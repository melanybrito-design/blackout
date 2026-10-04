// Capa 2D mínima: ayuda de controles (abajo a la izquierda), pensamientos del personaje y subtítulos
// (abajo al centro), objetivo actual (arriba a la izquierda) y avisos breves (arriba a la derecha).
import type { System } from '../core/Game';
import { t } from '../i18n';

/** `[E] Abrir` → teclas resaltadas. El texto viene de i18n (confiable). */
export function keycaps(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
}

export class Hud implements System {
  private hintEl = document.createElement('div');
  private subEl = document.createElement('div');
  private thoughtEl = document.createElement('div');
  private toastEl = document.createElement('div');
  private holdEl = document.createElement('div');
  private goalEl = document.createElement('div');
  private levelEl = document.createElement('div');
  private countEl = document.createElement('div');
  private hintT = 0;
  private subT = 0;
  private thoughtT = 0;
  private toastT = 0;
  private goalKey = '';
  private goalT = 0;
  subtitles = true;

  constructor() {
    this.hintEl.className = 'hud-hint';
    this.subEl.className = 'hud-sub';
    this.thoughtEl.className = 'hud-thought';
    this.toastEl.className = 'hud-toast';
    this.holdEl.className = 'hud-hold';
    this.goalEl.className = 'hud-goal';
    this.levelEl.className = 'hud-level';
    this.countEl.className = 'hud-count';
    document.body.append(this.countEl);
    document.body.append(this.hintEl, this.subEl, this.thoughtEl, this.toastEl, this.holdEl, this.goalEl, this.levelEl);
  }

  /** Ayuda de controles / tutorial (clave i18n). Las teclas entre [corchetes] se resaltan. */
  hint(key: string, seconds = 5, vars?: Record<string, string | number>): void {
    this.hintEl.innerHTML = keycaps(t(key, vars));
    this.hintEl.classList.add('on');
    this.hintT = seconds;
  }

  get hintVisible(): boolean {
    return this.hintT > 0;
  }

  hideHint(): void {
    if (this.hintT > 0) this.hintT = 0.001;
  }

  subtitle(key: string, seconds = 4): void {
    if (!this.subtitles) return;
    this.type(this.subEl, t(key));
    this.subT = seconds;
  }

  /** Pensamiento del personaje al examinar algo (siempre visible: es parte del juego, no un subtítulo). */
  think(key: string, seconds?: number, vars?: Record<string, string | number>): void {
    const text = t(key, vars);
    this.type(this.thoughtEl, text);
    this.thoughtT = seconds ?? Math.max(3.5, 1.6 + text.length * 0.055);
  }

  toast(key: string, seconds = 2.5): void {
    this.toastEl.textContent = t(key);
    this.toastEl.classList.add('on');
    this.toastT = seconds;
  }

  /** Objetivo actual: aparece arriba a la izquierda cuando cambia y luego se desvanece. */
  objective(key: string): void {
    if (key === this.goalKey) return;
    this.goalKey = key;
    this.goalEl.innerHTML = `<small>${t('hud.goal')}</small>${t(key)}`;
    this.goalEl.classList.remove('new');
    void this.goalEl.offsetWidth;
    this.goalEl.classList.add('on', 'new');
    this.goalT = 9;
  }

  /** Cartel de nivel al llegar a un piso (claves `level.<n>` y `level.<n>.sub`). */
  level(n: number): void {
    this.levelEl.innerHTML = `<b>${t(`level.${n}`)}</b><span>${t(`level.${n}.sub`)}</span>`;
    this.levelEl.classList.remove('on');
    void this.levelEl.offsetWidth;
    this.levelEl.classList.add('on');
  }

  /** Contador del nivel («LLAVES 1/3»). `null` lo oculta. Late cuando sube. */
  counter(key: string | null, have = 0, total = 0): void {
    if (!key) {
      this.countEl.classList.remove('on');
      return;
    }
    const text = `${t(key)} <b>${have}/${total}</b>`;
    if (this.countEl.innerHTML !== text) {
      this.countEl.innerHTML = text;
      this.countEl.classList.remove('bump');
      void this.countEl.offsetWidth;
      this.countEl.classList.add('bump');
    }
    this.countEl.classList.add('on');
    this.countEl.classList.toggle('done', have >= total);
  }

  /** Barra de "mantener E" (0..1). */
  hold(p: number): void {
    this.holdEl.style.display = p > 0 && p < 1 ? 'block' : 'none';
    this.holdEl.style.setProperty('--p', String(p));
  }

  clear(): void {
    this.hintT = this.subT = this.toastT = this.thoughtT = 0.001;
  }

  private type(el: HTMLElement, text: string): void {
    el.textContent = '';
    el.classList.add('on');
    let i = 0;
    const id = (el.dataset.tid = String(Math.random()));
    const tick = () => {
      if (el.dataset.tid !== id) return;
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, 18);
    };
    tick();
  }

  update(dt: number): void {
    // El objetivo es una nota propia: se asoma al cambiar y se va. Queda en el diario.
    if (this.goalT > 0) {
      this.goalT -= dt;
      if (this.goalT <= 0) this.goalEl.classList.remove('on');
    }
    for (const [el, key] of [
      [this.hintEl, 'hintT'],
      [this.subEl, 'subT'],
      [this.thoughtEl, 'thoughtT'],
      [this.toastEl, 'toastT'],
    ] as const) {
      if (this[key] > 0) {
        this[key] -= dt;
        if (this[key] <= 0) el.classList.remove('on');
      }
    }
  }

  setVisible(v: boolean): void {
    for (const el of [this.hintEl, this.subEl, this.thoughtEl, this.toastEl, this.goalEl, this.countEl]) el.style.visibility = v ? '' : 'hidden';
  }
}
