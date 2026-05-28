from __future__ import annotations

import pytest

from koudai.execution.price_feed import PriceFeed


class TestPriceFeedDryRun:

    @pytest.mark.asyncio
    async def test_get_price_returns_float(self) -> None:
        feed = PriceFeed(dry_run=True)
        price = await feed.get_price("INJ")
        assert isinstance(price, float)
        assert price > 0

    @pytest.mark.asyncio
    async def test_get_price_unknown_token_returns_nonzero(self) -> None:
        feed = PriceFeed(dry_run=True)
        price = await feed.get_price("UNKNOWN")
        assert price > 0

    @pytest.mark.asyncio
    async def test_get_prices_returns_all_symbols(self) -> None:
        feed = PriceFeed(dry_run=True)
        result = await feed.get_prices(["INJ", "USDT", "ETH"])
        assert set(result.keys()) == {"INJ", "USDT", "ETH"}
        for v in result.values():
            assert isinstance(v, float)

    @pytest.mark.asyncio
    async def test_cache_prevents_duplicate_fetch(self) -> None:
        feed = PriceFeed(dry_run=True)
        p1 = await feed.get_price("INJ")
        p2 = await feed.get_price("INJ")
        assert p1 == p2

    @pytest.mark.asyncio
    async def test_get_price_history_returns_correct_length(self) -> None:
        feed = PriceFeed(dry_run=True)
        history = await feed.get_price_history("INJ", limit=5)
        assert len(history) == 5

    @pytest.mark.asyncio
    async def test_close_is_idempotent(self) -> None:
        feed = PriceFeed(dry_run=True)
        await feed.close()
        await feed.close()

    @pytest.mark.asyncio
    async def test_context_manager(self) -> None:
        async with PriceFeed(dry_run=True) as feed:
            price = await feed.get_price("BTC")
            assert price > 0
