// Utilería reutilizable: sillas, mesas, figuras sentadas, lluvia, relámpagos en ventanas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { System } from '../core/Game';
import { applyPS2 } from '../render/ps2Material';

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** Silla escolar (origen en el piso, mira hacia +z). */
export function chairGeometry(): THREE.BufferGeometry {
  const parts = [
    boxAt(0.42, 0.04, 0.42, 0, 0.45, 0),
    boxAt(0.42, 0.36, 0.04, 0, 0.7, -0.2),
  ];
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ])
    parts.push(boxAt(0.03, 0.45, 0.03, x, 0.225, z));
  return mergeGeometries(parts)!;
}

/** Mesa escolar. */
export function deskGeometry(): THREE.BufferGeometry {
  const parts = [boxAt(0.6, 0.04, 0.45, 0, 0.72, 0)];
  for (const [x, z] of [
    [-0.27, -0.2],
    [0.27, -0.2],
    [-0.27, 0.2],
    [0.27, 0.2],
  ])
    parts.push(boxAt(0.03, 0.72, 0.03, x, 0.36, z));
  return mergeGeometries(parts)!;
}

export interface Placement {
  x: number;
  y?: number;
  z: number;
  ry?: number;
  rx?: number;
  rz?: number;
}

export function instanced(scene: THREE.Scene, geo: THREE.BufferGeometry, mat: THREE.Material, list: Placement[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  list.forEach((p, i) => {
    e.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

/** Figura sentada con bolsa en la cabeza (gimnasio). Mira hacia +z local. */
export function seatedFigure(uniform: THREE.Material, skin: THREE.Material, skirt: THREE.Material, bag: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(0.34, 0.46, 0.2), uniform, 0, 0.72, -0.05, -0.08);
  add(new THREE.BoxGeometry(0.36, 0.14, 0.42), skirt, 0, 0.5, 0.08);
  add(new THREE.BoxGeometry(0.1, 0.42, 0.1), skin, -0.09, 0.22, 0.26);
  add(new THREE.BoxGeometry(0.1, 0.42, 0.1), skin, 0.09, 0.22, 0.26);
  // brazos atados atrás
  add(new THREE.BoxGeometry(0.08, 0.4, 0.08), uniform, -0.2, 0.68, -0.14, 0.35);
  add(new THREE.BoxGeometry(0.08, 0.4, 0.08), uniform, 0.2, 0.68, -0.14, 0.35);
  const head = add(new THREE.IcosahedronGeometry(0.13, 0), bag, 0, 1.08, -0.04);
  head.scale.set(1, 1.2, 1);
  head.rotation.z = 0.25;
  return g;
}

/** Lluvia: segmentos animados por shader (sin costo de CPU). */
export class Rain implements System {
  readonly mesh: THREE.LineSegments;
  private mat: THREE.ShaderMaterial;

  constructor(minX: number, maxX: number, minZ: number, maxZ: number, count = 1600, height = 8) {
    const pos = new Float32Array(count * 6);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);
      const y = Math.random() * height;
      pos.set([x, y, z, x + 0.01, y - 0.22, z], i * 6);
      seed[i * 2] = seed[i * 2 + 1] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uH: { value: height } },
      vertexShader: `
        uniform float uTime; uniform float uH; attribute float seed; varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uTime * (9.0 + seed * 3.0), uH);
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vA = (0.08 + seed * 0.12) * smoothstep(1.2, 4.0, distance(wp.xyz, cameraPosition));
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(0.55, 0.63, 0.68, vA); }`,
    });
    this.mesh = new THREE.LineSegments(geo, this.mat);
    this.mesh.frustumCulled = false;
  }

  update(_dt: number, time: number): void {
    this.mat.uniforms.uTime.value = time;
  }
}

/** Ventanas que se iluminan con relámpagos. */
export class Lightning implements System {
  private next = 12 + Math.random() * 20;
  private t = -1;
  onStrike: (() => void) | null = null;
  readonly mats: THREE.MeshBasicMaterial[] = [];
  private base = new THREE.Color(0x3a4a55);
  /** Luz ambiental extra en exteriores. */
  flashLight: THREE.HemisphereLight | null = null;

  addWindow(mat: THREE.MeshBasicMaterial): void {
    mat.color.copy(this.base);
    this.mats.push(mat);
  }

  strike(): void {
    this.t = 0;
    this.onStrike?.();
  }

  update(dt: number): void {
    this.next -= dt;
    if (this.next <= 0) {
      this.next = 25 + Math.random() * 40;
      this.strike();
    }
    if (this.t < 0) return;
    this.t += dt;
    const v = this.t < 0.08 ? 1 : this.t < 0.16 ? 0.2 : this.t < 0.26 ? 0.8 : Math.max(0, 1 - (this.t - 0.26) * 3);
    for (const m of this.mats) m.color.copy(this.base).lerp(WHITE, v * 0.85);
    if (this.flashLight) this.flashLight.intensity = v * 2.5;
    if (this.t > 0.7) this.t = -1;
  }
}
const WHITE = new THREE.Color(0xdfeaff);

export function ps2Basic(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return applyPS2(new THREE.MeshBasicMaterial(params));
}
