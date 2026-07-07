import type { Settings } from "../shared/types";

export class ContentState {
  floatingBtn: HTMLButtonElement | null = null;
  resultLayer: HTMLDivElement | null = null;
  overlay: HTMLDivElement | null = null;
  currentText = "";
  currentImages: string[] = [];
  currentRect: DOMRect | null = null;
  currentPresetId = "";
  isLoading = false;
  settings: Settings | null = null;
  /**
   * Selection anchor in document coordinates (computed once at mouseup time as
   * scrollY/scrollX + viewport rect). Used to reposition UI on scroll/resize
   * without re-querying the (possibly stale) selection.
   */
  selectionAnchor: { docTop: number; docLeft: number; docRight: number; docBottom: number } | null = null;
}