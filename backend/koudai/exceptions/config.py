from __future__ import annotations

from koudai.exceptions.base import KoudaiError


class ConfigError(KoudaiError):

    def __init__(self, message: str) -> None:
        super().__init__(message, code='CONFIG_ERROR')
