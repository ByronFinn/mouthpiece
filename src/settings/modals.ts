import type { Preset } from "../shared/types";

export function showSourcePicker(presets: Preset[]): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "modal";

    const title = document.createElement("h3");
    title.textContent = "选择要复制的预设";
    modal.appendChild(title);

    const list = document.createElement("ul");
    list.className = "source-list";

    for (const preset of presets) {
      const li = document.createElement("li");
      li.textContent = preset.name;
      if (preset.builtIn) {
        const badge = document.createElement("span");
        badge.className = "preset-builtin";
        badge.textContent = "内置";
        li.appendChild(badge);
      }
      li.addEventListener("click", () => {
        backdrop.remove();
        resolve(preset.id);
      });
      list.appendChild(li);
    }

    modal.appendChild(list);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => {
      backdrop.remove();
      resolve(null);
    });
    modal.appendChild(cancelBtn);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  });
}