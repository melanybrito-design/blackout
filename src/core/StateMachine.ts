// Máquina de estados genérica (historia, fases del Director, menús).

export interface State<C> {
  enter?(ctx: C, from: string | null): void;
  exit?(ctx: C, to: string): void;
  update?(ctx: C, dt: number): void;
}

export class StateMachine<C, S extends string = string> {
  private current: S | null = null;
  private elapsed = 0;

  constructor(
    private ctx: C,
    private states: Record<S, State<C>>,
  ) {}

  get state(): S | null {
    return this.current;
  }

  /** Segundos desde que se entró al estado actual. */
  get timeInState(): number {
    return this.elapsed;
  }

  go(next: S): void {
    if (next === this.current) return;
    const prev = this.current;
    if (prev) this.states[prev].exit?.(this.ctx, next);
    this.current = next;
    this.elapsed = 0;
    this.states[next].enter?.(this.ctx, prev);
  }

  update(dt: number): void {
    if (!this.current) return;
    this.elapsed += dt;
    this.states[this.current].update?.(this.ctx, dt);
  }
}
