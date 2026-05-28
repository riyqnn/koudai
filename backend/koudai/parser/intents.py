from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TradingIntent(BaseModel):
    action: Literal["buy", "sell"] = Field(description="The trading action")
    token: str = Field(description="Token symbol to trade (e.g., INJ, USDT, ATOM)")
    amount: float = Field(description="Amount of tokens to trade")
    amount_denom: Literal["token", "usd"] = Field(default="token", description="Whether amount is in token units or USD")
    order_type: Literal["market", "limit"] = Field(default="market", description="Execution type")
    price: float | None = Field(default=None, description="Limit price in USD — only required for limit orders")
    confidence: float = Field(default=1.0, description="LLM confidence score (0.0 to 1.0)")

    @field_validator("amount")
    @classmethod
    def _amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v

    @field_validator("confidence")
    @classmethod
    def _confidence_in_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("Confidence must be between 0.0 and 1.0")
        return v

    @field_validator("price")
    @classmethod
    def _price_must_be_positive_if_set(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("Price must be positive if set")
        return v


class LLMResponse(BaseModel):
    intent: TradingIntent | None = Field(default=None)
    error_message: str | None = Field(default=None)
    reasoning: str | None = Field(default=None)
