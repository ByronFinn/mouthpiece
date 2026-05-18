import type { Settings, ApiResult, GenerateResponse } from "./types";
import { buildSystemPrompt } from "./presets";

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

  // Build user message content
  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  contentParts.push({
    type: "text",
    text: text,
  });

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
    const url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = mapHttpError(res.status);
      return { ok: false, status: res.status, error };
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || "";
    const parsed = parseResponse(raw);

    if (!parsed) {
      return { ok: false, status: 0, error: "无法解析 AI 回复" };
    }

    return { ok: true, status: 200, data: parsed };
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      return { ok: false, status: 0, error: "网络连接失败，请检查网络或 Base URL" };
    }
    return { ok: false, status: 0, error: `请求失败：${err.message}` };
  }
}

function mapHttpError(status: number): string {
  switch (status) {
    case 401: return "API Key 无效，请检查设置";
    case 402:
    case 429: return "API 配额不足或请求过于频繁";
    case 404: return "模型不存在，请检查模型名称";
    case 500:
    case 502:
    case 503: return "AI 服务暂时不可用，请稍后重试";
    default: return `请求失败 (HTTP ${status})`;
  }
}

function parseResponse(raw: string): ApiResult | null {
  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    if (isValidResult(parsed)) return parsed;
  } catch {}

  // 2. Extract from code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (isValidResult(parsed)) return parsed;
    } catch {}
  }

  // 3. Bracket matching — find outermost { }
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

function isValidResult(obj: any): obj is ApiResult {
  return (
    obj &&
    typeof obj === "object" &&
    "comments" in obj &&
    Array.isArray(obj.comments) &&
    obj.comments.length > 0
  );
}

export function sanitizeOutput(text: string): string {
  // Detect prompt leakage in output
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
