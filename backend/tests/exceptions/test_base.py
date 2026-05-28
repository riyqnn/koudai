from __future__ import annotations
import pytest
from koudai.exceptions.base import KoudaiError

class TestKoudaiErrorAttributes:

    def test_message_is_stored(self) -> None:
        exc = KoudaiError('something went wrong')
        assert exc.message == 'something went wrong'

    def test_default_code(self) -> None:
        exc = KoudaiError('oops')
        assert exc.code == 'KOUDAI_ERROR'

    def test_custom_code(self) -> None:
        exc = KoudaiError('oops', code='CUSTOM_CODE')
        assert exc.code == 'CUSTOM_CODE'

    def test_repr_contains_code_and_message(self) -> None:
        exc = KoudaiError('bad thing', code='MY_CODE')
        r = repr(exc)
        assert 'MY_CODE' in r
        assert 'bad thing' in r

    def test_is_subclass_of_exception(self) -> None:
        assert issubclass(KoudaiError, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        with pytest.raises(KoudaiError, match='test raise'):
            raise KoudaiError('test raise')