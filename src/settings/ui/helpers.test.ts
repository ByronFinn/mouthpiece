import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFilterableDropdown } from "./helpers";

const BASE_OPTS = {
  value: "",
  placeholder: "pick one",
  options: ["Apple", "Banana", "Cherry", "apricot"],
  onInput: vi.fn(),
  onSelect: vi.fn(),
};

describe("createFilterableDropdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a wrapper with an input seeded with the initial value", () => {
    const handle = createFilterableDropdown({ ...BASE_OPTS, value: "Banana" });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("Banana");
    expect(input.placeholder).toBe("pick one");
  });

  it("filters options case-insensitively on focus and opens the panel", () => {
    const handle = createFilterableDropdown({ ...BASE_OPTS, value: "ap" });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;

    input.dispatchEvent(new Event("focus"));

    const items = Array.from(handle.wrapper.querySelectorAll(".model-option"));
    // "ap" matches "Apple" and "apricot" (case-insensitive), not Banana/Cherry
    expect(items.map((el) => el.textContent)).toEqual(["Apple", "apricot"]);
    expect(handle.wrapper.querySelector(".model-dropdown-list")?.classList.contains("open")).toBe(true);
  });

  it("marks the option matching the input value as active", () => {
    const handle = createFilterableDropdown({ ...BASE_OPTS, value: "Cherry" });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));

    const active = handle.wrapper.querySelector(".model-option.active") as HTMLElement;
    expect(active.textContent).toBe("Cherry");
  });

  it("commits via mousedown on an option, fires onSelect, and closes the panel", () => {
    const onSelect = vi.fn();
    const handle = createFilterableDropdown({ ...BASE_OPTS, onSelect });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));

    const apple = handle.wrapper.querySelector(".model-option") as HTMLElement;
    // mousedown is what the implementation listens to (prevents blur before click)
    apple.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(input.value).toBe("Apple");
    expect(onSelect).toHaveBeenCalledWith("Apple");
    expect(handle.wrapper.querySelector(".model-dropdown-list")?.classList.contains("open")).toBe(false);
  });

  it("fires onInput when the user types", () => {
    const onInput = vi.fn();
    const handle = createFilterableDropdown({ ...BASE_OPTS, onInput });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;

    input.value = "ban";
    input.dispatchEvent(new Event("input"));

    expect(onInput).toHaveBeenCalledWith("ban");
    // Panel re-renders with the filtered set
    const items = Array.from(handle.wrapper.querySelectorAll(".model-option"));
    expect(items.map((el) => el.textContent)).toEqual(["Banana"]);
  });

  it("supports dynamic options via setOptions + refresh", () => {
    const handle = createFilterableDropdown({ ...BASE_OPTS, options: [], value: "x" });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;

    // Empty options → nothing rendered
    input.value = "";
    input.dispatchEvent(new Event("focus"));
    expect(handle.wrapper.querySelectorAll(".model-option")).toHaveLength(0);

    // Update options and re-render
    handle.setOptions(["New1", "New2"]);
    handle.refresh();

    const items = Array.from(handle.wrapper.querySelectorAll(".model-option"));
    expect(items.map((el) => el.textContent)).toEqual(["New1", "New2"]);
  });

  it("respects shouldHideWhen to close the panel", () => {
    const handle = createFilterableDropdown({
      ...BASE_OPTS,
      value: "Apple",
      shouldHideWhen: (filter, filtered) =>
        filtered.length === 1 && filtered[0] === filter,
    });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;

    // Input exactly matches the only filtered option → hide
    input.value = "Apple";
    input.dispatchEvent(new Event("focus"));

    expect(handle.wrapper.querySelector(".model-dropdown-list")?.classList.contains("open")).toBe(false);
  });

  it("hides the panel on blur", () => {
    const handle = createFilterableDropdown({ ...BASE_OPTS, value: "a" });
    const input = handle.wrapper.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new Event("focus"));
    expect(handle.wrapper.querySelector(".model-dropdown-list")?.classList.contains("open")).toBe(true);

    input.dispatchEvent(new Event("blur"));
    expect(handle.wrapper.querySelector(".model-dropdown-list")?.classList.contains("open")).toBe(false);
  });
});
