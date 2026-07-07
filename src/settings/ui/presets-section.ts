import { saveSettings } from "../../shared/storage";
import { BUILT_IN_PRESETS, generateId } from "../../shared/presets";
import type { Settings, Preset } from "../../shared/types";
import { showSourcePicker } from "../modals";
import { showToast } from "./helpers";

export interface PresetsSectionContext {
  settings: Settings;
  getEditingPresetId: () => string | null;
  setEditingPresetId: (id: string | null) => void;
  rerender: () => void;
}

export function renderPresetsSection(ctx: PresetsSectionContext): HTMLDivElement {
  const { settings, getEditingPresetId, setEditingPresetId, rerender } = ctx;
  const editingPresetId = getEditingPresetId();

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
    editBtn.addEventListener("click", () => {
      setEditingPresetId(editingPresetId === preset.id ? null : preset.id);
      rerender();
    });
    actions.appendChild(editBtn);

    if (preset.builtIn) {
      const restoreBtn = document.createElement("button");
      restoreBtn.className = "btn btn-sm btn-ghost";
      restoreBtn.textContent = "恢复默认";
      restoreBtn.addEventListener("click", async () => {
        const original = BUILT_IN_PRESETS.find((p) => p.id === preset.id);
        if (original) {
          preset.systemPrompt = original.systemPrompt;
          preset.name = original.name;
          await saveSettings({ presets: settings.presets });
          showToast("已恢复");
          setEditingPresetId(null);
          rerender();
        }
      });
      actions.appendChild(restoreBtn);
    } else {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-sm btn-danger";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", async () => {
        settings.presets = settings.presets.filter((p) => p.id !== preset.id);
        settings.selectedPresetIds = settings.selectedPresetIds.filter((id) => id !== preset.id);
        await saveSettings({ presets: settings.presets, selectedPresetIds: settings.selectedPresetIds });
        showToast("已删除");
        setEditingPresetId(null);
        rerender();
      });
      actions.appendChild(deleteBtn);
    }

    li.appendChild(nameSpan);
    li.appendChild(actions);
    presetList.appendChild(li);

    if (editingPresetId === preset.id) {
      presetList.appendChild(createEditForm(preset, ctx));
    }
  }

  presetSection.appendChild(presetList);

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary";
  addBtn.style.marginTop = "12px";
  addBtn.textContent = "+ 添加预设";
  addBtn.addEventListener("click", async () => {
    const sourceId = await showSourcePicker(settings.presets);
    if (!sourceId) return;

    const source = settings.presets.find((p) => p.id === sourceId);
    if (!source) return;

    const newPreset: Preset = {
      id: generateId(),
      name: source.name + " (副本)",
      systemPrompt: source.systemPrompt,
      builtIn: false,
    };
    settings.presets.push(newPreset);
    await saveSettings({ presets: settings.presets });
    setEditingPresetId(newPreset.id);
    rerender();
  });
  presetSection.appendChild(addBtn);

  return presetSection;
}

function createEditForm(preset: Preset, ctx: PresetsSectionContext): HTMLLIElement {
  const { settings, setEditingPresetId, rerender } = ctx;
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
    setEditingPresetId(null);
    showToast("已保存");
    rerender();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-ghost btn-sm";
  cancelBtn.textContent = "取消";
  cancelBtn.style.marginLeft = "8px";
  cancelBtn.addEventListener("click", () => {
    setEditingPresetId(null);
    rerender();
  });

  li.appendChild(nameGroup);
  li.appendChild(promptGroup);
  li.appendChild(note);
  li.appendChild(saveBtn);
  li.appendChild(cancelBtn);

  return li;
}