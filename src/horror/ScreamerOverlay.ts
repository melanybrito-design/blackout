// Rostro a pantalla completa pegado a la cámara. Pasa por el pipeline PS2 (se ve dithered y sucio).
import * as THREE from 'three';
import type { System } from '../core/Game';
import { LAYER } from '../core/layers';
import { toTexture } from '../textures/canvas';
import { screamerCanvas } from '../textures/faces';

export class ScreamerOverlay implements System {
  private mesh: THREE.Mesh;
  private black: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private t = -1;
  private dur = 0.7;
  private blackT = 0;
  private cache = new Map<number, THREE.Texture>();
  onDone: (() => void) | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.renderOrder = 999;
    this.mesh.layers.set(LAYER.VIEWMODEL);
    this.mesh.visible = false;
    this.mesh.position.z = -0.3;
    camera.add(this.mesh);
    this.black = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false }),
    );
    this.black.renderOrder = 1000;
    this.black.layers.set(LAYER.VIEWMODEL);
    this.black.position.z = -0.25;
    this.black.visible = false;
    camera.add(this.black);
  }

  face(seed: number): THREE.Texture {
    let tex = this.cache.get(seed);
    if (!tex) {
      tex = toTexture(screamerCanvas(seed, 256), false);
      this.cache.set(seed, tex);
    }
    return tex;
  }

  /** Muestra el rostro durante `dur` s y luego corta a negro `blackout` s. */
  show(seed: number, dur = 0.7, blackout = 0.22): void {
    this.mat.map = this.face(seed);
    this.mat.needsUpdate = true;
    this.t = 0;
    this.dur = dur;
    this.blackT = blackout;
    this.mesh.visible = true;
  }

  /** Negro total (cortes). */
  blackout(seconds: number): void {
    this.black.visible = true;
    this.blackT = seconds;
    this.t = -2;
  }

  get active(): boolean {
    return this.t >= 0 || this.black.visible;
  }

  update(dt: number): void {
    if (this.t === -2) {
      this.blackT -= dt;
      if (this.blackT <= 0) {
        this.black.visible = false;
        this.t = -1;
      }
      return;
    }
    if (this.t < 0) return;
    this.t += dt;
    const cam = this.mesh.parent as THREE.PerspectiveCamera;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.3;
    const grow = Math.min(1, this.t / 0.12);
    const s = h * (0.55 + grow * 0.75 + Math.sin(this.t * 60) * 0.02);
    this.mesh.scale.set(s, s, 1);
    this.mesh.position.x = (Math.random() - 0.5) * 0.01;
    this.mesh.position.y = (Math.random() - 0.5) * 0.01 - 0.005;
    this.mesh.rotation.z = (Math.random() - 0.5) * 0.06;
    if (this.t > this.dur) {
      this.mesh.visible = false;
      this.t = -1;
      if (this.blackT > 0) this.blackout(this.blackT);
      this.onDone?.();
    }
  }
}
