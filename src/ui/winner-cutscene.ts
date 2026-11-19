import { WINNER_SCENES, randomWinnerScene, runWinnerScene, type Contender, type WinnerSceneId } from '../render/winner-scene';

/**
 * The winner cutscene overlay (#5): one of the letterboxed winner scenes (random unless chosen),
 * a white flash on each strike, then "<Name> wins!" cut large before the final score band takes over. Skippable with a
 * click, Space, Enter or Escape. Under reduced motion it is skipped entirely.
 */
export function playWinnerCutscene(
  root: HTMLElement,
  winner: Contender,
  losers: readonly Contender[],
  announce: (text: string) => void,
  scene: WinnerSceneId = randomWinnerScene(),
): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'cutscene winner';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', `${winner.name} wins`);
    const canvas = document.createElement('canvas');
    canvas.className = 'winner__scene';
    canvas.setAttribute('aria-hidden', 'true');
    const flash = document.createElement('div');
    flash.className = 'winner__flash';
    const call = document.createElement('div');
    call.className = 'cutscene__call winner__call';
    const label = document.createElement('p');
    label.className = 'cutscene__label';
    label.textContent = `${winner.name} wins!`;
    call.append(label);
    const skip = document.createElement('p');
    skip.className = 'cutscene__skip';
    skip.textContent = 'Click or press Space to skip';
    const bars = ['top', 'bottom'].map((side) => {
      const bar = document.createElement('div');
      bar.className = `cutscene__bar cutscene__bar--${side}`;
      bar.setAttribute('aria-hidden', 'true');
      return bar;
    });
    overlay.append(canvas, flash, ...bars, call, skip);

    const abort = new AbortController();
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
      abort.abort();
      window.removeEventListener('keydown', onKey, true);
      root.classList.remove('is-cutscene');
      overlay.classList.add('is-out');
      window.setTimeout(() => overlay.remove(), 260);
      resolve();
    }
    overlay.addEventListener('click', finish);
    window.addEventListener('keydown', onKey, true);
    root.classList.add('is-cutscene');
    root.append(overlay);
    announce(`${winner.name} wins! ${WINNER_SCENES.find((s) => s.id === scene)?.blurb ?? ''}`);

    const strike = () => {
      flash.classList.remove('is-on');
      void flash.offsetWidth;
      flash.classList.add('is-on');
    };
    void runWinnerScene(canvas, winner, losers, abort.signal, strike, scene).then(() => {
      if (done) return;
      // Hold the title for a beat, then hand over to the final score band.
      call.classList.add('is-shown');
      window.setTimeout(finish, 1600);
    });
  });
}
