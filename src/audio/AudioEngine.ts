// Motor de audio 100% procedural (Web Audio API). Sin archivos.
// Buses: world (se "silencia" antes de un susto) → master; impact (stingers, nunca se silencia) → master.
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Surface } from '../player/PlayerController';

type Dest = AudioNode;

export interface PlayOpts {
  pos?: THREE.Vector3;
  gain?: number;
}

export class AudioEngine implements System {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  /** Todo lo "del mundo": ambiente, pasos, eventos. Se silencia con duck(). */
  world!: GainNode;
  private impact!: GainNode;
  private voice!: GainNode;
  private ui!: GainNode;
  private white!: AudioBuffer;
  private pink!: AudioBuffer;
  private brown!: AudioBuffer;

  // Capas continuas
  private rainGain!: GainNode;
  private rainFilter!: BiquadFilterNode;
  private humGain!: GainNode;
  private droneGain!: GainNode;
  private droneFilter!: BiquadFilterNode;
  private droneHigh!: GainNode;
  private roomGain!: GainNode;
  private hissGain!: GainNode;

  private listenerPos = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private up = new THREE.Vector3();

  // Estado de capas moduladas en update()
  tension = 0;
  outdoor = 1;
  hum = 0;
  heart = 0;
  breath = 0.2;
  breathRate = 0.28;
  private heartT = 0;
  private breathT = 0;
  private duckT = 0;
  volume = 0.9;

  constructor(public camera: THREE.Camera) {}

  /** Debe llamarse desde un gesto del usuario. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.world = this.bus(this.master, 1);
    this.impact = this.bus(this.master, 1);
    this.voice = this.bus(this.world, 1);
    this.ui = this.bus(this.master, 0.7);

    this.white = this.noiseBuffer('white');
    this.pink = this.noiseBuffer('pink');
    this.brown = this.noiseBuffer('brown');
    this.buildLayers();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private bus(to: AudioNode, g: number): GainNode {
    const n = this.ctx!.createGain();
    n.gain.value = g;
    n.connect(to);
    return n;
  }

  private noiseBuffer(kind: 'white' | 'pink' | 'brown'): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  private loopNoise(buf: AudioBuffer): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 2);
    return s;
  }

  private buildLayers(): void {
    const ctx = this.ctx!;
    // Lluvia
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 5000;
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 300;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.loopNoise(this.pink).connect(rainHP).connect(this.rainFilter).connect(this.rainGain).connect(this.world);

    // Zumbido fluorescente
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const humF = ctx.createBiquadFilter();
    humF.type = 'bandpass';
    humF.frequency.value = 240;
    humF.Q.value = 1.5;
    for (const [f, type, g] of [
      [60, 'sawtooth', 0.4],
      [120, 'sine', 0.5],
      [180, 'square', 0.08],
    ] as Array<[number, OscillatorType, number]>) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(humF);
      o.start();
    }
    humF.connect(this.humGain).connect(this.world);

    // Drone de tensión
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 220;
    this.droneFilter.Q.value = 4;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    for (const f of [41.2, 41.7, 61.8, 87.3]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const og = ctx.createGain();
      og.gain.value = 0.25;
      o.connect(og).connect(this.droneFilter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 90;
    lfo.connect(lfoG).connect(this.droneFilter.frequency);
    lfo.start();
    this.droneFilter.connect(this.droneGain).connect(this.world);
    // Capa aguda disonante (tensión alta)
    this.droneHigh = ctx.createGain();
    this.droneHigh.gain.value = 0;
    for (const f of [1244, 1318.5, 1396.9]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.02;
      o.connect(og).connect(this.droneHigh);
      o.start();
    }
    this.droneHigh.connect(this.world);

    // Tono de sala (aire)
    this.roomGain = ctx.createGain();
    this.roomGain.gain.value = 0.02;
    const roomF = ctx.createBiquadFilter();
    roomF.type = 'lowpass';
    roomF.frequency.value = 380;
    this.loopNoise(this.brown).connect(roomF).connect(this.roomGain).connect(this.world);

    // Siseo de cinta (grabadora)
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    const hissF = ctx.createBiquadFilter();
    hissF.type = 'highpass';
    hissF.frequency.value = 3500;
    this.loopNoise(this.white).connect(hissF).connect(this.hissGain).connect(this.voice);
  }

  /** Clic de interfaz (menús). */
  uiClick(): void {
    if (!this.ctx) return;
    const { node, t } = this.out(undefined, this.ui);
    this.noise(node, t, 0.05, { type: 'bandpass', f: 1400, q: 2, gain: 0.3 });
    this.tone(node, t, 0.08, { type: 'triangle', f: 220, f2: 140, gain: 0.08 });
  }

  setHiss(v: number): void {
    if (this.ctx) this.hissGain.gain.setTargetAtTime(v * 0.05, this.ctx.currentTime, 0.05);
  }

  /** Silencio antes de un susto: baja el mundo a casi cero durante `seconds`. */
  duck(seconds: number, level = 0.015): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.world.gain.cancelScheduledValues(t);
    this.world.gain.setTargetAtTime(level, t, 0.12);
    this.duckT = seconds;
  }

  unduck(time = 1.2): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.world.gain.cancelScheduledValues(t);
    this.world.gain.setTargetAtTime(1, t, time / 3);
    this.duckT = 0;
  }

  get ducked(): boolean {
    return this.duckT > 0;
  }

  update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    // Oyente
    this.camera.getWorldPosition(this.listenerPos);
    this.camera.getWorldDirection(this.fwd);
    this.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.setTargetAtTime(this.listenerPos.x, t, 0.02);
      L.positionY.setTargetAtTime(this.listenerPos.y, t, 0.02);
      L.positionZ.setTargetAtTime(this.listenerPos.z, t, 0.02);
      L.forwardX.setTargetAtTime(this.fwd.x, t, 0.02);
      L.forwardY.setTargetAtTime(this.fwd.y, t, 0.02);
      L.forwardZ.setTargetAtTime(this.fwd.z, t, 0.02);
      L.upX.setTargetAtTime(this.up.x, t, 0.02);
      L.upY.setTargetAtTime(this.up.y, t, 0.02);
      L.upZ.setTargetAtTime(this.up.z, t, 0.02);
    } else {
      L.setPosition(this.listenerPos.x, this.listenerPos.y, this.listenerPos.z);
      L.setOrientation(this.fwd.x, this.fwd.y, this.fwd.z, this.up.x, this.up.y, this.up.z);
    }

    // Capas
    const tn = this.tension;
    this.rainGain.gain.setTargetAtTime(0.05 + this.outdoor * 0.3, t, 0.4);
    this.rainFilter.frequency.setTargetAtTime(500 + this.outdoor * 5500, t, 0.4);
    this.humGain.gain.setTargetAtTime(this.hum * 0.05, t, 0.08);
    this.droneGain.gain.setTargetAtTime(0.015 + tn * tn * 0.16, t, 0.6);
    this.droneFilter.Q.value = 3 + tn * 8;
    this.droneHigh.gain.setTargetAtTime(tn > 0.65 ? (tn - 0.65) * 0.5 : 0, t, 0.8);

    // Duck
    if (this.duckT > 0) {
      this.duckT -= dt;
      if (this.duckT <= 0) this.unduck(0.6);
    }

    // Latido
    if (this.heart > 0.05) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        const bpm = 62 + this.heart * 70;
        this.heartT = 60 / bpm;
        this.heartbeat(this.heart);
      }
    }
    // Respiración
    this.breathT -= dt;
    if (this.breathT <= 0 && this.breath > 0.02) {
      this.breathT = 1 / Math.max(0.1, this.breathRate);
      this.breathe(this.breath, this.breathT);
    }
  }

  // ---------------- Utilidades de síntesis ----------------

  private out(opts: PlayOpts | undefined, bus?: GainNode): { node: AudioNode; t: number } {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = opts?.gain ?? 1;
    if (opts?.pos) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1.2;
      p.rolloffFactor = 1.1;
      p.maxDistance = 60;
      p.positionX.value = opts.pos.x;
      p.positionY.value = opts.pos.y;
      p.positionZ.value = opts.pos.z;
      g.connect(p).connect(bus ?? this.world);
    } else g.connect(bus ?? this.world);
    return { node: g, t: ctx.currentTime + 0.005 };
  }

  private noise(dest: Dest, t: number, dur: number, o: { type?: BiquadFilterType; f?: number; f2?: number; q?: number; gain?: number; attack?: number; buf?: AudioBuffer }): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = o.buf ?? this.white;
    const flt = ctx.createBiquadFilter();
    flt.type = o.type ?? 'bandpass';
    flt.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    flt.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.5, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(dest);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  private tone(dest: Dest, t: number, dur: number, o: { type?: OscillatorType; f: number; f2?: number; gain?: number; attack?: number; release?: 'exp' | 'lin' }): OscillatorNode {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return osc;
  }

  // ---------------- Sonidos ----------------

  step(surface: Surface, running: boolean, pos?: THREE.Vector3, barefoot = false): void {
    if (!this.ctx) return;
    const { node, t } = this.out({ pos, gain: running ? 1 : 0.6 });
    if (barefoot) {
      this.noise(node, t, 0.09, { type: 'lowpass', f: 900, gain: 0.35 });
      this.noise(node, t + 0.03, 0.12, { type: 'bandpass', f: 1800, q: 2, gain: 0.08 });
      return;
    }
    switch (surface) {
      case 'tile':
        this.noise(node, t, 0.07, { type: 'bandpass', f: 2600 + Math.random() * 600, q: 1.2, gain: 0.22 });
        this.tone(node, t, 0.06, { f: 95, f2: 60, gain: 0.25 });
        break;
      case 'wood':
        this.noise(node, t, 0.1, { type: 'bandpass', f: 700 + Math.random() * 200, q: 1.5, gain: 0.3 });
        this.tone(node, t, 0.09, { f: 120, f2: 70, gain: 0.3 });
        if (Math.random() < 0.15) this.creak(node, t + 0.05, 0.3, 0.05);
        break;
      case 'concrete':
        this.noise(node, t, 0.08, { type: 'bandpass', f: 1500, q: 0.8, gain: 0.2 });
        this.noise(node, t + 0.01, 0.16, { type: 'highpass', f: 3000, gain: 0.08 });
        break;
      case 'water':
        this.noise(node, t, 0.22, { type: 'bandpass', f: 1400, f2: 500, q: 1.5, gain: 0.45 });
        this.noise(node, t + 0.04, 0.25, { type: 'highpass', f: 2500, gain: 0.12 });
        break;
    }
  }

  private creak(dest: Dest, t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 + Math.random() * 40, t);
    o.frequency.linearRampToValueAtTime(110 + Math.random() * 60, t + dur);
    const am = ctx.createOscillator();
    am.frequency.value = 25 + Math.random() * 20;
    const amG = ctx.createGain();
    amG.gain.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    am.connect(amG).connect(g.gain);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1400, t + dur);
    bp.Q.value = 9;
    o.connect(bp).connect(g).connect(dest);
    o.start(t);
    am.start(t);
    o.stop(t + dur + 0.05);
    am.stop(t + dur + 0.05);
  }

  play(name: SoundName, opts?: PlayOpts): { stop: () => void } {
    const none = { stop: () => undefined };
    if (!this.ctx) return none;
    const ctx = this.ctx;
    const isImpact = name.startsWith('stinger') || name === 'caught';
    const { node, t } = this.out(opts, isImpact ? this.impact : name === 'sms' || name === 'vibrate' || name === 'ringtone' ? this.impact : undefined);
    switch (name) {
      case 'doorCreak':
        this.creak(node, t, 1.3, 0.12);
        break;
      case 'doorOpen':
        this.creak(node, t, 0.7, 0.07);
        this.noise(node, t, 0.05, { type: 'bandpass', f: 3000, q: 3, gain: 0.25 });
        break;
      case 'doorSlam':
        this.noise(node, t, 0.5, { type: 'lowpass', f: 900, gain: 0.9, buf: this.brown });
        this.tone(node, t, 0.35, { f: 70, f2: 40, gain: 0.8 });
        this.noise(node, t, 0.08, { type: 'bandpass', f: 2200, q: 2, gain: 0.4 });
        break;
      case 'doorLocked':
        for (let i = 0; i < 3; i++) {
          this.noise(node, t + i * 0.09, 0.05, { type: 'bandpass', f: 2800, q: 6, gain: 0.3 });
          this.tone(node, t + i * 0.09, 0.08, { f: 140, f2: 90, gain: 0.25 });
        }
        break;
      case 'unlock':
        this.noise(node, t, 0.04, { type: 'bandpass', f: 3500, q: 5, gain: 0.35 });
        this.noise(node, t + 0.12, 0.05, { type: 'bandpass', f: 2500, q: 5, gain: 0.35 });
        this.tone(node, t + 0.12, 0.1, { type: 'square', f: 800, f2: 600, gain: 0.05 });
        break;
      case 'lockerBang':
        for (const f of [212, 347, 521, 783, 1130]) this.tone(node, t, 0.5 + Math.random() * 0.4, { f, gain: 0.12 });
        this.noise(node, t, 0.1, { type: 'bandpass', f: 1800, q: 1, gain: 0.5 });
        break;
      case 'lockerRattle':
        for (let i = 0; i < 6; i++) {
          const tt = t + i * 0.07 + Math.random() * 0.03;
          for (const f of [300, 470]) this.tone(node, tt, 0.15, { f: f * (0.9 + Math.random() * 0.2), gain: 0.08 });
          this.noise(node, tt, 0.04, { type: 'bandpass', f: 2000, q: 2, gain: 0.25 });
        }
        break;
      case 'metalCreak':
        this.creak(node, t, 0.9, 0.08);
        break;
      case 'stinger':
      case 'stingerBig': {
        const big = name === 'stingerBig';
        const base = 110 * (big ? 0.75 : 1);
        for (const r of [1, 1.06, 1.19, 1.41, 1.5, 2.12]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(base * r * 2, t);
          o.frequency.exponentialRampToValueAtTime(base * r * (big ? 0.7 : 1.4), t + 1.6);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(5000, t);
          lp.frequency.exponentialRampToValueAtTime(500, t + 1.8);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(big ? 0.2 : 0.14, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 2.6 : 1.8));
          o.connect(lp).connect(g).connect(node);
          o.start(t);
          o.stop(t + 2.8);
        }
        this.noise(node, t, big ? 0.7 : 0.45, { type: 'highpass', f: 900, gain: big ? 0.9 : 0.6 });
        this.tone(node, t, 1.4, { f: 90, f2: 28, gain: big ? 1 : 0.8 });
        // chirrido metálico con vibrato
        const sc = ctx.createOscillator();
        sc.frequency.setValueAtTime(1700, t);
        sc.frequency.exponentialRampToValueAtTime(2600, t + 0.6);
        const vib = ctx.createOscillator();
        vib.frequency.value = 38;
        const vibG = ctx.createGain();
        vibG.gain.value = 180;
        vib.connect(vibG).connect(sc.frequency);
        const scG = ctx.createGain();
        scG.gain.setValueAtTime(0.0001, t);
        scG.gain.exponentialRampToValueAtTime(big ? 0.18 : 0.1, t + 0.02);
        scG.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        sc.connect(scG).connect(node);
        sc.start(t);
        vib.start(t);
        sc.stop(t + 1);
        vib.stop(t + 1);
        break;
      }
      case 'stingerSoft':
        for (const f of [220, 233.1, 311.1]) this.tone(node, t, 2.2, { type: 'triangle', f, f2: f * 0.94, gain: 0.08, attack: 0.3 });
        this.tone(node, t, 1.5, { f: 60, f2: 35, gain: 0.35, attack: 0.1 });
        break;
      case 'caught':
        this.noise(node, t, 0.6, { type: 'highpass', f: 600, gain: 0.8 });
        this.tone(node, t, 0.9, { type: 'sawtooth', f: 180, f2: 60, gain: 0.3 });
        this.tone(node, t, 0.9, { f: 80, f2: 30, gain: 0.8 });
        break;
      case 'ringtone': {
        // Melodía polifónica original, en bucle hasta stop().
        const notes = [880, 659.3, 987.8, 659.3, 880, 1318.5, 1174.7, 987.8];
        let alive = true;
        const loop = (start: number) => {
          if (!alive) return;
          notes.forEach((f, i) => {
            this.tone(node, start + i * 0.16, 0.14, { type: 'square', f, gain: 0.07 });
            this.tone(node, start + i * 0.16, 0.14, { type: 'square', f: f / 2, gain: 0.03 });
          });
          const next = start + notes.length * 0.16 + 0.5;
          setTimeout(() => loop(next), (next - ctx.currentTime - 0.1) * 1000);
        };
        loop(t);
        return { stop: () => (alive = false) };
      }
      case 'vibrate':
        for (let i = 0; i < 2; i++) {
          const tt = t + i * 0.55;
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = 150;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 380;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, tt);
          g.gain.exponentialRampToValueAtTime(0.22, tt + 0.02);
          g.gain.setValueAtTime(0.22, tt + 0.35);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.38);
          o.connect(lp).connect(g).connect(node);
          o.start(tt);
          o.stop(tt + 0.4);
        }
        break;
      case 'sms':
        this.tone(node, t, 0.09, { type: 'square', f: 1318.5, gain: 0.05 });
        this.tone(node, t + 0.12, 0.12, { type: 'square', f: 1760, gain: 0.05 });
        break;
      case 'shutter':
        this.noise(node, t, 0.03, { type: 'highpass', f: 4000, gain: 0.4 });
        this.noise(node, t + 0.07, 0.04, { type: 'highpass', f: 3000, gain: 0.3 });
        break;
      case 'click':
        this.noise(node, t, 0.02, { type: 'bandpass', f: 3500, q: 4, gain: 0.3 });
        break;
      case 'phoneOpen':
        this.noise(node, t, 0.04, { type: 'bandpass', f: 2400, q: 3, gain: 0.25 });
        this.tone(node, t + 0.05, 0.05, { type: 'square', f: 2093, gain: 0.03 });
        break;
      case 'tapeClick':
        this.noise(node, t, 0.03, { type: 'bandpass', f: 1500, q: 3, gain: 0.5 });
        this.tone(node, t, 0.04, { type: 'square', f: 300, f2: 180, gain: 0.08 });
        break;
      case 'tapeRewind': {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(260, t);
        o.frequency.exponentialRampToValueAtTime(900, t + 1.6);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.04, t + 0.1);
        g.gain.setValueAtTime(0.04, t + 1.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200;
        o.connect(bp).connect(g).connect(node);
        o.start(t);
        o.stop(t + 1.8);
        this.noise(node, t, 1.7, { type: 'bandpass', f: 3000, q: 1, gain: 0.05, attack: 0.1 });
        break;
      }
      case 'boneCrack':
        for (let i = 0; i < 5; i++) this.noise(node, t + i * 0.035 + Math.random() * 0.02, 0.025, { type: 'bandpass', f: 2500 + Math.random() * 2000, q: 3, gain: 0.5 });
        this.tone(node, t, 0.1, { f: 160, f2: 80, gain: 0.3 });
        break;
      case 'glassCrack':
        for (let i = 0; i < 14; i++) this.noise(node, t + Math.random() * 0.5, 0.03, { type: 'highpass', f: 3500, gain: 0.35 });
        for (const f of [3900, 5200, 6100]) this.tone(node, t, 1.2, { f, gain: 0.04 });
        break;
      case 'thunder':
        this.noise(node, t, 4.5, { type: 'lowpass', f: 380, f2: 90, gain: 0.9, attack: 0.15, buf: this.brown });
        this.noise(node, t + 0.05, 1.2, { type: 'lowpass', f: 1500, f2: 200, gain: 0.35, attack: 0.02 });
        break;
      case 'switchOff':
        this.noise(node, t, 0.03, { type: 'bandpass', f: 2200, q: 5, gain: 0.5 });
        this.tone(node, t, 0.25, { f: 120, f2: 40, gain: 0.12 });
        break;
      case 'bulbPop':
        this.noise(node, t, 0.12, { type: 'highpass', f: 1500, gain: 0.7 });
        for (let i = 0; i < 6; i++) this.noise(node, t + 0.1 + Math.random() * 0.4, 0.02, { type: 'highpass', f: 5000, gain: 0.2 });
        break;
      case 'drip':
        this.tone(node, t, 0.06, { f: 1400 + Math.random() * 400, f2: 500, gain: 0.12 });
        break;
      case 'bang':
        this.noise(node, t, 0.35, { type: 'lowpass', f: 600, gain: 0.8, buf: this.brown });
        this.tone(node, t, 0.3, { f: 55, f2: 35, gain: 0.6 });
        break;
      case 'knock':
        for (let i = 0; i < 3; i++) {
          this.noise(node, t + i * 0.28, 0.08, { type: 'lowpass', f: 700, gain: 0.7, buf: this.brown });
          this.tone(node, t + i * 0.28, 0.1, { f: 110, f2: 60, gain: 0.4 });
        }
        break;
      case 'pickup':
        this.noise(node, t, 0.06, { type: 'bandpass', f: 1200, q: 2, gain: 0.2 });
        break;
      case 'paper':
        this.noise(node, t, 0.25, { type: 'highpass', f: 2500, gain: 0.12, attack: 0.03 });
        break;
      case 'pencil':
        this.noise(node, t, 0.4, { type: 'bandpass', f: 4000, q: 2, gain: 0.08, attack: 0.05 });
        break;
      case 'snap':
        this.noise(node, t, 0.05, { type: 'bandpass', f: 1800, q: 1, gain: 0.3 });
        this.tone(node, t, 0.08, { f: 200, f2: 90, gain: 0.15 });
        break;
      case 'wood':
        this.noise(node, t, 0.12, { type: 'bandpass', f: 500, q: 2, gain: 0.5 });
        this.creak(node, t, 0.5, 0.08);
        break;
      case 'keypad':
        this.tone(node, t, 0.05, { type: 'square', f: 1600, gain: 0.02 });
        this.noise(node, t, 0.02, { type: 'bandpass', f: 3000, q: 5, gain: 0.2 });
        break;
      case 'static':
        this.noise(node, t, 0.6, { type: 'bandpass', f: 2500, q: 0.5, gain: 0.25, attack: 0.02 });
        break;
      case 'flashOn':
        this.noise(node, t, 0.02, { type: 'bandpass', f: 3000, q: 5, gain: 0.15 });
        break;
    }
    return none;
  }

  private heartbeat(v: number): void {
    const { node, t } = this.out({ gain: 0.25 + v * 0.55 }, this.impact);
    this.tone(node, t, 0.14, { f: 58, f2: 40, gain: 0.8 });
    this.tone(node, t + 0.2, 0.12, { f: 52, f2: 38, gain: 0.55 });
  }

  private breathe(v: number, period: number): void {
    const { node, t } = this.out({ gain: v }, this.voice);
    const inhale = period * 0.4;
    this.noise(node, t, inhale, { type: 'bandpass', f: 1300, f2: 1700, q: 0.8, gain: 0.05, attack: inhale * 0.5 });
    this.noise(node, t + inhale + 0.05, period * 0.45, { type: 'bandpass', f: 900, f2: 600, q: 0.8, gain: 0.06, attack: 0.06 });
  }

  /**
   * Voz sintética (susurro/voz de cinta): ruido o pulso glotal filtrado por formantes, por sílabas.
   * No pronuncia palabras reales: los subtítulos llevan el texto.
   */
  voiceSynth(o: { syllables: number; pitch?: number; whisper?: boolean; pos?: THREE.Vector3; gain?: number; rate?: number; tape?: boolean; delay?: number; direct?: boolean }): number {
    if (!this.ctx) return 0;
    const ctx = this.ctx;
    const { node, t: t0 } = this.out({ pos: o.pos, gain: o.gain ?? 1 }, o.direct ? this.impact : this.voice);
    const t = t0 + (o.delay ?? 0);
    const vowels: Array<[number, number, number]> = [
      [730, 1090, 2440],
      [270, 2290, 3010],
      [530, 1840, 2480],
      [570, 840, 2410],
      [300, 870, 2240],
    ];
    const rate = o.rate ?? 0.2;
    let cur = t;
    // Fuente
    const src = o.whisper ? ctx.createBufferSource() : ctx.createOscillator();
    if (src instanceof AudioBufferSourceNode) {
      src.buffer = this.white;
      src.loop = true;
    } else {
      src.type = 'sawtooth';
      src.frequency.value = o.pitch ?? 180;
      // vibrato/"wow" de cinta
      const wow = ctx.createOscillator();
      wow.frequency.value = o.tape ? 0.8 : 5;
      const wowG = ctx.createGain();
      wowG.gain.value = o.tape ? 9 : 3;
      wow.connect(wowG).connect(src.frequency);
      wow.start(t);
      wow.stop(t + o.syllables * rate * 1.6 + 0.5);
    }
    const amp = ctx.createGain();
    amp.gain.value = 0.0001;
    const filters = [0, 1, 2].map((k) => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = o.whisper ? 7 : 11;
      const g = ctx.createGain();
      g.gain.value = [1, 0.6, 0.3][k] * (o.whisper ? 0.9 : 0.5);
      amp.connect(f).connect(g).connect(node);
      return f;
    });
    src.connect(amp);
    for (let s = 0; s < o.syllables; s++) {
      const dur = rate * (0.6 + Math.random() * 0.9);
      const v = vowels[Math.floor(Math.random() * vowels.length)];
      filters.forEach((f, k) => {
        f.frequency.setTargetAtTime(v[k] * (o.pitch && o.pitch > 250 ? 1.15 : 1), cur, 0.03);
      });
      if (!(src instanceof AudioBufferSourceNode) && o.pitch) {
        src.frequency.setTargetAtTime(o.pitch * (0.9 + Math.random() * 0.25), cur, 0.05);
      }
      amp.gain.setTargetAtTime(o.whisper ? 0.5 : 0.35, cur, 0.02);
      amp.gain.setTargetAtTime(0.0001, cur + dur * 0.75, 0.03);
      cur += dur + (Math.random() < 0.2 ? rate * 0.8 : 0.03);
    }
    src.start(t);
    src.stop(cur + 0.3);
    return cur - t0;
  }

  /** Risas de chicas grabadas en cinta (sílabas agudas rápidas). */
  laughter(o: { pos?: THREE.Vector3; gain?: number; delay?: number }): void {
    for (let i = 0; i < 3; i++) {
      this.voiceSynth({ syllables: 5 + Math.floor(Math.random() * 3), pitch: 330 + i * 40 + Math.random() * 40, rate: 0.1, pos: o.pos, gain: (o.gain ?? 0.5) * 0.6, tape: true, delay: (o.delay ?? 0) + i * 0.35 + Math.random() * 0.2 });
    }
  }
}

export type SoundName =
  | 'doorCreak'
  | 'doorOpen'
  | 'doorSlam'
  | 'doorLocked'
  | 'unlock'
  | 'lockerBang'
  | 'lockerRattle'
  | 'metalCreak'
  | 'stinger'
  | 'stingerBig'
  | 'stingerSoft'
  | 'caught'
  | 'ringtone'
  | 'vibrate'
  | 'sms'
  | 'shutter'
  | 'click'
  | 'phoneOpen'
  | 'tapeClick'
  | 'tapeRewind'
  | 'boneCrack'
  | 'glassCrack'
  | 'thunder'
  | 'switchOff'
  | 'bulbPop'
  | 'drip'
  | 'bang'
  | 'knock'
  | 'pickup'
  | 'paper'
  | 'pencil'
  | 'snap'
  | 'wood'
  | 'keypad'
  | 'static'
  | 'flashOn';
