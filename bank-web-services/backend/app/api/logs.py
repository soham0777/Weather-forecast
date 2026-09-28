"""
API call log (REST and SOAP) for the simulator's Logs page.

``DELETE /api/v1/logs`` is also this project's example of
``204 No Content``: the action succeeded and there is nothing to return.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import Integer, case, delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ApiLog
from app.schemas import ApiLogItem, ApiLogList, ApiLogStats
from app.services.banking_service import to_ist

router = APIRouter(prefix="/api/v1/logs", tags=["API Logs"])

_STATUS_RANGES = {"2xx": (200, 299), "4xx": (400, 499), "5xx": (500, 599)}


@router.get("", response_model=ApiLogList, summary="Recent API calls")
def list_logs(
    db: Annotated[Session, Depends(get_db)],
    interface: Annotated[Literal["ALL", "REST", "SOAP"], Query()] = "ALL",
    status: Annotated[Literal["ALL", "2xx", "4xx", "5xx"], Query()] = "ALL",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> ApiLogList:
    query = select(ApiLog)
    if interface != "ALL":
        query = query.where(ApiLog.interface_type == interface)
    if status != "ALL":
        low, high = _STATUS_RANGES[status]
        query = query.where(ApiLog.status_code.between(low, high))
    rows = db.scalars(query.order_by(ApiLog.id.desc()).limit(limit)).all()

    def count_if(condition):
        return func.coalesce(func.sum(case((condition, 1), else_=0)), 0).cast(Integer)

    total, rest, soap, ok, client, server, avg = db.execute(select(
        func.count(ApiLog.id),
        count_if(ApiLog.interface_type == "REST"),
        count_if(ApiLog.interface_type == "SOAP"),
        count_if(ApiLog.status_code.between(200, 299)),
        count_if(ApiLog.status_code.between(400, 499)),
        count_if(ApiLog.status_code >= 500),
        func.avg(ApiLog.duration_ms),
    )).one()

    return ApiLogList(
        items=[
            ApiLogItem(
                id=r.id, timestamp=to_ist(r.timestamp).replace(microsecond=0), interface_type=r.interface_type,
                method=r.method, endpoint=r.endpoint, status_code=r.status_code, duration_ms=r.duration_ms,
                consumer=r.consumer, request_id=r.request_id,
                request_summary=r.request_summary, response_summary=r.response_summary,
            )
            for r in rows
        ],
        stats=ApiLogStats(total=total, rest=rest, soap=soap, success=ok, client_errors=client,
                          server_errors=server, average_duration_ms=round(float(avg or 0), 1)),
    )


@router.delete("", status_code=204, summary="Clear the API log (204 No Content)")
def clear_logs(db: Annotated[Session, Depends(get_db)]) -> Response:
    db.execute(delete(ApiLog))
    db.commit()
    return Response(status_code=204)
