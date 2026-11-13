import { DIREWOLVES } from '../animals/direwolves';
import { sculptWolfArrays } from '../sculpt/paint-wolf';

/** Carves direwolf meshes off the main thread. Message in: { id, step }; arrays out, transferred. */
self.onmessage = (e: MessageEvent<{ id: string; step: number }>) => {
  const { id, step } = e.data;
  const design = DIREWOLVES.find((d) => d.id === id);
  if (!design) return;
  const a = sculptWolfArrays(design, step);
  (self as unknown as Worker).postMessage({ id, step, ...a }, [a.positions.buffer, a.normals.buffer, a.colours.buffer, a.indices.buffer]);
};
