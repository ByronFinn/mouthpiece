import type { ContentState } from "../state";
import { getShadowRoot } from "./shadow-host";

export function createFloatingButton(state: ContentState, onClick: (e: MouseEvent) => void): void {
  if (state.floatingBtn) return;
  const btn = document.createElement("button");
  btn.id = "mp-floating-btn";
  btn.textContent = "生成评论";
  btn.addEventListener("click", onClick);
  getShadowRoot().appendChild(btn);
  state.floatingBtn = btn;
}

export function showFloatingButton(state: ContentState, rect: DOMRect): void {
  if (!state.floatingBtn) return;
  // Record the selection anchor in document coordinates for later repositioning.
  state.selectionAnchor = {
    docTop: window.scrollY + rect.top,
    docLeft: window.scrollX + rect.left,
    docRight: window.scrollX + rect.right,
    docBottom: window.scrollY + rect.bottom,
  };
  positionFloatingButton(state);
  state.floatingBtn.style.display = "block";
}

/** Recompute the floating button position from the stored selection anchor. */
export function positionFloatingButton(state: ContentState): void {
  if (!state.floatingBtn || !state.selectionAnchor) return;
  state.floatingBtn.style.top = `${state.selectionAnchor.docBottom + 6}px`;
  state.floatingBtn.style.left = `${state.selectionAnchor.docRight + 6}px`;
}

export function hideFloatingButton(state: ContentState): void {
  if (state.floatingBtn) state.floatingBtn.style.display = "none";
}

/** Fully remove the floating button from the DOM (called on deactivation). */
export function destroyFloatingButton(state: ContentState): void {
  if (state.floatingBtn) {
    state.floatingBtn.remove();
    state.floatingBtn = null;
  }
}
