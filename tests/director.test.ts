import { describe, expect, it } from 'vitest';
import { FearDirector, type DirectorEvent, type DirectorInput } from '../src/horror/FearDirector';
import { DIRECTOR } from '../src/config';

const calm: DirectorInput = { still: 0, reading: false, lookingBack: false, scripted: false };

function run(d: FearDirector, seconds: number, input: DirectorInput = calm, dt = 0.1): DirectorEvent[] {
  const all: DirectorEvent[] = [];
  for (let t = 0; t < seconds; t += dt) all.push(...d.update(dt, input).map((e) => ({ ...e })));
  return all;
}

function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('FearDirector', () => {
  it('no hace nada si está deshabilitado', () => {
    const d = new FearDirector(seeded());
    expect(run(d, 120)).toHaveLength(0);
  });

  it('genera falsas alarmas espaciadas', () => {
    const d = new FearDirector(seeded());
    d.enabled = true;
    const ev = run(d, 300);
    const minors = ev.filter((e) => e.kind === 'minor' || e.kind === 'medium');
    expect(minors.length).toBeGreaterThanOrEqual(5);
    // Tope según la configuración: nunca más seguidas que los mínimos de cada tipo.
    expect(minors.length).toBeLessThanOrEqual(Math.ceil(300 / DIRECTOR.minorMin) + Math.ceil(300 / DIRECTOR.mediumMin));
  });

  it('un mayor va precedido de silencio y de al menos 3 falsas alarmas', () => {
    const d = new FearDirector(seeded(3));
    d.enabled = true;
    d.arm('s1');
    const ev = run(d, 200);
    const iSilence = ev.findIndex((e) => e.kind === 'silence');
    const iMajor = ev.findIndex((e) => e.kind === 'major');
    expect(iSilence).toBeGreaterThanOrEqual(0);
    expect(iMajor).toBeGreaterThan(iSilence);
    const fakeBefore = ev.slice(0, iSilence).filter((e) => e.kind === 'minor' || e.kind === 'medium').length;
    expect(fakeBefore).toBeGreaterThanOrEqual(DIRECTOR.fakeOutsBetweenMajors);
  });

  it('respeta el cooldown entre mayores', () => {
    const d = new FearDirector(seeded(5));
    d.enabled = true;
    d.arm('a');
    let t = 0;
    let firstAt = -1;
    let secondAt = -1;
    while (t < 600 && secondAt < 0) {
      for (const e of d.update(0.1, calm)) {
        if (e.kind === 'major') {
          if (firstAt < 0) {
            firstAt = t;
            d.majorFinished();
            d.arm('b');
          } else secondAt = t;
        }
      }
      t += 0.1;
    }
    expect(secondAt - firstAt).toBeGreaterThanOrEqual(DIRECTOR.majorCooldown - 0.2);
  });

  it('no dispara eventos durante RELAX', () => {
    const d = new FearDirector(seeded(7));
    d.enabled = true;
    d.majorFinished();
    expect(run(d, DIRECTOR.relaxMin - 1)).toHaveLength(0);
  });

  it('un mayor forzado ocurre aunque no haya cooldown', () => {
    const d = new FearDirector(seeded(9));
    d.enabled = true;
    d.sinceMajor = 0;
    d.arm('final', true);
    const ev = run(d, 5);
    expect(ev.some((e) => e.kind === 'major' && e.id === 'final')).toBe(true);
  });

  it('nunca pierde un mayor armado aunque el jugador esté paranoico', () => {
    const d = new FearDirector(seeded(11));
    d.enabled = true;
    d.arm('s2');
    const ev = run(d, 400, { ...calm, lookingBack: true });
    expect(ev.some((e) => e.kind === 'major' && e.id === 's2')).toBe(true);
  });
});
