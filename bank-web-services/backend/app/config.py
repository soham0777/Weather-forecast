"""
Application configuration.

Values are read from environment variables (optionally loaded from a local
``.env`` file). Every default is safe for local, educational use only.
Nothing here is a real credential.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# A local .env file is optional; real environment variables always win.
load_dotenv(BACKEND_DIR / ".env", override=False)


def _resolve_sqlite_url(url: str) -> str:
    """Make relative SQLite paths relative to the backend folder.

    ``sqlite:///./bank.db`` would otherwise depend on the directory uvicorn
    happens to be started from, which is a classic source of "my data
    disappeared" confusion.
    """
    prefix = "sqlite:///"
    if url.startswith(prefix) and not url.startswith(prefix + "/") and ":memory:" not in url:
        relative = url[len(prefix):]
        return prefix + str((BACKEND_DIR / relative).resolve())
    return url


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "National Digital Bank - Web Services Platform"
    version: str = "1.0.0"
    environment: str = os.getenv("ENVIRONMENT", "development")

    database_url: str = _resolve_sqlite_url(os.getenv("DATABASE_URL", "sqlite:///./bank.db"))

    api_host: str = os.getenv("API_HOST", "127.0.0.1")
    api_port: int = int(os.getenv("API_PORT", "8000"))

    # CORS: explicit origins only (never "*").
    cors_origins: list[str] = field(
        default_factory=lambda: _csv(
            os.getenv("FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )

    # DEMO AUTHENTICATION - this key only signs tokens for the local simulator.
    demo_jwt_secret: str = os.getenv("DEMO_JWT_SECRET", "demo-only-signing-key-not-a-real-secret")
    token_ttl_seconds: int = int(os.getenv("TOKEN_TTL_SECONDS", "3600"))

    # In-memory rate limiter (per API client).
    rate_limit_requests: int = int(os.getenv("RATE_LIMIT_REQUESTS", "30"))
    rate_limit_window_seconds: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

    # NEFT transfers settle in batches; the simulator settles them after this delay.
    neft_settlement_seconds: int = int(os.getenv("NEFT_SETTLEMENT_SECONDS", "20"))

    # Demo-only helper endpoints (reset data, list demo accounts, ...).
    enable_demo_endpoints: bool = os.getenv("ENABLE_DEMO_ENDPOINTS", "true").lower() == "true"

    log_level: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()
