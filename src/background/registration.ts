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
  } else if (!shouldRun && isRegistered) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}

