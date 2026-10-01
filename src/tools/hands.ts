// Manos del jugador (viewmodel) low-poly: guantes de lana pálidos, como en la ref. 01.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyPS2 } from '../render/ps2Material';
import { canvas, toTexture, noise } from '../textures/canvas';
import { rng } from '../textures/rng';

let gloveMat: THREE.MeshLambertMaterial | null = null;

export function gloveMaterial(): THREE.MeshLambertMaterial {
  if (gloveMat) return gloveMat;
  const [c, ctx] = canvas(32, 32);
  const r = rng(99);
  ctx.fillStyle = '#c9c6bc';
  ctx.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 3) {
    ctx.fillStyle = 'rgba(80,78,70,0.25)';
    ctx.fillRect(0, y, 32, 1);
  }
  noise(ctx, r, 32, 32, 28);
  gloveMat = applyPS2(new THREE.MeshLambertMaterial({ map: toTexture(c) }));
  return gloveMat;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rx);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/**
 * Mano que sostiene un objeto: palma vertical, dedos curvos alrededor.
 * side: 1 derecha, -1 izquierda. El objeto sostenido queda en el origen.
 */
export function holdingHand(side: 1 | -1): THREE.Mesh {
  const s = side;
  const parts = [
    // palma detrás/lado del objeto
    box(0.028, 0.085, 0.07, 0.035 * s, -0.035, 0.0),
    // muñeca / antebrazo
    box(0.05, 0.05, 0.16, 0.04 * s, -0.08, 0.1, -0.25),
    // pulgar por delante
    box(0.018, 0.05, 0.018, 0.0, -0.005, 0.03, 0, -0.6 * s),
  ];
  // dedos envolviendo por el otro lado
  for (let i = 0; i < 4; i++) parts.push(box(0.042, 0.016, 0.018, -0.005 * s, -0.07 + i * 0.019, -0.03, 0, 0));
  return new THREE.Mesh(mergeGeometries(parts)!, gloveMaterial());
}
