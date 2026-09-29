// i18n mínimo: t('clave', { var }) con diccionarios ES/EN. Todo texto visible pasa por aquí.
import es from './es.json';
import en from './en.json';
import { bus } from '../core/EventBus';

export type Lang = 'es' | 'en';
export const dictionaries: Record<Lang, Record<string, string>> = { es, en };

const STORAGE_KEY = 'uvv.lang';
let current: Lang = detect();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    /* sin almacenamiento */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* sin almacenamiento */
  }
  bus.emit('lang:changed', lang);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dictionaries[current][key] ?? dictionaries.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
