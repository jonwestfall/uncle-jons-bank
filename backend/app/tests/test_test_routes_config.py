"""Regression tests for conditional mounting of non-production test routes."""

import importlib
import pathlib
import sys

import pytest

# Allow importing the app package.
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))


def _reload_main_module():
    import app.main as main_module

    return importlib.reload(main_module)


def _route_paths(app) -> set[str]:
    return {route.path for route in app.routes if hasattr(route, "path")}


@pytest.fixture(autouse=True)
def _restore_main_module_state(monkeypatch):
    """Keep later tests isolated from env-driven router registration."""

    yield
    monkeypatch.delenv("ENABLE_TEST_ROUTES", raising=False)
    _reload_main_module()


def test_tests_routes_are_unavailable_in_production_by_default(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("ENABLE_TEST_ROUTES", raising=False)

    main_module = _reload_main_module()

    paths = _route_paths(main_module.app)
    assert "/tests/run" not in paths
    assert "/tests/interest-test" not in paths
    assert "/tests/cd-issue" not in paths
    assert "/tests/cd-redeem" not in paths


def test_tests_routes_are_available_when_explicitly_enabled(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("ENABLE_TEST_ROUTES", "true")

    main_module = _reload_main_module()

    paths = _route_paths(main_module.app)
    assert "/tests/run" in paths
    assert "/tests/interest-test" in paths
    assert "/tests/cd-issue" in paths
    assert "/tests/cd-redeem" in paths
