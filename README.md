# 🍪 CookieWise — Automatic Cookie Banner Detector

A Chrome extension that **automatically detects cookie consent banners** on every page you visit and clearly signals the result via a toolbar badge and popup — no manual activation required.

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Auto-detection on page load** | Activates on every `http://` and `https://` URL without any user action |
| **40+ CMP vendor selectors** | Covers OneTrust, Cookiebot, TrustArc, Didomi, Quantcast, Sourcepoint, and more |
| **Keyword heuristic fallback** | Detects custom or unknown banners by scanning visible text and overlay positioning |
| **MutationObserver** | Catches late-injected banners from SPAs and lazy-loaded CMPs |
| **Toolbar badge** | Red `!` badge appears instantly when a banner is found; cleared on clean pages |
| **Rich popup** | Shows detection method, matched selector, and a text snippet from the banner |
| **Selenium test suite** | Automated Python tests against real sites (BBC, NYT, CNN, Guardian, Reuters…) |

---

## 📁 Project Structure

```
CookieWise/
├── extension/                 # Chrome extension source (load unpacked)
│   ├── manifest.json          # MV3 manifest
│   ├── content.js             # Detection logic (runs on every page)
│   ├── background.js          # Service worker — badge management
│   ├── popup.html             # Toolbar popup UI
│   ├── popup.js               # Popup logic — queries background for state
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
└── selenium_tests/            # Python Selenium test suite
    ├── requirements.txt
    ├── conftest.py
    └── test_cookiewise.py
```

---

## 🚀 Installation (Chrome)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `CookieWise/extension/` folder
5. The CookieWise cookie icon appears in your toolbar

That's it — browse any website and CookieWise will automatically detect cookie banners.

---

## 🔍 How Detection Works

The content script (`content.js`) runs three passes:

### Pass 1 — Vendor Selector Match
Queries 40+ CSS selectors used by real-world Consent Management Platforms (CMPs):
- **OneTrust** → `#onetrust-banner-sdk`
- **Cookiebot** → `#CybotCookiebotDialog`
- **TrustArc** → `#truste-consent-track`
- **Didomi** → `#didomi-host`
- **Quantcast** → `.qc-cmp2-container`
- Generic patterns → `[id*='cookie-banner']`, `[class*='cookieConsent']` etc.

### Pass 2 — Keyword Heuristic
Scans fixed/sticky/high-z-index overlay elements for phrases like:
> "Accept all cookies", "We use cookies", "Cookie settings", "GDPR", "Manage preferences"

### Pass 3 — Multi-keyword Scan
Requires 2+ keyword hits in any visible element — catches edge cases missed by passes 1–2.

A **MutationObserver** re-runs detection for 15 seconds after page load to handle banners injected by SPAs or lazy-loaded scripts.

---

## 🏅 Toolbar Badge

| State | Badge | Meaning |
|---|---|---|
| Banner detected | 🔴 `!` | Cookie consent banner found |
| No banner | *(no badge)* | Page has no cookie banner |
| Loading / unsupported | *(no badge)* | Waiting for scan result or non-http page |

---

## 🧪 Running Selenium Tests

The test suite verifies the extension against real websites.

### Prerequisites

- Python 3.9+
- Google Chrome installed
- Internet access

### Setup

```bash
cd CookieWise/selenium_tests

# Create a virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Run tests

```bash
# Headless (default — fast, no visible browser)
pytest test_cookiewise.py -v

# Headed (watch the browser)
pytest test_cookiewise.py -v --headed

# Single test
pytest test_cookiewise.py::TestCookieBannerDetection::test_site_has_banner[BBC-https://www.bbc.com/] -v

# Generate HTML report
pytest test_cookiewise.py -v --html=report.html --self-contained-html
```

### Test coverage

| Test | What it checks |
|---|---|
| `test_site_has_banner[BBC]` | BBC.com triggers banner detection |
| `test_site_has_banner[NYT]` | NYTimes.com triggers banner detection |
| `test_site_has_banner[CNN]` | CNN.com triggers banner detection |
| `test_site_has_banner[Guardian]` | Guardian.com triggers banner detection |
| `test_site_has_banner[Reuters]` | Reuters.com triggers banner detection |
| `test_site_has_no_banner[example.com]` | example.com is NOT falsely flagged |
| `test_site_has_no_banner[Wikipedia]` | Wikipedia is NOT falsely flagged |
| `test_result_structure` | Result object has required keys |
| `test_found_result_has_method` | Detected results include method field |
| `test_extension_activates_on_http` | Extension runs on `http://` URLs |

---

## 🔧 Configuration & Customisation

### Add custom selectors
Edit the `VENDOR_SELECTORS` array in `extension/content.js`:
```javascript
const VENDOR_SELECTORS = [
  // ... existing selectors ...
  "#my-custom-banner-id",
  ".my-company-cookie-popup",
];
```

### Add custom keywords
Edit the `KEYWORD_PATTERNS` array in `extension/content.js`:
```javascript
const KEYWORD_PATTERNS = [
  // ... existing patterns ...
  /\bmy custom phrase\b/i,
];
```

---

## 🔒 Permissions Explained

| Permission | Why it's needed |
|---|---|
| `activeTab` | Read the current tab's URL for popup display |
| `scripting` | Execute content scripts and read sessionStorage in popup fallback |
| `storage` | Cache detection results across popup open/close via `chrome.storage.session` |
| `tabs` | Listen for tab navigation events to reset badge state |
| `http://*/*` `https://*/*` | Run content script on all web pages |

---

## 📋 Acceptance Criteria — Verification

| Criterion | How it's met |
|---|---|
| Extension activates on page load for all `http://` and `https://` URLs | `manifest.json` `content_scripts.matches` covers both schemes; `run_at: document_idle` |
| Identifies banners on BBC / NYT test pages | Selenium tests `test_site_has_banner[BBC]` and `test_site_has_banner[NYT]` |
| Ignores pages without banners | Selenium tests `test_site_has_no_banner[example.com]` and `test_site_has_no_banner[Wikipedia]` |
| Toolbar icon changes to indicate a banner | Background service worker sets red `!` badge via `chrome.action.setBadgeText` |

---

## 🐛 Troubleshooting

**Extension not showing in toolbar** — pin it via the puzzle piece (🧩) icon in Chrome.

**Badge not updating** — ensure Developer Mode is on and the extension is enabled in `chrome://extensions/`.

**Selenium tests fail with "cannot find Chrome"** — install Google Chrome and ensure it's on your PATH. `webdriver-manager` handles ChromeDriver automatically.

**False negative on a site you know has a banner** — the CMP may inject the banner after the 15-second observation window (rare). Open a GitHub issue with the site URL.

---

## 📄 License

MIT — free to use, modify, and distribute.
