from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class NetworkEnv(str, Enum):
    TESTNET = "testnet"
    MAINNET = "mainnet"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass(frozen=True)
class Market:
    spot_market_id: str
    base_denom: str
    quote_denom: str
    base_symbol: str
    quote_symbol: str
    min_quantity: float
    min_price: float


@dataclass(frozen=True)
class PricePoint:
    price: float
    quantity: float
    timestamp: float


class OrderRequest(BaseModel):
    order_side: Literal["buy", "sell"] = Field(description="Buy or sell")
    token_symbol: str = Field(description="Token symbol (e.g., INJ)")
    amount: float = Field(description="Amount to trade")
    amount_denom: Literal["token", "usd"] = Field(default="token")
    order_type: Literal["market", "limit"] = Field(default="market")
    limit_price: float | None = Field(default=None, description="Required for limit orders")
    market_id: str | None = Field(default=None)

    def get_order_type_enum(self) -> OrderType:
        return OrderType(self.order_type)

    def get_order_side_enum(self) -> OrderSide:
        return OrderSide(self.order_side)


class OrderResult(BaseModel):
    status: OrderStatus
    tx_hash: str | None = Field(default=None)
    order_id: str | None = Field(default=None)
    filled_amount: float = Field(default=0.0)
    filled_price: float | None = Field(default=None)
    gas_used: float | None = Field(default=None)
    error_message: str | None = Field(default=None)
    timestamp: float


class WalletBalance(BaseModel):
    denom: str
    available: float
    total: float
    symbol: str | None = Field(default=None)


__all__ = [
    "Market",
    "NetworkEnv",
    "OrderRequest",
    "OrderResult",
    "OrderSide",
    "OrderStatus",
    "OrderType",
    "PricePoint",
    "WalletBalance",
]
