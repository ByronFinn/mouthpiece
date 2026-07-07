import type { GenerateResponse } from "./types";

/** Prefix used when a generation request fails (background wraps failure into a comment). */
export const GENERATION_FAILED_PREFIX = "生成失败：";
/** Prefix used when an unexpected request error reaches the caller. */
export const REQUEST_FAILED_PREFIX = "请求失败：";
/** Fallback message when no error detail is available. */
export const UNKNOWN_ERROR = "未知错误";

/** Maps an HTTP status code to a localized user-facing message. */
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

/**
 * Extracts the user-facing error message from a failed GenerateResponse.
 * Returns the prefix + UNKNOWN_ERROR if the response carries no error detail.
 */
export function errorFromResponse(response: GenerateResponse): string {
  if (response.ok) return "";
  return `${GENERATION_FAILED_PREFIX}${response.error || UNKNOWN_ERROR}`;
}
