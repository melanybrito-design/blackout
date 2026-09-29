// Opciones del jugador (persisten en localStorage).
export interface Settings {
  sensitivity: number;
  fov: number;
  volume: number;
  brightness: number;
  reduceFlashes: boolean;
  highQuality: boolean;
  subtitles: boolean;
}

const KEY = 'uvv.settings';
const DEFAULTS: Settings = {
  sensitivity: 1,
  fov: 72,
  volume: 0.9,
  brightness: 1,
  reduceFlashes: false,
  highQuality: false,
  subtitles: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* sin almacenamiento */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento */
  }
}
