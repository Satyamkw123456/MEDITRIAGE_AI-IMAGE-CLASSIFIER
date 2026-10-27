from __future__ import annotations

import time
from enum import Enum
from threading import Lock
from typing import Optional


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """
    Thread-safe circuit breaker preventing cascading failures when external LLM is down.
    Transitions:
    CLOSED -> OPEN (after N consecutive failures)
    OPEN -> HALF_OPEN (after cooldown period has elapsed)
    HALF_OPEN -> CLOSED (on successful probe)
    HALF_OPEN -> OPEN (on probe failure)
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        cooldown_seconds: float = 30.0,
    ):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self._lock = Lock()

    def can_execute(self) -> bool:
        """Determines whether a call should be attempted or failed fast."""
        with self._lock:
            now = time.time()
            if self.state == CircuitState.CLOSED:
                return True

            if self.state == CircuitState.OPEN:
                if self.last_failure_time and (now - self.last_failure_time >= self.cooldown_seconds):
                    self.state = CircuitState.HALF_OPEN
                    return True
                return False

            if self.state == CircuitState.HALF_OPEN:
                return True

            return False

    def record_success(self) -> None:
        """Records a successful call and closes the circuit."""
        with self._lock:
            self.failure_count = 0
            self.state = CircuitState.CLOSED
            self.last_failure_time = None

    def record_failure(self) -> None:
        """Records a failure and trips the circuit open if threshold exceeded."""
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.state == CircuitState.HALF_OPEN or self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN

    def reset(self) -> None:
        """Manually resets circuit breaker to CLOSED."""
        with self._lock:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.last_failure_time = None
