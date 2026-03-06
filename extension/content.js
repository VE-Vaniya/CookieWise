/**
 * CookieWise — Content Script
 * Runs on every http/https page at document_idle.
 * Detects cookie consent banners using a multi-signal approach:
 *   1. Known CSS selectors / IDs / class names used by major CMP vendors
 *   2. Keyword scanning of visible element text
 *   3. ARIA role / landmark heuristics
 * Sends results to the background service worker to update the toolbar badge.
 */

(() => {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  VENDOR SELECTORS — Covers 40+ real-world CMPs / banner patterns    */
  /* ------------------------------------------------------------------ */
  const VENDOR_SELECTORS = [
    // OneTrust
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    ".onetrust-pc-dark-filter",
    // Cookiebot
    "#CybotCookiebotDialog",
    "#CybotCookiebotDialogBody",
    ".CybotCookiebotDialog",
    // TrustArc / TRUSTe
    "#truste-consent-track",
    "#truste-consent-button",
    ".truste_overlay",
    ".truste_box_overlay",
    // Quantcast Choice
    ".qc-cmp2-container",
    ".qc-cmp-showing",
    "#qcCmpUi",
    // Didomi
    "#didomi-host",
    ".didomi-popup-container",
    ".didomi-notice",
    // Usercentrics
    "#usercentrics-root",
    ".uc-banner",
    // Sourcepoint
    "#sp_message_container",
    ".sp_message_iframe",
    // Civic Cookie Control
    "#ccc",
    "#ccc-module",
    // Cookie Information
    ".cookie-information-popup-v2",
    ".coiOverlay",
    // Klaro
    ".klaro",
    ".cookie-modal",
    // Borlabs Cookie (WordPress)
    "#BorlabsCookieBox",
    ".BorlabsCookie",
    // GDPR Cookie Consent (WordPress plugin)
    "#gdpr-cookie-consent-bar",
    "#cookie-law-info-bar",
    // Cookieconsent (osano open-source)
    ".cc-window",
    ".cc-banner",
    ".cc-dialog",
    // Silktide
    ".silktide-consent",
    // Generic high-confidence patterns
    "[id*='cookie-banner']",
    "[id*='cookieBanner']",
    "[id*='cookie_banner']",
    "[class*='cookie-banner']",
    "[class*='cookieBanner']",
    "[id*='cookie-consent']",
    "[id*='cookieConsent']",
    "[class*='cookie-consent']",
    "[class*='cookieConsent']",
    "[id*='cookie-notice']",
    "[class*='cookie-notice']",
    "[id*='cookie-bar']",
    "[class*='cookie-bar']",
    "[id*='gdpr-banner']",
    "[class*='gdpr-banner']",
    "[id*='gdpr-popup']",
    "[class*='gdpr-popup']",
    "[aria-label*='cookie' i]",
    "[aria-label*='consent' i]",
    "[role='dialog'][aria-label*='cookie' i]",
    "[role='alertdialog'][aria-label*='cookie' i]",
  ];

  /* ------------------------------------------------------------------ */
  /*  KEYWORD PATTERNS for text-content scanning (case-insensitive)      */
  /* ------------------------------------------------------------------ */
  const KEYWORD_PATTERNS = [
    /\baccept\s+(all\s+)?cookies?\b/i,
    /\bcookie\s+consent\b/i,
    /\bcookie\s+policy\b/i,
    /\bwe\s+use\s+cookies?\b/i,
    /\bthis\s+(website|site)\s+uses?\s+cookies?\b/i,
    /\bby\s+(continuing|browsing|using).*cookies?\b/i,
    /\bprivacy\s+&\s+cookies?\b/i,
    /\bmanage\s+(cookie\s+)?preferences?\b/i,
    /\bcookie\s+settings?\b/i,
    /\bgdpr\b/i,
    /\blegitimate\s+interest/i,
    /\bconsent\s+management\b/i,
  ];

  /* ------------------------------------------------------------------ */
  /*  HELPER — is an element actually visible?                           */
  /* ------------------------------------------------------------------ */
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    // allow off-screen elements that are still "in the DOM with size"
    return rect.width > 0 || rect.height > 0;
  }

  /* ------------------------------------------------------------------ */
  /*  DETECTION LOGIC                                                     */
  /* ------------------------------------------------------------------ */
  function detectBanner() {
    // 1. Vendor selector check
    for (const selector of VENDOR_SELECTORS) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          return {
            found: true,
            method: "vendor_selector",
            matchedSelector: selector,
            snippetText: (el.innerText || "").slice(0, 120).trim(),
          };
        }
      } catch (_) {
        // invalid selector — skip
      }
    }

    // 2. Keyword scan — look at fixed/sticky/absolute positioned elements
    //    or elements with high z-index that contain cookie-related text.
    const candidates = Array.from(
      document.querySelectorAll(
        "div, section, aside, footer, header, nav, form, dialog, [role='dialog'], [role='alertdialog'], [role='banner']"
      )
    );

    for (const el of candidates) {
      if (!isVisible(el)) continue;

      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex, 10);
      const position = style.position;

      // Heuristic: overlays / banners tend to be fixed, sticky, or high z-index
      const isOverlay =
        position === "fixed" ||
        position === "sticky" ||
        (zIndex > 100 && position !== "static");

      if (!isOverlay) continue;

      const text = (el.innerText || "").toLowerCase();
      if (text.length < 10) continue;

      for (const pattern of KEYWORD_PATTERNS) {
        if (pattern.test(text)) {
          return {
            found: true,
            method: "keyword_heuristic",
            matchedPattern: pattern.toString(),
            snippetText: (el.innerText || "").slice(0, 120).trim(),
          };
        }
      }
    }

    // 3. Broader keyword pass — any element (less confident but catches edge cases)
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = el.innerText || "";
      if (text.length < 20 || text.length > 5000) continue;

      let hits = 0;
      for (const pattern of KEYWORD_PATTERNS) {
        if (pattern.test(text)) hits++;
      }
      // Require 2+ keyword hits for an unpositioned element to count
      if (hits >= 2) {
        return {
          found: true,
          method: "multi_keyword",
          keywordHits: hits,
          snippetText: text.slice(0, 120).trim(),
        };
      }
    }

    return { found: false };
  }

  /* ------------------------------------------------------------------ */
  /*  STATUS ALERT — Shows a popup if detection fails or is out of scope */
  /* ------------------------------------------------------------------ */
  let alertShown = false;

  function showAlert(message) {
    if (alertShown || document.getElementById("cookiewise-status-alert")) return;
    alertShown = true;

    // Add styles if not present
    if (!document.getElementById("cookiewise-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "cookiewise-styles";
      styleEl.textContent = `
        #cookiewise-status-alert {
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(30, 30, 30, 0.9);
          color: white;
          padding: 14px 22px;
          border-radius: 12px;
          z-index: 2147483647;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          font-family: 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          transform: translateX(100px);
          opacity: 0;
          transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        #cookiewise-status-alert.cw-visible {
          transform: translateX(0);
          opacity: 1;
        }
        #cookiewise-status-alert .cw-close {
          cursor: pointer;
          opacity: 0.6;
          padding: 4px;
          margin-left: 10px;
          transition: opacity 0.2s;
        }
        #cookiewise-status-alert .cw-close:hover { opacity: 1; }
      `;
      document.head.appendChild(styleEl);
    }

    const alert = document.createElement("div");
    alert.id = "cookiewise-status-alert";
    alert.innerHTML = `
      <span style="font-size: 18px">⚠️</span>
      <span>${message}</span>
      <span class="cw-close">✕</span>
    `;

    document.body.appendChild(alert);

    // Trigger animation
    setTimeout(() => alert.classList.add("cw-visible"), 100);

    const closeAlert = () => {
      alert.classList.remove("cw-visible");
      setTimeout(() => alert.remove(), 500);
    };

    alert.querySelector(".cw-close").onclick = closeAlert;

    // Auto-hide after 6 seconds
    setTimeout(closeAlert, 6000);
  }

  /* ------------------------------------------------------------------ */
  /*  RUN + REPORT                                                        */
  /* ------------------------------------------------------------------ */
  function hideAlert() {
    const alert = document.getElementById("cookiewise-status-alert");
    if (alert) {
      alert.classList.remove("cw-visible");
      setTimeout(() => alert.remove(), 500);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  RUN + REPORT                                                        */
  /* ------------------------------------------------------------------ */
  function run() {
    let result;
    try {
      result = detectBanner();
    } catch (e) {
      console.error("CookieWise Detection Error:", e);
      result = { found: false, error: true };
    }

    // Store result in sessionStorage so popup can read it synchronously
    try {
      sessionStorage.setItem("cookiewise_result", JSON.stringify(result));
    } catch (_) { }

    // Notify background script to update the toolbar badge
    chrome.runtime.sendMessage({
      type: "COOKIE_BANNER_RESULT",
      payload: {
        ...result,
        url: location.href,
        timestamp: Date.now(),
      },
    });

    if (result.found) {
      // If we found a banner (either now or via late observer), hide the failure alert
      hideAlert();
    } else {
      // Show failure alert only if it hasn't been shown yet or it's a critical error
      const msg = result.error
        ? "CookieWise: Detection engine encountered an error on this site."
        : "CookieWise: Unable to detect cookie banner or out of scope.";
      showAlert(msg);
    }
  }

  // Run immediately (document_idle — DOM is ready)
  run();

  // Also observe late-injected banners (SPAs, lazy-loaded CMPs)
  let observerTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      const cached = sessionStorage.getItem("cookiewise_result");
      if (cached) {
        try {
          const prev = JSON.parse(cached);
          if (prev.found) return; // already detected — no need to re-run
        } catch (_) { }
      }
      run();
    }, 600);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
  });

  // Stop observing after 15 s to avoid unnecessary overhead
  setTimeout(() => observer.disconnect(), 15000);
})();
