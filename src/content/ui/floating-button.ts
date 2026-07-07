import type { ContentState } from "../state";

export function createFloatingButton(state: ContentState, onClick: (e: MouseEvent) => void): void {
  if (state.floatingBtn) return;
  const btn = document.createElement("button");
  btn.id = "mp-floating-btn";
  btn.textContent = "生成评论";
  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
  state.floatingBtn = btn;
}

export function showFloatingButton(state: ContentState, rect: DOMRect): void {
  if (!state.floatingBtn) return;
  state.floatingBtn.style.top = `${window.scrollY + rect.bottom + 6}px`;
  state.floatingBtn.style.left = `${window.scrollX + rect.right + 6}px`;
  state.floatingBtn.style.display = "block";
}

export function hideFloatingButton(state: ContentState): void {
  if (state.floatingBtn) state.floatingBtn.style.display = "none";
}