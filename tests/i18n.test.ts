import { describe, expect, it } from 'vitest';
import es from '../src/i18n/es.json';
import en from '../src/i18n/en.json';

describe('i18n', () => {
  it('ES y EN tienen exactamente las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('ningún texto está vacío', () => {
    for (const dict of [es, en]) for (const v of Object.values(dict)) expect(v.trim()).not.toBe('');
  });
});
