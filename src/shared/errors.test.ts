import { describe, it, expect } from "vitest";
import {
  mapHttpError,
  errorFromResponse,
  GENERATION_FAILED_PREFIX,
  REQUEST_FAILED_PREFIX,
  UNKNOWN_ERROR,
} from "./errors";

describe("mapHttpError", () => {
  it("maps known status codes", () => {
    expect(mapHttpError(401)).toContain("API Key");
    expect(mapHttpError(404)).toContain("不存在");
    expect(mapHttpError(429)).toContain("频繁");
  });

  it("maps 5xx to server error", () => {
    expect(mapHttpError(500)).toContain("服务");
    expect(mapHttpError(503)).toContain("服务");
  });
});

describe("errorFromResponse", () => {
  it("returns empty string for a successful response", () => {
    expect(errorFromResponse({ ok: true, status: 200, data: { translation: null, comments: [] } })).toBe("");
  });

  it("uses response.error when present", () => {
    const msg = errorFromResponse({ ok: false, status: 500, error: "boom" });
    expect(msg).toBe(`${GENERATION_FAILED_PREFIX}boom`);
  });

  it("falls back to UNKNOWN_ERROR when error is empty", () => {
    const msg = errorFromResponse({ ok: false, status: 0, error: "" });
    expect(msg).toBe(`${GENERATION_FAILED_PREFIX}${UNKNOWN_ERROR}`);
  });
});

describe("prefix constants", () => {
  it("exposes stable prefixes", () => {
    expect(GENERATION_FAILED_PREFIX).toBe("生成失败：");
    expect(REQUEST_FAILED_PREFIX).toBe("请求失败：");
    expect(UNKNOWN_ERROR).toBe("未知错误");
  });
});
