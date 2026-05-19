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

  // Model input with custom dropdown
  const modelWrapper = document.createElement("div");
  modelWrapper.className = "model-dropdown";

  const modelInput = document.createElement("input");
  modelInput.type = "text";
  modelInput.value = settings.model;
  modelInput.placeholder = "gpt-4o";
  let modelSaveTimeout: ReturnType<typeof setTimeout>;
  modelInput.addEventListener("input", () => {
    clearTimeout(modelSaveTimeout);
    modelSaveTimeout = setTimeout(async () => {
      settings.model = modelInput.value;
      await saveSettings({ model: modelInput.value });
      showToast("已保存");
    }, 500);
    renderModelDropdown(modelInput.value);
  });
  modelInput.addEventListener("focus", () => renderModelDropdown(modelInput.value));

  const dropdownList = document.createElement("div");
  dropdownList.className = "model-dropdown-list";

  let cachedModels: string[] = [];

  function renderModelDropdown(filter: string) {
    dropdownList.innerHTML = "";
    if (cachedModels.length === 0) { dropdownList.classList.remove("open"); return; }
    const q = filter.toLowerCase();
    const filtered = cachedModels.filter(m => m.toLowerCase().includes(q));
    if (filtered.length === 0) { dropdownList.classList.remove("open"); return; }
    for (const id of filtered) {
      const opt = document.createElement("div");
      opt.className = "model-option";
      if (id === modelInput.value) opt.classList.add("active");
      opt.textContent = id;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent blur
        modelInput.value = id;
        settings.model = id;
        saveSettings({ model: id });
        showToast("已保存");
        dropdownList.classList.remove("open");
      });
      dropdownList.appendChild(opt);
    }
    dropdownList.classList.add("open");
  }

  modelInput.addEventListener("blur", () => dropdownList.classList.remove("open"));

  modelWrapper.appendChild(modelInput);
  modelWrapper.appendChild(dropdownList);
  apiSection.appendChild(createFormGroup("模型", modelWrapper));

  // Fetch models + Test connection buttons
  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";

  const fetchBtn = document.createElement("button");
  fetchBtn.className = "btn btn-primary btn-sm";
  fetchBtn.textContent = "获取模型";

  const testBtn = document.createElement("button");
  testBtn.className = "btn btn-ghost btn-sm";
  testBtn.textContent = "测试连接";

  const errorDiv = document.createElement("div");
  errorDiv.className = "inline-error";
  errorDiv.style.display = "none";

  function clearError() { errorDiv.style.display = "none"; errorDiv.textContent = ""; }
  function showError(msg: string) { errorDiv.textContent = msg; errorDiv.style.display = "block"; }

  fetchBtn.addEventListener("click", async () => {
    clearError();
    if (!settings.apiKey || !settings.baseUrl) {
      showError("请先填写 API Key 和 Base URL");
      return;
    }
    fetchBtn.disabled = true;
    fetchBtn.textContent = "获取中...";
    try {
      const res = await fetch(`${settings.baseUrl}/models`, {
        headers: { "Authorization": `Bearer ${settings.apiKey}` },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        showError(`获取失败 (${res.status}): ${mapError(res.status, errText)}`);
        return;
      }
      const data = await res.json();
      cachedModels = (data.data || [])
        .map((m: { id: string }) => m.id)
        .sort();
      showToast(`已获取 ${cachedModels.length} 个模型`);
      renderModelDropdown(modelInput.value);
    } catch (e: any) {
      showError(`网络错误: ${e.message || e}`);
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = "获取模型";
    }
  });

  testBtn.addEventListener("click", async () => {
    clearError();
    if (!settings.apiKey || !settings.baseUrl || !settings.model) {
      showError("请先填写 API Key、Base URL 和模型");
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = "测试中...";
    try {
      const res = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        showError(`连接失败 (${res.status}): ${mapError(res.status, errText)}`);
        return;
      }
      showToast("连接成功");
    } catch (e: any) {
      showError(`网络错误: ${e.message || e}`);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = "测试连接";
    }
  });

  btnRow.appendChild(fetchBtn);
  btnRow.appendChild(testBtn);
  apiSection.appendChild(btnRow);
  apiSection.appendChild(errorDiv);

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

  const LANGUAGES = [
    "中文", "English", "日本語", "한국어", "Français", "Deutsch",
    "Español", "Português", "Русский", "العربية", "ไทย",
    "Tiếng Việt", "Bahasa Indonesia", "Italiano", "Nederlands",
    "Polski", "Türkçe", "हिन्दी", "বাংলা", "فارسی",
  ];

  const langWrapper = document.createElement("div");
  langWrapper.className = "model-dropdown";

  const langInput = document.createElement("input");
  langInput.type = "text";
  langInput.value = settings.translationLang;
  langInput.placeholder = "中文";
  let langSaveTimeout: ReturnType<typeof setTimeout>;
  langInput.addEventListener("input", () => {
    clearTimeout(langSaveTimeout);
    langSaveTimeout = setTimeout(async () => {
      settings.translationLang = langInput.value;
      await saveSettings({ translationLang: langInput.value });
      showToast("已保存");
    }, 500);
    renderLangDropdown(langInput.value);
  });
  langInput.addEventListener("focus", () => renderLangDropdown(langInput.value));

  const langDropdown = document.createElement("div");
  langDropdown.className = "model-dropdown-list";

  function renderLangDropdown(filter: string) {
    langDropdown.innerHTML = "";
    const q = filter.toLowerCase();
    const filtered = LANGUAGES.filter(l => l.toLowerCase().includes(q));
    if (filtered.length === 0 || (filtered.length === 1 && filtered[0] === filter)) {
      langDropdown.classList.remove("open");
      return;
    }
    for (const lang of filtered) {
      const opt = document.createElement("div");
      opt.className = "model-option";
      if (lang === langInput.value) opt.classList.add("active");
      opt.textContent = lang;
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        langInput.value = lang;
        settings.translationLang = lang;
        saveSettings({ translationLang: lang });
        showToast("已保存");
        langDropdown.classList.remove("open");
      });
      langDropdown.appendChild(opt);
    }
    langDropdown.classList.add("open");
  }

  langInput.addEventListener("blur", () => langDropdown.classList.remove("open"));

  langWrapper.appendChild(langInput);
  langWrapper.appendChild(langDropdown);
  genSection.appendChild(createFormGroup("我的语言", langWrapper));

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
  note.textContent = "翻译规则和输出格式会自动附加到提示词末尾，无需手动添加。";

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

function mapError(status: number, _body: string): string {
  switch (status) {
    case 401: return "API Key 无效";
    case 402: return "账户余额不足";
    case 403: return "无权限访问";
    case 404: return "模型或接口不存在";
    case 429: return "请求频率过高，请稍后重试";
    default: return status >= 500 ? "服务器错误，请稍后重试" : `HTTP ${status}`;
  }
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
