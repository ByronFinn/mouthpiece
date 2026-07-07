import { loadSettings } from "../shared/storage";

const SCRIPT_ID = "mouthpiece-content";
/**
 * Fixed path of the standalone content-script bundle produced by the separate
 * Vite build output (see vite.config.ts). Must be a classic (IIFE) script
 * relative to the extension root.
 */
const CONTENT_JS = "content.js";

/**
 * Ensures the dynamic content script is registered or unregistered based on
 * `enabled && apiKey`. Called at SW startup and whenever settings change.
 *
 * Per ADR 0001, the manifest carries NO content_scripts — Chrome never injects
 * on real pages automatically. The Service Worker registers `content.js`
 * dynamically here, so injection happens only when the user has enabled the
 * extension AND configured an API key.
 *
 * When the extension transitions to enabled (or the SW starts up with enabled
 * already on), already-open tabs would otherwise remain without the content
 * script — `registerContentScripts` only affects future navigations. We
 * proactively inject `content.js` into every matching existing tab via
 * `chrome.scripting.executeScript`. The content script is idempotent (its
 * `activateIfAllowed()` no-ops if already active), so re-injection is safe.
 */
export async function syncContentScriptRegistration(): Promise<void> {
  const settings = await loadSettings();
  const shouldRun = settings.enabled && !!settings.apiKey;

  const existing = await chrome.scripting.getRegisteredContentScripts();
  const isRegistered = existing.some((s) => s.id === SCRIPT_ID);

  if (shouldRun && !isRegistered) {
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js: [CONTENT_JS],
        matches: ["<all_urls>"],
        runAt: "document_idle",
        allFrames: false,
      },
    ]);
    // Cover already-open tabs that won't get the newly-registered script.
    await injectIntoExistingTabs();
  } else if (!shouldRun && isRegistered) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}

/**
 * Injects the content script into all currently-open http(s) tabs. Called when
 * registration is first created (enabled toggle or SW startup while enabled).
 * Failures on individual tabs (e.g. chrome:// pages, no permission) are
 * ignored — the tab simply won't get the script until its next navigation.
 */
async function injectIntoExistingTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const targets = tabs
      .filter((t) => typeof t.id === "number" && /^https?:/.test(t.url || ""))
      .map((t) => ({ tabId: t.id as number }));

    if (targets.length === 0) return;

    // Fan out per-tab to tolerate individual failures (chrome://, web store,
    // dev tools, etc.). The content script's activateIfAllowed() is idempotent,
    // so re-injection on already-active tabs is a safe no-op.
    await Promise.all(
      targets.map((target) =>
        chrome.scripting
          .executeScript({ target, files: [CONTENT_JS] })
          .catch(() => {
            /* tab not injectable — skip */
          }),
      ),
    );
  } catch (err: unknown) {
    console.error("[mouthpiece] inject into existing tabs failed:", err);
  }
}


