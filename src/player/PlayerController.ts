// Jugador en primera persona: mirar, caminar, correr (stamina), agacharse, colisiones,
// cabeceo y eventos de paso. Puede congelarse o forzar la mirada en escenas con guion.
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Input } from '../core/Input';
import type { CollisionWorld } from '../world/Collision';
import { PLAYER } from '../config';

export type Surface = 'tile' | 'wood' | 'concrete' | 'water';

export class PlayerController implements System {
  readonly position = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  /** Velocidad horizontal real (m/s) del último frame. */
  speed = 0;
  crouched = false;
  running = false;
  stamina: number = PLAYER.stamina;
  /** Sin movimiento (escenas, diario). La mirada sigue si lookEnabled. */
  frozen = false;
  lookEnabled = true;
  /** Segundos quieto. */
  stillTime = 0;
  /** Cantidad de giro rápido acumulado (para el Director: "mira hacia atrás"). */
  turnRate = 0;
  onStep: ((surface: Surface, running: boolean) => void) | null = null;
  surfaceAt: (x: number, z: number) => Surface = () => 'tile';

  private eye: number = PLAYER.eyeHeight;
  private bob = 0;
  private stepAcc = 0;
  private readonly move = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private shakeT = 0;
  private shakeAmp = 0;
  private lookTarget: THREE.Vector3 | null = null;
  private lookLerp = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private input: Input,
    private collision: CollisionWorld,
  ) {}

  teleport(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.speed = 0;
  }

  shake(amp: number, time: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, time);
  }

  /** Gira la cabeza suavemente hacia un punto (escenas con guion). null = liberar. */
  lookAt(target: THREE.Vector3 | null, strength = 4): void {
    this.lookTarget = target;
    this.lookLerp = strength;
  }

  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt: number): void {
    const inp = this.input;
    const prevYaw = this.yaw;
    if (this.lookEnabled && inp.locked && !this.lookTarget) {
      this.yaw -= inp.mouseDX * PLAYER.mouseSensitivity * sensitivityScale;
      this.pitch -= inp.mouseDY * PLAYER.mouseSensitivity * sensitivityScale;
    }
    if (this.lookTarget) {
      const dx = this.lookTarget.x - this.position.x;
      const dz = this.lookTarget.z - this.position.z;
      const wantYaw = Math.atan2(-dx, -dz);
      let d = wantYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, this.lookLerp * dt);
      const dy = this.lookTarget.y - (this.position.y + this.eye);
      const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      this.pitch += (wantPitch - this.pitch) * Math.min(1, this.lookLerp * dt);
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    this.turnRate = this.turnRate * Math.exp(-dt * 2) + Math.abs(this.yaw - prevYaw);

    // Movimiento
    let f = 0;
    let s = 0;
    if (!this.frozen) {
      f = (inp.isDown('KeyW') ? 1 : 0) - (inp.isDown('KeyS') ? 1 : 0);
      s = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
      if (inp.wasPressed('KeyC') || inp.wasPressed('ControlLeft')) this.crouched = !this.crouched;
    }
    this.move.set(s, 0, -f);
    const wants = this.move.lengthSq() > 0;
    this.running = wants && !this.crouched && inp.isDown('ShiftLeft') && this.stamina > 0.05 && !this.frozen;
    if (this.running) this.crouched = false;
    this.stamina = this.running
      ? Math.max(0, this.stamina - dt)
      : Math.min(PLAYER.stamina, this.stamina + dt * PLAYER.staminaRegen);

    const speed = this.crouched ? PLAYER.crouchSpeed : this.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const before = this.prev.copy(this.position);
    if (wants) {
      this.move.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw).multiplyScalar(speed * dt);
      this.position.add(this.move);
    }
    this.collision.resolve(this.position, PLAYER.radius, 0, this.crouched ? 1.1 : 1.75);
    const moved = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    this.speed = dt > 0 ? moved / dt : 0;
    this.stillTime = this.speed < 0.1 ? this.stillTime + dt : 0;

    // Pasos y cabeceo
    if (moved > 0.0001) {
      this.bob += moved * (Math.PI / PLAYER.stepLength);
      this.stepAcc += moved;
      const stepLen = PLAYER.stepLength * (this.running ? 1.25 : this.crouched ? 0.8 : 1);
      if (this.stepAcc >= stepLen) {
        this.stepAcc = 0;
        this.onStep?.(this.surfaceAt(this.position.x, this.position.z), this.running);
      }
    }
    const targetEye = this.crouched ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 8);
    const bobAmp = this.speed > 0.1 ? (this.running ? 0.05 : 0.028) : 0;

    // Temblor de cámara
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.min(1, this.shakeT * 3);
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }

    this.camera.position.set(
      this.position.x,
      this.eye + Math.sin(this.bob) * bobAmp,
      this.position.z,
    );
    this.euler.set(this.pitch + sy * 0.5, this.yaw + sx * 0.5, Math.sin(this.bob * 0.5) * bobAmp * 0.25);
    this.camera.quaternion.setFromEuler(this.euler);
  }
}

/** Multiplicador de sensibilidad desde Opciones. */
export let sensitivityScale = 1;
export function setSensitivityScale(v: number): void {
  sensitivityScale = v;
}
