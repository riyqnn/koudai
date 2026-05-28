from __future__ import annotations
import os
import tempfile
from koudai.core.logging import configure_logging, get_logger

class TestConfigureLogging:

    def test_console_mode_does_not_raise(self) -> None:
        configure_logging(level='DEBUG', fmt='console')

    def test_json_mode_does_not_raise(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            configure_logging(level='INFO', fmt='json', log_dir=tmp)

    def test_json_mode_creates_log_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            nested = os.path.join(tmp, 'deep', 'log_dir')
            configure_logging(fmt='json', log_dir=nested)
            assert os.path.isdir(nested)

    def test_json_mode_creates_jsonl_file_on_emit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            configure_logging(fmt='json', log_dir=tmp)
            get_logger('test.emit').info('probe_event', marker='json_file_test')
            assert os.path.isfile(os.path.join(tmp, 'koudai.jsonl'))

class TestGetLogger:

    def test_returns_non_none_logger(self) -> None:
        configure_logging(fmt='console')
        assert get_logger('test') is not None

    def test_named_loggers_are_independent(self) -> None:
        configure_logging(fmt='console')
        log_a = get_logger('module.a')
        log_b = get_logger('module.b')
        assert log_a is not log_b

    def test_bound_context_does_not_raise_on_emit(self) -> None:
        configure_logging(fmt='console')
        log = get_logger('test.ctx', component='parser', phase=2)
        log.info('context_bound_event')

    def test_info_warning_error_levels_do_not_raise(self) -> None:
        configure_logging(fmt='console')
        log = get_logger('test.levels')
        log.info('info_event')
        log.warning('warning_event')
        log.error('error_event')