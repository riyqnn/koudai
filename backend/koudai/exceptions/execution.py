from __future__ import annotations

from koudai.exceptions.base import KoudaiError


class InjectiveConnectionError(KoudaiError):

    def __init__(self, message: str) -> None:
        super().__init__(message, code='INJECTIVE_CONNECTION_ERROR')

class OrderExecutionError(KoudaiError):

    def __init__(self, message: str, tx_hash: str | None=None) -> None:
        super().__init__(message, code='ORDER_EXECUTION_ERROR')
        self.tx_hash = tx_hash

class InsufficientBalanceError(KoudaiError):

    def __init__(self, required: float, available: float, denom: str='INJ') -> None:
        message = f'Insufficient {denom}: required {required:.6f}, available {available:.6f}.'
        super().__init__(message, code='INSUFFICIENT_BALANCE')
        self.required = required
        self.available = available
        self.denom = denom

class OrderLimitExceededError(KoudaiError):

    def __init__(self, order_usd: float, limit_usd: float) -> None:
        message = f'Order ${order_usd:.2f} exceeds limit ${limit_usd:.2f}. Raise AGENT_MAX_ORDER_USD or split the order.'
        super().__init__(message, code='ORDER_LIMIT_EXCEEDED')
        self.order_usd = order_usd
        self.limit_usd = limit_usd
