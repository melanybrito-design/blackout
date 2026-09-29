// Grabadora de cassette (mano izquierda): grabar 10 s, rebobinar, reproducir.
// En zonas EVP la reproducción revela una psicofonía. Reproducir hace ruido (sube la tensión).
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Input } from '../core/Input';
import { LAYER, setLayer } from '../core/layers';
import { applyPS2 } from '../render/ps2Material';
import { canvas, toTexture } from '../textures/canvas';
import { holdingHand } from './hands';
import type { AudioEngine } from '../audio/AudioEngine';

export type RecState = 'idle' | 'playingTape' | 'recording' | 'recorded' | 'rewinding' | 'playing';

export interface EvpZone {
  id: string;
  contains: () => boolean;
  captured: boolean;
}

export class Recorder implements System {
  readonly root = new THREE.Group();
  private led: THREE.MeshBasicMaterial;
  private reels: THREE.Mesh[] = [];
  out = false;
  available = false;
  clickBlocked = false;
  state: RecState = 'idle';
  /** El cassette original "24/10" todavía no se escuchó. */
  tapeUnheard = true;
  private t = 0;
  private openT = 0;
  private recordedZone: EvpZone | null = null;
  readonly zones: EvpZone[] = [];

  onTapePlayed: (() => void) | null = null;
  onRecordStart: (() => void) | null = null;
  onPlaybackStart: ((zone: EvpZone | null) => void) | null = null;
  onPlaybackEnd: ((zone: EvpZone | null) => void) | null = null;
  onToggle: ((out: boolean) => void) | null = null;

  constructor(
    camera: THREE.Camera,
    private input: Input,
    private audio: AudioEngine,
  ) {
    const body = applyPS2(new THREE.MeshLambertMaterial({ color: 0x2b2b2e }));
    const [c, ctx] = canvas(64, 32);
    ctx.fillStyle = '#2b2b2e';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(6, 4, 52, 20);
    ctx.fillStyle = '#d8d0b6';
    ctx.fillRect(12, 7, 40, 14);
    ctx.fillStyle = '#222';
    ctx.font = '8px monospace';
    ctx.fillText('24/10', 21, 17);
    const face = applyPS2(new THREE.MeshLambertMaterial({ map: toTexture(c, false) }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.065, 0.025), [body, body, body, body, face, body]);
    const reelMat = applyPS2(new THREE.MeshLambertMaterial({ color: 0x151515 }));
    for (const x of [-0.018, 0.018]) {
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 6), reelMat);
      reel.rotation.x = Math.PI / 2;
      reel.position.set(x, 0.003, 0.0135);
      box.add(reel);
      this.reels.push(reel);
    }
    this.led = new THREE.MeshBasicMaterial({ color: 0x220000 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.004), this.led);
    led.position.set(0.04, 0.025, 0.0135);
    box.add(led);
    const btns = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.02), applyPS2(new THREE.MeshLambertMaterial({ color: 0x777777 })));
    btns.position.set(0, 0.036, 0);
    box.add(btns);
    const hand = holdingHand(-1);
    hand.position.set(-0.03, -0.01, -0.012);
    this.root.add(box, hand);
    setLayer(this.root, LAYER.VIEWMODEL);
    this.root.visible = false;
    camera.add(this.root);
  }

  toggle(force?: boolean): void {
    if (!this.available) return;
    const next = force ?? !this.out;
    if (next === this.out) return;
    this.out = next;
    this.audio.play('tapeClick');
    this.onToggle?.(next);
  }

  /** Acción principal (clic izquierdo). */
  use(): void {
    if (!this.out) return;
    switch (this.state) {
      case 'idle':
        if (this.tapeUnheard) this.playTape();
        else this.record();
        break;
      case 'recorded':
        this.rewind();
        break;
      default:
        break;
    }
  }

  private playTape(): void {
    this.state = 'playingTape';
    this.t = 0;
    this.audio.play('tapeClick');
    this.audio.setHiss(1);
    this.audio.laughter({ gain: 0.45, delay: 0.3 });
    this.audio.voiceSynth({ syllables: 14, pitch: 280, rate: 0.16, gain: 0.35, tape: true, delay: 2.2 });
    this.audio.laughter({ gain: 0.5, delay: 5.2 });
  }

  private record(): void {
    this.state = 'recording';
    this.t = 0;
    this.audio.play('tapeClick');
    this.recordedZone = this.zones.find((z) => !z.captured && z.contains()) ?? null;
    this.onRecordStart?.();
  }

  private rewind(): void {
    this.state = 'rewinding';
    this.t = 0;
    this.audio.play('tapeRewind');
  }

  update(dt: number): void {
    const inp = this.input;
    if (inp.wasPressed('Digit2')) this.toggle();
    if (this.out && !this.clickBlocked && inp.wasPressed("Mouse0")) this.use();

    this.t += dt;
    const spin = this.state === 'rewinding' ? 40 : this.state === 'idle' || this.state === 'recorded' ? 0 : 6;
    for (const r of this.reels) r.rotation.y += spin * dt;

    switch (this.state) {
      case 'playingTape':
        if (this.t > 8.2) {
          this.audio.play('static');
          this.audio.setHiss(0);
          this.state = 'idle';
          this.tapeUnheard = false;
          this.onTapePlayed?.();
        }
        break;
      case 'recording':
        this.led.color.setHex(Math.floor(this.t * 2) % 2 ? 0xff1a1a : 0x550000);
        if (this.t > 10) {
          this.audio.play('tapeClick');
          this.state = 'recorded';
          this.led.color.setHex(0x220000);
        }
        break;
      case 'rewinding':
        if (this.t > 1.7) {
          this.state = 'playing';
          this.t = 0;
          this.audio.play('tapeClick');
          this.audio.setHiss(1);
          this.onPlaybackStart?.(this.recordedZone);
        }
        break;
      case 'playing':
        if (this.t > 9) {
          this.audio.setHiss(0);
          this.audio.play('tapeClick');
          const z = this.recordedZone;
          if (z) z.captured = true;
          this.state = 'idle';
          this.onPlaybackEnd?.(z);
          this.recordedZone = null;
        }
        break;
    }

    this.openT = THREE.MathUtils.clamp(this.openT + (this.out ? dt * 4 : -dt * 5), 0, 1);
    this.root.visible = this.openT > 0.01;
    const e = this.openT * this.openT * (3 - 2 * this.openT);
    this.root.position.set(-0.19, THREE.MathUtils.lerp(-0.45, -0.17, e), -0.3);
    this.root.rotation.set(-0.3, 0.3, -0.08);
  }

  get busy(): boolean {
    return this.state !== 'idle' && this.state !== 'recorded';
  }
}
