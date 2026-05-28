from __future__ import annotations

from koudai.exceptions.base import KoudaiError


class IntentParseError(KoudaiError):

    def __init__(self, message: str, raw_output: str | None=None) -> None:
        super().__init__(message, code='INTENT_PARSE_ERROR')
        self.raw_output = raw_output

class IntentValidationError(KoudaiError):

    def __init__(self, message: str, field: str | None=None) -> None:
        super().__init__(message, code='INTENT_VALIDATION_ERROR')
        self.field = field
