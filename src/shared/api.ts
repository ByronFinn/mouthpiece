import type { Settings, ApiResult, GenerateResponse, Comment } from "./types";
import { buildSystemPrompt, buildUserMessageText } from "./presets";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function mapHttpError(status: number): string {
  switch (status) {
    case 401: return "API Key 无效，请检查设置";
    case 402: return "账户余额不足";
    case 403: return "无权限访问";
    case 404: return "模型或接口不存在，请检查模型名称";
    case 429: return "API 配额不足或请求过于频繁，请稍后重试";
    case 500:
    case 502:
    case 503: return "AI 服务暂时不可用，请稍后重试";
    default: return status >= 500 ? "服务器错误，请稍后重试" : `请求失败 (HTTP ${status})`;
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
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
    const res = await fetch(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        ...authHeaders(settings.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `连接失败 (${res.status}): ${mapHttpError(res.status)}${errText ? ` — ${errText.slice(0, 120)}` : ""}` };
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
  presetId: string
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

  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: userText },
  ];

  for (const imgUrl of images) {
    contentParts.push({
      type: "image_url",
      image_url: { url: imgUrl },
    });
  }

  const body = {
    model: settings.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts },
    ],
    stream: false,
  };

  try {
    const url = `${normalizeBaseUrl(settings.baseUrl)}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(settings.apiKey),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: mapHttpError(res.status) };
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || "";
    const parsed = parseResponse(raw);

    if (!parsed) {
      return { ok: false, status: 0, error: "无法解析 AI 回复" };
    }

    return { ok: true, status: 200, data: parsed };
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      return { ok: false, status: 0, error: "网络连接失败，请检查网络或 Base URL" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: `请求失败：${message}` };
  }
}

export async function callWithImageFallback(
  settings: Settings,
  text: string,
  images: string[],
  presetId: string
): Promise<GenerateResponse> {
  let response = await callOpenAI(settings, text, images, presetId);
  if (!response.ok && images.length > 0) {
    response = await callOpenAI(settings, text, [], presetId);
  }
  if (response.ok && response.data) {
    response.data = sanitizeApiResult(response.data);
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

export function parseResponse(raw: string): ApiResult | null {
  try {
    const parsed = JSON.parse(raw);
    if (isValidResult(parsed)) return parsed;
  } catch {}

  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (isValidResult(parsed)) return parsed;
    } catch {}
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
      if (isValidResult(parsed)) return parsed;
    } catch {}
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