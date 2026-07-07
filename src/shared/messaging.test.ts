import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendGenerateMessage } from "./messaging";
import type { GenerateRequest } from "./types";

describe("sendGenerateMessage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "chrome",
      {
        runtime: {
          sendMessage: vi.fn(),
        },
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the typed request to chrome.runtime.sendMessage", async () => {
    const request: GenerateRequest = {
      type: "generate",
      text: "hello",
      images: [],
      presetIds: ["critic"],
      generationMode: "single",
    };
    const expected = { ok: true, status: 200, data: { translation: null, comments: [] } };
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(expected as never);

    const result = await sendGenerateMessage(request);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(request);
    expect(result).toEqual(expected);
  });
});
