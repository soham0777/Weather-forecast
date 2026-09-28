"""SOAP interface tests - raw XML over HTTP, plus a real SOAP client (zeep)."""

from decimal import Decimal

import pytest
from lxml import etree

from app.services import banking_service
from tests.conftest import DEMO_ACCOUNT, DEMO_BENEFICIARY

SOAP = "http://schemas.xmlsoap.org/soap/envelope/"
NDB = "http://bank.local/soap/corebanking/v1"
NS = {"soap": SOAP, "ndb": NDB}


def envelope(body: str, channel: str = "ATM", terminal: str = "ATM-PUNE-0042") -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="{SOAP}" xmlns:ndb="{NDB}">
  <soap:Header>
    <ndb:ConsumerInfo><ndb:channel>{channel}</ndb:channel><ndb:terminalId>{terminal}</ndb:terminalId></ndb:ConsumerInfo>
  </soap:Header>
  <soap:Body>{body}</soap:Body>
</soap:Envelope>"""


def call(client, operation: str, body: str, **kwargs):
    response = client.post("/soap", content=envelope(body, **kwargs), headers={
        "Content-Type": "text/xml; charset=utf-8", "SOAPAction": f'"{NDB}/{operation}"',
    })
    return response, etree.fromstring(response.content)


def text(tree, path: str) -> str:
    return tree.findtext(path, namespaces=NS)


def test_soap_get_balance(client):
    response, tree = call(client, "getBalance",
                          f"<ndb:getBalance><ndb:accountNumber>{DEMO_ACCOUNT}</ndb:accountNumber></ndb:getBalance>")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/xml")
    result = ".//ndb:getBalanceResponse/ndb:"
    assert text(tree, result + "accountNumber") == DEMO_ACCOUNT
    assert text(tree, result + "availableBalance") == "45230.75"
    assert text(tree, result + "ledgerBalance") == "47230.75"
    assert text(tree, result + "currency") == "INR"


def test_soap_get_mini_statement(client):
    response, tree = call(client, "getMiniStatement",
                          f"<ndb:getMiniStatement><ndb:accountNumber>{DEMO_ACCOUNT}</ndb:accountNumber>"
                          "<ndb:maxEntries>5</ndb:maxEntries></ndb:getMiniStatement>")
    assert response.status_code == 200
    assert text(tree, ".//ndb:entryCount") == "5"
    assert len(tree.findall(".//ndb:entry", NS)) == 5


def test_soap_transfer_uses_the_shared_banking_service(client, auth):
    response, tree = call(client, "transferFunds",
                          f"<ndb:transferFunds><ndb:fromAccount>{DEMO_ACCOUNT}</ndb:fromAccount>"
                          f"<ndb:toAccount>{DEMO_BENEFICIARY}</ndb:toAccount><ndb:amount>500.00</ndb:amount>"
                          "<ndb:remarks>ATM transfer</ndb:remarks></ndb:transferFunds>")
    assert response.status_code == 200
    assert text(tree, ".//ndb:transferId").startswith("TRX")
    assert text(tree, ".//ndb:status") == "COMPLETED"
    assert text(tree, ".//ndb:availableBalance") == "44730.75"

    # The REST API sees the SOAP transfer immediately: one shared service, one database.
    rest = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/balance", headers=auth).json()
    assert rest["availableBalance"] == "44730.75"
    latest = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions?limit=1", headers=auth).json()
    assert latest["transactions"][0]["description"].startswith("ATM-FT/")


def test_rest_and_soap_call_the_same_service_function(client, auth, monkeypatch):
    calls = []
    original = banking_service.get_balance

    def spy(db, account_number):
        calls.append(account_number)
        return original(db, account_number)

    monkeypatch.setattr(banking_service, "get_balance", spy)
    client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/balance", headers=auth)
    call(client, "getBalance", f"<ndb:getBalance><ndb:accountNumber>{DEMO_ACCOUNT}</ndb:accountNumber></ndb:getBalance>")
    assert calls == [DEMO_ACCOUNT, DEMO_ACCOUNT]


def test_soap_transfer_reference_id_is_idempotent(client):
    body = (f"<ndb:transferFunds><ndb:fromAccount>{DEMO_ACCOUNT}</ndb:fromAccount>"
            f"<ndb:toAccount>{DEMO_BENEFICIARY}</ndb:toAccount><ndb:amount>100.00</ndb:amount>"
            "<ndb:referenceId>RRN000000000777</ndb:referenceId></ndb:transferFunds>")
    _, first = call(client, "transferFunds", body)
    _, retry = call(client, "transferFunds", body)
    assert text(first, ".//ndb:transferId") == text(retry, ".//ndb:transferId")
    _, balance = call(client, "getBalance",
                      f"<ndb:getBalance><ndb:accountNumber>{DEMO_ACCOUNT}</ndb:accountNumber></ndb:getBalance>")
    assert text(balance, ".//ndb:availableBalance") == "45130.75"


@pytest.mark.parametrize("body, error_code", [
    ("<ndb:getBalance><ndb:accountNumber>0000000000</ndb:accountNumber></ndb:getBalance>", "ACCOUNT_NOT_FOUND"),
    (f"<ndb:transferFunds><ndb:fromAccount>{DEMO_ACCOUNT}</ndb:fromAccount><ndb:toAccount>{DEMO_BENEFICIARY}"
     "</ndb:toAccount><ndb:amount>9000000.00</ndb:amount></ndb:transferFunds>", "INSUFFICIENT_FUNDS"),
    (f"<ndb:transferFunds><ndb:fromAccount>{DEMO_ACCOUNT}</ndb:fromAccount><ndb:toAccount>{DEMO_BENEFICIARY}"
     "</ndb:toAccount><ndb:amount>-5</ndb:amount></ndb:transferFunds>", "INVALID_AMOUNT"),
    ("<ndb:getBalance/>", "INVALID_REQUEST"),
    ("<ndb:closeAccount/>", "UNKNOWN_OPERATION"),
])
def test_soap_errors_are_soap_faults(client, body, error_code):
    response = client.post("/soap", content=envelope(body), headers={"Content-Type": "text/xml"})
    assert response.status_code == 500  # SOAP 1.1: every fault is HTTP 500 ...
    tree = etree.fromstring(response.content)
    assert tree.findtext(".//faultcode") == "soap:Client"  # ... the real reason is inside the XML
    assert text(tree, ".//ndb:BankingFault/ndb:errorCode") == error_code


def test_soap_malformed_xml_and_version_mismatch(client):
    malformed = client.post("/soap", content="<soap:Envelope><unclosed>", headers={"Content-Type": "text/xml"})
    assert malformed.status_code == 500
    assert "MALFORMED_XML" in malformed.text

    soap12 = client.post("/soap", content='<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">'
                                         "<env:Body/></env:Envelope>", headers={"Content-Type": "text/xml"})
    assert etree.fromstring(soap12.content).findtext(".//faultcode") == "soap:VersionMismatch"


def test_soap_rejects_external_entities(client):
    xxe = ('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>'
           + envelope("<ndb:getBalance><ndb:accountNumber>&e;</ndb:accountNumber></ndb:getBalance>")
           .split("?>", 1)[1])
    response = client.post("/soap", content=xxe, headers={"Content-Type": "text/xml"})
    assert response.status_code == 500
    assert "root:" not in response.text


def test_soap_simulated_server_fault(client):
    response = client.post("/soap", content=envelope(
        f"<ndb:getBalance><ndb:accountNumber>{DEMO_ACCOUNT}</ndb:accountNumber></ndb:getBalance>"),
        headers={"Content-Type": "text/xml", "X-Demo-Simulate": "503"})
    assert response.status_code == 500
    assert etree.fromstring(response.content).findtext(".//faultcode") == "soap:Server"


def test_soap_calls_are_logged_with_operation_and_consumer(client):
    client.delete("/api/v1/logs")
    call(client, "getBalance", f"<ndb:getBalance><ndb:accountNumber>{DEMO_ACCOUNT}</ndb:accountNumber></ndb:getBalance>",
         channel="BRANCH", terminal="BR-MUM-0101")
    item = client.get("/api/v1/logs?interface=SOAP").json()["items"][0]
    assert item["method"] == "getBalance"
    assert item["endpoint"] == "/soap"
    assert item["statusCode"] == 200
    assert item["consumer"] == "Branch Software (BR-MUM-0101)"


def test_wsdl_is_served(client):
    response = client.get("/soap?wsdl")
    assert response.status_code == 200
    wsdl = etree.fromstring(response.content)
    operations = {op.get("name") for op in wsdl.findall(".//{http://schemas.xmlsoap.org/wsdl/}portType/"
                                                        "{http://schemas.xmlsoap.org/wsdl/}operation")}
    assert operations == {"getBalance", "getMiniStatement", "transferFunds"}


def test_zeep_soap_client_interoperability(live_server):
    """An independent SOAP client generated from our WSDL can call every operation."""
    zeep = pytest.importorskip("zeep")
    from requests import Session
    from zeep.exceptions import Fault
    from zeep.transports import Transport

    session = Session()
    session.trust_env = False  # talk to the local server directly, ignoring any HTTP proxy
    soap_client = zeep.Client(f"{live_server}/soap?wsdl", transport=Transport(session=session))
    header = {"ConsumerInfo": {"channel": "ATM", "terminalId": "ATM-PUNE-0042"}}

    balance = soap_client.service.getBalance(accountNumber=DEMO_ACCOUNT, _soapheaders=header)
    assert balance.availableBalance == Decimal("45230.75")

    statement = soap_client.service.getMiniStatement(accountNumber=DEMO_ACCOUNT, maxEntries=3)
    assert statement.entryCount == 3

    result = soap_client.service.transferFunds(fromAccount=DEMO_ACCOUNT, toAccount=DEMO_BENEFICIARY,
                                               amount=Decimal("500.00"), _soapheaders=header)
    assert result.status == "COMPLETED"
    assert result.availableBalance == Decimal("44730.75")

    with pytest.raises(Fault) as fault:
        soap_client.service.getBalance(accountNumber="0000000000")
    assert fault.value.code == "soap:Client"
