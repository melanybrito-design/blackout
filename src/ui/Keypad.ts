// Candado de 3 números del gimnasio (overlay pequeño, controlado con teclado).
import { t } from '../i18n';
import type { AudioEngine } from '../audio/AudioEngine';

export class Keypad {
  private el = document.createElement('div');
  private digits = [0, 0, 0];
  private cur = 0;
  isOpen = false;
  onResult: ((ok: boolean) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(
    private code: string,
    private audio: AudioEngine,
  ) {
    this.el.className = 'keypad hidden';
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const k = e.code;
      if (k === 'KeyW' || k === 'ArrowUp') this.bump(1);
      else if (k === 'KeyS' || k === 'ArrowDown') this.bump(-1);
      else if (k === 'KeyA' || k === 'ArrowLeft') this.move(-1);
      else if (k === 'KeyD' || k === 'ArrowRight') this.move(1);
      else if (k === 'KeyE' || k === 'Enter') this.submit();
      else if (k === 'Escape' || k === 'KeyQ') this.close();
      else if (/^Digit\d$/.test(k)) {
        this.digits[this.cur] = Number(k.slice(5));
        this.move(1);
      }
    });
  }

  open(prefill?: string): void {
    if (prefill) this.digits = prefill.split('').map(Number);
    this.isOpen = true;
    this.cur = 0;
    this.el.classList.remove('hidden');
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.onClose?.();
  }

  private bump(d: number): void {
    this.digits[this.cur] = (this.digits[this.cur] + d + 10) % 10;
    this.audio.play('keypad');
    this.render();
  }

  private move(d: number): void {
    this.cur = (this.cur + d + 3) % 3;
    this.audio.play('keypad');
    this.render();
  }

  private submit(): void {
    const ok = this.digits.join('') === this.code;
    this.onResult?.(ok);
    if (ok) this.close();
    else {
      this.el.classList.remove('shake');
      void this.el.offsetWidth;
      this.el.classList.add('shake');
      this.render(t('keypad.wrong'));
    }
  }

  private render(msg = ''): void {
    this.el.innerHTML = `<div class="kp-title">${t('keypad.title')}</div>
      <div class="kp-wheels">${this.digits
        .map((d, i) => `<div class="kp-wheel ${i === this.cur ? 'on' : ''}"><span>${(d + 9) % 10}</span><b>${d}</b><span>${(d + 1) % 10}</span></div>`)
        .join('')}</div>
      <div class="kp-msg">${msg}</div>
      <div class="kp-help">${t('keypad.help')}</div>`;
  }
}
