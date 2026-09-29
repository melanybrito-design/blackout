import { describe, expect, it } from 'vitest';
import { ClueGraph, CONNECTIONS } from '../src/narrative/ClueGraph';
import es from '../src/i18n/es.json';

describe('ClueGraph', () => {
  it('rechaza conexiones con pistas que no se tienen', () => {
    const g = new ClueGraph();
    g.add('c1');
    expect(g.link('c1', 'c3')).toEqual({ ok: false, reason: 'missing' });
  });

  it('acepta una conexión válida en cualquier orden y la marca una sola vez como nueva', () => {
    const g = new ClueGraph();
    g.add('c1');
    g.add('c3');
    const r1 = g.link('c3', 'c1');
    expect(r1.ok && r1.connection.flag).toBe('deduceRehearsal');
    expect(r1.ok && r1.isNew).toBe(true);
    const r2 = g.link('c1', 'c3');
    expect(r2.ok && r2.isNew).toBe(false);
    expect(g.pending()).toHaveLength(0);
  });

  it('rechaza conexiones sin sentido', () => {
    const g = new ClueGraph();
    g.add('c2');
    g.add('c3');
    expect(g.link('c2', 'c3')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('toda deducción tiene texto', () => {
    for (const c of CONNECTIONS) expect((es as Record<string, string>)[c.deduction]).toBeTruthy();
  });
});
