// Rostro a pantalla completa pegado a la cámara. Pasa por el pipeline PS2 (se ve dithered y sucio).
import * as THREE from 'three';
import type { System } from '../core/Game';
import { LAYER } from '../core/layers';
import { toTexture } from '../textures/canvas';
import { screamerCanvas } from '../textures/faces';
import { optionalTexture } from '../textures/asset';

const SCREAMERS: Record<number, string> = { 4011: 'lucia', 2203: 'daniela', 3307: 'renata', 5419: 'anapaula' };
/** Segundo del video en el que empieza el grito (antes de eso, la chica aún gira la cabeza). */
const VIDEO_START: Record<number, number> = { 4011: 1.5 };
/** Últimos segundos del golpe en los que el video corta a la imagen fija (Lucía: la sonrisa partida). */
const STILL_TAIL: Record<number, number> = { 4011: 0.3 };

export class ScreamerOverlay implements System {
  private mesh: THREE.Mesh;
  private black: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private t = -1;
  private dur = 0.7;
  private blackT = 0;
  private seed = 0;
  private cache = new Map<number, THREE.Texture>();
  private videos = new Map<number, { element: HTMLVideoElement; texture: THREE.VideoTexture }>();
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
    for (const [seed, girl] of [[4011, 'lucia'], [2203, 'daniela']] as const) {
      const element = document.createElement('video');
      element.src = `/assets/video/jumpscare_${girl}.mp4`;
      element.muted = true;
      element.playsInline = true;
      element.preload = 'auto';
      const texture = new THREE.VideoTexture(element);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      // El video es 16:9 con el rostro en el cuadrado central: recortar para no aplastarlo.
      element.addEventListener('loadedmetadata', () => {
        // Dejar el video ya parado en el grito: al mostrarlo no hay ni un cuadro de la cara tranquila.
        element.currentTime = VIDEO_START[seed] ?? 0;
        const k = element.videoHeight / element.videoWidth;
        if (k < 1) {
          texture.repeat.set(k, 1);
          texture.offset.set((1 - k) / 2, 0);
        }
      });
      this.videos.set(seed, { element, texture });
    }
    // Precargar los rostros: si se piden recién en el golpe, el primer cuadro sale con el dibujo de respaldo.
    for (const seed of Object.keys(SCREAMERS)) this.face(Number(seed));
  }

  face(seed: number): THREE.Texture {
    let tex = this.cache.get(seed);
    if (!tex) {
      tex = toTexture(screamerCanvas(seed, 256), false);
      const girl = SCREAMERS[seed];
      if (girl) optionalTexture(tex, `characters/scream_${girl}.png`);
      this.cache.set(seed, tex);
    }
    return tex;
  }

  /** Muestra el rostro durante `dur` s y luego corta a negro `blackout` s. */
  show(seed: number, dur = 0.7, blackout = 0.22): void {
    this.mat.map = this.face(seed);
    this.mat.color.setScalar(1);
    const video = this.videos.get(seed);
    if (video?.element.readyState && video.element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // Entrar directo en el grito: el golpe debe llenar la pantalla en menos de 400 ms.
      const start = VIDEO_START[seed] ?? 0;
      if (Math.abs(video.element.currentTime - start) > 0.04) video.element.currentTime = start;
      this.mat.map = video.texture;
      this.mat.color.setScalar(1.7);
      void video.element.play().catch(() => {
        this.mat.map = this.face(seed);
        this.mat.color.setScalar(1);
        this.mat.needsUpdate = true;
      });
    }
    this.mat.needsUpdate = true;
    this.seed = seed;
    this.t = 0;
    this.dur = dur;
    this.blackT = blackout;
    this.mesh.visible = true;
  }

  /** Negro total (cortes). Si hay un rostro en pantalla, el negro entra cuando el rostro termina. */
  blackout(seconds: number): void {
    if (this.t >= 0) {
      this.blackT = Math.max(this.blackT, seconds);
      return;
    }
    this.mesh.visible = false;
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
    const tail = STILL_TAIL[this.seed];
    if (tail && this.t > this.dur - tail && this.mat.map !== this.face(this.seed)) {
      this.mat.map = this.face(this.seed);
      this.mat.color.setScalar(1);
      this.mat.needsUpdate = true;
    }
    if (this.t > this.dur) {
      for (const [seed, video] of this.videos) {
        video.element.pause();
        video.element.currentTime = VIDEO_START[seed] ?? 0;
      }
      this.mesh.visible = false;
      this.t = -1;
      if (this.blackT > 0) this.blackout(this.blackT);
      this.onDone?.();
    }
  }
}
