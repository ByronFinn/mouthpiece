import { describe, it, expect } from "vitest";
import {
  resolveThinkingDisableFields,
  parseThinkingDisableExtra,
  stripThinkingDisableReservedKeys,
  PRESET_THINKING_DISABLE_FIELDS,
} from "./thinking-disable";
import type { Settings } from "./types";
import { BUILT_IN_PRESETS } from "./presets";

function settings(
  overrides: Partial<
    Pick<
      Settings,
      "disableModelThinking" | "thinkingDisableProfile" | "thinkingDisableExtra"
    >
  > = {}
): Pick<
  Settings,
  "disableModelThinking" | "thinkingDisableProfile" | "thinkingDisableExtra"
> {
  return {
    disableModelThinking: true,
    thinkingDisableProfile: "deepseek_glm",
    thinkingDisableExtra: "{}",
    ...overrides,
  };
}

describe("resolveThinkingDisableFields", () => {
  it("returns deepseek_glm fields by default profile", () => {
    expect(resolveThinkingDisableFields(settings())).toEqual(
      PRESET_THINKING_DISABLE_FIELDS.deepseek_glm
    );
    expect(resolveThinkingDisableFields(settings()).thinking).toEqual({
      type: "disabled",
    });
  });

  it("returns empty when master switch is off", () => {
    expect(
      resolveThinkingDisableFields(settings({ disableModelThinking: false }))
    ).toEqual({});
  });

  it("maps each prefab profile to its fields only", () => {
    for (const [id, fields] of Object.entries(PRESET_THINKING_DISABLE_FIELDS)) {
      const resolved = resolveThinkingDisableFields(
        settings({ thinkingDisableProfile: id as keyof typeof PRESET_THINKING_DISABLE_FIELDS })
      );
      expect(resolved).toEqual(fields);
      // No accidental stacking of other dialects
      if (id !== "deepseek_glm") {
        expect(resolved).not.toHaveProperty("thinking");
      }
      if (id !== "qwen_cloud") {
        expect(resolved).not.toHaveProperty("enable_thinking");
      }
    }
  });

  it("merges custom JSON after stripping reserved keys", () => {
    const extra = JSON.stringify({
      thinking: { type: "disabled" },
      model: "should-not-appear",
      messages: [],
      stream: true,
      response_format: { type: "json_object" },
      foo: 1,
    });
    const resolved = resolveThinkingDisableFields(
      settings({ thinkingDisableProfile: "custom", thinkingDisableExtra: extra })
    );
    expect(resolved).toEqual({ thinking: { type: "disabled" }, foo: 1 });
    expect(resolved).not.toHaveProperty("model");
    expect(resolved).not.toHaveProperty("messages");
    expect(resolved).not.toHaveProperty("stream");
    expect(resolved).not.toHaveProperty("response_format");
  });

  it("returns empty for invalid custom JSON", () => {
    expect(
      resolveThinkingDisableFields(
        settings({ thinkingDisableProfile: "custom", thinkingDisableExtra: "not-json" })
      )
    ).toEqual({});
  });
});

describe("parseThinkingDisableExtra", () => {
  it("accepts empty as {}", () => {
    expect(parseThinkingDisableExtra("")).toEqual({ ok: true, value: {} });
    expect(parseThinkingDisableExtra("   ")).toEqual({ ok: true, value: {} });
  });

  it("rejects arrays and primitives", () => {
    expect(parseThinkingDisableExtra("[]").ok).toBe(false);
    expect(parseThinkingDisableExtra("1").ok).toBe(false);
    expect(parseThinkingDisableExtra('"x"').ok).toBe(false);
  });

  it("accepts a plain object", () => {
    expect(parseThinkingDisableExtra('{"a":true}')).toEqual({
      ok: true,
      value: { a: true },
    });
  });
});

describe("stripThinkingDisableReservedKeys", () => {
  it("removes reserved keys only", () => {
    expect(
      stripThinkingDisableReservedKeys({
        model: "x",
        messages: [],
        stream: false,
        response_format: {},
        thinking: { type: "disabled" },
      })
    ).toEqual({ thinking: { type: "disabled" } });
  });
});

// Ensure Settings-shaped defaults still typecheck when used in tests elsewhere
export function fullSettingsFixture(overrides: Partial<Settings> = {}): Settings {
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
    disableModelThinking: true,
    thinkingDisableProfile: "deepseek_glm",
    thinkingDisableExtra: "{}",
    ...overrides,
  };
}
