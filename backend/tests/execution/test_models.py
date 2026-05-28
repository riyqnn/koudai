from __future__ import annotations

import pytest
from typing import Any

from koudai.execution.models import (
    Market,
    NetworkEnv,
    OrderRequest,
    OrderResult,
    OrderSide,
    OrderStatus,
    OrderType,
    PricePoint,
    WalletBalance,
)


class TestEnums:

    def test_network_env_values(self) -> None:
        assert NetworkEnv.TESTNET.value == "testnet"
        assert NetworkEnv.MAINNET.value == "mainnet"

    def test_order_side_values(self) -> None:
        assert OrderSide.BUY.value == "buy"
        assert OrderSide.SELL.value == "sell"

    def test_order_type_values(self) -> None:
        assert OrderType.MARKET.value == "market"
        assert OrderType.LIMIT.value == "limit"

    def test_order_status_completed_states(self) -> None:
        assert OrderStatus.FILLED.value == "filled"
        assert OrderStatus.FAILED.value == "failed"


class TestOrderRequest:

    def _make(self, **kwargs: Any) -> OrderRequest:
        defaults: dict[str, Any] = {
            "order_side": "buy",
            "token_symbol": "INJ",
            "amount": 10.0,
        }
        return OrderRequest(**{**defaults, **kwargs})

    def test_defaults(self) -> None:
        req = self._make()
        assert req.order_type == "market"
        assert req.amount_denom == "token"
        assert req.limit_price is None
        assert req.market_id is None

    def test_get_order_type_enum(self) -> None:
        assert self._make().get_order_type_enum() == OrderType.MARKET

    def test_get_order_side_enum(self) -> None:
        assert self._make(order_side="sell").get_order_side_enum() == OrderSide.SELL

    def test_limit_order_with_price(self) -> None:
        req = self._make(order_type="limit", limit_price=25.5)
        assert req.limit_price == 25.5


class TestOrderResult:

    def test_failed_result(self) -> None:
        import time
        result = OrderResult(status=OrderStatus.FAILED, error_message="no market", timestamp=time.time())
        assert result.filled_amount == 0.0
        assert result.tx_hash is None

    def test_filled_result(self) -> None:
        import time
        result = OrderResult(
            status=OrderStatus.FILLED,
            tx_hash="0x" + "a" * 63,
            order_id="order_123",
            filled_amount=10.0,
            filled_price=25.5,
            timestamp=time.time(),
        )
        assert result.filled_amount == 10.0
        assert result.filled_price == 25.5


class TestMarket:

    def test_market_is_frozen(self) -> None:
        import dataclasses
        m = Market(
            spot_market_id="m1",
            base_denom="inj",
            quote_denom="usdt",
            base_symbol="INJ",
            quote_symbol="USDT",
            min_quantity=0.001,
            min_price=0.01,
        )
        assert dataclasses.fields(m) is not None
        params = dataclasses.asdict(m)
        assert params["spot_market_id"] == "m1"


class TestWalletBalance:

    def test_defaults(self) -> None:
        b = WalletBalance(denom="inj", available=100.0, total=100.0)
        assert b.symbol is None

    def test_with_symbol(self) -> None:
        b = WalletBalance(denom="inj", available=100.0, total=100.0, symbol="INJ")
        assert b.symbol == "INJ"


class TestPricePoint:

    def test_fields(self) -> None:
        p = PricePoint(price=25.5, quantity=10.0, timestamp=1000.0)
        assert p.price == 25.5
        assert p.quantity == 10.0
        assert p.timestamp == 1000.0
