import { loadSettings } from "../shared/storage";
import { ContentState } from "./state";
import { extractTextWithEmoji } from "./selection/text";
import { extractImages } from "./selection/images";
import {
  createFloatingButton,
  showFloatingButton,
  hideFloatingButton,
} from "./ui/floating-button";
import {
  showResultLayer,
  closeResultLayer,
} from "./ui/result-layer";
import { generateComments } from "./generate";

const state = new ContentState();

(async () => {
  state.settings = await loadSettings();
  if (!state.settings.apiKey) return;

  state.currentPresetId = state.settings.selectedPresetIds[0] || "critic";
  createFloatingButton(state, onFloatingBtnClick);
  document.addEventListener("mouseup", onMouseUp, { capture: true });
})();

chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    loadSettings().then((newSettings) => {
      state.settings = newSettings;
      state.currentPresetId = newSettings.selectedPresetIds[0] || "critic";
    });
  }
});

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