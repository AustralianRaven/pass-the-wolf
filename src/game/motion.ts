/**
 * The "Floppy wolves" setting: tail, ears and legs flop as the wolves tumble (render only).
 * Remembered per browser; off by default when the player asks for reduced motion.
 */
const KEY = 'pass-the-wolf:floppy';

export function loadFloppy(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === '1';
  } catch {
    /* storage blocked: fall back to the motion preference */
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function saveFloppy(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked: the setting lasts for this visit only */
  }
}
