"""
Logging: console logs for every request + the ``api_logs`` table.

``ApiLoggingMiddleware`` is plain ASGI middleware wrapped around the whole
application. For every HTTP request it:
  * assigns a request ID (returned in the ``X-Request-ID`` header),
  * measures the duration (``X-Process-Time-Ms`` header),
  * prints ``timestamp method path status duration`` to the console,
  * stores REST/SOAP banking calls in the ``api_logs`` table (shown on the
    UI's API Logs page),
  * turns any unexpected exception into a generic 500 response, so no stack
    trace ever reaches the client (the trace is logged server-side only).
"""

import logging
import time
import uuid

import anyio
from sqlalchemy import delete, func, select
from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger("ndb.api")

MAX_SUMMARY = 4000
MAX_LOG_ROWS = 2000
LOGGED_REQUEST_HEADERS = ("idempotency-key", "x-demo-simulate", "soapaction")


def configure_logging() -> None:
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    )


def classify(method: str, path: str) -> str | None:
    """Which calls count as banking API traffic for the api_logs table."""
    if path.startswith(("/api/v1/accounts/", "/api/v1/transfers/")):
        return "REST"
    if path.rstrip("/") == "/soap" and method == "POST":
        return "SOAP"
    return None


def _truncate(text: str) -> str:
    return text if len(text) <= MAX_SUMMARY else text[:MAX_SUMMARY] + "... [truncated]"


def _persist(entry: dict) -> None:
    from app.database import SessionLocal
    from app.models import ApiLog

    try:
        with SessionLocal() as db:
            db.add(ApiLog(**entry))
            db.commit()
            newest = db.scalar(select(func.max(ApiLog.id))) or 0
            if newest % 100 == 0:  # occasional pruning keeps the table small
                db.execute(delete(ApiLog).where(ApiLog.id <= newest - MAX_LOG_ROWS))
                db.commit()
    except Exception:  # logging must never break a request
        logger.warning("Could not store API log entry", exc_info=True)


class ApiLoggingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex[:12]
        state = scope.setdefault("state", {})
        state["request_id"] = request_id
        method, path = scope["method"], scope["path"]
        interface = classify(method, path)
        started = time.perf_counter()
        request_body = bytearray()
        response_body = bytearray()
        response_status = {"code": 500, "started": False}

        async def receive_wrapper():
            message = await receive()
            if interface and message["type"] == "http.request":
                request_body.extend(message.get("body", b""))
            return message

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                response_status["code"] = message["status"]
                response_status["started"] = True
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                headers["X-Process-Time-Ms"] = str(round((time.perf_counter() - started) * 1000))
            elif message["type"] == "http.response.body" and interface:
                response_body.extend(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive_wrapper, send_wrapper)
        except Exception as exc:
            from app.api.deps import SimulatedServerError

            if isinstance(exc, SimulatedServerError):
                logger.error("Simulated server error (X-Demo-Simulate: 500) request_id=%s", request_id)
            else:
                logger.exception("Unhandled error request_id=%s", request_id)
            if not response_status["started"]:
                if interface == "SOAP":
                    from app.soap.service import soap_fault_response

                    response = soap_fault_response("soap:Server", "Internal server error", "INTERNAL_ERROR",
                                                   "An unexpected error occurred.", request_id)
                else:
                    response = JSONResponse(
                        {
                            "type": "https://bank.local/errors/internal-error",
                            "title": "Internal server error",
                            "status": 500,
                            "detail": "An unexpected error occurred. Quote the requestId when contacting support.",
                            "code": "INTERNAL_ERROR",
                            "instance": path,
                            "requestId": request_id,
                        },
                        status_code=500,
                        media_type="application/problem+json",
                    )
                await response(scope, receive, send_wrapper)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000)
            logger.info("%s %s -> %s (%d ms)%s", method, path, response_status["code"], duration_ms,
                        f" [{interface}]" if interface else "")
            if interface:
                await anyio.to_thread.run_sync(_persist, self._entry(
                    scope, state, interface, method, path, response_status["code"], duration_ms,
                    bytes(request_body), bytes(response_body), request_id,
                ))

    @staticmethod
    def _entry(scope, state, interface, method, path, status, duration_ms, request_body, response_body,
               request_id) -> dict:
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        query = scope.get("query_string", b"").decode("latin-1")
        lines = [f"{name.title()}: {headers[name]}" for name in LOGGED_REQUEST_HEADERS
                 if name in headers and headers[name]]
        body_text = request_body.decode("utf-8", errors="replace").strip()
        if body_text:
            lines.append(body_text)
        return {
            "interface_type": interface,
            # REST logs the HTTP verb; SOAP logs the operation (always an HTTP POST).
            "method": state.get("soap_operation", "UNKNOWN") if interface == "SOAP" else method,
            "endpoint": path + (f"?{query}" if query else ""),
            "status_code": status,
            "request_summary": _truncate("\n".join(lines)) or None,
            "response_summary": _truncate(response_body.decode("utf-8", errors="replace").strip()) or None,
            "duration_ms": duration_ms,
            "consumer": state.get("consumer"),
            "request_id": request_id,
        }
