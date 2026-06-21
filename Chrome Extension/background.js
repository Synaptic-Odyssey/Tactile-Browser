// background.js
// Service worker for the Tactile Browser extension.
//
// Responsibilities:
//   • Route TACTILE_ELEMENTS_UPDATE from content script → popup (if open).
//   • Route TACTILE_CELL_READ / TACTILE_CELL_ACTIVATE from popup → content script.
//
// Chrome MV3 service workers cannot hold persistent state, so we do not cache
// the latest grid here.  The popup requests a fresh render via
// TACTILE_REQUEST_LATEST when it opens.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // ── Content → Popup ────────────────────────────────────────────────────
    if (message.type === 'TACTILE_ELEMENTS_UPDATE') {
        // Broadcast to all extension pages (popup, devtools panel, etc.)
        // chrome.runtime.sendMessage throws if nothing is listening; swallow it.
        chrome.runtime.sendMessage(message).catch(() => {});
        return false; // no async response needed
    }

    // ── Popup → Content ────────────────────────────────────────────────────
    if (
        message.type === 'TACTILE_CELL_READ' ||
        message.type === 'TACTILE_CELL_ACTIVATE'
    ) {
        // Forward to the active tab's content script.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs.length) { sendResponse({ ok: false, reason: 'no active tab' }); return; }
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ ok: false, reason: chrome.runtime.lastError.message });
                } else {
                    sendResponse(response);
                }
            });
        });
        return true; // keep channel open for async sendResponse
    }

    // ── Popup opened: ask content script to re-render immediately ──────────
    if (message.type === 'TACTILE_REQUEST_LATEST') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs.length) return;
            chrome.tabs.sendMessage(tabs[0].id, { type: 'TACTILE_FORCE_RENDER' });
        });
        return false;
    }
});