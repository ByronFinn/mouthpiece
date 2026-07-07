import { describe, it, expect } from "vitest";
import { generateId } from "./id";

describe("generateId", () => {
  it("returns a non-empty string of reasonable length", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(8);
  });

  it("returns distinct values across consecutive calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    // With timestamp + random, 100 consecutive calls should all be distinct
    expect(ids.size).toBe(100);
  });
});
