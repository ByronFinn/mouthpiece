import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mergePresets, loadSettings } from "./storage";
import { BUILT_IN_PRESETS } from "./presets";

describe("mergePresets", () => {
  it("returns defaults when stored is undefined", () => {
    const presets = mergePresets(undefined);
    expect(presets).toHaveLength(BUILT_IN_PRESETS.length);
    expect(presets.map((p) => p.id).sort()).toEqual(BUILT_IN_PRESETS.map((p) => p.id).sort());
  });

  it("ensures built-in presets are always present", () => {
    const presets = mergePresets([]);
    for (const builtIn of BUILT_IN_PRESETS) {
      expect(presets.some((p) => p.id === builtIn.id)).toBe(true);
    }
  });

  it("preserves custom presets", () => {
    const custom = {
      id: "custom-1",
      name: "自定义",
      systemPrompt: "test",
      builtIn: false,
    };
    const presets = mergePresets([custom]);
    expect(presets.some((p) => p.id === "custom-1")).toBe(true);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "custom-1", name: "自定义", systemPrompt: "test", builtIn: false },
    ];
    const snapshot = [...input];

    const result = mergePresets(input);

    // Input array reference is unchanged
    expect(input).toEqual(snapshot);
    // Result is a new array (built-ins were appended to the copy, not the input)
    expect(result).not.toBe(input);
    expect(result.length).toBeGreaterThan(input.length);
  });
});

describe("loadSettings enabled migration", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "chrome",
      {
        storage: {
          local: {
            get: vi.fn(),
          },
        },
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockStored(value: unknown): void {
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce(value as never);
  }

  it("defaults enabled to false for fresh install (no stored data)", async () => {
    mockStored({});
    const s = await loadSettings();
    expect(s.enabled).toBe(false);
  });

  it("migrates existing users with a key to enabled=true", async () => {
    // No stored `enabled` flag, but apiKey present → migrate.
    mockStored({ mouthpiece_settings: { apiKey: "sk-existing" } });
    const s = await loadSettings();
    expect(s.enabled).toBe(true);
    expect(s.apiKey).toBe("sk-existing");
  });

  it("respects an explicitly stored enabled=false", async () => {
    mockStored({
      mouthpiece_settings: { apiKey: "sk-existing", enabled: false },
    });
    const s = await loadSettings();
    expect(s.enabled).toBe(false);
  });
});