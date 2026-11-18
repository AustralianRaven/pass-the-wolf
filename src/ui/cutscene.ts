import type { RollResult } from '../rules/scoring';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * The big-roll cutscene overlay: letterbox bars close in while the camera pushes in on the
 * wolves, and the call is cut large across the lower third. Resolves when it ends or the
 * player skips it (click, Space, Enter or Escape). Shared by the game and the demo page.
 */
export function playCutscene(root: HTMLElement, roll: RollResult, ms: number, announce: (text: string) => void): Promise<void> {
  return new Promise((resolve) => {
    const tone = roll.kind === 'tangled' ? ' is-bust' : roll.kind === 'alpha' ? ' is-alpha' : '';
    const points = roll.kind === 'tangled' ? 'Bank wiped' : `+${roll.points}`;
    const overlay = el('div', `cutscene${tone}`, undefined, { role: 'dialog', 'aria-label': `${roll.label}, ${points}` });
    const call = el('div', 'cutscene__call');
    call.append(el('p', 'cutscene__label', roll.label), el('p', 'cutscene__points', points));
    overlay.append(
      el('div', 'cutscene__bar cutscene__bar--top', undefined, { 'aria-hidden': 'true' }),
      el('div', 'cutscene__bar cutscene__bar--bottom', undefined, { 'aria-hidden': 'true' }),
      call,
      el('p', 'cutscene__skip', 'Click or press Space to skip'),
    );
    let done = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    function finish(): void {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      root.classList.remove('is-cutscene');
      overlay.classList.add('is-out');
      window.setTimeout(() => overlay.remove(), 260);
      resolve();
    }
    overlay.addEventListener('click', finish);
    window.addEventListener('keydown', onKey, true);
    // The HUD steps back while the camera has the stage.
    root.classList.add('is-cutscene');
    root.append(overlay);
    announce(`${roll.label}! ${points}.`);
    window.setTimeout(finish, ms);
  });
}
