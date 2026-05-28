from __future__ import annotations

SUPPORTED_NETWORK: str = "testnet"
INJECTIVE_TESTNET_GRPC: str = "testnet.sentry.chain.grpc.injective.network:443"
INJECTIVE_TESTNET_LCD: str = "https://testnet.sentry.lcd.injective.network"
INJ_ADDRESS_PREFIX: str = "inj1"
MIN_POLL_INTERVAL_SEC: int = 5
MIN_ORDER_USD: float = 0.01
DEFAULT_LLM_MODEL: str = "gemini-2.0-flash-exp"
LOG_FILENAME: str = "koudai.jsonl"

_PLACEHOLDER_API_KEY: str = "<GEMINI_API_KEY>"
_PLACEHOLDER_MNEMONIC: str = "<INJECTIVE_TESTNET_MNEMONIC>"
_PLACEHOLDER_WALLET: str = "<WALLET_ADDRESS>"

__all__ = [
    "DEFAULT_LLM_MODEL",
    "INJ_ADDRESS_PREFIX",
    "INJECTIVE_TESTNET_GRPC",
    "INJECTIVE_TESTNET_LCD",
    "LOG_FILENAME",
    "MIN_ORDER_USD",
    "MIN_POLL_INTERVAL_SEC",
    "SUPPORTED_NETWORK",
]
