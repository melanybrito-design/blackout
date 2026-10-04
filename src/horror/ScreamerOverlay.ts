// Screamer: la pantalla se va a negro y el rostro sale de la oscuridad hacia la cámara.
// No es una imagen pegada: un shader a pantalla completa lo recorta en óvalo difuso, lo hace
// avanzar, lo tuerce, lo rasga en franjas y le mete grano y saltos de cuadro. Pasa por el
// pipeline PS2 (baja resolución + dithering), así que queda dentro del mundo del juego.
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

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec4 uRect;      // offset.xy, repeat.zw (recorte del video 16:9 al cuadrado del rostro)
  uniform float uTime;
  uniform float uP;        // progreso del golpe 0..1
  uniform float uAspect;   // ancho / alto de la pantalla
  uniform float uGain;
  uniform float uFlash;
  uniform float uBig;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec2 rect(vec2 u) { return uRect.xy + clamp(u, 0.0, 1.0) * uRect.zw; }

  void main() {
    vec2 p = vUv - 0.5;
    p.x *= uAspect;

    // Embestida: aparece lejos en la oscuridad, en ~0,14 s llena la pantalla y sigue acercándose.
    float lunge = smoothstep(0.0, 0.14, uP);
    float z = mix(0.34, 1.0, lunge) + (0.12 + 0.18 * uBig) * smoothstep(0.14, 1.0, uP);
    vec2 q = p / (1.18 * z);

    // Cuadros que saltan (stop-motion) y franjas rasgadas, más fuertes al principio.
    float glitch = min(1.0, mix(1.0, 0.35, smoothstep(0.1, 0.6, uP)) + 0.25 * uBig);
    float tick = floor(uTime * 22.0);
    q += (vec2(hash(vec2(tick, 1.0)), hash(vec2(tick, 2.0))) - 0.5) * 0.035 * glitch;
    float band = floor((vUv.y + hash(vec2(tick, 3.0)) * 0.3) * 22.0);
    q.x += step(0.82, hash(vec2(band, tick))) * (hash(vec2(band, tick + 7.0)) - 0.5) * 0.22 * glitch;
    // Respiración de la carne: ondas lentas y una vibración rápida.
    q += vec2(sin(q.y * 9.0 + uTime * 7.0), cos(q.x * 8.0 - uTime * 6.0)) * 0.012;
    q += (hash(vec2(tick, 5.0)) - 0.5) * 0.004;

    vec2 uv = q + 0.5;
    float ca = 0.003 + 0.011 * glitch;
    vec3 col = vec3(
      texture2D(uMap, rect(uv + vec2(ca, 0.0))).r,
      texture2D(uMap, rect(uv)).g,
      texture2D(uMap, rect(uv - vec2(ca, 0.0))).b
    );

    // Óvalo difuso: sin bordes, el rostro se funde con el negro.
    float m = 1.0 - smoothstep(0.26, 0.5, length(q * vec2(1.12, 0.86)));
    col *= m * uGain;
    col = clamp((col - 0.04) * 1.25, 0.0, 1.0);

    // Grano, cuadros que se apagan y la luz que tiembla.
    col += (hash(vUv * 731.0 + uTime) - 0.5) * 0.14;
    col *= 0.62 + 0.38 * step(0.18, hash(vec2(tick, 9.0)));
    col *= 0.9 + 0.1 * sin(uTime * 90.0);
    col += uFlash;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <colorspace_fragment>
  }
`;

export class ScreamerOverlay implements System {
  private mesh: THREE.Mesh;
  private black: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private t = -1;
  private dur = 0.7;
  private blackT = 0;
  private seed = 0;
  private flash = true;
  private cache = new Map<number, THREE.Texture>();
  private videos = new Map<number, { element: HTMLVideoElement; texture: THREE.VideoTexture; rect: THREE.Vector4 }>();
  private fullRect = new THREE.Vector4(0, 0, 1, 1);
  onDone: (() => void) | null = null;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: null },
        uRect: { value: this.fullRect },
        uTime: { value: 0 },
        uP: { value: 0 },
        uAspect: { value: 16 / 9 },
        uGain: { value: 1 },
        uFlash: { value: 0 },
        uBig: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      // En la pasada transparente (con renderOrder alto) para quedar encima de polvo y lluvia.
      transparent: true,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999;
    this.mesh.layers.set(LAYER.VIEWMODEL);
    this.mesh.visible = false;
    camera.add(this.mesh);
    this.black = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, transparent: true }),
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
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      const rect = new THREE.Vector4(0, 0, 1, 1);
      // El video es 16:9 con el rostro en el cuadrado central: recortar para no aplastarlo.
      element.addEventListener('loadedmetadata', () => {
        // Dejar el video ya parado en el grito: al mostrarlo no hay ni un cuadro de la cara tranquila.
        element.currentTime = VIDEO_START[seed] ?? 0;
        const k = element.videoHeight / element.videoWidth;
        if (k < 1) rect.set((1 - k) / 2, 0, k, 1);
      });
      this.videos.set(seed, { element, texture, rect });
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

  private useStill(seed: number): void {
    const u = this.mat.uniforms;
    u.uMap.value = this.face(seed);
    u.uRect.value = this.fullRect;
    u.uGain.value = 1;
  }

  /**
   * Golpe: `dur` s de rostro y luego `blackout` s de negro.
   * `big` = el más fuerte (Lucía); `flash` = destello blanco al entrar (se apaga con «Reducir destellos»).
   */
  show(seed: number, dur = 0.7, blackout = 0.22, opts: { big?: boolean; flash?: boolean } = {}): void {
    const u = this.mat.uniforms;
    this.useStill(seed);
    const video = this.videos.get(seed);
    if (video?.element.readyState && video.element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const start = VIDEO_START[seed] ?? 0;
      if (Math.abs(video.element.currentTime - start) > 0.04) video.element.currentTime = start;
      u.uMap.value = video.texture;
      u.uRect.value = video.rect;
      u.uGain.value = 1.8; // los videos son oscuros
      void video.element.play().catch(() => this.useStill(seed));
    }
    u.uBig.value = opts.big ? 1 : 0;
    this.flash = opts.flash ?? true;
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
    const u = this.mat.uniforms;
    u.uTime.value += dt;
    u.uP.value = Math.min(1, this.t / this.dur);
    u.uAspect.value = this.camera.aspect;
    // Destello solo en los primeros cuadros (sin destello si el jugador pidió reducirlos).
    u.uFlash.value = this.flash && this.t < 0.05 ? 0.55 : 0;
    const tail = STILL_TAIL[this.seed];
    if (tail && this.t > this.dur - tail && u.uMap.value !== this.face(this.seed)) this.useStill(this.seed);
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
