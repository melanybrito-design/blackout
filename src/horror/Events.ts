// Falsas alarmas del Director: eventos menores (sonidos, parpadeos) y medios (aparición al fondo,
// apagón en secuencia). Nunca dos iguales seguidos.
import * as THREE from 'three';
import type { System } from '../core/Game';
import type { Session } from '../session/Session';
import { GirlModel } from '../entities/GirlModel';

type EventFn = () => boolean;

export class HorrorEvents implements System {
  private last = '';
  private whispers = 0;
  private apparition: GirlModel;
  private appT = -1;
  private appLife = 3.2;
  private appMin = 6;
  private tmp = new THREE.Vector3();
  private seqs: Array<{ t: number; fn: () => void }> = [];

  constructor(private s: Session) {
    this.apparition = new GirlModel({ seed: 2203, scary: 0, hairFront: 0.9, wet: true });
    this.apparition.root.visible = false;
    this.apparition.pose(0.5);
    s.scene.add(this.apparition.root);
  }

  /** Programa una función (secuencias cortas). */
  later(seconds: number, fn: () => void): void {
    this.seqs.push({ t: seconds, fn });
  }

  /** Punto detrás del jugador, a d metros. */
  behind(d: number, spread = 0.6): THREE.Vector3 {
    const p = this.s.player;
    const a = p.yaw + Math.PI + (Math.random() - 0.5) * spread;
    return new THREE.Vector3(p.position.x - Math.sin(a) * d, 1.2, p.position.z - Math.cos(a) * d);
  }

  private pick(list: Array<[string, EventFn]>): void {
    const shuffled = list.filter(([id]) => id !== this.last).sort(() => Math.random() - 0.5);
    for (const [id, fn] of shuffled) {
      if (fn()) {
        this.last = id;
        return;
      }
    }
  }

  minor(): void {
    const s = this.s;
    const area = s.area;
    this.pick([
      [
        'steps',
        () => {
          for (let i = 0; i < 3; i++)
            this.later(i * 0.42, () => s.audio.step('tile', false, this.behind(3.2 - i * 0.3), true));
          return true;
        },
      ],
      [
        'slam',
        () => {
          s.audio.play('doorSlam', { pos: this.behind(12, 2) });
          return true;
        },
      ],
      [
        'flicker',
        () => {
          const lights = s.school.lights[area as keyof typeof s.school.lights];
          if (!lights?.length) return false;
          const l = lights[Math.floor(Math.random() * lights.length)];
          if (l.mode === 'off') return false;
          const prev = l.mode;
          l.mode = 'dying';
          this.later(1.6, () => (l.mode = prev));
          s.audio.play('switchOff', { pos: l.group.position });
          return true;
        },
      ],
      [
        'locker',
        () => {
          if (area !== 'corridor') return false;
          s.audio.play('lockerRattle', { pos: new THREE.Vector3(-1.2, 1.2, -9 - Math.random() * 3) });
          return true;
        },
      ],
      [
        'whisper',
        () => {
          if (this.whispers >= 2 || !s.story.has('insideSchool')) return false;
          this.whispers++;
          s.audio.voiceSynth({ syllables: 4, whisper: true, pos: this.behind(0.9, 0.3), gain: 0.9, rate: 0.22 });
          s.hud.subtitle('sub.whisper', 2.5);
          return true;
        },
      ],
      [
        'vibrate',
        () => {
          if (!s.phone.available) return false;
          s.audio.play('vibrate');
          return true;
        },
      ],
      [
        'knock',
        () => {
          s.audio.play('knock', { pos: this.behind(2.5, 1.5) });
          return true;
        },
      ],
      [
        'thunder',
        () => {
          s.school.lightning.strike();
          return true;
        },
      ],
    ]);
  }

  medium(): void {
    const s = this.s;
    this.pick([
      ['figure', () => this.figureAtEnd()],
      [
        'blackout',
        () => {
          const lights = s.school.lights[s.area as keyof typeof s.school.lights];
          if (!lights?.length) return false;
          const saved = lights.map((l) => l.mode);
          lights.forEach((l, i) =>
            this.later(i * 0.35, () => {
              l.mode = 'off';
              s.audio.play('switchOff', { pos: l.group.position });
            }),
          );
          this.later(lights.length * 0.35 + 3.5, () => lights.forEach((l, i) => (l.mode = saved[i])));
          return true;
        },
      ],
      [
        'doorCreak',
        () => {
          s.audio.play('doorCreak', { pos: this.behind(5, 1.2) });
          return true;
        },
      ],
    ]);
  }

  /** Aparición con guion: una figura quieta en (x, z) que se va al alumbrarla, al acercarse o sola. */
  appear(x: number, z: number, life = 3.2, minDist = 1.8): void {
    this.apparition.root.position.set(x, 0, z);
    this.apparition.lookAt(this.s.player.position);
    this.apparition.root.visible = true;
    this.appT = 0;
    this.appLife = life;
    this.appMin = minDist;
  }

  /** Figura al fondo del pasillo que desaparece al alumbrarla o acercarse. */
  figureAtEnd(): boolean {
    const s = this.s;
    if (this.appT >= 0) return false;
    const p = s.player.position;
    const f = s.player.forward(this.tmp);
    let d = 0;
    for (d = 2; d < 18; d += 0.5) if (s.school.collision.blocked(p.x, p.z, p.x + f.x * d, p.z + f.z * d, 1.2)) break;
    if (d < 8) return false;
    const at = Math.min(d - 1.2, 15);
    this.apparition.root.position.set(p.x + f.x * at, 0, p.z + f.z * at);
    this.apparition.lookAt(p);
    this.apparition.root.visible = true;
    this.appT = 0;
    this.appLife = 3.2;
    this.appMin = 6;
    return true;
  }

  update(dt: number): void {
    for (let i = this.seqs.length - 1; i >= 0; i--) {
      this.seqs[i].t -= dt;
      if (this.seqs[i].t <= 0) {
        const fn = this.seqs[i].fn;
        this.seqs.splice(i, 1);
        fn();
      }
    }
    if (this.appT >= 0) {
      this.appT += dt;
      const s = this.s;
      const a = this.apparition.root.position;
      const dist = Math.hypot(a.x - s.player.position.x, a.z - s.player.position.z);
      const f = s.player.forward(this.tmp);
      const dx = (a.x - s.player.position.x) / dist;
      const dz = (a.z - s.player.position.z) / dist;
      const facing = f.x * dx + f.z * dz;
      const lit = s.phone.out && s.phone.flashOn && facing > 0.96;
      if ((lit && this.appT > 0.5) || dist < this.appMin || this.appT > this.appLife) {
        this.apparition.root.visible = false;
        this.appT = -1;
        s.audio.play('switchOff', { pos: a.clone().setY(2.5) });
        s.director.addTension(8);
      }
    }
  }
}
