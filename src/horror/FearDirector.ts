// Director de Miedo: decide CUÁNDO asustar. Lógica pura (sin three ni DOM), testeable.
//
// Reglas duras (AGENTS.md §10):
// - ≥ majorCooldown s entre screamers mayores y ≥ fakeOutsBetweenMajors falsas alarmas entre ellos.
// - Antes de un mayor: silencio forzado. Después: RELAX sin eventos.
// - Un mayor armado nunca se pierde: si espera demasiado, se fuerza en la siguiente oportunidad.
import { DIRECTOR } from '../config';

export type Phase = 'CALM' | 'BUILD' | 'PEAK' | 'RELAX';

export interface DirectorInput {
  /** Segundos que el jugador lleva quieto. */
  still: number;
  /** Diario o galería abiertos, leyendo algo. */
  reading: boolean;
  /** Girando la cámara con violencia (paranoico): mejor esperar. */
  lookingBack: boolean;
  /** Secuencia con guion en curso: no hay eventos aleatorios. */
  scripted: boolean;
}

export type DirectorEvent =
  | { kind: 'minor' }
  | { kind: 'medium' }
  | { kind: 'silence'; seconds: number; id: string }
  | { kind: 'major'; id: string };

interface Armed {
  id: string;
  waited: number;
  /** Sin requisito de falsas alarmas/cooldown (finales). */
  force: boolean;
}

type Config = typeof DIRECTOR;

export class FearDirector {
  phase: Phase = 'CALM';
  tension = 0;
  enabled = false;
  fakeOuts = 0;
  sinceMajor: number;
  private sinceMinor = 0;
  private sinceMedium = 0;
  private nextMinor: number;
  private nextMedium: number;
  private relaxT = 0;
  private armed: Armed[] = [];
  private silence: { id: string; t: number } | null = null;
  private out: DirectorEvent[] = [];
  readonly fired: string[] = [];

  constructor(
    private rand: () => number = Math.random,
    private cfg: Config = DIRECTOR,
  ) {
    this.sinceMajor = cfg.majorCooldown;
    this.nextMinor = this.range(cfg.minorMin, cfg.minorMax);
    this.nextMedium = this.range(cfg.mediumMin, cfg.mediumMax);
  }

  private range(a: number, b: number): number {
    return a + this.rand() * (b - a);
  }

  /** La historia habilita un screamer mayor; el Director elige el momento. */
  arm(id: string, force = false): void {
    if (this.fired.includes(id) || this.armed.some((a) => a.id === id)) return;
    this.armed.push({ id, waited: 0, force });
  }

  /** La historia ya no puede esperar a este susto: se dispara en cuanto termine el respiro actual. */
  force(id: string): void {
    const a = this.armed.find((x) => x.id === id);
    if (a) a.force = true;
    else this.arm(id, true);
  }

  isArmed(id: string): boolean {
    return this.armed.some((a) => a.id === id) || this.silence?.id === id;
  }

  /** Llamar cuando el screamer terminó su animación. */
  majorFinished(): void {
    this.phase = 'RELAX';
    this.relaxT = this.range(this.cfg.relaxMin, this.cfg.relaxMax);
    this.tension = Math.min(100, this.tension + 10);
  }

  addTension(v: number): void {
    this.tension = Math.max(0, Math.min(100, this.tension + v));
  }

  update(dt: number, input: DirectorInput): DirectorEvent[] {
    const out = this.out;
    out.length = 0;
    this.sinceMajor += dt;
    this.sinceMinor += dt;
    this.sinceMedium += dt;
    for (const a of this.armed) a.waited += dt;

    // Silencio en curso → mayor
    if (this.silence) {
      this.silence.t -= dt;
      if (this.silence.t <= 0) {
        const id = this.silence.id;
        this.silence = null;
        this.sinceMajor = 0;
        this.fakeOuts = 0;
        this.fired.push(id);
        this.phase = 'PEAK';
        this.tension = 100;
        out.push({ kind: 'major', id });
      }
      return out;
    }

    if (this.phase === 'RELAX') {
      this.relaxT -= dt;
      this.tension = Math.max(15, this.tension - dt * 2.2);
      if (this.relaxT <= 0) this.phase = 'BUILD';
      return out;
    }
    if (this.phase === 'PEAK') this.phase = 'BUILD';
    if (!this.enabled) return out;
    if (this.phase === 'CALM') this.phase = 'BUILD';

    this.tension = Math.min(85, this.tension + dt * 0.35);
    const lowGuard = input.reading || input.still > this.cfg.lowGuardStill;

    // ¿Algún mayor listo?
    const next = this.armed[0];
    if (next && (!input.scripted || next.force)) {
      const cooled = this.sinceMajor >= this.cfg.majorCooldown;
      const faked = this.fakeOuts >= this.cfg.fakeOutsBetweenMajors;
      const overdue = next.waited > this.cfg.majorMaxWait;
      const ready = next.force || (cooled && (faked || overdue));
      const moment = next.force || lowGuard || next.waited > 6 || overdue;
      if (ready && moment && (!input.lookingBack || overdue || next.force)) {
        this.armed.shift();
        const secs = this.range(this.cfg.silenceMin, this.cfg.silenceMax);
        this.silence = { id: next.id, t: secs };
        out.push({ kind: 'silence', seconds: secs, id: next.id });
        return out;
      }
      // Hay un mayor esperando: acelerar las falsas alarmas.
      if (!faked && this.nextMinor - this.sinceMinor > 8) this.nextMinor = this.sinceMinor + this.range(4, 8);
    }

    if (input.scripted) return out;

    if (this.sinceMedium >= this.nextMedium && !input.lookingBack) {
      this.sinceMedium = 0;
      this.sinceMinor = Math.max(0, this.sinceMinor - 8);
      this.nextMedium = this.range(this.cfg.mediumMin, this.cfg.mediumMax);
      this.fakeOuts++;
      this.tension = Math.min(90, this.tension + 12);
      out.push({ kind: 'medium' });
    } else if (this.sinceMinor >= this.nextMinor) {
      this.sinceMinor = 0;
      this.nextMinor = this.range(this.cfg.minorMin, this.cfg.minorMax);
      this.fakeOuts++;
      this.tension = Math.min(90, this.tension + 6);
      out.push({ kind: 'minor' });
    }
    return out;
  }
}
