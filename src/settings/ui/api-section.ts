import { fetchModels, testConnection } from "../../shared/api";
import { saveSettings } from "../../shared/storage";
import type { Settings, ThinkingDisableProfileId } from "../../shared/types";
import {
  THINKING_DISABLE_CUSTOM_HELP,
  THINKING_DISABLE_PROFILE_OPTIONS,
  parseThinkingDisableExtra,
} from "../../shared/thinking-disable";
import { createFormGroup, createInput, createFilterableDropdown, showToast } from "./helpers";

function createCheckboxRow(
  id: string,
  checked: boolean,
  labelText: string,
  onChange: (checked: boolean) => void | Promise<void>
): HTMLDivElement {
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.id = id;
  toggle.checked = checked;
  toggle.addEventListener("change", () => {
    void onChange(toggle.checked);
  });
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;
  const row = document.createElement("div");
  row.className = "form-group";
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";
  row.appendChild(toggle);
  row.appendChild(label);
  return row;
}

export function renderApiSection(settings: Settings): HTMLDivElement {
  const apiSection = document.createElement("div");
  apiSection.innerHTML = `<h2>API 配置</h2>`;

  apiSection.appendChild(createFormGroup("API Key", createInput("password", settings.apiKey, "sk-...", async (v) => {
    const wasEmpty = !settings.apiKey;
    settings.apiKey = v;
    // First-time key entry auto-enables the extension and shows a one-time toast.
    if (wasEmpty && v) {
      settings.enabled = true;
      await saveSettings({ apiKey: v, enabled: true });
      showToast("嘴替已启用");
    } else {
      await saveSettings({ apiKey: v });
      showToast("已保存");
    }
  })));

  apiSection.appendChild(
    createCheckboxRow(
      "mp-enabled-toggle",
      settings.enabled,
      "启用嘴替（在网页上选中文本时显示浮动按钮）",
      async (checked) => {
        settings.enabled = checked;
        await saveSettings({ enabled: checked });
        showToast(checked ? "已启用" : "已关闭");
      }
    )
  );

  apiSection.appendChild(createFormGroup("Base URL", createInput("text", settings.baseUrl, "https://api.openai.com/v1", async (v) => {
    settings.baseUrl = v;
    await saveSettings({ baseUrl: v });
    showToast("已保存");
  })));

  let cachedModels: string[] = [];
  let modelSaveTimeout: ReturnType<typeof setTimeout>;

  const modelDropdown = createFilterableDropdown({
    value: settings.model,
    placeholder: "gpt-4o",
    options: cachedModels,
    onInput: (value) => {
      clearTimeout(modelSaveTimeout);
      modelSaveTimeout = setTimeout(async () => {
        settings.model = value;
        await saveSettings({ model: value });
        showToast("已保存");
      }, 500);
    },
    onSelect: (value) => {
      settings.model = value;
      saveSettings({ model: value });
      showToast("已保存");
    },
  });

  apiSection.appendChild(createFormGroup("模型", modelDropdown.wrapper));

  // —— Thinking disable controls (ADR 0002 / PRD-0002) ——
  const thinkingControls = document.createElement("div");
  thinkingControls.className = "thinking-disable-controls";

  const profileSelect = document.createElement("select");
  profileSelect.id = "mp-thinking-profile";
  profileSelect.className = "form-control";
  for (const opt of THINKING_DISABLE_PROFILE_OPTIONS) {
    const option = document.createElement("option");
    option.value = opt.id;
    option.textContent = opt.label;
    if (opt.id === settings.thinkingDisableProfile) option.selected = true;
    profileSelect.appendChild(option);
  }

  const customWrap = document.createElement("div");
  customWrap.className = "form-group";
  customWrap.style.display =
    settings.thinkingDisableProfile === "custom" ? "block" : "none";

  const customHelp = document.createElement("pre");
  customHelp.className = "help-text thinking-disable-help";
  customHelp.style.whiteSpace = "pre-wrap";
  customHelp.style.fontSize = "12px";
  customHelp.style.opacity = "0.85";
  customHelp.style.margin = "0 0 8px";
  customHelp.textContent = THINKING_DISABLE_CUSTOM_HELP;

  const customError = document.createElement("div");
  customError.className = "inline-error";
  customError.style.display = "none";
  customError.style.marginBottom = "6px";

  const customTextarea = document.createElement("textarea");
  customTextarea.id = "mp-thinking-extra";
  customTextarea.className = "form-control";
  customTextarea.rows = 5;
  customTextarea.placeholder = '{"thinking":{"type":"disabled"}}';
  customTextarea.value = settings.thinkingDisableExtra || "{}";

  let customSaveTimeout: ReturnType<typeof setTimeout>;
  customTextarea.addEventListener("input", () => {
    clearTimeout(customSaveTimeout);
    customSaveTimeout = setTimeout(async () => {
      const parsed = parseThinkingDisableExtra(customTextarea.value);
      if (!parsed.ok) {
        customError.textContent = parsed.error;
        customError.style.display = "block";
        return;
      }
      customError.style.display = "none";
      customError.textContent = "";
      settings.thinkingDisableExtra = customTextarea.value.trim() || "{}";
      await saveSettings({ thinkingDisableExtra: settings.thinkingDisableExtra });
      showToast("已保存");
    }, 500);
  });

  customWrap.appendChild(customHelp);
  customWrap.appendChild(customError);
  customWrap.appendChild(customTextarea);

  function setThinkingControlsEnabled(enabled: boolean) {
    profileSelect.disabled = !enabled;
    customTextarea.disabled = !enabled;
  }

  thinkingControls.appendChild(
    createCheckboxRow(
      "mp-disable-thinking-toggle",
      settings.disableModelThinking,
      "关闭模型思考（加速）",
      async (checked) => {
        settings.disableModelThinking = checked;
        setThinkingControlsEnabled(checked);
        await saveSettings({ disableModelThinking: checked });
        showToast(checked ? "已开启关思考" : "已允许模型思考");
      }
    )
  );

  thinkingControls.appendChild(createFormGroup("关思考档案", profileSelect));
  thinkingControls.appendChild(customWrap);
  setThinkingControlsEnabled(settings.disableModelThinking);

  profileSelect.addEventListener("change", async () => {
    const id = profileSelect.value as ThinkingDisableProfileId;
    settings.thinkingDisableProfile = id;
    customWrap.style.display = id === "custom" ? "block" : "none";
    await saveSettings({ thinkingDisableProfile: id });
    showToast("已保存");
  });

  apiSection.appendChild(thinkingControls);

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
    fetchBtn.disabled = true;
    fetchBtn.textContent = "获取中...";
    const result = await fetchModels(settings);
    if (!result.ok) {
      showError(result.error);
    } else {
      cachedModels = result.models;
      modelDropdown.setOptions(cachedModels);
      modelDropdown.refresh();
      showToast(`已获取 ${cachedModels.length} 个模型`);
    }
    fetchBtn.disabled = false;
    fetchBtn.textContent = "获取模型";
  });

  testBtn.addEventListener("click", async () => {
    clearError();
    testBtn.disabled = true;
    testBtn.textContent = "测试中...";
    const result = await testConnection(settings);
    if (!result.ok) {
      showError(result.error);
    } else {
      showToast("连接成功");
    }
    testBtn.disabled = false;
    testBtn.textContent = "测试连接";
  });

  btnRow.appendChild(fetchBtn);
  btnRow.appendChild(testBtn);
  apiSection.appendChild(btnRow);
  apiSection.appendChild(errorDiv);

  return apiSection;
}
