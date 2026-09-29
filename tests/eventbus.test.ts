import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

type E = { ping: number; empty: void };

describe('EventBus', () => {
  it('entrega el payload y permite desuscribirse', () => {
    const bus = new EventBus<E>();
    const fn = vi.fn();
    const off = bus.on('ping', fn);
    bus.emit('ping', 3);
    off();
    bus.emit('ping', 4);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('once se dispara una sola vez', () => {
    const bus = new EventBus<E>();
    const fn = vi.fn();
    bus.once('empty', fn);
    bus.emit('empty');
    bus.emit('empty');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
