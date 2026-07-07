export function showToast(msg: string): void {
  const toast = document.getElementById("toast")!;
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2000);
}

export function createFormGroup(labelText: string, input: HTMLElement): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "form-group";
  const label = document.createElement("label");
  label.textContent = labelText;
  group.appendChild(label);
  group.appendChild(input);
  return group;
}

export function createInput(
  type: string,
  value: string,
  placeholder: string,
  onChange: (v: string) => Promise<void>
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  let timeout: ReturnType<typeof setTimeout>;
  input.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => onChange(input.value), 500);
  });
  return input;
}

export interface FilterableDropdownOptions {
  value: string;
  placeholder: string;
  options: string[];
  onInput: (value: string) => void;
  onSelect: (value: string) => void;
  shouldHideWhen?: (filter: string, filtered: string[]) => boolean;
}

export function createFilterableDropdown(opts: FilterableDropdownOptions): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "model-dropdown";

  const input = document.createElement("input");
  input.type = "text";
  input.value = opts.value;
  input.placeholder = opts.placeholder;

  const dropdownList = document.createElement("div");
  dropdownList.className = "model-dropdown-list";

  function renderDropdown(filter: string) {
    dropdownList.innerHTML = "";
    const q = filter.toLowerCase();
    const filtered = opts.options.filter((o) => o.toLowerCase().includes(q));
    if (opts.shouldHideWhen?.(filter, filtered) || filtered.length === 0) {
      dropdownList.classList.remove("open");
      return;
    }
    for (const option of filtered) {
      const opt = document.createElement("div");
      opt.className = "model-option";
      if (option === input.value) opt.classList.add("active");
      opt.textContent = option;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = option;
        opts.onSelect(option);
        dropdownList.classList.remove("open");
      });
      dropdownList.appendChild(opt);
    }
    dropdownList.classList.add("open");
  }

  input.addEventListener("input", () => {
    opts.onInput(input.value);
    renderDropdown(input.value);
  });
  input.addEventListener("focus", () => renderDropdown(input.value));
  input.addEventListener("blur", () => dropdownList.classList.remove("open"));

  wrapper.appendChild(input);
  wrapper.appendChild(dropdownList);

  return wrapper;
}

