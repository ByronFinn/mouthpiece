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
}