import type { Settings, ApiResult, GenerateResponse, Comment } from "./types";
import { buildSystemPrompt, buildUserMessageText } from "./presets";
import { mapHttpError, REQUEST_FAILED_PREFIX, withThinkingDisableHint } from "./errors";
import { resolveThinkingDisableFields } from "./thinking-disable";

// Re-exported for backwards compatibility — existing callers (and tests) import mapHttpError from "./api".
export { mapHttpError };

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function isUnsupportedJsonObjectError(status: number): boolean {
  return status === 400 || status === 422;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

function formatRetrySuffix(expectedCount: number): string {
  return (
    `\n\n[Format correction: return ONLY valid JSON. ` +
    `The "comments" array MUST contain exactly ${expectedCount} objects, ` +
    `each with "content" and "translation" fields.]`
  );
}

type ContentPart = { type: string; text?: string; image_url?: { url: string } };

function buildContentParts(userText: string, images: string[]): ContentPart[] {
  const parts: ContentPart[] = [{ type: "text", text: userText }];
  for (const imgUrl of images) {
    parts.push({ type: "image_url", image_url: { url: imgUrl } });
  }
  return parts;
}

/** Build chat/completions body; exported for unit tests. */
export function buildChatBody(
  settings: Settings,
  systemPrompt: string,
  contentParts: ContentPart[],
  useJsonObject: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts },
    ],
    stream: false,
    ...resolveThinkingDisableFields(settings),
  };
  if (useJsonObject) {
    body.response_format = { type: "json_object" };
  }
  return body;
}

function httpErrorForSettings(settings: Settings, status: number): string {
  return withThinkingDisableHint(mapHttpError(status), status, settings.disableModelThinking);
}

async function postChatCompletion(
  settings: Settings,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ ok: true; raw: string } | { ok: false; status: number }> {
  const url = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(settings.apiKey),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content || "";
  return { ok: true, raw };
}

async function generateWithJsonMode(
  settings: Settings,
  systemPrompt: string,
  userText: string,
  images: string[],
  expectedCount: number,
  useJsonObject: boolean,
  signal?: AbortSignal
): Promise<GenerateResponse | "unsupported_json_object"> {
  let text = userText;

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await postChatCompletion(
      settings,
      buildChatBody(settings, systemPrompt, buildContentParts(text, images), useJsonObject),
      signal
    );

    if (!result.ok) {
      if (useJsonObject && isUnsupportedJsonObjectError(result.status)) {
        return "unsupported_json_object";
      }
      return {
        ok: false,
        status: result.status,
        error: httpErrorForSettings(settings, result.status),
      };
    }

    const parsed = tryParseApiResult(result.raw, expectedCount);
    if (parsed) {
      return { ok: true, status: 200, data: parsed };
    }

    if (attempt === 0) {
      text = userText + formatRetrySuffix(expectedCount);
    }
  }

  return { ok: false, status: 0, error: "无法解析 AI 回复" };
}

export async function fetchModels(settings: Settings): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  if (!settings.apiKey || !settings.baseUrl) {
    return { ok: false, error: "请先填写 API Key 和 Base URL" };
  }

  try {
    const res = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/models`, {
      headers: authHeaders(settings.apiKey),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `获取失败 (${res.status}): ${mapHttpError(res.status)}${errText ? ` — ${errText.slice(0, 120)}` : ""}` };
    }
    const data = await res.json();
    const models = ((data.data || []) as { id: string }[])
      .map((m) => m.id)
      .sort();
    return { ok: true, models };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `网络错误: ${message}` };
  }
}

export async function testConnection(settings: Settings): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    return { ok: false, error: "请先填写 API Key、Base URL 和模型" };
  }

  try {
    const body: Record<string, unknown> = {
      model: settings.model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
      ...resolveThinkingDisableFields(settings),
    };
    const res = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        ...authHeaders(settings.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const mapped = httpErrorForSettings(settings, res.status);
      return {
        ok: false,
        error: `连接失败 (${res.status}): ${mapped}${errText ? ` — ${errText.slice(0, 120)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `网络错误: ${message}` };
  }
}

export async function callOpenAI(
  settings: Settings,
  text: string,
  images: string[],
  presetId: string,
  signal?: AbortSignal
): Promise<GenerateResponse> {
  const preset = settings.presets.find(p => p.id === presetId);
  if (!preset) {
    return { ok: false, status: 0, error: "未找到预设风格" };
  }

  const systemPrompt = buildSystemPrompt(
    preset.systemPrompt,
    settings.translationLang,
    settings.repliesPerStyle
  );

  const userText = buildUserMessageText(text, images.length);
  const expectedCount = settings.repliesPerStyle;

  try {
    const jsonModeResult = await generateWithJsonMode(
      settings,
      systemPrompt,
      userText,
      images,
      expectedCount,
      true,
      signal
    );

    if (jsonModeResult !== "unsupported_json_object") {
      return jsonModeResult;
    }

    const fallbackResult = await generateWithJsonMode(
      settings,
      systemPrompt,
      userText,
      images,
      expectedCount,
      false,
      signal
    );
    if (fallbackResult === "unsupported_json_object") {
      return { ok: false, status: 0, error: "无法解析 AI 回复" };
    }
    return fallbackResult;
  } catch (err: unknown) {
    // Aborted requests are expected (user clicked "换一批" or disabled the extension).
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, status: 0, error: "已取消" };
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
      return { ok: false, status: 0, error: "网络连接失败，请检查网络或 Base URL" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: `${REQUEST_FAILED_PREFIX}${message}` };
  }
}

export async function callWithImageFallback(
  settings: Settings,
  text: string,
  images: string[],
  presetId: string,
  signal?: AbortSignal
): Promise<GenerateResponse> {
  let response = await callOpenAI(settings, text, images, presetId, signal);
  if (!response.ok && images.length > 0) {
    response = await callOpenAI(settings, text, [], presetId, signal);
  }
  if (response.ok && "data" in response) {
    response = { ...response, data: sanitizeApiResult(response.data) };
  }
  return response;
}

export function sanitizeApiResult(data: ApiResult): ApiResult {
  return {
    translation: data.translation ? sanitizeOutput(data.translation) : null,
    comments: data.comments.map((c: Comment) => ({
      content: sanitizeOutput(c.content),
      translation: c.translation ? sanitizeOutput(c.translation) : null,
    })),
  };
}

export function validateApiResult(obj: unknown, expectedCount: number): obj is ApiResult {
  if (typeof obj !== "object" || obj === null) return false;

  const result = obj as ApiResult;
  if (!("comments" in result) || !Array.isArray(result.comments)) return false;
  if (result.comments.length !== expectedCount) return false;

  if (
    "translation" in result &&
    result.translation !== null &&
    typeof result.translation !== "string"
  ) {
    return false;
  }

  for (const comment of result.comments) {
    if (typeof comment !== "object" || comment === null) return false;
    if (typeof comment.content !== "string" || !comment.content) return false;
    if (comment.translation !== null && typeof comment.translation !== "string") {
      return false;
    }
  }

  return true;
}

export function tryParseApiResult(raw: string, expectedCount: number): ApiResult | null {
  const parsed = parseResponse(raw);
  if (!parsed || !validateApiResult(parsed, expectedCount)) return null;
  return parsed;
}

export function parseResponse(raw: string): ApiResult | null {
  try {
    const parsed = JSON.parse(raw);
    if (isValidResult(parsed)) return parsed;
  } catch {
    // Not pure JSON — try code-block extraction next.
  }

  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (isValidResult(parsed)) return parsed;
    } catch {
      // Code block wasn't valid JSON — fall through to brace extraction.
    }
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
      if (isValidResult(parsed)) return parsed;
    } catch {
      // All parse strategies exhausted — caller will handle null.
    }
  }

  return null;
}

function isValidResult(obj: unknown): obj is ApiResult {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "comments" in obj &&
    Array.isArray((obj as ApiResult).comments) &&
    (obj as ApiResult).comments.length > 0
  );
}

export function sanitizeOutput(text: string): string {
  const leakedPatterns = [
    /system prompt/i,
    /ignore (previous|above|all)/i,
    /forget (your|all|previous)/i,
  ];

  for (const pattern of leakedPatterns) {
    if (pattern.test(text)) {
      return "[输出已过滤：检测到异常内容]";
    }
  }

  return text;
}