"""
Test fixtures.

The test run uses its own temporary SQLite file, so it never touches the
demo database (backend/bank.db). Every test starts from freshly seeded data.
"""

import os
import socket
import tempfile
import threading
import time

# Must be set before the app is imported (settings are read at import time).
_TMP_DIR = tempfile.mkdtemp(prefix="ndb-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP_DIR, 'test_bank.db')}"
os.environ["RATE_LIMIT_REQUESTS"] = "1000"
os.environ["NEFT_SETTLEMENT_SECONDS"] = "20"

import pytest  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed_data import reset_demo_data  # noqa: E402
from app.utils.rate_limiter import rate_limiter  # noqa: E402

DEMO_ACCOUNT = "1234567890"
DEMO_BENEFICIARY = "9876543210"
DORMANT_ACCOUNT = "1122334455"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def fresh_data():
    reset_demo_data()
    rate_limiter.reset()
    yield


def get_token(client, client_id="ndb-mobile-app", client_secret="demo-mobile-secret", scope=None) -> str:
    data = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}
    if scope:
        data["scope"] = scope
    response = client.post("/api/v1/oauth/token", data=data)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def auth(client) -> dict:
    """Authorization header for the (full-scope) demo mobile app."""
    return {"Authorization": f"Bearer {get_token(client)}"}


@pytest.fixture(scope="session")
def live_server():
    """A real uvicorn server on a free port - used by the zeep SOAP client test."""
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 10
    while not server.started and time.time() < deadline:
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)
