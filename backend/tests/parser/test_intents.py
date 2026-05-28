from __future__ import annotations

from typing import Any

import pytest

from koudai.parser.intents import LLMResponse, TradingIntent


class TestTradingIntent:

    def _make(self, **kwargs: Any) -> TradingIntent:
        defaults: dict[str, Any] = {
            "action": "buy",
            "token": "INJ",
            "amount": 10.0,
        }
        return TradingIntent(**{**defaults, **kwargs})

    def test_valid_buy_intent(self) -> None:
        intent = self._make()
        assert intent.action == "buy"
        assert intent.token == "INJ"
        assert intent.amount == 10.0
        assert intent.order_type == "market"
        assert intent.confidence == 1.0

    def test_valid_sell_limit_intent(self) -> None:
        intent = self._make(action="sell", order_type="limit", price=25.5, confidence=0.9)
        assert intent.action == "sell"
        assert intent.price == 25.5

    def test_negative_amount_raises(self) -> None:
        with pytest.raises(Exception, match="Amount must be positive"):
            self._make(amount=-1.0)

    def test_zero_amount_raises(self) -> None:
        with pytest.raises(Exception, match="Amount must be positive"):
            self._make(amount=0.0)

    def test_confidence_above_one_raises(self) -> None:
        with pytest.raises(Exception, match="Confidence must be between"):
            self._make(confidence=1.1)

    def test_confidence_below_zero_raises(self) -> None:
        with pytest.raises(Exception, match="Confidence must be between"):
            self._make(confidence=-0.1)

    def test_negative_price_raises(self) -> None:
        with pytest.raises(Exception, match="Price must be positive"):
            self._make(price=-5.0)

    def test_price_none_is_valid(self) -> None:
        assert self._make(price=None).price is None

    def test_usd_denom(self) -> None:
        intent = self._make(amount=50.0, amount_denom="usd")
        assert intent.amount_denom == "usd"


class TestLLMResponse:

    def test_intent_only(self) -> None:
        intent = TradingIntent(action="buy", token="INJ", amount=10.0)
        response = LLMResponse(intent=intent)
        assert response.intent is not None
        assert response.error_message is None

    def test_error_only(self) -> None:
        response = LLMResponse(error_message="Not a trading request")
        assert response.intent is None
        assert response.error_message == "Not a trading request"

    def test_empty_response_is_valid(self) -> None:
        response = LLMResponse()
        assert response.intent is None
        assert response.error_message is None
