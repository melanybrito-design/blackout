// Grafo de pistas: qué pistas tiene el jugador y qué conexiones producen deducciones.
// Lógica pura (testeable).

export interface Connection {
  a: string;
  b: string;
  /** Clave i18n de la deducción. */
  deduction: string;
  /** Flag de historia que se activa. */
  flag: string;
}

export const CONNECTIONS: Connection[] = [
  { a: 'c1', b: 'c3', deduction: 'deduce.rehearsal', flag: 'deduceRehearsal' },
  { a: 'c4', b: 'c5', deduction: 'deduce.locker', flag: 'deduceLocker' },
  { a: 'c6', b: 'c1', deduction: 'deduce.phone', flag: 'doubtsPhone' },
  { a: 'c2', b: 'c1', deduction: 'deduce.daniela', flag: 'deduceDaniela' },
  { a: 'c7', b: 'c6', deduction: 'deduce.code', flag: 'deduceCode' },
];

export const CLUE_IDS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'] as const;

export type LinkResult =
  | { ok: true; connection: Connection; isNew: boolean }
  | { ok: false; reason: 'missing' | 'invalid' | 'same' };

export class ClueGraph {
  readonly clues = new Set<string>();
  readonly links = new Set<string>();

  static key(a: string, b: string): string {
    return [a, b].sort().join('+');
  }

  add(id: string): boolean {
    if (this.clues.has(id)) return false;
    this.clues.add(id);
    return true;
  }

  has(id: string): boolean {
    return this.clues.has(id);
  }

  isLinked(a: string, b: string): boolean {
    return this.links.has(ClueGraph.key(a, b));
  }

  link(a: string, b: string): LinkResult {
    if (a === b) return { ok: false, reason: 'same' };
    if (!this.clues.has(a) || !this.clues.has(b)) return { ok: false, reason: 'missing' };
    const k = ClueGraph.key(a, b);
    const c = CONNECTIONS.find((x) => ClueGraph.key(x.a, x.b) === k);
    if (!c) return { ok: false, reason: 'invalid' };
    const isNew = !this.links.has(k);
    this.links.add(k);
    return { ok: true, connection: c, isNew };
  }

  /** Conexiones posibles con las pistas actuales que aún no se hicieron. */
  pending(): Connection[] {
    return CONNECTIONS.filter((c) => this.clues.has(c.a) && this.clues.has(c.b) && !this.isLinked(c.a, c.b));
  }
}
