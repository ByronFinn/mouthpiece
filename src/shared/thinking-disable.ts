import type { Settings, ThinkingDisableProfileId } from "./types";

/** Keys that custom JSON must not override on the chat/completions body. */
export const THINKING_DISABLE_RESERVED_KEYS = [
  "model",
  "messages",
  "stream",
  "response_format",
] as const;

export type ThinkingDisableProfileOption = {
  id: ThinkingDisableProfileId;
  label: string;
};

/** UI labels for preset + custom profiles (order = dropdown order). */
export const THINKING_DISABLE_PROFILE_OPTIONS: ThinkingDisableProfileOption[] = [
  { id: "openai_openrouter", label: "OpenAI / OpenRouter" },
  { id: "deepseek_glm", label: "DeepSeek / 智谱 GLM" },
  { id: "qwen_cloud", label: "Qwen 云（百炼等）" },
  { id: "qwen_glm_local", label: "Qwen / GLM 本地（vLLM·SGLang·llama.cpp）" },
  { id: "ollama", label: "Ollama" },
  { id: "custom", label: "自定义…" },
];

/** Prefabricated disable-thinking fields per profile (single dialect, not stacked). */
export const PRESET_THINKING_DISABLE_FIELDS: Record<
  Exclude<ThinkingDisableProfileId, "custom">,
  Record<string, unknown>
> = {
  openai_openrouter: {
    reasoning: { effort: "none" },
    reasoning_effort: "none",
  },
  deepseek_glm: {
    thinking: { type: "disabled" },
  },
  qwen_cloud: {
    enable_thinking: false,
  },
  qwen_glm_local: {
    chat_template_kwargs: { enable_thinking: false },
  },
  ollama: {
    think: false,
  },
};

export function stripThinkingDisableReservedKeys(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields };
  for (const key of THINKING_DISABLE_RESERVED_KEYS) {
    delete out[key];
  }
  return out;
}

/**
 * Parse custom JSON text into a plain object.
 * Returns null when the text is non-empty but not a JSON object.
 * Empty / whitespace → {}.
 */
export function parseThinkingDisableExtra(
  raw: string
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "须为单个 JSON 对象（不能是数组或原始值）" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "JSON 格式无效" };
  }
}

/**
 * Resolve fields to merge into chat/completions when disabling model thinking.
 * Empty object when the master switch is off or custom JSON is invalid/empty.
 */
export function resolveThinkingDisableFields(
  settings: Pick<
    Settings,
    "disableModelThinking" | "thinkingDisableProfile" | "thinkingDisableExtra"
  >
): Record<string, unknown> {
  if (!settings.disableModelThinking) {
    return {};
  }

  const profile = settings.thinkingDisableProfile;

  if (profile === "custom") {
    const parsed = parseThinkingDisableExtra(settings.thinkingDisableExtra);
    if (!parsed.ok) {
      return {};
    }
    return stripThinkingDisableReservedKeys(parsed.value);
  }

  const preset = PRESET_THINKING_DISABLE_FIELDS[profile];
  if (!preset) {
    return {};
  }
  return { ...preset };
}

/** Short help text for the custom JSON secondary config UI. */
export const THINKING_DISABLE_CUSTOM_HELP = [
  "将额外 JSON 字段合并进 Chat Completions 请求体（与 model、messages 同级）。",
  "只写服务文档里「关闭思考」的字段。示例：",
  '{"thinking":{"type":"disabled"}}',
  '{"enable_thinking":false}',
  '{"chat_template_kwargs":{"enable_thinking":false}}',
  "须为单个 JSON 对象。不要填写 model / messages / stream / response_format（插件会忽略）。",
].join("\n");
