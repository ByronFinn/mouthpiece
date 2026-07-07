import { loadSettings } from "../shared/storage";
import { ContentState } from "./state";
import { extractTextWithEmoji } from "./selection/text";
import { extractImages } from "./selection/images";
import {
  createFloatingButton,
  showFloatingButton,
  hideFloatingButton,
  destroyFloatingButton,
} from "./ui/floating-button";
import {
  showResultLayer,
  closeResultLayer,
} from "./ui/result-layer";
import { generateComments } from "./generate";

const state = new ContentState();
let active = false;

(async () => {
  state.settings = await loadSettings();
  activateIfAllowed();
})();

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadSettings().then((newSettings) => {
    const wasActive = active;
    state.settings = newSettings;
    state.currentPresetId = newSettings.selectedPresetIds[0] || "critic";

    if (newSettings.enabled && newSettings.apiKey) {
      activateIfAllowed();
    } else if (wasActive) {
      // Disabled or key cleared — tear down everything and stop responding.
      deactivate();
    }
  });
});

/** Bind UI only when enabled && apiKey; idempotent. */
function activateIfAllowed(): void {
  if (active) return;
  if (!state.settings || !state.settings.enabled || !state.settings.apiKey) return;
  active = true;
  createFloatingButton(state, onFloatingBtnClick);
  document.addEventListener("mouseup", onMouseUp, { capture: true });
}

/** Remove all UI and unbind events; idempotent. */
function deactivate(): void {
  active = false;
  document.removeEventListener("mouseup", onMouseUp, { capture: true });
  hideFloatingButton(state);
  closeResultLayer(state);
  destroyFloatingButton(state);
}

function onMouseUp(e: MouseEvent) {
  if (
    e.target instanceof HTMLElement &&
    (e.target.closest("#mp-floating-btn") ||
      e.target.closest("#mp-result-layer") ||
      e.target.closest("#mp-overlay"))
  ) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    hideFloatingButton(state);
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const clonedRange = range.cloneRange();

  let text = extractTextWithEmoji(clonedRange).trim();
  if (!text) {
    text = selection.toString().trim();
  }
  if (text.length < 2) {
    hideFloatingButton(state);
    return;
  }

  state.currentText = text;
  state.currentImages = extractImages(clonedRange);
  state.currentRect = rect;

  showFloatingButton(state, rect);
}

async function onFloatingBtnClick(e: MouseEvent) {
  e.stopPropagation();
  hideFloatingButton(state);
  showResultLayer(
    state,
    () => closeResultLayer(state),
    () => generateComments(state),
    () => generateComments(state)
  );
  await generateComments(state);
}