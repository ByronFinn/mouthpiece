import { loadSettings } from "../shared/storage";

const SCRIPT_ID = "mouthpiece-content";

/**
 * Ensures the dynamic content script is registered or unregistered based on
 * `enabled && apiKey`. Called at SW startup and whenever settings change.
 *
 * Per ADR 0001, the manifest carries a placeholder match (mouthpiece.invalid)
 * so Chrome never injects on real pages; we register the actual script here.
 */
export async function syncContentScriptRegistration(): Promise<void> {
  const settings = await loadSettings();
  const shouldRun = settings.enabled && !!settings.apiKey;

  const existing = await chrome.scripting.getRegisteredContentScripts();
  const isRegistered = existing.some((s) => s.id === SCRIPT_ID);

  if (shouldRun && !isRegistered) {
    const manifest = chrome.runtime.getManifest();
    // Manifest placeholder lists the content js path; reuse it so the path stays
    // declared in one place.
    const placeholder = (manifest.content_scripts?.[0]) as { js?: string[] } | undefined;
    const js = placeholder?.js ?? ["src/content/index.ts"];

    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js,
        matches: ["<all_urls>"],
        runAt: "document_idle",
        allFrames: false,
      },
    ]);
  } else if (!shouldRun && isRegistered) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}
