"""Health endpoints - used by the UI's "System Operational" indicator."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import HealthResponse
from app.services.banking_service import IST

router = APIRouter(tags=["Health"])

DISCLAIMER = "EDUCATIONAL SIMULATOR - NOT A REAL BANKING SYSTEM"


@router.get("/health", summary="Liveness probe")
def health() -> dict:
    return {"status": "UP"}


@router.get(
    "/api/v1/health",
    response_model=HealthResponse,
    summary="Detailed health check",
    responses={503: {"description": "Service Unavailable - the database is not reachable"}},
)
def api_health(response: Response, db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        database = "UP"
    except Exception:  # never leak database error details
        database = "DOWN"
    status = "UP" if database == "UP" else "DOWN"
    if status != "UP":
        response.status_code = 503
    return HealthResponse(
        status=status,
        service="National Digital Bank - Web Services Platform",
        version=settings.version,
        environment=settings.environment,
        timestamp=datetime.now(IST).replace(microsecond=0),
        components={"restApi": "UP", "soapService": "UP", "bankingService": status, "database": database},
        disclaimer=DISCLAIMER,
    )
