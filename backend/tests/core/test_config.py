from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from koudai.core.config import KoudaiConfig
from tests.conftest import VALID_CONFIG_ENV


def make_config(**overrides: Any) -> KoudaiConfig:
    return KoudaiConfig(**{**VALID_CONFIG_ENV, **overrides})


class TestValidConfiguration:

    def test_dry_run_defaults_to_true(self) -> None:
        assert make_config().agent_dry_run is True

    def test_network_is_testnet(self) -> None:
        assert make_config().injective_network == "testnet"

    def test_default_llm_model(self) -> None:
        assert make_config().llm_model == "gemini-2.0-flash-exp"

    def test_default_max_order_usd(self) -> None:
        assert make_config().agent_max_order_usd == 50.0

    def test_default_poll_interval(self) -> None:
        assert make_config().agent_poll_interval_sec == 10

    def test_valid_inj_wallet_accepted(self) -> None:
        cfg = make_config(injective_wallet_address="inj1abc0000000000000000000000000")
        assert cfg.injective_wallet_address.startswith("inj1")

    def test_custom_max_order_accepted(self) -> None:
        assert make_config(agent_max_order_usd=25.0).agent_max_order_usd == 25.0

    def test_dry_run_false_accepted(self) -> None:
        assert make_config(agent_dry_run=False).agent_dry_run is False


class TestPlaceholderRejection:

    def test_rejects_placeholder_api_key(self) -> None:
        with pytest.raises(ValidationError, match="GEMINI_API_KEY is not configured"):
            make_config(GEMINI_API_KEY="<GEMINI_API_KEY>")

    def test_rejects_placeholder_mnemonic(self) -> None:
        with pytest.raises(ValidationError, match="INJECTIVE_MNEMONIC is not configured"):
            make_config(injective_mnemonic="<INJECTIVE_TESTNET_MNEMONIC>")

    def test_rejects_placeholder_wallet_address(self) -> None:
        with pytest.raises(ValidationError, match="INJECTIVE_WALLET_ADDRESS is not configured"):
            make_config(injective_wallet_address="<WALLET_ADDRESS>")

    def test_rejects_non_inj_prefix_wallet(self) -> None:
        with pytest.raises(ValidationError, match="Must start with 'inj1'"):
            make_config(injective_wallet_address="cosmos1abc123")


class TestBoundaryGuards:

    def test_mainnet_is_rejected(self) -> None:
        with pytest.raises(ValidationError):
            make_config(injective_network="mainnet")

    def test_zero_max_order_usd_rejected(self) -> None:
        with pytest.raises(ValidationError):
            make_config(agent_max_order_usd=0.0)

    def test_negative_max_order_usd_rejected(self) -> None:
        with pytest.raises(ValidationError):
            make_config(agent_max_order_usd=-10.0)

    def test_poll_interval_below_minimum_rejected(self) -> None:
        with pytest.raises(ValidationError):
            make_config(agent_poll_interval_sec=2)

    def test_poll_interval_at_minimum_accepted(self) -> None:
        assert make_config(agent_poll_interval_sec=5).agent_poll_interval_sec == 5