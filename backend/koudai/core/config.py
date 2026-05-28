from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from koudai.core.constants import (
    _PLACEHOLDER_API_KEY,
    _PLACEHOLDER_MNEMONIC,
    _PLACEHOLDER_WALLET,
    DEFAULT_LLM_MODEL,
    INJ_ADDRESS_PREFIX,
    MIN_ORDER_USD,
    MIN_POLL_INTERVAL_SEC,
    SUPPORTED_NETWORK,
)


class KoudaiConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    llm_api_key: str = Field(default=_PLACEHOLDER_API_KEY, validation_alias="GEMINI_API_KEY")
    llm_model: str = Field(default=DEFAULT_LLM_MODEL, validation_alias="GEMINI_MODEL")

    injective_network: str = Field(default=SUPPORTED_NETWORK)
    injective_mnemonic: str = Field(default=_PLACEHOLDER_MNEMONIC)
    injective_wallet_address: str = Field(default=_PLACEHOLDER_WALLET)

    agent_dry_run: bool = Field(default=True)
    agent_poll_interval_sec: int = Field(default=10, ge=MIN_POLL_INTERVAL_SEC)
    agent_max_order_usd: float = Field(default=50.0, gt=MIN_ORDER_USD)

    log_level: str = Field(default="INFO")
    log_format: str = Field(default="json")
    log_dir: str = Field(default="logs")

    @field_validator("llm_api_key")
    @classmethod
    def _reject_placeholder_api_key(cls, value: str) -> str:
        if value == _PLACEHOLDER_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured. Copy .env.example to .env and set a real key.")
        return value

    @field_validator("injective_mnemonic")
    @classmethod
    def _reject_placeholder_mnemonic(cls, value: str) -> str:
        if value == _PLACEHOLDER_MNEMONIC:
            raise ValueError("INJECTIVE_MNEMONIC is not configured. Provide a valid 24-word testnet mnemonic in .env.")
        return value

    @field_validator("injective_wallet_address")
    @classmethod
    def _reject_placeholder_wallet(cls, value: str) -> str:
        if value == _PLACEHOLDER_WALLET:
            raise ValueError("INJECTIVE_WALLET_ADDRESS is not configured. Provide a valid inj1... address in .env.")
        if not value.startswith(INJ_ADDRESS_PREFIX):
            raise ValueError(f"Invalid wallet address '{value}'. Must start with '{INJ_ADDRESS_PREFIX}'.")
        return value

    @field_validator("injective_network")
    @classmethod
    def _only_testnet_allowed(cls, value: str) -> str:
        if value != SUPPORTED_NETWORK:
            raise ValueError(f"Only '{SUPPORTED_NETWORK}' is supported. Got: '{value}'.")
        return value


def load_config() -> KoudaiConfig:
    return KoudaiConfig()
