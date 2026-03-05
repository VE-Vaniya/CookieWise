"""
Pytest configuration for CookieWise Selenium tests.
Provides shared fixtures and CLI options.
"""

import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--headed",
        action="store_true",
        default=False,
        help="Run Chrome in headed (visible) mode instead of headless.",
    )


def pytest_configure(config):
    import os
    if config.getoption("--headed", default=False):
        os.environ["HEADLESS"] = "0"
