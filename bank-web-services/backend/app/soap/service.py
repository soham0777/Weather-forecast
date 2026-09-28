"""
Legacy SOAP 1.1 endpoint:  POST /soap   (contract: GET /soap?wsdl)

SOAP is operation-oriented: every call is an HTTP POST to ONE URL, and the
XML body names the operation to run (getBalance, getMiniStatement,
transferFunds). Errors are returned as a SOAP Fault inside the XML body with
HTTP status 500, as the SOAP 1.1 specification requires.

This module contains NO banking rules. Each operation:
    1. reads its parameters from the XML request,
    2. calls the SAME ``banking_service`` function the REST API calls,
    3. writes the result back as XML.

It is implemented directly with lxml (instead of a framework such as Spyne,
whose latest release does not import on Python 3.12+), which also keeps every
step of SOAP processing visible for learning. Interoperability is verified in
the test-suite with ``zeep``, an independent SOAP client library.
"""

import asyncio
from collections.abc import Callable
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import PlainTextResponse, Response
from lxml import etree
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services import banking_service
from app.services.banking_service import BankingError, InvalidRequestError, TransferCommand
from app.soap.wsdl import NDB_NS, render_wsdl

router = APIRouter(tags=["SOAP"])

SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"
SOAP12_NS = "http://www.w3.org/2003/05/soap-envelope"
NSMAP = {"soap": SOAP_NS, "ndb": NDB_NS}
SOAP_CONTENT_TYPE = "text/xml; charset=utf-8"
MAX_REQUEST_BYTES = 64 * 1024
CONSUMER_NAMES = {"ATM": "ATM Switch", "BRANCH": "Branch Software"}

# Hardened parser: no DTDs, no external entities, no network access (prevents XXE attacks).
_PARSER = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False,
                          remove_blank_text=True, huge_tree=False)


class SoapClientFault(Exception):
    """A problem with the SOAP message itself (malformed XML, unknown operation...)."""

    def __init__(self, code: str, message: str, faultcode: str = "soap:Client"):
        self.code = code
        self.message = message
        self.faultcode = faultcode
        super().__init__(message)


# ---------------------------------------------------------------------------
# XML helpers
# ---------------------------------------------------------------------------

def _q(namespace: str, name: str) -> str:
    return f"{{{namespace}}}{name}"


def _new_envelope() -> tuple[etree._Element, etree._Element]:
    envelope = etree.Element(_q(SOAP_NS, "Envelope"), nsmap=NSMAP)
    body = etree.SubElement(envelope, _q(SOAP_NS, "Body"))
    return envelope, body


def _add(parent: etree._Element, name: str, value=None) -> etree._Element:
    element = etree.SubElement(parent, _q(NDB_NS, name))
    if value is not None:
        element.text = value.isoformat(timespec="seconds") if isinstance(value, datetime) else str(value)
    return element


def _serialize(envelope: etree._Element) -> bytes:
    return etree.tostring(envelope, xml_declaration=True, encoding="utf-8", pretty_print=True)


def _field(request: etree._Element, name: str, required: bool = True) -> str | None:
    element = request.find(_q(NDB_NS, name))
    value = element.text.strip() if element is not None and element.text else None
    if required and not value:
        raise InvalidRequestError(f"<{name}> is required.")
    return value


def soap_fault_response(faultcode: str, faultstring: str, error_code: str, message: str,
                        request_id: str | None) -> Response:
    """SOAP 1.1 Fault. faultcode/faultstring/detail are deliberately unqualified."""
    envelope, body = _new_envelope()
    fault = etree.SubElement(body, _q(SOAP_NS, "Fault"))
    etree.SubElement(fault, "faultcode").text = faultcode
    etree.SubElement(fault, "faultstring").text = faultstring
    detail = etree.SubElement(fault, "detail")
    banking_fault = _add(detail, "BankingFault")
    _add(banking_fault, "errorCode", error_code)
    _add(banking_fault, "errorMessage", message)
    if request_id:
        _add(banking_fault, "requestId", request_id)
    return Response(_serialize(envelope), status_code=500, media_type=SOAP_CONTENT_TYPE)


# ---------------------------------------------------------------------------
# Operations - thin adapters over banking_service
# ---------------------------------------------------------------------------

def _op_get_balance(db: Session, request: etree._Element, channel: str) -> bytes:
    info = banking_service.get_balance(db, _field(request, "accountNumber"))  # shared business logic

    envelope, body = _new_envelope()
    response = _add(body, "getBalanceResponse")
    _add(response, "accountNumber", info.account_number)
    _add(response, "customerName", info.customer_name)
    _add(response, "availableBalance", f"{info.available_balance:.2f}")
    _add(response, "ledgerBalance", f"{info.ledger_balance:.2f}")
    _add(response, "currency", info.currency)
    _add(response, "asOf", info.as_of)
    return _serialize(envelope)


def _op_get_mini_statement(db: Session, request: etree._Element, channel: str) -> bytes:
    raw_max = _field(request, "maxEntries", required=False)
    try:
        max_entries = int(raw_max) if raw_max else 10
    except ValueError:
        raise InvalidRequestError("<maxEntries> must be a whole number.")
    statement = banking_service.get_mini_statement(db, _field(request, "accountNumber"), limit=max_entries)

    envelope, body = _new_envelope()
    response = _add(body, "getMiniStatementResponse")
    _add(response, "accountNumber", statement.account_number)
    _add(response, "currency", statement.currency)
    _add(response, "availableBalance", f"{statement.available_balance:.2f}")
    _add(response, "entryCount", len(statement.entries))
    entries = _add(response, "entries")
    for e in statement.entries:
        entry = _add(entries, "entry")
        _add(entry, "transactionId", e.transaction_id)
        _add(entry, "date", e.posted_at.date().isoformat())
        _add(entry, "type", e.type)
        _add(entry, "amount", f"{e.amount:.2f}")
        _add(entry, "description", e.description)
        _add(entry, "balanceAfter", f"{e.balance_after:.2f}")
    return _serialize(envelope)


def _op_transfer_funds(db: Session, request: etree._Element, channel: str) -> bytes:
    reference = _field(request, "referenceId", required=False)
    result = banking_service.transfer_funds(db, TransferCommand(
        from_account=_field(request, "fromAccount"),
        to_account=_field(request, "toAccount"),
        amount=_field(request, "amount"),
        currency=_field(request, "currency", required=False) or "INR",
        mode=_field(request, "mode", required=False) or "INTERNAL",
        remarks=_field(request, "remarks", required=False),
        channel=channel,
        # ATM switches retry with the same retrieval reference number (RRN);
        # it acts as the idempotency key, exactly like REST's Idempotency-Key.
        idempotency_key=f"SOAP:{reference}" if reference else None,
    ))

    envelope, body = _new_envelope()
    response = _add(body, "transferFundsResponse")
    _add(response, "transferId", result.transfer_id)
    _add(response, "status", result.status)
    _add(response, "fromAccount", result.from_account)
    _add(response, "toAccount", result.to_account)
    _add(response, "amount", f"{result.amount:.2f}")
    _add(response, "currency", result.currency)
    _add(response, "mode", result.mode)
    _add(response, "availableBalance", f"{result.source_balance_after:.2f}")
    _add(response, "timestamp", result.created_at)
    return _serialize(envelope)


OPERATIONS: dict[str, Callable[[Session, etree._Element, str], bytes]] = {
    "getBalance": _op_get_balance,
    "getMiniStatement": _op_get_mini_statement,
    "transferFunds": _op_transfer_funds,
}


def _run_operation(operation: str, request: etree._Element, channel: str) -> bytes:
    with SessionLocal() as db:
        return OPERATIONS[operation](db, request, channel)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/soap", include_in_schema=False)
async def soap_info(request: Request):
    if "wsdl" in {key.lower() for key in request.query_params.keys()}:
        address = str(request.base_url).rstrip("/") + "/soap"
        return Response(render_wsdl(address), media_type=SOAP_CONTENT_TYPE)
    return PlainTextResponse(
        "National Digital Bank - legacy Core Banking SOAP 1.1 service (EDUCATIONAL SIMULATOR).\n"
        "POST SOAP envelopes to this URL. Operations: getBalance, getMiniStatement, transferFunds.\n"
        "WSDL: /soap?wsdl\n"
    )


@router.post("/soap", include_in_schema=False)
async def soap_endpoint(request: Request) -> Response:
    request_id = getattr(request.state, "request_id", None)
    try:
        raw = await request.body()
        if len(raw) > MAX_REQUEST_BYTES:
            raise SoapClientFault("REQUEST_TOO_LARGE", "SOAP request exceeds 64 KB.")
        try:
            envelope = etree.fromstring(raw, _PARSER)
        except etree.XMLSyntaxError as exc:
            raise SoapClientFault("MALFORMED_XML", f"Request is not well-formed XML: {exc.msg}")

        if envelope.tag == _q(SOAP12_NS, "Envelope"):
            raise SoapClientFault("VERSION_MISMATCH", "Only SOAP 1.1 envelopes are supported.",
                                  faultcode="soap:VersionMismatch")
        if envelope.tag != _q(SOAP_NS, "Envelope"):
            raise SoapClientFault("NOT_A_SOAP_ENVELOPE", "Root element must be soap:Envelope (SOAP 1.1).")

        body = envelope.find(_q(SOAP_NS, "Body"))
        request_element = next((child for child in body if isinstance(child.tag, str)), None) \
            if body is not None else None
        if request_element is None:
            raise SoapClientFault("EMPTY_BODY", "soap:Body must contain exactly one operation element.")

        qname = etree.QName(request_element)
        operation = qname.localname
        request.state.soap_operation = operation
        if qname.namespace != NDB_NS or operation not in OPERATIONS:
            raise SoapClientFault("UNKNOWN_OPERATION",
                                  f"Unknown operation '{operation}'. Supported: {', '.join(OPERATIONS)}.")

        soap_action = request.headers.get("SOAPAction", "").strip().strip('"')
        if soap_action and soap_action.rsplit("/", 1)[-1] != operation:
            raise SoapClientFault("SOAPACTION_MISMATCH",
                                  f"SOAPAction '{soap_action}' does not match body operation '{operation}'.")

        # Optional SOAP header: which legacy consumer is calling?
        channel_code, terminal = None, None
        consumer_info = envelope.find(f"{_q(SOAP_NS, 'Header')}/{_q(NDB_NS, 'ConsumerInfo')}")
        if consumer_info is not None:
            channel_code = (_field(consumer_info, "channel", required=False) or "").upper() or None
            terminal = _field(consumer_info, "terminalId", required=False)
        consumer = CONSUMER_NAMES.get(channel_code, "Unidentified SOAP client")
        request.state.consumer = f"{consumer} ({terminal})" if terminal else consumer
        channel = f"SOAP/{channel_code}" if channel_code in CONSUMER_NAMES else "SOAP"

        # DEMO ONLY: simulated core-banking outage.
        simulate = request.headers.get("X-Demo-Simulate", "").strip()
        if simulate in {"500", "503", "504"}:
            if simulate == "504":
                await asyncio.sleep(1.5)
            messages = {
                "500": "Unexpected error in the core banking host (simulated).",
                "503": "Core banking host is unavailable - maintenance window (simulated).",
                "504": "Core banking host did not respond in time (simulated).",
            }
            return soap_fault_response("soap:Server", "Core banking system error", "HOST_UNAVAILABLE",
                                       messages[simulate], request_id)

        xml = await run_in_threadpool(_run_operation, operation, request_element, channel)
        return Response(xml, media_type=SOAP_CONTENT_TYPE)

    except SoapClientFault as fault:
        return soap_fault_response(fault.faultcode, fault.message, fault.code, fault.message, request_id)
    except BankingError as exc:
        # Same business error as REST - only the representation differs.
        return soap_fault_response("soap:Client", exc.message, exc.code, exc.message, request_id)
