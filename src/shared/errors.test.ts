import { describe, it, expect } from "vitest";
import {
  mapHttpError,
  withThinkingDisableHint,
  THINKING_DISABLE_PARAM_HINT,
} from "./errors";

describe("withThinkingDisableHint", () => {
  it("appends hint for 400/422 when disable thinking is active", () => {
    const base = mapHttpError(400);
    const msg = withThinkingDisableHint(base, 400, true);
    expect(msg).toContain(base);
    expect(msg).toContain(THINKING_DISABLE_PARAM_HINT);
  });

  it("does not append when disable thinking is off", () => {
    const base = mapHttpError(400);
    expect(withThinkingDisableHint(base, 400, false)).toBe(base);
  });

  it("does not append for unrelated status codes", () => {
    const base = mapHttpError(401);
    expect(withThinkingDisableHint(base, 401, true)).toBe(base);
  });
});
