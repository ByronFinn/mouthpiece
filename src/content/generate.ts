import type { ContentState } from "./state";
import { convertImagesToBase64 } from "./selection/images";
import {
  setLoadingState,
  renderComments,
  renderMultiComments,
  renderError,
} from "./ui/result-layer";
import { GENERATION_FAILED_PREFIX, REQUEST_FAILED_PREFIX, UNKNOWN_ERROR } from "../shared/errors";

export async function generateComments(state: ContentState): Promise<void> {
  if (state.isLoading || !state.resultLayer) return;
  state.isLoading = true;
  setLoadingState(state, true);

  const body = state.resultLayer.querySelector("#mp-layer-body") as HTMLDivElement;
  const styleSelect = state.resultLayer.querySelector("#mp-style-select") as HTMLSelectElement | null;

  if (styleSelect) {
    state.currentPresetId = styleSelect.value;
  }

  const isMulti = state.settings?.generationMode === "multi";

  try {
    const base64Images = await convertImagesToBase64(state.currentImages);

    const response = await chrome.runtime.sendMessage({
      type: "generate",
      text: state.currentText,
      images: base64Images,
      presetIds: isMulti ? state.settings!.selectedPresetIds : [state.currentPresetId],
      generationMode: isMulti ? "multi" : "single",
    });

    if (!response.ok) {
      renderError(body, response.error || `${GENERATION_FAILED_PREFIX}${UNKNOWN_ERROR}`, () => generateComments(state));
    } else if (isMulti && response.multiData) {
      renderMultiComments(body, response.multiData);
    } else if (!isMulti && response.data?.comments?.length) {
      renderComments(body, response.data);
    } else {
      renderError(body, "没有生成评论", () => generateComments(state));
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    renderError(body, `${REQUEST_FAILED_PREFIX}${message}`, () => generateComments(state));
  } finally {
    state.isLoading = false;
    setLoadingState(state, false);
  }
}