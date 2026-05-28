from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass

import httpx

from koudai.core.logging import get_logger
from koudai.exceptions import PriceFeedError

from .models import PricePoint

log = get_logger(__name__)

_MOCK_PRICES: dict[str, float] = {
    "INJ": 25.5,
    "USDT": 1.0,
    "USDC": 1.0,
    "ATOM": 8.75,
    "ETH": 3200.0,
    "BTC": 67000.0,
    "SOL": 145.0,
}


@dataclass
class PriceSnapshot:
    prices: dict[str, float]
    timestamp: float


class PriceFeed:

    def __init__(self, dry_run: bool = True) -> None:
        self.dry_run = dry_run
        self._client: httpx.AsyncClient | None = None
        self._cache: dict[str, tuple[float, float]] = {}
        self._cache_ttl = 30
        log.info("price_feed_initialized", dry_run=dry_run)

    async def get_price(self, symbol: str) -> float:
        key = symbol.upper()
        now = time.time()
        if key in self._cache:
            cached_price, cached_at = self._cache[key]
            if now - cached_at < self._cache_ttl:
                return cached_price

        price = await self._get_mock_price(symbol) if self.dry_run else await self._fetch_price(symbol)
        self._cache[key] = (price, now)
        log.info("price_fetched", symbol=symbol, price=price)
        return price

    async def get_prices(self, symbols: list[str]) -> dict[str, float]:
        results = await asyncio.gather(*[self.get_price(s) for s in symbols], return_exceptions=True)
        prices: dict[str, float] = {}
        for sym, outcome in zip(symbols, results, strict=False):
            if isinstance(outcome, BaseException):
                log.warning("price_fetch_failed", symbol=sym, error=str(outcome))
                prices[sym] = 0.0
            else:
                prices[sym] = float(outcome)
        return prices

    async def get_price_history(self, symbol: str, limit: int = 10, interval: float = 1.0) -> list[PricePoint]:
        now = time.time()
        return [
            PricePoint(price=await self._get_mock_price(symbol), quantity=0.0, timestamp=now - (limit - i) * interval)
            for i in range(limit)
        ]

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
        log.info("price_feed_closed")

    async def _get_mock_price(self, symbol: str) -> float:
        base = _MOCK_PRICES.get(symbol.upper(), 1.0)
        variation = (random.random() * 0.04) - 0.02  # noqa: S311 — non-crypto mock price jitter
        return base * (1.0 + variation)

    async def _fetch_price(self, symbol: str) -> float:
        log.warning("real_price_fetch_not_implemented", symbol=symbol)
        raise PriceFeedError(f"Real price fetching not implemented for {symbol}", market_id=symbol)

    async def __aenter__(self) -> PriceFeed:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()


__all__ = ["PriceFeed", "PriceSnapshot"]
