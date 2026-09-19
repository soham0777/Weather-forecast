from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .api import scan, jobs, optimization, export

app = FastAPI(
    title="Bansali SmartNest API",
    description="Vision-Based Intelligent Laser Cutting & Material Optimization Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan.router, prefix="/api", tags=["scan"])
app.include_router(jobs.router, prefix="/api", tags=["jobs"])
app.include_router(optimization.router, prefix="/api", tags=["optimization"])
app.include_router(export.router, prefix="/api", tags=["export"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Bansali SmartNest", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "Bansali SmartNest API — SEE. MEASURE. OPTIMIZE. CUT."}
