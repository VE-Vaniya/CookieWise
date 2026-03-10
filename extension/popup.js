/**
 * CookieWise — Popup Script
 * Queries the background for the current tab's detection result
 * and renders the UI accordingly.
 */

"use strict";

/* ── DOM refs ─────────────────────────────────────────────────── */
const statusCard   = document.getElementById("statusCard");
const statusIcon   = document.getElementById("statusIcon");
const statusTitle  = document.getElementById("statusTitle");
const statusDesc   = document.getElementById("statusDesc");
const detailsBox   = document.getElementById("detailsBox");
const detMethod    = document.getElementById("detMethod");
const selectorRow  = document.getElementById("selectorRow");
const detSelector  = document.getElementById("detSelector");
const hitsRow      = document.getElementById("hitsRow");
const detHits      = document.getElementById("detHits");
const snippetSection = document.getElementById("snippetSection");
const snippetBox   = document.getElementById("snippetBox");
const statusDot    = document.getElementById("statusDot");
const footerStatus = document.getElementById("footerStatus");
const footerTime   = document.getElementById("footerTime");

/* ── Helpers ──────────────────────────────────────────────────── */
function methodPill(method) {
  const map = {
    vendor_selector:  ["method-vendor",  "Vendor selector"],
    keyword_heuristic:["method-keyword", "Keyword heuristic"],
    multi_keyword:    ["method-multi",   "Multi-keyword scan"],
  };
  const [cls, label] = map[method] ?? ["method-multi", method];
  return `<span class="pill ${cls}">${label}</span>`;
}

function timeAgo(ts) {
  if (!ts) return "";
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 5)  return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

/* ── Render states ────────────────────────────────────────────── */
function renderFound(state) {
  statusCard.className = "status-card found";
  statusIcon.textContent = "🍪";
  statusTitle.innerHTML = "Cookie Banner Detected";
  statusDesc.textContent = "This page is using a cookie consent banner.";

  detailsBox.style.display = "block";
  detMethod.innerHTML = methodPill(state.method);

  if (state.matchedSelector) {
    selectorRow.style.display = "flex";
    detSelector.textContent = state.matchedSelector;
  }
  if (state.keywordHits) {
    hitsRow.style.display = "flex";
    detHits.textContent = state.keywordHits;
  }
  if (state.snippetText) {
    snippetSection.style.display = "block";
    snippetBox.textContent = `"${state.snippetText}…"`;
  }

  statusDot.className = "dot inactive";
  footerStatus.textContent = "Banner found";
  footerTime.textContent = timeAgo(state.timestamp);
}

function renderClear(state) {
  statusCard.className = "status-card clear";
  statusIcon.textContent = "✅";
  statusTitle.innerHTML = "No Banner Detected";
  statusDesc.textContent = "This page does not appear to have a cookie consent banner.";

  statusDot.className = "dot active";
  footerStatus.textContent = "Page is clean";
  footerTime.textContent = state?.timestamp ? timeAgo(state.timestamp) : "";
}

function renderScanning() {
  statusCard.className = "status-card scanning";
  statusIcon.textContent = "⏳";
  statusTitle.innerHTML = '<span class="spinner"></span> Scanning…';
  statusDesc.textContent = "Checking this page for cookie consent banners.";

  statusDot.className = "dot idle";
  footerStatus.textContent = "Waiting for result…";
}

function renderNoData() {
  statusCard.className = "status-card scanning";
  statusIcon.textContent = "🔍";
  statusTitle.innerHTML = "Waiting for scan";
  statusDesc.textContent = "Reload the page to trigger a fresh scan, or navigate to an http/https URL.";

  statusDot.className = "dot idle";
  footerStatus.textContent = "No data yet";
}
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard/risk-score.html")
  });
});

/* ── Main ─────────────────────────────────────────────────────── */
async function init() {
  renderScanning();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { renderNoData(); return; }

  // Only works on http/https pages
  if (!tab.url?.startsWith("http")) {
    statusCard.className = "status-card scanning";
    statusIcon.textContent = "🚫";
    statusTitle.innerHTML = "Unsupported page";
    statusDesc.textContent = "CookieWise only runs on http:// and https:// pages.";
    statusDot.className = "dot idle";
    footerStatus.textContent = "N/A";
    return;
  }

  // Ask background for cached state
  chrome.runtime.sendMessage({ type: "GET_TAB_STATE", tabId: tab.id }, (state) => {
    if (chrome.runtime.lastError) { renderNoData(); return; }

    if (!state) {
      // Try reading sessionStorage injected by content.js as fallback
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            return JSON.parse(sessionStorage.getItem("cookiewise_result") || "null");
          } catch (_) { return null; }
        },
      }).then((results) => {
        const r = results?.[0]?.result;
        if (r?.found !== undefined) {
          r.found ? renderFound(r) : renderClear(r);
        } else {
          renderNoData();
        }
      }).catch(() => renderNoData());
      return;
    }

    state.found ? renderFound(state) : renderClear(state);
  });
}

init();
