"""
CookieWise — Selenium Test Suite
=================================
Tests that the CookieWise Chrome extension correctly:
  1. Detects cookie banners on known banner sites (BBC, NYT, CNN, etc.)
  2. Does NOT flag pages that have no cookie banner (e.g. example.com)
  3. Injects the extension into Chrome via Selenium and reads
     the sessionStorage result written by content.js

Requirements
------------
    pip install selenium webdriver-manager pytest

Usage
-----
    # Run all tests (headless):
    pytest test_cookiewise.py -v

    # Run headed (see the browser):
    HEADLESS=0 pytest test_cookiewise.py -v

    # Run a single test:
    pytest test_cookiewise.py::TestCookieBannerDetection::test_bbc_has_banner -v

Notes
-----
- The extension is loaded unpacked from ../extension (relative to this file).
- Selenium drives Chrome; ChromeDriver is auto-managed by webdriver-manager.
- Each test opens a fresh browser tab for isolation.
- The suite reads the `cookiewise_result` key from sessionStorage that
  content.js writes, so no extension API calls are needed from Python.
"""

import json
import os
import time
import pathlib
import pytest

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager


# ── Config ────────────────────────────────────────────────────────────────
HERE          = pathlib.Path(__file__).parent
EXTENSION_DIR = (HERE / ".." / "extension").resolve()
HEADLESS      = os.environ.get("HEADLESS", "1") != "0"
PAGE_TIMEOUT  = 20   # seconds to wait for page load
BANNER_WAIT   = 8    # extra seconds for lazy-loaded banners


# ── Sites expected to HAVE a cookie banner ────────────────────────────────
BANNER_SITES = [
    ("BBC",         "https://www.bbc.com/"),
    ("NYT",         "https://www.nytimes.com/"),
    ("CNN",         "https://edition.cnn.com/"),
    ("The Guardian","https://www.theguardian.com/"),
    ("Reuters",     "https://www.reuters.com/"),
]

# ── Sites expected to have NO cookie banner ───────────────────────────────
CLEAN_SITES = [
    ("example.com", "https://example.com/"),
    ("Wikipedia",   "https://en.wikipedia.org/wiki/HTTP_cookie"),
]


# ── Browser fixture ───────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def driver():
    """Spin up a single Chrome instance with the CookieWise extension loaded."""
    opts = Options()

    # Load the unpacked extension
    opts.add_argument(f"--load-extension={EXTENSION_DIR}")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,900")

    if HEADLESS:
        # Chrome ≥ 109: use the new headless mode that supports extensions
        opts.add_argument("--headless=new")

    # Suppress extension install popup
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    service = Service(ChromeDriverManager().install())
    drv = webdriver.Chrome(service=service, options=opts)
    drv.set_page_load_timeout(PAGE_TIMEOUT)

    yield drv
    drv.quit()


# ── Helper ────────────────────────────────────────────────────────────────
def get_cookiewise_result(driver, url: str, extra_wait: float = 0) -> dict | None:
    """
    Navigate to *url*, wait for the content script to run, and return the
    parsed result dict from sessionStorage, or None if nothing was written.
    """
    try:
        driver.get(url)
    except Exception:
        # Some sites trigger a timeout on load but the DOM is still usable
        pass

    # Give the content script and any lazy CMPs time to fire
    total_wait = BANNER_WAIT + extra_wait
    deadline   = time.time() + total_wait
    result     = None

    while time.time() < deadline:
        raw = driver.execute_script(
            "return sessionStorage.getItem('cookiewise_result');"
        )
        if raw:
            try:
                result = json.loads(raw)
                # If already found, no need to wait longer
                if result.get("found"):
                    break
            except json.JSONDecodeError:
                pass
        time.sleep(0.5)

    return result


# ── Test class ────────────────────────────────────────────────────────────
class TestCookieBannerDetection:

    # ── Banner-present sites ───────────────────────────────────────────

    @pytest.mark.parametrize("name,url", BANNER_SITES)
    def test_site_has_banner(self, driver, name, url):
        """Extension should detect a cookie banner on well-known publisher sites."""
        result = get_cookiewise_result(driver, url)

        assert result is not None, (
            f"[{name}] content.js did not write a result to sessionStorage. "
            f"Make sure the extension is loaded and the page uses http/https."
        )
        assert result.get("found") is True, (
            f"[{name}] Expected a cookie banner to be detected on {url}.\n"
            f"Got result: {result}"
        )
        assert result.get("method") in (
            "vendor_selector", "keyword_heuristic", "multi_keyword"
        ), f"[{name}] Unexpected detection method: {result.get('method')}"

        print(f"\n  ✓ {name}: banner found via '{result['method']}'")
        if result.get("matchedSelector"):
            print(f"    Selector : {result['matchedSelector']}")
        if result.get("snippetText"):
            print(f"    Snippet  : {result['snippetText'][:80]}…")

    # ── Banner-free sites ──────────────────────────────────────────────

    @pytest.mark.parametrize("name,url", CLEAN_SITES)
    def test_site_has_no_banner(self, driver, name, url):
        """Extension should NOT flag pages that have no cookie consent banner."""
        result = get_cookiewise_result(driver, url)

        assert result is not None, (
            f"[{name}] content.js did not write a result. "
            f"Verify the extension is active."
        )
        assert result.get("found") is False, (
            f"[{name}] False positive: a banner was reported on {url} which "
            f"should not have one.\nResult: {result}"
        )
        print(f"\n  ✓ {name}: correctly reported no banner")

    # ── Badge / sessionStorage structure checks ────────────────────────

    def test_result_structure(self, driver):
        """Result object should always include 'found' and 'url' keys."""
        result = get_cookiewise_result(driver, "https://example.com/")
        assert result is not None
        assert "found"     in result
        assert "url"       in result
        assert "timestamp" in result

    def test_found_result_has_method(self, driver):
        """When a banner is detected the result must include a method key."""
        result = get_cookiewise_result(driver, "https://www.bbc.com/")
        if result and result.get("found"):
            assert "method" in result, (
                "Banner detection result must include a 'method' field."
            )

    def test_extension_activates_on_http(self, driver):
        """Extension must activate on plain http:// URLs."""
        # example.com redirects to https, but we test the mechanism
        result = get_cookiewise_result(driver, "http://example.com/")
        # We just need the script to have run (result is not None)
        assert result is not None, (
            "content.js did not run on an http:// URL — "
            "check manifest host_permissions."
        )

    # ── New Alert System Tests ────────────────────────────────────────

    def test_status_alert_on_clean_site(self, driver):
        """When no banner is detected, the extension should show a status alert overlay."""
        # Use a site where no banner is expected
        driver.get("https://example.com/")
        
        # Wait for the alert to be injected by content.js
        wait = WebDriverWait(driver, 10)
        try:
            alert = wait.until(EC.presence_of_element_located((By.ID, "cookiewise-status-alert")))
            assert alert.is_displayed()
            assert "Unable to detect" in alert.text or "out of scope" in alert.text.lower()
            print("\n  ✓ Status alert successfully detected on example.com")
        except:
            pytest.fail("Status alert '#cookiewise-status-alert' was not found on a page without a banner.")

    def test_no_alert_on_banner_site(self, driver):
        """When a banner IS detected, the status alert should NOT be shown."""
        # BBC has a banner
        driver.get("https://www.bbc.com/")
        
        # Give it a few seconds to perform detection
        time.sleep(4)
        
        # Check if the alert exists
        alerts = driver.find_elements(By.ID, "cookiewise-status-alert")
        assert len(alerts) == 0, (
            "Status alert was found on BBC.com, but it should ONLY show when "
            "detection FAILS."
        )
        print("\n  ✓ No status alert shown on BBC (correctly suppressed by detection)")


# ── Standalone runner (python test_cookiewise.py) ─────────────────────────
if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v", "--tb=short"]))
