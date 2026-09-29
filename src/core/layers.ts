// Capas de render. Cada cámara ve una combinación distinta.
// Principal: WORLD + VIEWMODEL · Celular: WORLD + SPECTRAL · Espejo: WORLD + PLAYER_BODY + MIRROR_ONLY
export const LAYER = {
  WORLD: 0,
  VIEWMODEL: 1,
  SPECTRAL: 2,
  PLAYER_BODY: 3,
  MIRROR_ONLY: 4,
} as const;

import type * as THREE from 'three';

/** Asigna un objeto (y sus hijos) a una sola capa. */
export function setLayer(obj: THREE.Object3D, layer: number): void {
  obj.traverse((o) => o.layers.set(layer));
}
