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

  console.log("%c[CookieWise] Extension ACTIVE on: " + location.hostname, "background: #1e1e1e; color: #00ff00; padding: 5px; border-radius: 4px;");

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
    "div[class*='consent' i]",
    "div[id*='consent' i]",
    "div[class*='cookie-notice' i]",
    "section[class*='cookie' i]",
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

  const POLICY_KEYWORDS = [
    /\bcookie\s+policy\b/i,
    /\bprivacy\s+policy\b/i,
    /\bprivacy\s+&\s+cookies?\b/i,
    /\bterms\s+(of\s+)?service\b/i,
    /\blegal\s+notice\b/i,
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
            element: el, // Return the element to search within it
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

  /**
   * Helper to find all elements matching a selector, even deep inside Shadow DOMs.
   */
  function querySelectorAllShadow(selector, root = document) {
    const elements = Array.from(root.querySelectorAll(selector));
    const children = root.querySelectorAll("*");
    for (const child of children) {
      if (child.shadowRoot) {
        elements.push(...querySelectorAllShadow(selector, child.shadowRoot));
      }
    }
    return elements;
  }

  /* ------------------------------------------------------------------ */
  /*  ROBUST LEGAL LINK DISCOVERY (Scoring Algorithm)                  */
  /* ------------------------------------------------------------------ */
  function findLegalLinks(container = document) {
    // 1. Collect all links from the container, including deep Shadow DOM
    const links = querySelectorAllShadow("a", container);

    // Find potential "Accept" buttons for proximity boost
const acceptButtons = querySelectorAllShadow("button, [role='button']").filter(b => {
    try {
        const text = (b?.innerText || b?.textContent || "").toLowerCase();
        return text.includes("accept") || text.includes("agree") || text.includes("allow");
    } catch (e) {
        return false;
    }
});

    const candidates = [];
    const BAD_PATTERNS = ["settings", "preferences", "manage-cookies", "consent", "news", "latest", "blog", "category", "articles", "generator", "tool", "pricing", "affiliate", "demo", "product", "guide"];

    for (const link of links) {
      const text = (link.innerText || "").toLowerCase().trim();
      const href = (link.href || "").toLowerCase();

      if (!href || href.startsWith("javascript:") || href.startsWith("#") || href === location.origin + "/" || href === location.href) continue;

      let score = 0;
      let type = "unknown";

      // --- PRIVACY SIGNALS ---
      if (text === "privacy" || text === "privacy statement") { score += 20; type = "privacy"; }
      else if (text.includes("privacy policy") || text.includes("privacy notice")) { score += 18; type = "privacy"; }

      // --- TERMS SIGNALS ---
      if (text === "terms" || text === "terms & conditions" || text === "terms of use") { score += 20; type = "terms"; }
      else if (text.includes("terms of service") || text.includes("legal terms")) { score += 18; type = "terms"; }

      // --- URL HEURISTICS ---
      if (href.includes("privacy-statement") || href.includes("privacy-policy")) { score += 15; if (type === "unknown") type = "privacy"; }
      if (href.includes("terms-of-use") || href.includes("terms-and-conditions")) { score += 15; if (type === "unknown") type = "terms"; }

      // --- PROXIMITY BOOST (Gemini Recommendation) ---
      try {
        const linkRect = link.getBoundingClientRect();
        for (const button of acceptButtons) {
          const btnRect = button.getBoundingClientRect();
          const dist = Math.sqrt(Math.pow(linkRect.left - btnRect.left, 2) + Math.pow(linkRect.top - btnRect.top, 2));
          if (dist < 100) { // Within 100px proximity
            score += 20;
            break;
          }
        }
      } catch (e) { }

      // --- FILTERS ---
      if (BAD_PATTERNS.some(p => text.includes(p) || (href.includes(p) && !href.includes("privacy") && !href.includes("terms")))) {
        score -= 40;
      }
      if (href.includes("?") || href.includes("&ref=")) score -= 10;
      if (link.closest && link.closest("footer")) score += 5;
      if (container !== document) score += 10;

      if (score > 10) {
        candidates.push({ url: link.href, score, type });
      }
    }

    // Pick top link for each type
    const best = {};
    candidates.sort((a, b) => b.score - a.score);
    for (const cand of candidates) {
      if (!best[cand.type]) best[cand.type] = cand.url;
    }

    // Fallback to whole document if banner search failed
    if (Object.keys(best).length === 0 && container !== document) {
      return findLegalLinks(document);
    }
    return best;
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
  /*  MESSAGE LISTENER (for robust policy extraction)                   */
  /* ------------------------------------------------------------------ */
  let processedThisSession = false;

  // In content.js - REPLACE the entire chrome.runtime.onMessage.addListener section
  // Find this section (around line 430-500) and replace with:

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "CLEAN_AND_LOG_POLICY") {
      const { domain, url, html, docType = "Policy" } = message.payload;

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let cleanText = "";

        // STRATEGY 0: Next.js or JSON Data mining
        const dataScripts = doc.querySelectorAll("script[type='application/json'], script#__NEXT_DATA__");
        for (const script of dataScripts) {
          try {
            const json = JSON.parse(script.textContent);
            const findDeepText = (obj) => {
              let texts = [];
              const walk = (o) => {
                if (typeof o === "string" && o.length > 300 && o.split(" ").length > 50) {
                  texts.push(o);
                } else if (typeof o === "object" && o !== null) {
                  Object.values(o).forEach(walk);
                }
              };
              walk(obj);
              return texts;
            };
            const extracted = findDeepText(json);
            if (extracted.length > 0) {
              cleanText = extracted.join("\n\n");
              break;
            }
          } catch (e) { }
        }

        // STRATEGY 1: DOM Scraping with Rule-Based Targeting
        if (!cleanText || cleanText.length < 500) {
          // Rule 1: Delete Noise
          const noise = ["script", "style", "nav", "svg", "header", "footer", "iframe", "noscript", "aside", "form", "button"];
          noise.forEach(s => doc.querySelectorAll(s).forEach(el => el.remove()));

          // Rule 2: Hunt for the "Heaviest" text block
          const potentialContainers = doc.querySelectorAll("article, main, section, [class*='content'], [id*='content'], [class*='legal'], [class*='policy']");
          let bestNode = null;
          let maxWords = 0;

          potentialContainers.forEach(node => {
            const wordCount = (node.innerText || "").split(/\s+/).length;
            if (wordCount > maxWords) {
              maxWords = wordCount;
              bestNode = node;
            }
          });

          const root = bestNode || doc.body;
          cleanText = root.innerText;
        }

        // Rule 3: Final cleanup and HTML stripping
        cleanText = cleanText
          .replace(/<[^>]+>/g, '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .replace(/(\n){3,}/g, '\n\n')
          .trim();

        // THIS IS THE IMPORTANT PART - MOVED OUTSIDE THE INNER TRY-CATCH
        if (cleanText.length > 500) {
          console.log(`%c[CookieWise] Full ${docType.toUpperCase()} Extracted for ${domain}`, "color: #4CAF50; font-weight: bold; font-size: 14px;");
          console.log(`Source URL: ${url}`);
          console.log(cleanText.slice(0, 10000) + (cleanText.length > 10000 ? "\n...[Truncated]..." : ""));
          console.log(`%c[CookieWise] --- End of ${docType.toUpperCase()} ---`, "color: #4CAF50; font-weight: bold;");

          // 🔥 SEND TO BACKGROUND
          console.log(`📤 Sending ${docType} to background for storage...`);

          chrome.runtime.sendMessage({
            type: "POLICY_EXTRACTED",
            payload: {
              docType: docType.toLowerCase(),
              text: cleanText,
              domain: domain,
              url: url
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Error sending to background:', chrome.runtime.lastError);
            } else {
              console.log(`✅ Successfully sent ${docType} to background`);
            }
          });

          // Also store in sessionStorage as backup
          try {
            sessionStorage.setItem(`cookiewise_${docType.toLowerCase()}`, cleanText);
            console.log(`💾 Backup stored in sessionStorage`);
          } catch (e) {
            console.error('Failed to store in sessionStorage:', e);
          }
        } else {
          console.log(`[CookieWise] Document at ${url} appears to be empty or protected.`);
        }

      } catch (e) {
        console.error("[CookieWise] DOM Extraction Error:", e);
      }
    }
  });

  // Run immediately (document_idle — DOM is ready)
  function run() {
    console.log("[CookieWise] Checking for banners/policies...");
    let result;
    try {
      result = detectBanner();
    } catch (e) {
      console.error("CookieWise Detection Error:", e);
      result = { found: false, error: true };
    }

    // Store result so popup can read it
    try { sessionStorage.setItem("cookiewise_result", JSON.stringify(result)); } catch (_) { }

    // Update badge
    chrome.runtime.sendMessage({
      type: "COOKIE_BANNER_RESULT",
      payload: { ...result, url: location.href, timestamp: Date.now() },
    });

    if (result.found) {
      console.warn("[CookieWise] Banner MATCHED:", result.method);
      // Inline hideAlert logic
      const alert = document.getElementById("cookiewise-status-alert");
      if (alert) {
        alert.classList.remove("cw-visible");
        setTimeout(() => alert.remove(), 500);
      }
    } else {
      showAlert(result.error ? "Error on site." : "Unable to detect banner.");
    }

    // --- POLICY EXTRACTION (Once per sessions) ---
    if (!processedThisSession) {
      const legalLinks = findLegalLinks(result.element || document);
      const foundAny = Object.keys(legalLinks).length > 0;

      if (foundAny) {
        processedThisSession = true;
        for (const [type, url] of Object.entries(legalLinks)) {
          console.log(`[CookieWise] Extracting ${type} document:`, url);
          chrome.runtime.sendMessage({
            type: "PROCESS_POLICY",
            payload: { url, domain: location.hostname, docType: type }
          });
        }
      }
    }
  }

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
