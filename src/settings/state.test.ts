import { describe, it, expect } from "vitest";
import { SettingsState, PopupState } from "./state";
import { BUILT_IN_PRESETS } from "../shared/presets";
import type { Settings } from "../shared/types";

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    apiKey: "sk-test",
    baseUrl: "https://api.example.com/v1",
    model: "test-model",
    translationLang: "中文",
    generationMode: "single",
    repliesPerStyle: 2,
    presets: [...BUILT_IN_PRESETS],
    selectedPresetIds: ["critic"],
    enabled: true,
    ...overrides,
  };
}

describe("SettingsState", () => {
  it("starts with null settings and no editing preset", () => {
    const s = new SettingsState();
    expect(s.settings).toBeNull();
    expect(s.editingPresetId).toBeNull();
  });

  it("accepts initial settings and exposes setSettings", () => {
    const initial = makeSettings();
    const s = new SettingsState(initial);
    expect(s.settings).toBe(initial);

    const next = makeSettings({ apiKey: "sk-other" });
    s.setSettings(next);
    expect(s.settings?.apiKey).toBe("sk-other");
  });

  it("startEditing / stopEditing manage editingPresetId", () => {
    const s = new SettingsState();
    s.startEditing("critic");
    expect(s.editingPresetId).toBe("critic");
    s.stopEditing();
    expect(s.editingPresetId).toBeNull();
  });

  it("toggleEditing flips the same id and clears when toggled again", () => {
    const s = new SettingsState();
    s.toggleEditing("critic");
    expect(s.editingPresetId).toBe("critic");
    s.toggleEditing("critic");
    expect(s.editingPresetId).toBeNull();
  });

  it("toggleEditing switches to a different id", () => {
    const s = new SettingsState();
    s.startEditing("critic");
    s.toggleEditing("wholesome");
    expect(s.editingPresetId).toBe("wholesome");
  });
});

describe("PopupState", () => {
  it("starts with null settings and exposes setSettings", () => {
    const s = new PopupState();
    expect(s.settings).toBeNull();
    s.setSettings(makeSettings());
    expect(s.settings).not.toBeNull();
  });
});
