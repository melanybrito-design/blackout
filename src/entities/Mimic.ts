// "La que Imita" (Ana Paula): avanza solo cuando el jugador se mueve rápido. Agachado y lento, espera.
// Se mueve a saltos por un camino (pasillo principal → cruce → gimnasio).
import * as THREE from 'three';
import type { System } from '../core/Game';
import { CHASE } from '../config';
import type { PlayerController } from '../player/PlayerController';
import type { AudioEngine } from '../audio/AudioEngine';
import { GirlModel } from './GirlModel';

// Sale de la escalera del tercer piso, dobla al pasillo largo y llega al gimnasio.
const PATH = [new THREE.Vector3(0, 0, -30.2), new THREE.Vector3(0, 0, -35.5), new THREE.Vector3(41.5, 0, -35.5)];

/** Distancia recorrida a lo largo del camino del punto más cercano a (x, z). */
export function pathProgress(x: number, z: number): number {
  let best = Infinity;
  let bestS = 0;
  let acc = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len = Math.hypot(abx, abz);
    const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (len * len), 0, 1);
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      bestS = acc + len * t;
    }
    acc += len;
  }
  return bestS;
}

export function pathPoint(s: number, out = new THREE.Vector3()): THREE.Vector3 {
  let acc = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const len = a.distanceTo(b);
    if (s <= acc + len) return out.copy(a).lerp(b, (s - acc) / len);
    acc += len;
  }
  return out.copy(PATH[PATH.length - 1]);
}

export class Mimic implements System {
  readonly model = new GirlModel({ seed: 5419, scary: 1, hairFront: 0.35 });
  active = false;
  s = 0;
  private pending = 0;
  private jumpT = 0;
  private stepT = 0;
  private wasMoving = false;
  /** Ruido extra (forzar una puerta): avanza aunque el jugador esté quieto. */
  noise = 0;
  /** Baja con cada vez que atrapa al jugador: la persecución no puede volverse una traba. */
  ease = 1;
  onCatch: (() => void) | null = null;
  private tmp = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private player: PlayerController,
    private audio: AudioEngine,
  ) {
    this.model.root.visible = false;
    this.model.pose(0.45, 0.2);
    scene.add(this.model.root);
  }

  spawnBehind(gap: number = CHASE.startGap): void {
    const ps = pathProgress(this.player.position.x, this.player.position.z);
    this.s = Math.max(0, ps - gap);
    this.pending = 0;
    this.active = true;
    this.model.root.visible = true;
    this.place();
  }

  hide(): void {
    this.active = false;
    this.model.root.visible = false;
  }

  private place(): void {
    pathPoint(this.s, this.tmp);
    this.model.root.position.set(this.tmp.x, 0, this.tmp.z);
    this.model.lookAt(this.player.position);
  }

  get distance(): number {
    const m = this.model.root.position;
    return Math.hypot(m.x - this.player.position.x, m.z - this.player.position.z);
  }

  update(dt: number): void {
    if (!this.active) return;
    const p = this.player;
    const fast = p.speed > CHASE.moveThreshold && !p.crouched;
    let v = 0;
    if (fast) v = p.speed * (p.running ? CHASE.runFactor : CHASE.walkFactor) * this.ease;
    if (this.noise > 0) {
      this.noise -= dt;
      v = Math.max(v, 1.4);
    }
    const moving = v > 0;
    if (!moving && this.wasMoving) this.audio.play('boneCrack', { pos: this.model.root.position.clone().setY(1.5) });
    this.wasMoving = moving;
    this.pending += v * dt;

    // Saltos: acumula distancia y teletransporta cada ~0.22 s
    this.jumpT -= dt;
    if (this.jumpT <= 0 && this.pending > 0.05) {
      this.jumpT = 0.18 + Math.random() * 0.1;
      const target = pathProgress(p.position.x, p.position.z);
      this.s = Math.min(this.s + this.pending, target);
      this.pending = 0;
      this.place();
      this.model.pose(0.3 + Math.random() * 0.4, 0.2 + Math.random() * 0.3);
    }
    if (moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.32;
        this.audio.step('tile', true, this.model.root.position.clone().setY(0.1), true);
      }
    } else this.model.lookAt(p.position);

    if (this.distance < CHASE.catchDistance) this.onCatch?.();
  }
}
