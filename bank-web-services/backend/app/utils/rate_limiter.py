"""
A tiny in-memory sliding-window rate limiter (per API client).

Each client may make ``limit`` requests in any rolling ``window`` seconds.
Request number ``limit + 1`` receives ``429 Too Many Requests`` with a
``Retry-After`` header telling the client how long to wait.

In production this state would live in a shared store (or an API gateway)
so that every server instance sees the same counters; for a single-process
classroom demo, a dictionary is enough.
"""

import math
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from app.config import settings


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int  # seconds until the next request would be allowed (0 if allowed)
    window: int


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> RateLimitResult:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry_after = max(1, math.ceil(hits[0] + self.window - now))
                return RateLimitResult(False, self.limit, 0, retry_after, self.window)
            hits.append(now)
            return RateLimitResult(True, self.limit, self.limit - len(hits), 0, self.window)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


rate_limiter = SlidingWindowRateLimiter(settings.rate_limit_requests, settings.rate_limit_window_seconds)
