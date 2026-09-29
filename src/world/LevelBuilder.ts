// Construye geometría estática con UVs en espacio de mundo y la fusiona por material
// (pocos draw calls). También registra colisiones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CollisionWorld } from './Collision';

export interface MatDef {
  material: THREE.Material;
  /** Metros por repetición de textura en U y V. */
  tile: [number, number];
}

export interface BoxOpts {
  collide?: boolean;
  /** Desplazamiento de V (p. ej. para que el zócalo quede abajo). */
  vOffset?: number;
}

export class LevelBuilder {
  private batches = new Map<MatDef, THREE.BufferGeometry[]>();

  constructor(
    private scene: THREE.Scene,
    readonly collision: CollisionWorld,
  ) {}

  /** Caja por extremos en coordenadas de mundo. */
  box(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
    mat: MatDef,
    opts: BoxOpts = {},
  ): void {
    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    if (w <= 0 || h <= 0 || d <= 0) return;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    worldUV(g, mat.tile, opts.vOffset ?? 0);
    let list = this.batches.get(mat);
    if (!list) this.batches.set(mat, (list = []));
    list.push(g);
    if (opts.collide !== false) this.collision.add(minX, maxX, minZ, maxZ, minY, maxY);
  }

  /** Pared a lo largo de Z en x fijo, con huecos [z1, z2] (puertas) de altura doorH. */
  wallX(x: number, z1: number, z2: number, h: number, mat: MatDef, gaps: Array<[number, number]> = [], doorH = 2.2, t = 0.2): void {
    this.segmented(z1, z2, gaps, (a, b) => this.box(x - t / 2, x + t / 2, 0, h, a, b, mat), (a, b) =>
      this.box(x - t / 2, x + t / 2, doorH, h, a, b, mat, { collide: false }),
    );
  }

  /** Pared a lo largo de X en z fijo. */
  wallZ(z: number, x1: number, x2: number, h: number, mat: MatDef, gaps: Array<[number, number]> = [], doorH = 2.2, t = 0.2): void {
    this.segmented(x1, x2, gaps, (a, b) => this.box(a, b, 0, h, z - t / 2, z + t / 2, mat), (a, b) =>
      this.box(a, b, doorH, h, z - t / 2, z + t / 2, mat, { collide: false }),
    );
  }

  floor(minX: number, maxX: number, minZ: number, maxZ: number, mat: MatDef, y = 0): void {
    this.box(minX, maxX, y - 0.1, y, minZ, maxZ, mat, { collide: false });
  }

  ceiling(minX: number, maxX: number, minZ: number, maxZ: number, mat: MatDef, y = 3): void {
    this.box(minX, maxX, y, y + 0.1, minZ, maxZ, mat, { collide: false });
  }

  private segmented(
    from: number,
    to: number,
    gaps: Array<[number, number]>,
    solid: (a: number, b: number) => void,
    lintel: (a: number, b: number) => void,
  ): void {
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    let cur = Math.min(from, to);
    const end = Math.max(from, to);
    for (const [g1, g2] of sorted) {
      if (g1 > cur) solid(cur, g1);
      lintel(g1, g2);
      cur = g2;
    }
    if (cur < end) solid(cur, end);
  }

  /** Fusiona todo por material y lo agrega a la escena. */
  finalize(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const [mat, geos] of this.batches) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat.material);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    this.batches.clear();
    return meshes;
  }
}

/** UV por cara según la normal, en metros de mundo / tile. */
export function worldUV(g: THREE.BufferGeometry, tile: [number, number], vOffset = 0): void {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    let u: number;
    let v: number;
    if (ny > 0.5) {
      u = x;
      v = z;
    } else if (nx > 0.5) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uv.setXY(i, u / tile[0], (v + vOffset) / tile[1]);
  }
  uv.needsUpdate = true;
}
