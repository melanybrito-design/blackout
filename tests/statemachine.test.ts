import { describe, expect, it } from 'vitest';
import { StateMachine } from '../src/core/StateMachine';

describe('StateMachine', () => {
  it('llama enter/exit y cuenta el tiempo en el estado', () => {
    const log: string[] = [];
    const sm = new StateMachine<null, 'a' | 'b'>(null, {
      a: { enter: () => log.push('enter a'), exit: () => log.push('exit a') },
      b: { enter: (_c, from) => log.push(`enter b from ${from}`) },
    });
    sm.go('a');
    sm.update(0.5);
    expect(sm.timeInState).toBe(0.5);
    sm.go('b');
    expect(sm.timeInState).toBe(0);
    expect(log).toEqual(['enter a', 'exit a', 'enter b from a']);
  });
});
