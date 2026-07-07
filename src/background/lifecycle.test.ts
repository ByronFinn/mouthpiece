import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startRequest, completeRequest, abortCurrent } from "./lifecycle";

describe("lifecycle (AbortController + heartbeat)", () => {
  const alarmCreate = vi.fn();
  const alarmClear = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      alarms: {
        create: alarmCreate,
        clear: alarmClear,
      },
    });
    alarmCreate.mockClear();
    alarmClear.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("startRequest returns an un-aborted controller and starts the heartbeat", () => {
    const controller = startRequest();
    expect(controller.signal.aborted).toBe(false);
    expect(alarmCreate).toHaveBeenCalledTimes(1);
  });

  it("startRequest aborts the previous in-flight controller", () => {
    const first = startRequest();
    const second = startRequest();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });

  it("abortCurrent aborts the active controller and stops the heartbeat", () => {
    const controller = startRequest();
    abortCurrent();
    expect(controller.signal.aborted).toBe(true);
    expect(alarmClear).toHaveBeenCalled();
  });

  it("completeRequest stops the heartbeat without aborting", () => {
    const controller = startRequest();
    completeRequest();
    // The controller itself isn't aborted — the request finished normally.
    expect(controller.signal.aborted).toBe(false);
    expect(alarmClear).toHaveBeenCalled();
  });
});
