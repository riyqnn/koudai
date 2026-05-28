from __future__ import annotations

import pytest

VALID_CONFIG_ENV: dict[str, str] = {
    "GEMINI_API_KEY": "sk-test-abc123",
    "injective_mnemonic": "word " * 23 + "word",
    "injective_wallet_address": "inj1testwalletaddressxxxxxxxxxxx",
    "agent_dry_run": "true",
}


@pytest.fixture()
def valid_config_env() -> dict[str, str]:
    return dict(VALID_CONFIG_ENV)