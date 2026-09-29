// Chica low-poly con uniforme escolar y pelo largo cubriendo parte del rostro.
// Sin animación fluida: se mueve "a saltos" (más inquietante).
import * as THREE from 'three';
import { applyPS2 } from '../render/ps2Material';
import { toTexture } from '../textures/canvas';
import { portraitCanvas, screamerCanvas } from '../textures/faces';

export interface GirlOpts {
  seed: number;
  /** 0 = rostro normal, 1 = monstruoso. */
  scary?: number;
  /** Cuánto cubre el pelo la cara (0..1). */
  hairFront?: number;
  wet?: boolean;
}

const lambert = (color: number) => applyPS2(new THREE.MeshLambertMaterial({ color }));

export class GirlModel {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  private faceMat: THREE.MeshLambertMaterial;
  readonly faceNormal: THREE.Texture;
  readonly faceScary: THREE.Texture;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;

  constructor(o: GirlOpts) {
    const skin = lambert(o.wet ? 0xa9a39a : 0xbdb2a6);
    const blouse = lambert(o.wet ? 0xb9b6ad : 0xd8d4c8);
    const navy = lambert(0x1b2233);
    const black = lambert(0x0b0909);
    const sock = lambert(0xd0ccc0);

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.root) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.085, 0.42, 0.085), skin, s * 0.075, 0.62, 0);
      add(new THREE.BoxGeometry(0.09, 0.34, 0.09), sock, s * 0.075, 0.2, 0);
      add(new THREE.BoxGeometry(0.1, 0.05, 0.16), black, s * 0.075, 0.025, 0.02);
    }
    add(new THREE.CylinderGeometry(0.17, 0.25, 0.36, 8), navy, 0, 0.9, 0);
    add(new THREE.BoxGeometry(0.33, 0.46, 0.19), blouse, 0, 1.3, 0);
    add(new THREE.BoxGeometry(0.05, 0.18, 0.01), navy, 0, 1.38, 0.1);
    this.armL = add(new THREE.BoxGeometry(0.07, 0.58, 0.07), blouse, -0.205, 1.2, 0.01);
    this.armR = add(new THREE.BoxGeometry(0.07, 0.58, 0.07), blouse, 0.205, 1.2, 0.01);
    for (const arm of [this.armL, this.armR]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.05), skin);
      hand.position.y = -0.34;
      arm.add(hand);
      arm.geometry.translate(0, -0.27, 0);
      arm.position.y += 0.27;
    }
    add(new THREE.BoxGeometry(0.07, 0.1, 0.07), skin, 0, 1.57, 0);

    // Cabeza
    this.head.position.set(0, 1.7, 0);
    this.root.add(this.head);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), skin);
    skull.scale.set(0.92, 1.12, 0.95);
    this.head.add(skull);
    this.faceNormal = toTexture(portraitCanvas({ seed: o.seed, hair: 1, size: 64 }), false);
    this.faceScary = toTexture(screamerCanvas(o.seed, 128), false);
    this.faceMat = applyPS2(new THREE.MeshLambertMaterial({ map: (o.scary ?? 0) > 0.5 ? this.faceScary : this.faceNormal }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.24), this.faceMat);
    face.position.set(0, -0.01, 0.1);
    this.head.add(face);
    // Pelo: casco, espalda y mechones delanteros
    const hairMat = applyPS2(new THREE.MeshLambertMaterial({ color: 0x080606, side: THREE.DoubleSide }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.128, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.y = 0.02;
    this.head.add(cap);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.62, 0.08), hairMat);
    back.position.set(0, -0.26, -0.07);
    this.head.add(back);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.16), hairMat);
      side.position.set(s * 0.12, -0.2, 0.0);
      this.head.add(side);
    }
    const cover = o.hairFront ?? 0.5;
    const strands = Math.round(2 + cover * 5);
    for (let i = 0; i < strands; i++) {
      const w = 0.03 + Math.random() * 0.03;
      const len = 0.25 + cover * 0.35 + Math.random() * 0.1;
      const strand = new THREE.Mesh(new THREE.PlaneGeometry(w, len), hairMat);
      const x = ((i + 0.5) / strands - 0.5) * 0.2 * (1 - cover * 0.35);
      strand.position.set(x, 0.07 - len / 2, 0.118);
      strand.rotation.z = (Math.random() - 0.5) * 0.15;
      this.head.add(strand);
    }
    this.root.traverse((m) => ((m as THREE.Mesh).isMesh ? (m.castShadow = true) : undefined));
  }

  setScary(on: boolean): void {
    this.faceMat.map = on ? this.faceScary : this.faceNormal;
    this.faceMat.needsUpdate = true;
  }

  /** Pose rígida: cabeza ladeada, brazos colgando o levantados hacia adelante. */
  pose(headTilt: number, armsForward = 0): void {
    this.head.rotation.z = headTilt;
    this.head.rotation.x = Math.abs(headTilt) * 0.4;
    this.armL.rotation.x = -armsForward * 1.3;
    this.armR.rotation.x = -armsForward * 1.25;
  }

  lookAt(target: THREE.Vector3): void {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    this.root.rotation.y = Math.atan2(dx, dz);
  }
}

/** Cuerpo del jugador (solo visible en espejos y en la foto de espaldas). */
export function playerBody(): THREE.Group {
  const g = new THREE.Group();
  const hoodie = lambert(0x24272b);
  const jeans = lambert(0x2c3446);
  const skin = lambert(0xb49d8c);
  const hair = lambert(0x0f0c0a);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 0.85, 0.13), jeans, s * 0.09, 0.43, 0);
    add(new THREE.BoxGeometry(0.1, 0.6, 0.1), hoodie, s * 0.25, 1.2, 0.02);
  }
  add(new THREE.BoxGeometry(0.42, 0.62, 0.24), hoodie, 0, 1.18, 0);
  const head = add(new THREE.IcosahedronGeometry(0.12, 1), skin, 0, 1.64, 0);
  head.scale.set(0.95, 1.1, 1);
  add(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.67, -0.01);
  // capucha caída
  add(new THREE.BoxGeometry(0.3, 0.14, 0.12), hoodie, 0, 1.45, -0.14);
  return g;
}
