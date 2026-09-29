// Celular de tapa: linterna (flash), pantalla VT323 (hora, SMS, galería, llamadas) y cámara que ve
// la capa espectral. Es la herramienta principal y la que más traiciona al jugador.
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Input } from '../core/Input';
import { LAYER, setLayer } from '../core/layers';
import { applyPS2 } from '../render/ps2Material';
import { canvas, toTexture } from '../textures/canvas';
import { drawFace } from '../textures/faces';
import { holdingHand } from './hands';
import { t } from '../i18n';
import { TIMING } from '../config';
import type { AudioEngine } from '../audio/AudioEngine';
import type { CollisionWorld } from '../world/Collision';

export type Screen = 'home' | 'sms' | 'gallery' | 'call' | 'camera' | 'scare';

export interface Photo {
  id: number;
  canvas: HTMLCanvasElement;
  clue: string | null;
  time: string;
  /** Foto "que no tomaste" (S1). */
  cursed?: boolean;
}

export interface Photographable {
  id: string;
  pos: THREE.Vector3;
  clue: string;
  maxDist: number;
  /** Ignorar oclusión (p. ej. a través del vidrio de una puerta). */
  throughGlass?: boolean;
  enabled: () => boolean;
}

interface Sms {
  key: string;
  time: string;
}

const SW = 128;
const SH = 160;
const CAM_W = 96;
const CAM_H = 120;

export class Phone implements System {
  readonly root = new THREE.Group();
  private lid = new THREE.Group();
  private screenCtx: CanvasRenderingContext2D;
  private screenTex: THREE.CanvasTexture;
  private camMesh: THREE.Mesh;
  readonly flash: THREE.SpotLight;
  readonly camRT: THREE.WebGLRenderTarget;
  readonly phoneCam: THREE.PerspectiveCamera;

  out = false;
  /** El jugador no puede guardarlo (llamada, susto). */
  forced = false;
  available = false;
  flashOn = false;
  cameraMode = false;
  screen: Screen = 'home';
  battery = 23;
  private openT = 0;
  private camT = 0;
  private redrawT = 0;
  private sway = new THREE.Vector2();
  private blink = 0;

  readonly sms: Sms[] = [];
  unreadSms = 0;
  readonly photos: Photo[] = [];
  newPhotos = 0;
  galleryIndex = 0;
  readonly targets: Photographable[] = [];

  // Llamada
  private ring: { stop: () => void } | null = null;
  callState: 'none' | 'ringing' | 'active' = 'none';
  private callT = 0;
  onAnswer: (() => void) | null = null;

  scareImage: HTMLCanvasElement | null = null;

  // Callbacks para el guion
  onPhoto: ((p: Photo) => void) | null = null;
  onGalleryView: ((p: Photo) => void) | null = null;
  onScreenChange: ((s: Screen) => void) | null = null;
  onToggle: ((out: boolean) => void) | null = null;

  private clockMinutes: number = TIMING.clockStart;
  private wallpaper: HTMLCanvasElement;
  private tmpV = new THREE.Vector3();
  private pixelBuf = new Uint8Array(CAM_W * CAM_H * 4);

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private audio: AudioEngine,
    private collision: CollisionWorld,
  ) {
    // ---- Modelo ----
    const bodyMat = applyPS2(new THREE.MeshLambertMaterial({ color: 0xe9dfe3 }));
    const pinkMat = applyPS2(new THREE.MeshLambertMaterial({ color: 0xd98aa6 }));
    const [kc, kctx] = canvas(32, 48);
    kctx.fillStyle = '#e9dfe3';
    kctx.fillRect(0, 0, 32, 48);
    kctx.fillStyle = '#b9aeb3';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) kctx.fillRect(4 + c * 9, 16 + r * 7, 7, 5);
    kctx.fillStyle = '#c47b95';
    kctx.fillRect(10, 4, 12, 9);
    const keyMat = applyPS2(new THREE.MeshLambertMaterial({ map: toTexture(kc, false) }));

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.016), [bodyMat, bodyMat, bodyMat, bodyMat, keyMat, bodyMat]);
    base.position.y = -0.045;
    const lidBody = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.012), [bodyMat, bodyMat, bodyMat, bodyMat, pinkMat, bodyMat]);
    lidBody.position.set(0, 0.0425, 0);
    this.lid.add(lidBody);

    const [sc, sctx] = canvas(SW, SH);
    this.screenCtx = sctx;
    this.screenTex = toTexture(sc, false);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.05),
      new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true }),
    );
    screen.position.set(0, 0.046, 0.0065);
    screen.renderOrder = 2;
    this.lid.add(screen);

    this.camRT = new THREE.WebGLRenderTarget(CAM_W, CAM_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.camRT.texture.colorSpace = THREE.SRGBColorSpace;
    this.camMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.05), new THREE.MeshBasicMaterial({ map: this.camRT.texture }));
    this.camMesh.position.set(0, 0.046, 0.0063);
    this.camMesh.visible = false;
    this.lid.add(this.camMesh);

    this.lid.position.y = 0;
    const hand = holdingHand(1);
    hand.position.set(0.004, -0.02, -0.004);
    this.root.add(base, this.lid, hand);
    setLayer(this.root, LAYER.VIEWMODEL);
    this.root.visible = false;
    camera.add(this.root);

    // ---- Linterna ----
    this.flash = new THREE.SpotLight(0xfff1dc, 0, 16, 0.5, 0.55, 1.4);
    this.flash.castShadow = true;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.shadow.camera.near = 0.2;
    this.flash.shadow.bias = -0.002;
    this.flash.position.set(0.1, -0.06, -0.45);
    this.flash.target.position.set(0, 0, -4);
    camera.add(this.flash, this.flash.target);
    this.flash.map = this.flashCookie();

    // ---- Cámara del celular ----
    this.phoneCam = new THREE.PerspectiveCamera(58, CAM_W / CAM_H, 0.05, 60);
    this.phoneCam.layers.set(LAYER.WORLD);
    this.phoneCam.layers.enable(LAYER.SPECTRAL);

    this.wallpaper = this.makeWallpaper();
    this.draw();
  }

  private flashCookie(): THREE.Texture {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, '#eee');
    g.addColorStop(0.6, '#888');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 4, 0, 7);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private makeWallpaper(): HTMLCanvasElement {
    const [c, ctx] = canvas(SW, SH);
    const [f1, c1] = canvas(64, 64);
    drawFace(c1, { seed: 4011, hair: 0 }, 64);
    const [f2, c2] = canvas(64, 64);
    drawFace(c2, { seed: 9120, hair: 2 }, 64);
    ctx.fillStyle = '#1a0f14';
    ctx.fillRect(0, 0, SW, SH);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(f2, 4, 48, 64, 64);
    ctx.drawImage(f1, 60, 44, 64, 64);
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, 'rgba(60,10,30,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SW, SH);
    return c;
  }

  // ---------------- API ----------------

  get clock(): string {
    const m = Math.floor(this.clockMinutes);
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  setClock(minutes: number): void {
    this.clockMinutes = minutes;
  }

  toggle(force?: boolean): void {
    if (!this.available) return;
    const next = force ?? !this.out;
    if (!next && this.forced) return;
    if (next === this.out) return;
    this.out = next;
    if (!next) this.cameraMode = false;
    this.audio.play('phoneOpen');
    if (next && this.unreadSms > 0) this.setScreen('sms');
    this.onToggle?.(next);
    this.dirty();
  }

  setFlash(on: boolean): void {
    this.flashOn = on;
    this.audio.play('flashOn');
  }

  setScreen(s: Screen): void {
    this.screen = s;
    if (s === 'sms') this.unreadSms = 0;
    if (s === 'gallery') {
      if (this.newPhotos > 0) this.galleryIndex = Math.max(0, this.photos.length - this.newPhotos);
      this.newPhotos = 0;
      const p = this.photos[this.galleryIndex];
      if (p) this.onGalleryView?.(p);
    }
    this.onScreenChange?.(s);
    this.dirty();
  }

  receiveSms(key: string): void {
    this.sms.push({ key, time: this.clock });
    this.unreadSms++;
    this.audio.play('vibrate');
    setTimeout(() => this.audio.play('sms'), 450);
    if (this.out && this.screen !== 'camera') this.setScreen('sms');
    this.dirty();
  }

  /** Agrega una foto (propia o "maldita"). */
  addPhoto(c: HTMLCanvasElement, clue: string | null, cursed = false): Photo {
    const p: Photo = { id: this.photos.length, canvas: c, clue, time: this.clock, cursed };
    this.photos.push(p);
    this.newPhotos++;
    this.dirty();
    return p;
  }

  incomingCall(onAnswer: () => void): void {
    this.callState = 'ringing';
    this.onAnswer = onAnswer;
    this.forced = true;
    this.toggle(true);
    this.cameraMode = false;
    this.setScreen('call');
    this.ring = this.audio.play('ringtone');
    this.audio.play('vibrate');
  }

  answer(): void {
    if (this.callState !== 'ringing') return;
    this.ring?.stop();
    this.ring = null;
    this.callState = 'active';
    this.callT = 0;
    this.audio.play('click');
    this.onAnswer?.();
    this.dirty();
  }

  endCall(): void {
    this.ring?.stop();
    this.callState = 'none';
    this.forced = false;
    this.setScreen('home');
  }

  showScare(img: HTMLCanvasElement | null): void {
    this.scareImage = img;
    if (img) this.setScreen('scare');
    this.dirty();
  }

  /** Renderiza desde una cámara arbitraria al RT y devuelve un canvas (fotos con guion). */
  captureFrom(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera): HTMLCanvasElement {
    renderer.setRenderTarget(this.camRT);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    return this.readRT(renderer);
  }

  private readRT(renderer: THREE.WebGLRenderer): HTMLCanvasElement {
    renderer.readRenderTargetPixels(this.camRT, 0, 0, CAM_W, CAM_H, this.pixelBuf);
    const [c, ctx] = canvas(CAM_W, CAM_H);
    const img = ctx.createImageData(CAM_W, CAM_H);
    for (let y = 0; y < CAM_H; y++) {
      const src = (CAM_H - 1 - y) * CAM_W * 4;
      img.data.set(this.pixelBuf.subarray(src, src + CAM_W * 4), y * CAM_W * 4);
    }
    // grano de sensor barato
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Toma una foto con la cámara del celular. */
  takePhoto(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Photo {
    this.syncPhoneCam();
    const c = this.captureFrom(renderer, scene, this.phoneCam);
    this.audio.play('shutter');
    const clue = this.detectTarget();
    const p = this.addPhoto(c, clue);
    this.newPhotos = Math.max(0, this.newPhotos - 1);
    this.onPhoto?.(p);
    return p;
  }

  private detectTarget(): string | null {
    this.syncPhoneCam();
    this.phoneCam.updateMatrixWorld();
    const camPos = this.phoneCam.getWorldPosition(new THREE.Vector3());
    for (const tg of this.targets) {
      if (!tg.enabled()) continue;
      const d = camPos.distanceTo(tg.pos);
      if (d > tg.maxDist) continue;
      const ndc = this.tmpV.copy(tg.pos).project(this.phoneCam);
      if (Math.abs(ndc.x) > 0.85 || Math.abs(ndc.y) > 0.85 || ndc.z > 1) continue;
      if (!tg.throughGlass && this.collision.blocked(camPos.x, camPos.z, tg.pos.x, tg.pos.z, 1.2)) continue;
      return tg.clue;
    }
    return null;
  }

  private syncPhoneCam(): void {
    this.camera.getWorldPosition(this.phoneCam.position);
    this.camera.getWorldQuaternion(this.phoneCam.quaternion);
    this.phoneCam.updateMatrixWorld();
  }

  /** Render del visor (llamado antes del render principal). */
  renderViewfinder(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    if (!this.out || this.camT < 0.3) return;
    this.syncPhoneCam();
    const prevFlash = this.flash.intensity;
    renderer.setRenderTarget(this.camRT);
    renderer.render(scene, this.phoneCam);
    renderer.setRenderTarget(null);
    this.flash.intensity = prevFlash;
  }

  dirty(): void {
    this.redrawT = 0;
  }

  // ---------------- Update ----------------

  update(dt: number): void {
    this.clockMinutes += dt / TIMING.secondsPerGameMinute;
    this.battery = Math.max(3, this.battery - dt * 0.012);
    const inp = this.input;

    if (inp.wasPressed('Digit1')) this.toggle();
    if (this.out) {
      if (inp.wasPressed('KeyF')) this.setFlash(!this.flashOn);
      const wantCam = inp.isDown('Mouse2') && this.callState === 'none' && this.screen !== 'scare';
      if (wantCam !== this.cameraMode) {
        this.cameraMode = wantCam;
        this.setScreen(wantCam ? 'camera' : 'home');
      }
      if (inp.wasPressed("Mouse0")) {
        if (this.cameraMode) {
          if (this.camT > 0.8) this.pendingPhoto = true;
        } else if (!this.clickBlocked && this.callState === "none" && this.screen !== "scare") {
          const order: Screen[] = ['home', 'sms', 'gallery'];
          const i = order.indexOf(this.screen);
          this.setScreen(order[(i + 1) % order.length]);
          this.audio.play('click');
        }
      }
      if (this.screen === 'gallery' && inp.wheel !== 0 && this.photos.length) {
        this.galleryIndex = THREE.MathUtils.clamp(this.galleryIndex + (inp.wheel > 0 ? 1 : -1), 0, this.photos.length - 1);
        this.audio.play('click');
        this.onGalleryView?.(this.photos[this.galleryIndex]);
        this.dirty();
      }
      if (this.callState === 'ringing' && inp.wasPressed('KeyE')) this.answer();
    }
    if (this.callState === 'active') this.callT += dt;

    // Animaciones
    this.openT = THREE.MathUtils.clamp(this.openT + (this.out ? dt * 4 : -dt * 5), 0, 1);
    this.camT = THREE.MathUtils.clamp(this.camT + (this.cameraMode ? dt * 5 : -dt * 6), 0, 1);
    this.root.visible = this.openT > 0.01;
    const e = easeInOut(this.openT);
    const c = easeInOut(this.camT);
    // pose: guardado → sostenido → cámara (al centro, más cerca)
    this.sway.x += (-inp.mouseDX * 0.00012 - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (inp.mouseDY * 0.00012 - this.sway.y) * Math.min(1, dt * 10);
    const px = THREE.MathUtils.lerp(0.125, 0.0, c) + this.sway.x;
    const py = THREE.MathUtils.lerp(-0.4, THREE.MathUtils.lerp(-0.115, -0.045, c), e) + this.sway.y;
    const pz = THREE.MathUtils.lerp(-0.3, -0.19, c);
    this.root.position.set(px, py, pz);
    this.root.rotation.set(THREE.MathUtils.lerp(0.12, 0.05, c), THREE.MathUtils.lerp(-0.3, 0, c), THREE.MathUtils.lerp(0.08, 0, c));
    this.lid.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.98, -0.18, e);
    this.camMesh.visible = this.camT > 0.3;

    // Linterna: solo con el celular fuera
    const want = this.out && this.flashOn ? 16 : 0;
    this.flash.intensity += (want - this.flash.intensity) * Math.min(1, dt * 18);
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      this.flash.intensity *= Math.random() > 0.5 ? 1 : 0.05;
    }

    // Pantalla
    this.blink += dt;
    this.redrawT -= dt;
    if (this.redrawT <= 0 && this.openT > 0) {
      this.draw();
      this.redrawT = this.screen === 'call' || this.screen === 'camera' ? 0.1 : 0.5;
    }
  }

  /** Foto pendiente: se toma en preRender (necesita el renderer). */
  pendingPhoto = false;
  clickBlocked = false;
  private flickerT = 0;

  flicker(seconds: number): void {
    this.flickerT = seconds;
  }

  // ---------------- Pantalla ----------------

  private draw(): void {
    const ctx = this.screenCtx;
    ctx.clearRect(0, 0, SW, SH);
    ctx.textBaseline = 'top';
    const s = this.screen;
    if (s === 'camera') {
      this.drawCameraOverlay(ctx);
    } else if (s === 'scare' && this.scareImage) {
      ctx.drawImage(this.scareImage, 0, 0, SW, SH);
    } else {
      ctx.drawImage(this.wallpaper, 0, 0);
      if (s === 'home') this.drawHome(ctx);
      else if (s === 'sms') this.drawSms(ctx);
      else if (s === 'gallery') this.drawGallery(ctx);
      else if (s === 'call') this.drawCall(ctx);
      this.drawStatus(ctx);
    }
    this.screenTex.needsUpdate = true;
  }

  private drawStatus(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, SW, 14);
    ctx.fillStyle = '#f5c6d6';
    ctx.font = '13px VT323';
    ctx.fillText(t('phone.noSignal'), 3, 1);
    ctx.fillText(this.clock, 56, 1);
    const b = Math.round(this.battery);
    ctx.strokeStyle = '#f5c6d6';
    ctx.strokeRect(100, 3, 20, 8);
    ctx.fillStyle = b < 10 ? '#ff4d6a' : '#f5c6d6';
    ctx.fillRect(101, 4, Math.max(1, (18 * b) / 100), 6);
    ctx.fillRect(120, 5, 2, 4);
  }

  private drawHome(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffe4ee';
    ctx.font = '40px VT323';
    ctx.textAlign = 'center';
    ctx.fillText(this.clock, SW / 2, 22);
    ctx.font = '14px VT323';
    ctx.fillText(t('phone.date'), SW / 2, 58);
    ctx.textAlign = 'left';
    let y = 112;
    ctx.font = '13px VT323';
    if (this.unreadSms > 0) {
      ctx.fillStyle = 'rgba(217,138,166,0.85)';
      ctx.fillRect(6, y, SW - 12, 16);
      ctx.fillStyle = '#1a0f14';
      ctx.fillText(`✉ ${t('phone.newMessage')}`, 10, y + 2);
      y += 20;
    }
    if (this.newPhotos > 0) {
      ctx.fillStyle = 'rgba(217,138,166,0.85)';
      ctx.fillRect(6, y, SW - 12, 16);
      ctx.fillStyle = '#1a0f14';
      ctx.fillText(`▣ ${t('phone.newPhotos', { n: this.newPhotos })}`, 10, y + 2);
    }
    this.drawTabs(ctx);
  }

  private drawTabs(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, SH - 13, SW, 13);
    ctx.font = '11px VT323';
    const tabs: Array<[Screen, string]> = [
      ['home', t('phone.home')],
      ['sms', t('phone.messages')],
      ['gallery', t('phone.gallery')],
    ];
    tabs.forEach(([s, label], i) => {
      ctx.fillStyle = this.screen === s ? '#ff9fbf' : '#8a6f7a';
      ctx.textAlign = 'center';
      ctx.fillText(label, 21 + i * 43, SH - 12);
    });
    ctx.textAlign = 'left';
  }

  private drawSms(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(10,4,8,0.75)';
    ctx.fillRect(0, 14, SW, SH - 27);
    ctx.fillStyle = '#ff9fbf';
    ctx.font = '14px VT323';
    ctx.fillText(`${t('phone.messages')} · ${t('sms.from')}`, 4, 16);
    if (!this.sms.length) {
      ctx.fillStyle = '#8a6f7a';
      ctx.fillText(t('phone.noMessages'), 4, 40);
    }
    // del más nuevo abajo hacia arriba
    let y = SH - 18;
    ctx.font = '12px VT323';
    for (let i = this.sms.length - 1; i >= 0 && y > 34; i--) {
      const lines = wrap(ctx, t(this.sms[i].key), SW - 22);
      const h = lines.length * 11 + 14;
      y -= h;
      ctx.fillStyle = i === this.sms.length - 1 ? 'rgba(217,138,166,0.95)' : 'rgba(120,70,90,0.8)';
      ctx.fillRect(4, y, SW - 12, h - 3);
      ctx.fillStyle = '#1a0f14';
      lines.forEach((l, k) => ctx.fillText(l, 8, y + 2 + k * 11));
      ctx.fillStyle = 'rgba(26,15,20,0.7)';
      ctx.fillText(this.sms[i].time, SW - 36, y + h - 14);
    }
    this.drawTabs(ctx);
  }

  private drawGallery(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 14, SW, SH - 27);
    const p = this.photos[this.galleryIndex];
    if (!p) {
      ctx.fillStyle = '#8a6f7a';
      ctx.font = '14px VT323';
      ctx.fillText(t('phone.noPhotos'), 4, 40);
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(p.canvas, 4, 17, SW - 8, (SW - 8) * (CAM_H / CAM_W) * 0.98);
      ctx.fillStyle = '#ff9fbf';
      ctx.font = '12px VT323';
      ctx.fillText(`${this.galleryIndex + 1}/${this.photos.length}  ${p.time}`, 4, SH - 26);
    }
    this.drawTabs(ctx);
  }

  private drawCall(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(10,4,8,0.8)';
    ctx.fillRect(0, 14, SW, SH - 14);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe4ee';
    ctx.font = '14px VT323';
    if (this.callState === 'ringing') {
      ctx.fillText(t('phone.incoming'), SW / 2, 30);
      if (Math.floor(this.blink * 3) % 2 === 0) {
        ctx.font = '24px VT323';
        ctx.fillStyle = '#ff9fbf';
        ctx.fillText(t('phone.caller'), SW / 2, 60);
      }
      ctx.font = '13px VT323';
      ctx.fillStyle = '#ffe4ee';
      ctx.fillText(t('hint.answer'), SW / 2, 120);
    } else {
      ctx.font = '22px VT323';
      ctx.fillStyle = '#ff9fbf';
      ctx.fillText(t('phone.caller'), SW / 2, 50);
      ctx.font = '18px VT323';
      ctx.fillStyle = '#ffe4ee';
      const s = Math.floor(this.callT);
      ctx.fillText(`00:${String(s).padStart(2, '0')}`, SW / 2, 84);
    }
    ctx.textAlign = 'left';
  }

  private drawCameraOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    const m = 8;
    const l = 12;
    for (const [x, y, dx, dy] of [
      [m, m, 1, 1],
      [SW - m, m, -1, 1],
      [m, SH - m, 1, -1],
      [SW - m, SH - m, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * l);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * l, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = '12px VT323';
    ctx.fillText(t('phone.camera'), 14, 12);
    ctx.fillText(this.clock, SW - 40, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(SW / 2 - 6, SH / 2 - 6, 12, 12);
  }
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
