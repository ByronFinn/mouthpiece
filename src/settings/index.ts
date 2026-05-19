import { loadSettings, saveSettings } from "../shared/storage";
import { BUILT_IN_PRESETS, generateId } from "../shared/presets";
import type { Settings, Preset } from "../shared/types";

let settings: Settings;
let editingPresetId: string | null = null;

(async () => {
  settings = await loadSettings();
  render();
})();

function showToast(msg: string) {
  const toast = document.getElementById("toast")!;
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2000);
}

function render() {
  const container = document.getElementById("settings-content")!;
  container.innerHTML = "";

  // === API Section ===
  const apiSection = document.createElement("div");
  apiSection.innerHTML = `<h2>API 配置</h2>`;

  apiSection.appendChild(createFormGroup("API Key", createInput("password", settings.apiKey, "sk-...", async (v) => {
    settings.apiKey = v;
    await saveSettings({ apiKey: v });
    showToast("已保存");
  })));

  apiSection.appendChild(createFormGroup("Base URL", createInput("text", settings.baseUrl, "https://api.openai.com/v1", async (v) => {
    settings.baseUrl = v;
    await saveSettings({ baseUrl: v });
    showToast("已保存");
  })));

  apiSection.appendChild(createFormGroup("模型", createInput("text", settings.model, "gpt-4o", async (v) => {
    settings.model = v;
    await saveSettings({ model: v });
    showToast("已保存");
  })));

  container.appendChild(apiSection);

  // === Generation Section ===
  const genSection = document.createElement("div");
  genSection.innerHTML = `<h2>生成设置</h2>`;

  const modeSelect = document.createElement("select");
  const singleOpt = document.createElement("option");
  singleOpt.value = "single";
  singleOpt.textContent = "单风格（一个预设，多条回复）";
  const multiOpt = document.createElement("option");
  multiOpt.value = "multi";
  multiOpt.textContent = "多风格（多个预设，各一条回复）";
  modeSelect.appendChild(singleOpt);
  modeSelect.appendChild(multiOpt);
  modeSelect.value = settings.generationMode;
  modeSelect.addEventListener("change", async () => {
    settings.generationMode = modeSelect.value as "single" | "multi";
    await saveSettings({ generationMode: settings.generationMode });
    showToast("已保存");
  });
  genSection.appendChild(createFormGroup("生成模式", modeSelect));

  genSection.appendChild(createFormGroup("每种风格回复数", createInput("number", String(settings.repliesPerStyle), "3", async (v) => {
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 10) {
      settings.repliesPerStyle = n;
      await saveSettings({ repliesPerStyle: n });
      showToast("已保存");
    }
  })));

  const langInput = createInput("text", settings.translationLang, "Chinese", async (v) => {
    settings.translationLang = v;
    await saveSettings({ translationLang: v });
    showToast("已保存");
  });
  langInput.setAttribute("list", "lang-suggestions");
  langInput.autocomplete = "off";
  genSection.appendChild(createFormGroup("我的语言", langInput));

  const langDatalist = document.createElement("datalist");
  langDatalist.id = "lang-suggestions";
  for (const lang of ["Chinese", "English", "Japanese", "Korean", "French", "German", "Spanish", "Portuguese", "Russian", "Arabic", "Thai", "Vietnamese", "Indonesian"]) {
    const opt = document.createElement("option");
    opt.value = lang;
    langDatalist.appendChild(opt);
  }
  genSection.appendChild(langDatalist);

  const langNote = document.createElement("div");
  langNote.className = "note";
  langNote.textContent = "评论和原文会翻译成你设置的语言。如果原文已经是这个语言，则不翻译。";
  genSection.appendChild(langNote);

  container.appendChild(genSection);

  // === Presets Section ===
  const presetSection = document.createElement("div");
  presetSection.innerHTML = `<h2>预设风格</h2>`;

  const presetList = document.createElement("ul");
  presetList.className = "preset-list";

  for (const preset of settings.presets) {
    const li = document.createElement("li");
    li.className = "preset-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "preset-name";
    nameSpan.textContent = preset.name;
    if (preset.builtIn) {
      const badge = document.createElement("span");
      badge.className = "preset-builtin";
      badge.textContent = "内置";
      nameSpan.appendChild(badge);
    }

    const actions = document.createElement("div");
    actions.className = "preset-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-sm btn-ghost";
    editBtn.textContent = "编辑";
    editBtn.addEventListener("click", () => toggleEdit(preset.id));
    actions.appendChild(editBtn);

    if (preset.builtIn) {
      const restoreBtn = document.createElement("button");
      restoreBtn.className = "btn btn-sm btn-ghost";
      restoreBtn.textContent = "恢复默认";
      restoreBtn.addEventListener("click", async () => {
        const original = BUILT_IN_PRESETS.find(p => p.id === preset.id);
        if (original) {
          preset.systemPrompt = original.systemPrompt;
          preset.name = original.name;
          await saveSettings({ presets: settings.presets });
          showToast("已恢复");
          editingPresetId = null;
          render();
        }
      });
      actions.appendChild(restoreBtn);
    } else {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-sm btn-danger";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", async () => {
        settings.presets = settings.presets.filter(p => p.id !== preset.id);
        settings.selectedPresetIds = settings.selectedPresetIds.filter(id => id !== preset.id);
        await saveSettings({ presets: settings.presets, selectedPresetIds: settings.selectedPresetIds });
        showToast("已删除");
        editingPresetId = null;
        render();
      });
      actions.appendChild(deleteBtn);
    }

    li.appendChild(nameSpan);
    li.appendChild(actions);
    presetList.appendChild(li);

    // Edit form
    if (editingPresetId === preset.id) {
      const editForm = createEditForm(preset);
      presetList.appendChild(editForm);
    }
  }

  presetSection.appendChild(presetList);

  // Add preset button
  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary";
  addBtn.style.marginTop = "12px";
  addBtn.textContent = "+ 添加预设";
  addBtn.addEventListener("click", async () => {
    const sourceId = await showSourcePicker(settings.presets);
    if (!sourceId) return;

    const source = settings.presets.find(p => p.id === sourceId);
    if (!source) return;

    const newPreset: Preset = {
      id: generateId(),
      name: source.name + " (副本)",
      systemPrompt: source.systemPrompt,
      builtIn: false,
    };
    settings.presets.push(newPreset);
    await saveSettings({ presets: settings.presets });
    editingPresetId = newPreset.id;
    render();
  });
  presetSection.appendChild(addBtn);

  container.appendChild(presetSection);
}

function createFormGroup(labelText: string, input: HTMLElement): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "form-group";
  const label = document.createElement("label");
  label.textContent = labelText;
  group.appendChild(label);
  group.appendChild(input);
  return group;
}

function createInput(type: string, value: string, placeholder: string, onChange: (v: string) => Promise<void>): HTMLInputElement {
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

function createEditForm(preset: Preset): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "edit-form";
  li.style.listStyle = "none";

  const nameGroup = document.createElement("div");
  nameGroup.className = "form-group";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "名称";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = preset.name;
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);

  const promptGroup = document.createElement("div");
  promptGroup.className = "form-group";
  const promptLabel = document.createElement("label");
  promptLabel.textContent = "系统提示词";
  const promptTextarea = document.createElement("textarea");
  promptTextarea.value = preset.systemPrompt;
  promptGroup.appendChild(promptLabel);
  promptGroup.appendChild(promptTextarea);

  const note = document.createElement("div");
  note.className = "note";
  note.textContent = "翻译规则和输出格式会自动附加到提示词末尾，无需手动添加。可使用 {{count}} 和 {{translation_lang}} 变量。";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary btn-sm";
  saveBtn.textContent = "保存";
  saveBtn.addEventListener("click", async () => {
    preset.name = nameInput.value;
    preset.systemPrompt = promptTextarea.value;
    await saveSettings({ presets: settings.presets });
    editingPresetId = null;
    showToast("已保存");
    render();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost btn-sm";
  cancelBtn.textContent = "取消";
  cancelBtn.style.marginLeft = "8px";
  cancelBtn.addEventListener("click", () => {
    editingPresetId = null;
    render();
  });

  li.appendChild(nameGroup);
  li.appendChild(promptGroup);
  li.appendChild(note);
  li.appendChild(saveBtn);
  li.appendChild(cancelBtn);

  return li;
}

function toggleEdit(presetId: string) {
  editingPresetId = editingPresetId === presetId ? null : presetId;
  render();
}

function showSourcePicker(presets: Preset[]): Promise<string | null> {
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
