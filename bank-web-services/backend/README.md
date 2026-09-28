# Backend — FastAPI (REST + SOAP)

> EDUCATIONAL SIMULATOR — NOT A REAL BANKING SYSTEM. See the [project README](../README.md) for the full picture.

## Quick start

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows   (macOS/Linux: source venv/bin/activate)
                                 # Windows alternative without activation: .\venv\Scripts\python.exe -m pip ...  (see main README)
pip install -r requirements.txt
python seed.py                   # create bank.db with fictional demo data (safe to re-run; --reset to restore)
uvicorn app.main:app --reload --port 8000
```

Alternatively `python -m app.main` starts Uvicorn using `API_HOST` / `API_PORT` from `.env`.

| URL | What |
|---|---|
| http://localhost:8000/api-docs | Swagger UI (click **Authorize** - DEMO credentials are pre-filled) |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/soap?wsdl | WSDL of the SOAP service |
| http://localhost:8000/health | liveness |

## Tests

```bash
pytest            # 58 tests, uses a temporary database (bank.db is never touched)
```

## Layout

```
app/
  main.py                    FastAPI app: middleware, routers, /api-docs, /redoc
  services/banking_service.py  ★ all banking rules - called by REST and SOAP
  api/                       REST routers + request pipeline (deps.py) + problem-details errors (errors.py)
  soap/                      SOAP 1.1 endpoint (service.py) + WSDL (wsdl.py)
  utils/                     logging middleware, DEMO OAuth/JWT, rate limiter
  database.py models.py schemas.py config.py seed_data.py
tests/                       pytest suite (REST, SOAP, zeep interoperability, platform concerns)
```

## Configuration (`.env`, all optional)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./bank.db` | relative paths resolve to this folder |
| `FRONTEND_URL` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allow-list (never `*`) |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `8000` | used by `python -m app.main` |
| `ENVIRONMENT` | `development` | shown in `/api/v1/health` |
| `DEMO_JWT_SECRET` | demo value | signs DEMO tokens |
| `TOKEN_TTL_SECONDS` | `3600` | token lifetime |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | `30` / `60` | per-client rate limit |
| `NEFT_SETTLEMENT_SECONDS` | `20` | simulated NEFT batch delay |
| `ENABLE_DEMO_ENDPOINTS` | `true` | `/api/v1/demo/*` helpers |
| `LOG_LEVEL` | `INFO` | console log level |
