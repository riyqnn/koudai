from __future__ import annotations
import pytest
from koudai.exceptions.base import KoudaiError
from koudai.exceptions.intent import IntentParseError, IntentValidationError

class TestIntentParseError:

    def test_error_code(self) -> None:
        assert IntentParseError('bad json').code == 'INTENT_PARSE_ERROR'

    def test_raw_output_is_stored(self) -> None:
        exc = IntentParseError('parse failed', raw_output='{"broken": true}')
        assert exc.raw_output == '{"broken": true}'

    def test_raw_output_defaults_to_none(self) -> None:
        exc = IntentParseError('no output available')
        assert exc.raw_output is None

    def test_is_koudai_error(self) -> None:
        assert isinstance(IntentParseError('x'), KoudaiError)

    def test_can_be_raised_and_caught_as_base(self) -> None:
        with pytest.raises(KoudaiError):
            raise IntentParseError('caught by base')

class TestIntentValidationError:

    def test_error_code(self) -> None:
        assert IntentValidationError('bad amount').code == 'INTENT_VALIDATION_ERROR'

    def test_field_is_stored(self) -> None:
        exc = IntentValidationError('invalid value', field='amount')
        assert exc.field == 'amount'

    def test_field_defaults_to_none(self) -> None:
        exc = IntentValidationError('no field identified')
        assert exc.field is None

    def test_is_koudai_error(self) -> None:
        assert isinstance(IntentValidationError('x'), KoudaiError)