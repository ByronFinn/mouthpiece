import type { GenerateRequest, GenerateResponse } from "./types";

/**
 * Typed wrapper around chrome.runtime.sendMessage for the generate flow.
 * Guarantees the request shape at the call site and types the response.
 */
export function sendGenerateMessage(request: GenerateRequest): Promise<GenerateResponse> {
  return chrome.runtime.sendMessage(request);
}
