import type { ApiResult, MultiPresetResult } from "../../shared/types";
import type { ContentState } from "../state";

export function showResultLayer(
  state: ContentState,
  onClose: () => void,
  onRegenerate: () => void,
  onPresetChange: () => void
): void {
  closeResultLayer(state);

  const overlay = document.createElement("div");
  overlay.id = "mp-overlay";
  overlay.addEventListener("click", onClose);
  state.overlay = overlay;

  const resultLayer = document.createElement("div");
  resultLayer.id = "mp-result-layer";
  state.resultLayer = resultLayer;

  const header = document.createElement("div");
  header.id = "mp-layer-header";

  const isMulti = state.settings?.generationMode === "multi";

  if (isMulti) {
    const summary = document.createElement("span");
    summary.id = "mp-style-summary";
    const count = state.settings?.selectedPresetIds.length || 0;
    summary.textContent = `${count} 种风格`;
    header.appendChild(summary);
  } else {
    const select = document.createElement("select");
    select.id = "mp-style-select";
    if (state.settings) {
      for (const preset of state.settings.presets) {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.name;
        if (preset.id === state.currentPresetId) option.selected = true;
        select.appendChild(option);
      }
    }
    select.addEventListener("change", () => {
      state.currentPresetId = select.value;
      onPresetChange();
    });
    header.appendChild(select);
  }

  const closeBtn = document.createElement("button");
  closeBtn.id = "mp-close-btn";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", onClose);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.id = "mp-layer-body";
  body.appendChild(createLoadingEl());

  const footer = document.createElement("div");
  footer.id = "mp-layer-footer";
  const regenBtn = document.createElement("button");
  regenBtn.id = "mp-regenerate-btn";
  regenBtn.textContent = "换一批";
  regenBtn.disabled = true;
  regenBtn.addEventListener("click", onRegenerate);
  footer.appendChild(regenBtn);

  resultLayer.appendChild(header);
  resultLayer.appendChild(body);
  resultLayer.appendChild(footer);

  if (state.currentRect) {
    const top = window.scrollY + state.currentRect.bottom + 10;
    const left = Math.min(
      window.scrollX + state.currentRect.right - 380,
      window.scrollX + window.innerWidth - 400
    );
    resultLayer.style.top = `${Math.max(top, window.scrollY + 10)}px`;
    resultLayer.style.left = `${Math.max(left, window.scrollX + 10)}px`;
  }

  document.body.appendChild(overlay);
  document.body.appendChild(resultLayer);

  overlay.classList.add("visible");
  resultLayer.classList.add("visible");
}

export function closeResultLayer(state: ContentState): void {
  if (state.resultLayer) {
    state.resultLayer.remove();
    state.resultLayer = null;
  }
  if (state.overlay) {
    state.overlay.remove();
    state.overlay = null;
  }
}

export function createLoadingEl(): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "mp-loading";
  const spinner = document.createElement("div");
  spinner.className = "mp-loading-spinner";
  const text = document.createElement("div");
  text.textContent = "生成中...";
  div.appendChild(spinner);
  div.appendChild(text);
  return div;
}

export function setLoadingState(state: ContentState, loading: boolean): void {
  if (!state.resultLayer) return;
  const body = state.resultLayer.querySelector("#mp-layer-body") as HTMLDivElement;
  const regenBtn = state.resultLayer.querySelector("#mp-regenerate-btn") as HTMLButtonElement;
  const closeBtn = state.resultLayer.querySelector("#mp-close-btn") as HTMLButtonElement;
  const styleSelect = state.resultLayer.querySelector("#mp-style-select") as HTMLSelectElement | null;

  if (loading) {
    body.innerHTML = "";
    body.appendChild(createLoadingEl());
    regenBtn.disabled = true;
    closeBtn.style.pointerEvents = "none";
    if (styleSelect) styleSelect.disabled = true;
  } else {
    regenBtn.disabled = false;
    closeBtn.style.pointerEvents = "";
    if (styleSelect) styleSelect.disabled = false;
  }
}

export function renderComments(body: HTMLDivElement, data: ApiResult): void {
  body.innerHTML = "";

  if (data.translation) {
    const transDiv = document.createElement("div");
    transDiv.className = "mp-translation";
    transDiv.textContent = data.translation;
    body.appendChild(transDiv);
  }

  for (const comment of data.comments) {
    body.appendChild(createCommentCard(comment.content, comment.translation));
  }
}

export function renderMultiComments(body: HTMLDivElement, multiData: MultiPresetResult[]): void {
  body.innerHTML = "";

  for (const group of multiData) {
    const header = document.createElement("div");
    header.className = "mp-preset-header";
    header.textContent = group.presetName;
    body.appendChild(header);

    if (group.result.translation) {
      const transDiv = document.createElement("div");
      transDiv.className = "mp-translation";
      transDiv.textContent = group.result.translation;
      body.appendChild(transDiv);
    }

    for (const comment of group.result.comments) {
      body.appendChild(createCommentCard(comment.content, comment.translation));
    }
  }
}

function createCommentCard(content: string, translation: string | null): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "mp-comment-card";

  if (translation) {
    card.appendChild(createCommentRow(content));
    card.appendChild(createCommentRow(translation, true));
  } else {
    card.appendChild(createCommentRow(content));
  }

  return card;
}

function createCommentRow(text: string, isTranslation = false): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "mp-comment-row" + (isTranslation ? " mp-comment-trans" : "");

  const span = document.createElement("span");
  span.className = "mp-comment-text";
  span.textContent = text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "mp-copy-btn";
  copyBtn.textContent = "复制";
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "已复制 ✓";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "复制";
        copyBtn.classList.remove("copied");
      }, 1500);
    });
  });

  row.appendChild(span);
  row.appendChild(copyBtn);
  return row;
}

export function renderError(body: HTMLDivElement, message: string, onRetry: () => void): void {
  body.innerHTML = "";
  const div = document.createElement("div");
  div.className = "mp-error";

  const msg = document.createElement("div");
  msg.textContent = message;

  const retryBtn = document.createElement("button");
  retryBtn.className = "mp-retry-btn";
  retryBtn.textContent = "重试";
  retryBtn.addEventListener("click", onRetry);

  div.appendChild(msg);
  div.appendChild(retryBtn);
  body.appendChild(div);
}