from __future__ import annotations


class KoudaiError(Exception):

    def __init__(self, message: str, code: str='KOUDAI_ERROR') -> None:
        super().__init__(message)
        self.message = message
        self.code = code

    def __repr__(self) -> str:
        return f'{self.__class__.__name__}(code={self.code!r}, message={self.message!r})'
