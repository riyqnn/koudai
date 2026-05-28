from __future__ import annotations

import pytest

from koudai.exceptions.agent import AgentStateError, PriceFeedError
from koudai.exceptions.base import KoudaiError


class TestAgentStateError:

    def test_error_code(self) -> None:
        assert AgentStateError("IDLE", "CONFIRMED").code == "AGENT_STATE_ERROR"

    def test_states_are_stored(self) -> None:
        exc = AgentStateError("PARSING", "EXECUTING")
        assert exc.from_state == "PARSING"
        assert exc.to_state == "EXECUTING"

    def test_message_contains_both_states(self) -> None:
        exc = AgentStateError("IDLE", "CONFIRMED")
        assert "IDLE" in exc.message
        assert "CONFIRMED" in exc.message

    def test_is_koudai_error(self) -> None:
        assert isinstance(AgentStateError("A", "B"), KoudaiError)

    def test_catchable_as_base(self) -> None:
        with pytest.raises(KoudaiError):
            raise AgentStateError("IDLE", "EXECUTING")


class TestPriceFeedError:

    def test_error_code(self) -> None:
        assert PriceFeedError("no data").code == "PRICE_FEED_ERROR"

    def test_market_id_stored(self) -> None:
        assert PriceFeedError("timeout", market_id="INJ/USDT").market_id == "INJ/USDT"

    def test_market_id_defaults_to_none(self) -> None:
        assert PriceFeedError("feed unavailable").market_id is None

    def test_is_koudai_error(self) -> None:
        assert isinstance(PriceFeedError("x"), KoudaiError)