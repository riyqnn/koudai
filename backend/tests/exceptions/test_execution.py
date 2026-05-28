from __future__ import annotations
import pytest
from koudai.exceptions.base import KoudaiError
from koudai.exceptions.execution import InjectiveConnectionError, InsufficientBalanceError, OrderExecutionError, OrderLimitExceededError

class TestInjectiveConnectionError:

    def test_error_code(self) -> None:
        exc = InjectiveConnectionError('timeout')
        assert exc.code == 'INJECTIVE_CONNECTION_ERROR'

    def test_is_koudai_error(self) -> None:
        assert isinstance(InjectiveConnectionError('x'), KoudaiError)

class TestOrderExecutionError:

    def test_error_code(self) -> None:
        assert OrderExecutionError('failed').code == 'ORDER_EXECUTION_ERROR'

    def test_tx_hash_stored(self) -> None:
        exc = OrderExecutionError('rejected', tx_hash='0xdeadbeef')
        assert exc.tx_hash == '0xdeadbeef'

    def test_tx_hash_defaults_to_none(self) -> None:
        exc = OrderExecutionError('no hash yet')
        assert exc.tx_hash is None

class TestInsufficientBalanceError:

    def test_error_code(self) -> None:
        exc = InsufficientBalanceError(required=5.0, available=1.0)
        assert exc.code == 'INSUFFICIENT_BALANCE'

    def test_attributes_stored(self) -> None:
        exc = InsufficientBalanceError(required=10.5, available=3.2, denom='USDT')
        assert exc.required == 10.5
        assert exc.available == 3.2
        assert exc.denom == 'USDT'

    def test_message_contains_all_values(self) -> None:
        exc = InsufficientBalanceError(required=10.5, available=3.2, denom='INJ')
        assert '10.5' in exc.message
        assert '3.2' in exc.message
        assert 'INJ' in exc.message

    def test_default_denom_is_inj(self) -> None:
        exc = InsufficientBalanceError(required=1.0, available=0.5)
        assert exc.denom == 'INJ'

class TestOrderLimitExceededError:

    def test_error_code(self) -> None:
        exc = OrderLimitExceededError(order_usd=100.0, limit_usd=50.0)
        assert exc.code == 'ORDER_LIMIT_EXCEEDED'

    def test_attributes_stored(self) -> None:
        exc = OrderLimitExceededError(order_usd=75.0, limit_usd=50.0)
        assert exc.order_usd == 75.0
        assert exc.limit_usd == 50.0

    def test_message_contains_usd_values(self) -> None:
        exc = OrderLimitExceededError(order_usd=75.0, limit_usd=50.0)
        assert '$75.00' in exc.message
        assert '$50.00' in exc.message

    def test_is_koudai_error(self) -> None:
        with pytest.raises(KoudaiError):
            raise OrderLimitExceededError(order_usd=200.0, limit_usd=50.0)