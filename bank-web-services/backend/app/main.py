"""
National Digital Bank - Web Services Platform (EDUCATIONAL SIMULATOR).

One FastAPI application exposes two interfaces over one business layer:

    REST  /api/v1/...  (JSON)  -> mobile app, fintech partners, budgeting apps
    SOAP  /soap        (XML)   -> ATM switch, branch software (legacy)
                  both call  app/services/banking_service.py  -> SQLite

Interactive documentation:  /api-docs (Swagger UI)  and  /redoc (ReDoc)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import accounts, auth, demo, health, logs, transactions, transfers
from app.api.errors import register_exception_handlers
from app.config import settings
from app.seed_data import seed_if_empty
from app.soap import service as soap_service
from app.utils.logger import ApiLoggingMiddleware, configure_logging

DESCRIPTION = """
**EDUCATIONAL SIMULATOR - NOT A REAL BANKING SYSTEM.** All accounts and transactions are fictional demo data.
No real bank, NPCI, UPI, RBI or ATM network is contacted.

This REST API is the *modern* interface of a hybrid architecture. The same banking capabilities are also
exposed to legacy consumers (ATM switch, branch software) as a SOAP service at `/soap`
(contract: [`/soap?wsdl`](/soap?wsdl)). Both interfaces share one banking service layer.

### Try it
1. Click **Authorize**, keep the pre-filled DEMO credentials (`ndb-mobile-app` / `demo-mobile-secret`),
   tick the scopes and authorize.
2. Call `GET /api/v1/accounts/1234567890/balance`.

Demo account **1234567890**, demo beneficiary **9876543210** (demo data only).
"""

TAGS = [
    {"name": "Accounts", "description": "Balance enquiry"},
    {"name": "Transactions", "description": "Mini statement / transaction history"},
    {"name": "Transfers", "description": "Simulated fund transfers (IMPS / NEFT / RTGS / INTERNAL)"},
    {"name": "Demo Authentication", "description": "DEMO OAuth 2.0 client-credentials token endpoint"},
    {"name": "Health", "description": "Liveness and health checks"},
    {"name": "API Logs", "description": "Recorded REST and SOAP calls"},
    {"name": "Demo utilities", "description": "Simulator helpers - not part of a real bank API"},
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    seed_if_empty()  # the simulator works even if seed.py was not run yet
    yield


app = FastAPI(
    title="National Digital Bank - Web Services Platform",
    summary="SOAP + REST integration demonstrator (educational simulator)",
    description=DESCRIPTION,
    version=settings.version,
    docs_url="/api-docs",  # /docs is used by the React documentation page
    redoc_url="/redoc",
    openapi_tags=TAGS,
    lifespan=lifespan,
    swagger_ui_init_oauth={"clientId": "ndb-mobile-app", "clientSecret": "demo-mobile-secret"},
    swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
)

register_exception_handlers(app)

# Middleware added last runs first: CORS wraps everything, so even error
# responses carry the CORS headers the browser needs.
app.add_middleware(ApiLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # explicit list, never "*"
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Demo-Simulate", "SOAPAction"],
    expose_headers=["Location", "Retry-After", "Idempotent-Replayed", "X-Request-ID", "X-Process-Time-Ms",
                    "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Window", "WWW-Authenticate"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(transfers.router)
app.include_router(logs.router)
if settings.enable_demo_endpoints:
    app.include_router(demo.router)
app.include_router(soap_service.router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {
        "name": "National Digital Bank - Web Services Platform",
        "disclaimer": "EDUCATIONAL SIMULATOR - NOT A REAL BANKING SYSTEM",
        "rest": "/api/v1",
        "soap": "/soap",
        "wsdl": "/soap?wsdl",
        "swagger": "/api-docs",
        "redoc": "/redoc",
        "health": "/health",
    }


if __name__ == "__main__":  # python -m app.main  (uses API_HOST / API_PORT from .env)
    import uvicorn

    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port,
                reload=settings.environment == "development")
