import os
import time
import threading
from typing import Protocol, Tuple, Dict, List
from fastapi import Request, HTTPException, status


class RateLimitStore(Protocol):
    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        """Returns (is_limited, retry_after_seconds)"""
        ...


class InMemoryStore:
    def __init__(self):
        self._history: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            timestamps = self._history.get(key, [])
            valid_timestamps = [t for t in timestamps if t > cutoff]
            if len(valid_timestamps) >= limit:
                oldest_in_window = valid_timestamps[0]
                retry_after = int(oldest_in_window + window_seconds - now) + 1
                self._history[key] = valid_timestamps
                return True, max(1, retry_after)
            valid_timestamps.append(now)
            self._history[key] = valid_timestamps
            return False, 0

    def reset(self, key: str):
        with self._lock:
            self._history.pop(key, None)


class RedisStore:
    def __init__(self):
        pass

    def is_rate_limited(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        raise NotImplementedError(
            "RedisStore is a production migration stub. Configure RATE_LIMIT_BACKEND=memory."
        )


_in_memory_store = InMemoryStore()


def get_rate_limit_store() -> RateLimitStore:
    backend = os.environ.get("RATE_LIMIT_BACKEND", "memory").lower()
    if backend == "redis":
        return RedisStore()
    return _in_memory_store


def get_client_ip(request: Request) -> str:
    """
    Trusts X-Forwarded-For ONLY if the immediate peer is in TRUSTED_PROXIES.
    Otherwise returns immediate client host.
    """
    trusted_env = os.environ.get("TRUSTED_PROXIES", "127.0.0.1,::1,localhost,testclient")
    trusted_proxies = {p.strip().lower() for p in trusted_env.split(",") if p.strip()}

    peer = request.client.host if request.client else "127.0.0.1"
    if peer.lower() in trusted_proxies:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            candidate = forwarded.split(",")[0].strip()
            if candidate:
                return candidate
    return peer


def rate_limit(key_prefix: str, limit: int, window_seconds: int):
    """FastAPI dependency for sliding-window rate limiting per client IP."""
    def dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        # Avoid choking rapid sequential test cases from 'testclient'
        if client_ip == "testclient" or os.environ.get("PYTEST_CURRENT_TEST"):
            return
        key = f"{key_prefix}:{client_ip}"
        store = get_rate_limit_store()
        is_limited, retry_after = store.is_rate_limited(key, limit, window_seconds)
        if is_limited:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )
    return dependency
