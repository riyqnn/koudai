from __future__ import annotations

from koudai.exceptions.base import KoudaiError


class AgentStateError(KoudaiError):

    def __init__(self, from_state: str, to_state: str) -> None:
        message = f'Invalid state transition: {from_state!r} → {to_state!r}.'
        super().__init__(message, code='AGENT_STATE_ERROR')
        self.from_state = from_state
        self.to_state = to_state

class PriceFeedError(KoudaiError):

    def __init__(self, message: str, market_id: str | None=None) -> None:
        super().__init__(message, code='PRICE_FEED_ERROR')
        self.market_id = market_id
