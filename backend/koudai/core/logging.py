from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

import structlog

from koudai.core.constants import LOG_FILENAME


def _ensure_log_dir(log_dir: str) -> Path:
    path = Path(log_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _shared_processors() -> list[Any]:
    return [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]


def _configure_json_mode(log_level: int, log_dir: str) -> None:
    log_path = _ensure_log_dir(log_dir) / LOG_FILENAME
    pre_chain = _shared_processors() + [structlog.stdlib.add_logger_name]

    structlog.configure(
        processors=pre_chain + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=pre_chain,
    )

    file_handler = logging.FileHandler(str(log_path), encoding="utf-8")
    console_handler = logging.StreamHandler(sys.stdout)

    for handler in (file_handler, console_handler):
        handler.setLevel(log_level)
        handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(console_handler)
    root.setLevel(log_level)


def _configure_console_mode(log_level: int) -> None:
    structlog.configure(
        processors=_shared_processors() + [structlog.dev.ConsoleRenderer(colors=True)],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=log_level)


def configure_logging(level: str = "INFO", fmt: str = "json", log_dir: str = "logs") -> None:
    log_level = getattr(logging, level.upper(), logging.INFO)
    if fmt == "json":
        _configure_json_mode(log_level, log_dir)
    else:
        _configure_console_mode(log_level)


def get_logger(name: str = "koudai", **context: Any) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name).bind(**context)
