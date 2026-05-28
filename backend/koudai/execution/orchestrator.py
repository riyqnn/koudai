from __future__ import annotations

import asyncio
from typing import Any

from koudai.core.config import load_config
from koudai.core.logging import get_logger

from .injective_client import InjectiveClient
from .models import OrderRequest, OrderResult, OrderStatus
from .price_feed import PriceFeed

log = get_logger(__name__)


class TradingOrchestrator:

    def __init__(self, dry_run: bool | None = None) -> None:
        cfg = load_config()
        self.dry_run = dry_run if dry_run is not None else cfg.agent_dry_run
        self._price_feed: PriceFeed | None = None
        self._injective: InjectiveClient | None = None
        log.info("trading_orchestrator_initialized", dry_run=self.dry_run)

    async def start(self) -> None:
        self._price_feed = PriceFeed(dry_run=self.dry_run)
        self._injective = InjectiveClient(dry_run=self.dry_run)
        await self._injective.connect()
        log.info("trading_orchestrator_started")

    async def stop(self) -> None:
        if self._price_feed:
            await self._price_feed.close()
        if self._injective:
            await self._injective.close()
        log.info("trading_orchestrator_stopped")

    async def execute_order(self, request: OrderRequest) -> OrderResult:
        if not self._injective or not self._price_feed:
            raise RuntimeError("Orchestrator not started. Call start() first.")

        log.info("executing_order", side=request.order_side, token=request.token_symbol, amount=request.amount)

        market = await self._injective.find_market(base_symbol=request.token_symbol, quote_symbol="USDT")
        if not market:
            log.warning("market_not_found", token=request.token_symbol)
            return OrderResult(
                status=OrderStatus.FAILED,
                error_message=f"Market for {request.token_symbol}/USDT not found",
                timestamp=asyncio.get_event_loop().time(),
            )

        request.market_id = market.spot_market_id

        if request.order_type == "market" and request.amount_denom == "usd":
            price = await self._price_feed.get_price(request.token_symbol)
            request.amount = request.amount / price
            request.amount_denom = "token"
            log.info("converted_usd_to_tokens", price=price, tokens=request.amount)

        return await self._injective.submit_order(request)

    async def get_wallet_status(self) -> dict[str, Any]:
        if not self._injective:
            raise RuntimeError("Orchestrator not started. Call start() first.")
        balance = await self._injective.get_balance("inj")
        return {
            "network": self._injective.network.value,
            "wallet_address": self._injective.wallet_address,
            "inj_balance": {"available": balance.available, "total": balance.total},
            "dry_run": self.dry_run,
        }

    async def get_market_info(self, token_symbol: str) -> dict[str, Any]:
        if not self._price_feed or not self._injective:
            raise RuntimeError("Orchestrator not started. Call start() first.")
        price = await self._price_feed.get_price(token_symbol)
        market = await self._injective.find_market(token_symbol, "USDT")
        return {
            "token": token_symbol,
            "price_usd": price,
            "market_id": market.spot_market_id if market else None,
            "min_quantity": market.min_quantity if market else None,
            "min_price": market.min_price if market else None,
        }

    async def __aenter__(self) -> TradingOrchestrator:
        await self.start()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.stop()


__all__ = ["TradingOrchestrator"]
