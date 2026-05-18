import type { Settings, Preset } from "./types";
import { DEFAULT_SETTINGS, BUILT_IN_PRESETS } from "./presets";

const STORAGE_KEY = "mouthpiece_settings";

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored: Partial<Settings> = (result[STORAGE_KEY] as Partial<Settings>) || {};

  // Merge with defaults, ensuring built-in presets are always present
  const presets = mergePresets(stored.presets);

  return {
    apiKey: stored.apiKey || "",
    baseUrl: stored.baseUrl || DEFAULT_SETTINGS.baseUrl,
    model: stored.model || DEFAULT_SETTINGS.model,
    translationLang: stored.translationLang || DEFAULT_SETTINGS.translationLang,
    generationMode: stored.generationMode || DEFAULT_SETTINGS.generationMode,
    repliesPerStyle: stored.repliesPerStyle || DEFAULT_SETTINGS.repliesPerStyle,
    presets,
    selectedPresetIds: stored.selectedPresetIds || DEFAULT_SETTINGS.selectedPresetIds,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
}

function mergePresets(stored?: Preset[]): Preset[] {
  if (!stored || !Array.isArray(stored)) return [...DEFAULT_SETTINGS.presets];

  // Ensure built-in presets exist
  const builtInIds = new Set(BUILT_IN_PRESETS.map(p => p.id));
  const storedMap = new Map(stored.map(p => [p.id, p]));

  for (const builtIn of BUILT_IN_PRESETS) {
    if (!storedMap.has(builtIn.id)) {
      stored.push(builtIn);
    }
  }

  return stored;
}
