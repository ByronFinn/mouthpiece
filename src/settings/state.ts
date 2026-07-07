import type { Settings } from "../shared/types";

/**
 * Encapsulates the mutable state of the settings page, mirroring the
 * `ContentState` pattern in the content script. Replaces module-level `let`
 * variables so state transitions are explicit and testable.
 */
export class SettingsState {
  settings: Settings | null = null;
  editingPresetId: string | null = null;

  constructor(initial?: Settings) {
    if (initial) this.settings = initial;
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
  }

  startEditing(presetId: string): void {
    this.editingPresetId = presetId;
  }

  stopEditing(): void {
    this.editingPresetId = null;
  }

  toggleEditing(presetId: string): void {
    this.editingPresetId = this.editingPresetId === presetId ? null : presetId;
  }
}

/**
 * Encapsulates popup state. Smaller than SettingsState — the popup only needs
 * the loaded settings, no edit tracking. Provided for consistency with the
 * per-end state-class convention.
 */
export class PopupState {
  settings: Settings | null = null;

  constructor(initial?: Settings) {
    if (initial) this.settings = initial;
  }

  setSettings(settings: Settings): void {
    this.settings = settings;
  }
}
