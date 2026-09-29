// Controlador provisorio de la Fase 1 (sin colisiones reales): mirar y caminar por el pasillo
// para validar el look. La Fase 2 lo reemplaza por PlayerController.
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Input } from '../core/Input';
import { PLAYER } from '../config';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class FreeLookController implements System {
  private yaw = 0;
  private pitch = 0;
  private bob = 0;
  private readonly move = new THREE.Vector3();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private bounds: Bounds,
  ) {
    camera.position.set(0, PLAYER.eyeHeight, 0);
  }

  update(dt: number): void {
    const inp = this.input;
    if (inp.locked) {
      this.yaw -= inp.mouseDX * PLAYER.mouseSensitivity;
      this.pitch -= inp.mouseDY * PLAYER.mouseSensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    }
    this.euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);

    const f = (inp.isDown('KeyW') ? 1 : 0) - (inp.isDown('KeyS') ? 1 : 0);
    const s = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
    this.move.set(s, 0, -f);
    const moving = this.move.lengthSq() > 0;
    if (moving) {
      const speed = inp.isDown('ShiftLeft') ? PLAYER.runSpeed : PLAYER.walkSpeed;
      this.move.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw).multiplyScalar(speed * dt);
      const p = this.camera.position;
      p.x = THREE.MathUtils.clamp(p.x + this.move.x, this.bounds.minX, this.bounds.maxX);
      p.z = THREE.MathUtils.clamp(p.z + this.move.z, this.bounds.minZ, this.bounds.maxZ);
      this.bob += dt * (inp.isDown('ShiftLeft') ? 13 : 8.5);
    }
    this.camera.position.y = PLAYER.eyeHeight + (moving ? Math.sin(this.bob) * 0.035 : 0);
  }
}
