import { describe, it, expect } from "vitest";
import { mergePresets } from "./storage";
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
});