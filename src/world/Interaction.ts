// Detecta qué objeto interactuable mira el jugador, muestra el puntero con la acción disponible
// y ejecuta la acción con E (o manteniendo E).
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Input } from '../core/Input';
import { PLAYER } from '../config';
import { t } from '../i18n';
import { keycaps } from '../ui/Hud';

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  /** Radio de "hitbox" alrededor de position. */
  radius: number;
  enabled: () => boolean;
  use: () => void;
  /** Clave i18n del verbo que se muestra junto al puntero ("Abrir", "Examinar"…). */
  label?: string | (() => string);
  /** Si está definido, hay que mantener E estos segundos. */
  hold?: number;
  onHold?: (progress: number) => void;
}

export class Interaction implements System {
  readonly items: Interactable[] = [];
  current: Interactable | null = null;
  private holdT = 0;
  private dot: HTMLDivElement;
  private labelEl: HTMLDivElement;
  private shownLabel = '';
  private ray = new THREE.Ray();
  private tmp = new THREE.Vector3();
  blocked = false;
  /** Se llama cada vez que el jugador usa algo (animación de la mano). */
  onUse: ((item: Interactable) => void) | null = null;

  constructor(
    private camera: THREE.Camera,
    private input: Input,
  ) {
    this.dot = document.createElement('div');
    this.dot.className = 'reticle';
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'reticle-label';
    document.body.append(this.dot, this.labelEl);
  }

  add(item: Interactable): Interactable {
    this.items.push(item);
    return item;
  }

  remove(id: string): void {
    const i = this.items.findIndex((it) => it.id === id);
    if (i >= 0) this.items.splice(i, 1);
  }

  private showLabel(item: Interactable | null): void {
    let text = '';
    if (item) {
      const key = typeof item.label === 'function' ? item.label() : (item.label ?? 'act.use');
      text = item.hold ? `${t('hint.hold')} · ${t(key)}` : `[E] ${t(key)}`;
    }
    if (text === this.shownLabel) return;
    this.shownLabel = text;
    this.labelEl.innerHTML = keycaps(text);
    this.labelEl.classList.toggle('on', !!text);
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
        // Solo cuenta lo que está delante: algo a la espalda no se puede usar aunque esté pegado.
        if (this.tmp.copy(it.position).sub(this.ray.origin).dot(this.ray.direction) <= 0.05) continue;
        this.ray.closestPointToPoint(it.position, this.tmp);
        const off = this.tmp.distanceTo(it.position);
        if (off > it.radius) continue;
        // Entre varios candidatos gana el que está más centrado en el puntero (y luego el más cercano).
        const score = dist + (off / it.radius) * 0.8;
        if (score < bestD) {
          bestD = score;
          best = it;
        }
      }
    }
    if (best !== this.current) this.holdT = 0;
    this.current = best;
    this.dot.classList.toggle('on', !!best);
    this.dot.classList.toggle('off', this.blocked);
    this.showLabel(best);

    if (!best) return;
    if (best.hold) {
      if (this.input.isDown('KeyE')) {
        this.holdT += dt;
        best.onHold?.(Math.min(1, this.holdT / best.hold));
        if (this.holdT >= best.hold) {
          this.holdT = 0;
          this.onUse?.(best);
          best.use();
        }
      } else if (this.holdT > 0) {
        this.holdT = 0;
        best.onHold?.(0);
      }
    } else if (this.input.wasPressed('KeyE')) {
      this.onUse?.(best);
      best.use();
    }
  }

  setVisible(v: boolean): void {
    this.dot.style.display = v ? '' : 'none';
    this.labelEl.style.display = v ? '' : 'none';
  }
}
