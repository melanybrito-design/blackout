// Manos del jugador siempre visibles: cuelgan abajo cuando están libres, se mecen al caminar
// y la derecha se estira al interactuar. Cuando una mano sostiene una herramienta (celular a la
// derecha, grabadora a la izquierda) esa mano libre se guarda: la herramienta trae la suya.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { System } from '../core/Game';
import { LAYER, setLayer } from '../core/layers';
import { applyPS2 } from '../render/ps2Material';
import type { PlayerController } from './PlayerController';

function part(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rx);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

const skin = applyPS2(new THREE.MeshLambertMaterial({ color: 0xb9a08e }));
const sleeve = applyPS2(new THREE.MeshLambertMaterial({ color: 0x23262b }));

/** Mano relajada (piel) con la manga del buzo; los dedos apuntan hacia adelante (-z). */
function restingHand(side: 1 | -1): THREE.Group {
  const hand = [
    part(0.072, 0.03, 0.085, 0, 0, 0), // palma
    part(0.02, 0.022, 0.05, -0.046 * side, -0.004, 0.0, 0, 0.5 * side), // pulgar
    part(0.05, 0.04, 0.04, 0, -0.004, 0.055), // muñeca
  ];
  for (let i = 0; i < 4; i++) parts(hand, i, side);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(hand)!, skin));
  // manga: un poco más ancha que la muñeca, con el puño marcado
  g.add(new THREE.Mesh(mergeGeometries([part(0.075, 0.065, 0.3, 0, -0.012, 0.22), part(0.082, 0.072, 0.03, 0, -0.012, 0.085)])!, sleeve));
  return g;
}

/** Dedos: dos falanges, la segunda apenas curvada hacia abajo. */
function parts(list: THREE.BufferGeometry[], i: number, side: 1 | -1): void {
  const x = (-0.027 + i * 0.018) * side;
  const len = i === 0 || i === 3 ? 0.03 : 0.036;
  list.push(part(0.0155, 0.02, len, x, -0.004, -0.042 - len / 2, 0.15));
  list.push(part(0.0145, 0.018, len * 0.85, x, -0.014, -0.045 - len * 1.35, 0.5));
}

export class Hands implements System {
  private right = restingHand(1);
  private left = restingHand(-1);
  private showR = 0;
  private showL = 0;
  private reachT = -1;
  private bob = 0;
  /** ¿La mano está ocupada con una herramienta? */
  rightBusy: () => boolean = () => false;
  leftBusy: () => boolean = () => false;
  hidden = false;

  constructor(
    camera: THREE.Camera,
    private player: PlayerController,
  ) {
    for (const h of [this.right, this.left]) {
      setLayer(h, LAYER.VIEWMODEL);
      camera.add(h);
    }
  }

  /** Estira la mano hacia el puntero (abrir, recoger, tocar). */
  reach(): void {
    this.reachT = 0;
  }

  update(dt: number): void {
    const p = this.player;
    this.bob += p.speed * dt * 4.2;
    const sway = Math.sin(this.bob) * Math.min(1, p.speed / 2) * 0.012;
    const lift = Math.cos(this.bob * 2) * Math.min(1, p.speed / 2) * 0.006;

    // En primera persona las manos no están en el encuadre: aparecen al bajar la mirada
    // (y la que alcanza algo se ve mientras dura el gesto).
    const down = THREE.MathUtils.smoothstep(-p.pitch, 0.3, 0.75);
    const reaching = this.reachT >= 0 ? 1 : 0;
    const k = Math.min(1, dt * 9);
    const useLeftNow = this.rightBusy() && !this.leftBusy();
    this.showR += ((this.hidden || this.rightBusy() ? 0 : Math.max(down, useLeftNow ? 0 : reaching)) - this.showR) * k;
    this.showL += ((this.hidden || this.leftBusy() ? 0 : Math.max(down, useLeftNow ? reaching : 0)) - this.showL) * k;

    // Alcance: sube y avanza 0,14 s, sostiene, vuelve.
    let reach = 0;
    if (this.reachT >= 0) {
      this.reachT += dt;
      const t = this.reachT;
      reach = t < 0.14 ? t / 0.14 : t < 0.3 ? 1 : Math.max(0, 1 - (t - 0.3) / 0.25);
      if (t > 0.55) this.reachT = -1;
    }
    // Si la derecha está ocupada, alcanza la izquierda.
    const useLeft = this.rightBusy() && !this.leftBusy();
    const rr = useLeft ? 0 : reach;
    const rl = useLeft ? reach : 0;

    const crouch = p.crouched ? 0.02 : 0;
    this.right.visible = this.showR > 0.02;
    this.left.visible = this.showL > 0.02;
    this.right.position.set(0.2 - rr * 0.11 + sway, -0.26 - (1 - this.showR) * 0.3 + rr * 0.13 + lift - crouch + down * 0.07, -0.36 - rr * 0.13);
    this.right.rotation.set(0.32 - rr * 0.2, 0.3 - rr * 0.2, -0.12);
    this.left.position.set(-0.2 + rl * 0.11 + sway, -0.26 - (1 - this.showL) * 0.3 + rl * 0.13 - lift - crouch + down * 0.07, -0.36 - rl * 0.13);
    this.left.rotation.set(0.32 - rl * 0.2, -0.3 + rl * 0.2, 0.12);
  }
}
