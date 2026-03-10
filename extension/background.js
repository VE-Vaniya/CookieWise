/**
 * CookieWise — Background Service Worker
 * Listens for detection results from content scripts and
 * updates the toolbar badge / icon accordingly.
 */

"use strict";

/* ------------------------------------------------------------------ */
/*  Badge colours                                                       */
/* ------------------------------------------------------------------ */
const BADGE_FOUND = {
  text: "!",
  color: "#E53935",   // Red — banner detected
  title: "CookieWise: Cookie banner detected on this page",
};

const BADGE_CLEAR = {
  text: "",
  color: "#4CAF50",   // Green — no banner (badge hidden)
  title: "CookieWise: No cookie banner detected",
};

/* ------------------------------------------------------------------ */
/*  Per-tab state store                                                 */
/* ------------------------------------------------------------------ */
const tabState = new Map(); // tabId → result payload

/* ------------------------------------------------------------------ */
/*  Apply badge to a specific tab                                       */
/*  FIX: removed stray `payload` reference that was outside scope      */
/* ------------------------------------------------------------------ */
function applyBadge(tabId, found) {
  const cfg = found ? BADGE_FOUND : BADGE_CLEAR;
  chrome.action.setBadgeText({ tabId, text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
  chrome.action.setTitle({ tabId, title: cfg.title });
}

/* ------------------------------------------------------------------ */
/*  Message listener — receives results from content.js                */
/* ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "COOKIE_BANNER_RESULT") return;

  const tabId = sender?.tab?.id;
  if (!tabId) return;

  const payload = message.payload;
  tabState.set(tabId, payload);
  applyBadge(tabId, payload.found);

  // Show notification only when banner is detected
  if (payload.found) {
    chrome.notifications.create(`cw_${tabId}_${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "CookieWise Alert",
      message: "Cookie banner detected on this site. Click to view details.",
      priority: 2,
    });
  }

  // Persist latest result so popup can query it
  chrome.storage.session
    .set({ [`tab_${tabId}`]: payload })
    .catch(() => {});
});

/* ------------------------------------------------------------------ */
/*  Clean up state when a tab is closed or navigates away              */
/* ------------------------------------------------------------------ */
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
  chrome.storage.session.remove(`tab_${tabId}`).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabState.delete(tabId);
    chrome.storage.session.remove(`tab_${tabId}`).catch(() => {});
    applyBadge(tabId, false);
  }
});

/* ------------------------------------------------------------------ */
/*  Popup queries current tab state                                     */
/* ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "GET_TAB_STATE") return;

  const tabId = message.tabId;
  const state = tabState.get(tabId) ?? null;

  if (state) {
    sendResponse(state);
  } else {
    chrome.storage.session
      .get(`tab_${tabId}`)
      .then((data) => sendResponse(data[`tab_${tabId}`] ?? null))
      .catch(() => sendResponse(null));
    return true; // keep channel open for async response
  }
});

/* ------------------------------------------------------------------ */
/*  Open dashboard (risk-score page) when notification is clicked      */
/*  FIX: updated path to dashboard/risk-score.html                     */
/* ------------------------------------------------------------------ */
chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("dashboard/risk-score.html"),
  });
});
