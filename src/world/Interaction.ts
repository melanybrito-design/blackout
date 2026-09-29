// Detecta qué objeto interactuable mira el jugador y ejecuta la acción con E (o manteniendo E).
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Input } from '../core/Input';
import { PLAYER } from '../config';

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  /** Radio de "hitbox" alrededor de position. */
  radius: number;
  enabled: () => boolean;
  use: () => void;
  /** Si está definido, hay que mantener E estos segundos. */
  hold?: number;
  onHold?: (progress: number) => void;
}

export class Interaction implements System {
  readonly items: Interactable[] = [];
  current: Interactable | null = null;
  private holdT = 0;
  private dot: HTMLDivElement;
  private ray = new THREE.Ray();
  private tmp = new THREE.Vector3();
  blocked = false;

  constructor(
    private camera: THREE.Camera,
    private input: Input,
  ) {
    this.dot = document.createElement('div');
    this.dot.className = 'reticle';
    document.body.appendChild(this.dot);
  }

  add(item: Interactable): Interactable {
    this.items.push(item);
    return item;
  }

  remove(id: string): void {
    const i = this.items.findIndex((it) => it.id === id);
    if (i >= 0) this.items.splice(i, 1);
  }

  update(dt: number): void {
    this.camera.getWorldPosition(this.ray.origin);
    this.camera.getWorldDirection(this.ray.direction);
    let best: Interactable | null = null;
    let bestD = Infinity;
    if (!this.blocked) {
      for (const it of this.items) {
        if (!it.enabled()) continue;
        const dist = this.ray.origin.distanceTo(it.position);
        if (dist > PLAYER.interactRange + it.radius) continue;
        this.ray.closestPointToPoint(it.position, this.tmp);
        const off = this.tmp.distanceTo(it.position);
        if (off > it.radius) continue;
        if (this.tmp.sub(this.ray.origin).dot(this.ray.direction) < 0) continue;
        if (dist < bestD) {
          bestD = dist;
          best = it;
        }
      }
    }
    if (best !== this.current) this.holdT = 0;
    this.current = best;
    this.dot.classList.toggle('on', !!best);

    if (!best) return;
    if (best.hold) {
      if (this.input.isDown('KeyE')) {
        this.holdT += dt;
        best.onHold?.(Math.min(1, this.holdT / best.hold));
        if (this.holdT >= best.hold) {
          this.holdT = 0;
          best.use();
        }
      } else if (this.holdT > 0) {
        this.holdT = 0;
        best.onHold?.(0);
      }
    } else if (this.input.wasPressed('KeyE')) {
      best.use();
    }
  }

  setVisible(v: boolean): void {
    this.dot.style.display = v ? '' : 'none';
  }
}
