// Puerta con bisagra, colisión y estados (abierta, cerrada, con llave, trabada por historia).
import * as THREE from 'three';
import type { AABB, CollisionWorld } from './Collision';
import type { System } from '../core/Game';

export interface DoorOpts {
  /** Posición de la bisagra en el piso. */
  hinge: THREE.Vector3;
  width: number;
  height?: number;
  /** Eje en el que se extiende la puerta cerrada: 'x' o 'z' (con signo por dir). */
  axis: 'x' | 'z';
  dir: 1 | -1;
  /** Ángulo de apertura (radianes, con signo). */
  openAngle: number;
  material: THREE.Material | THREE.Material[];
  thickness?: number;
  locked?: boolean;
}

export class Door implements System {
  readonly pivot = new THREE.Group();
  readonly panel: THREE.Mesh;
  private collider: AABB;
  private angle = 0;
  private target = 0;
  locked: boolean;
  isOpen = false;
  /** Clave i18n del mensaje al intentar abrirla cerrada. */
  lockedMessage = 'door.locked';

  constructor(
    scene: THREE.Scene,
    collision: CollisionWorld,
    readonly opts: DoorOpts,
  ) {
    const h = opts.height ?? 2.15;
    const t = opts.thickness ?? 0.06;
    this.locked = opts.locked ?? false;
    const geo =
      opts.axis === 'x' ? new THREE.BoxGeometry(opts.width, h, t) : new THREE.BoxGeometry(t, h, opts.width);
    const off = (opts.width / 2) * opts.dir;
    geo.translate(opts.axis === 'x' ? off : 0, h / 2, opts.axis === 'z' ? off : 0);
    this.panel = new THREE.Mesh(geo, opts.material);
    this.panel.castShadow = true;
    this.panel.receiveShadow = true;
    this.pivot.position.copy(opts.hinge);
    this.pivot.add(this.panel);
    scene.add(this.pivot);

    const { x, z } = opts.hinge;
    const end = opts.width * opts.dir;
    this.collider =
      opts.axis === 'x'
        ? collision.add(x, x + end, z - 0.08, z + 0.08, 0, h)
        : collision.add(x - 0.08, x + 0.08, z, z + end, 0, h);
  }

  /** Centro de la puerta en el mundo (para interacción). */
  center(out = new THREE.Vector3()): THREE.Vector3 {
    const { hinge, axis, width, dir } = this.opts;
    return out.set(
      hinge.x + (axis === 'x' ? (width / 2) * dir : 0),
      1.1,
      hinge.z + (axis === 'z' ? (width / 2) * dir : 0),
    );
  }

  open(): void {
    this.isOpen = true;
    this.target = this.opts.openAngle;
    this.collider.enabled = false;
  }

  close(): void {
    this.isOpen = false;
    this.target = 0;
    this.collider.enabled = true;
  }

  /** Cierre de golpe (evento de susto). */
  slam(): void {
    this.close();
    this.angle = this.target;
    this.pivot.rotation.y = 0;
  }

  update(dt: number): void {
    if (this.angle === this.target) return;
    const speed = this.isOpen ? 2.2 : 3.5;
    const d = this.target - this.angle;
    const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    this.angle += step;
    this.pivot.rotation.y = this.angle;
  }
}
