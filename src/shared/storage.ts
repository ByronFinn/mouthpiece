import type { Settings, Preset, ThinkingDisableProfileId } from "./types";
import { DEFAULT_SETTINGS, BUILT_IN_PRESETS } from "./presets";
import { PRESET_THINKING_DISABLE_FIELDS } from "./thinking-disable";

const STORAGE_KEY = "mouthpiece_settings";

const KNOWN_THINKING_PROFILES = new Set<string>([
  ...Object.keys(PRESET_THINKING_DISABLE_FIELDS),
  "custom",
]);

function resolveThinkingDisableProfile(
  stored: Partial<Settings>
): ThinkingDisableProfileId {
  const p = stored.thinkingDisableProfile;
  if (typeof p === "string" && KNOWN_THINKING_PROFILES.has(p)) {
    return p as ThinkingDisableProfileId;
  }
  return DEFAULT_SETTINGS.thinkingDisableProfile;
}

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored: Partial<Settings> = (result[STORAGE_KEY] as Partial<Settings>) || {};

  // Merge with defaults, ensuring built-in presets are always present
  const presets = mergePresets(stored.presets);

  // Migration: existing users who already configured a key are assumed to want
  // the extension active. New installs (no stored `enabled`, no key) stay opt-in.
  const hasStoredEnabledFlag = "enabled" in stored;
  const migratedEnabled = !hasStoredEnabledFlag && !!stored.apiKey;

  // Missing flag → default true (disable thinking). Explicit false is preserved.
  const disableModelThinking =
    typeof stored.disableModelThinking === "boolean"
      ? stored.disableModelThinking
      : DEFAULT_SETTINGS.disableModelThinking;

  return {
    apiKey: stored.apiKey || "",
    baseUrl: stored.baseUrl || DEFAULT_SETTINGS.baseUrl,
    model: stored.model || DEFAULT_SETTINGS.model,
    translationLang: stored.translationLang || DEFAULT_SETTINGS.translationLang,
    generationMode: stored.generationMode || DEFAULT_SETTINGS.generationMode,
    repliesPerStyle: stored.repliesPerStyle || DEFAULT_SETTINGS.repliesPerStyle,
    presets,
    selectedPresetIds: stored.selectedPresetIds || DEFAULT_SETTINGS.selectedPresetIds,
    enabled: migratedEnabled || !!stored.enabled,
    disableModelThinking,
    thinkingDisableProfile: resolveThinkingDisableProfile(stored),
    thinkingDisableExtra:
      typeof stored.thinkingDisableExtra === "string"
        ? stored.thinkingDisableExtra
        : DEFAULT_SETTINGS.thinkingDisableExtra,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEY]: merged });
}

export function mergePresets(stored?: Preset[]): Preset[] {
  if (!stored || !Array.isArray(stored)) return [...DEFAULT_SETTINGS.presets];

  // Work on a copy — never mutate the caller's array.
  const result = [...stored];

  // Ensure built-in presets exist
  const storedMap = new Map(result.map(p => [p.id, p]));

  for (const builtIn of BUILT_IN_PRESETS) {
    if (!storedMap.has(builtIn.id)) {
      result.push(builtIn);
    }
  }

  return result;
}
