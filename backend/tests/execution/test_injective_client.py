from __future__ import annotations

import pytest

from koudai.execution.injective_client import InjectiveClient
from koudai.execution.models import OrderRequest, OrderStatus
from koudai.exceptions import InsufficientBalanceError, OrderLimitExceededError

from tests.conftest import VALID_CONFIG_ENV


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> InjectiveClient:
    for k, v in VALID_CONFIG_ENV.items():
        monkeypatch.setenv(k.upper(), v)
    return InjectiveClient(dry_run=True)


class TestInjectiveClientDryRun:

    @pytest.mark.asyncio
    async def test_connect_does_not_raise(self, client: InjectiveClient) -> None:
        await client.connect()

    @pytest.mark.asyncio
    async def test_get_balance_returns_mock(self, client: InjectiveClient) -> None:
        balance = await client.get_balance("inj")
        assert balance.available == 1000.0
        assert balance.denom == "inj"

    @pytest.mark.asyncio
    async def test_find_market_returns_mock(self, client: InjectiveClient) -> None:
        market = await client.find_market("INJ", "USDT")
        assert market is not None
        assert market.base_symbol == "INJ"
        assert market.quote_symbol == "USDT"

    @pytest.mark.asyncio
    async def test_submit_order_returns_filled(self, client: InjectiveClient) -> None:
        req = OrderRequest(order_side="buy", token_symbol="INJ", amount=10.0)
        result = await client.submit_order(req)
        assert result.status == OrderStatus.FILLED
        assert result.order_id is not None
        assert result.tx_hash is not None

    @pytest.mark.asyncio
    async def test_submit_order_usd_over_limit_raises(self, client: InjectiveClient) -> None:
        req = OrderRequest(order_side="buy", token_symbol="INJ", amount=999.0, amount_denom="usd")
        with pytest.raises(OrderLimitExceededError):
            await client.submit_order(req)

    @pytest.mark.asyncio
    async def test_close_does_not_raise(self, client: InjectiveClient) -> None:
        await client.close()
