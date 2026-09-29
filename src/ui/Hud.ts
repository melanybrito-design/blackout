// Capa 2D mínima (sin HUD flotante): pista de tutorial abajo a la izquierda, subtítulos abajo al centro
// y un aviso breve ("nueva pista"). Todo con máquina de escribir.
import type { System } from '../core/Game';
import { t } from '../i18n';

export class Hud implements System {
  private hintEl = document.createElement('div');
  private subEl = document.createElement('div');
  private toastEl = document.createElement('div');
  private holdEl = document.createElement('div');
  private hintT = 0;
  private subT = 0;
  private toastT = 0;
  subtitles = true;

  constructor() {
    this.hintEl.className = 'hud-hint';
    this.subEl.className = 'hud-sub';
    this.toastEl.className = 'hud-toast';
    this.holdEl.className = 'hud-hold';
    document.body.append(this.hintEl, this.subEl, this.toastEl, this.holdEl);
  }

  /** Pista de tutorial / mensaje del mundo (clave i18n o texto ya traducido con raw=true). */
  hint(key: string, seconds = 5, vars?: Record<string, string | number>): void {
    this.type(this.hintEl, t(key, vars));
    this.hintT = seconds;
  }

  subtitle(key: string, seconds = 4): void {
    if (!this.subtitles) return;
    this.type(this.subEl, t(key));
    this.subT = seconds;
  }

  toast(key: string, seconds = 2.5): void {
    this.toastEl.textContent = t(key);
    this.toastEl.classList.add('on');
    this.toastT = seconds;
  }

  /** Barra de "mantener E" (0..1). */
  hold(p: number): void {
    this.holdEl.style.display = p > 0 && p < 1 ? 'block' : 'none';
    this.holdEl.style.setProperty('--p', String(p));
  }

  clear(): void {
    this.hintT = this.subT = this.toastT = 0.001;
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
    for (const [el, key] of [
      [this.hintEl, 'hintT'],
      [this.subEl, 'subT'],
      [this.toastEl, 'toastT'],
    ] as const) {
      if (this[key] > 0) {
        this[key] -= dt;
        if (this[key] <= 0) el.classList.remove('on');
      }
    }
  }

  setVisible(v: boolean): void {
    for (const el of [this.hintEl, this.subEl, this.toastEl]) el.style.visibility = v ? '' : 'hidden';
  }
}
