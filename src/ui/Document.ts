// Documento legible (hoja, cuaderno, comunicado): overlay de papel. El mundo sigue corriendo.
import { t } from '../i18n';
import { keycaps } from './Hud';
import type { AudioEngine } from '../audio/AudioEngine';

export class DocumentView {
  private el = document.createElement('div');
  isOpen = false;
  private openedAt = 0;
  onClose: (() => void) | null = null;

  constructor(private audio: AudioEngine) {
    this.el.className = 'doc hidden';
    document.body.appendChild(this.el);
  }

  /** `id` → claves i18n `doc.<id>.title`, `doc.<id>.body` y (opcional) `doc.<id>.note` a mano. */
  open(id: string, style: 'typed' | 'hand' = 'typed'): void {
    const note = t(`doc.${id}.note`);
    this.el.innerHTML = `<div class="doc-paper ${style}">
      <div class="doc-title">${t(`doc.${id}.title`)}</div>
      <div class="doc-body">${t(`doc.${id}.body`).replace(/\n/g, '<br/>')}</div>
      ${note !== `doc.${id}.note` ? `<div class="doc-note">${note.replace(/\n/g, '<br/>')}</div>` : ''}
      <div class="doc-help">${keycaps(t('doc.close'))}</div>
    </div>`;
    this.el.classList.remove('hidden');
    this.isOpen = true;
    this.openedAt = performance.now();
    this.audio.play('paper');
  }

  /** Cierra (ignora la misma pulsación que lo abrió). */
  close(): void {
    if (!this.isOpen || performance.now() - this.openedAt < 250) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.audio.play('paper');
    this.onClose?.();
  }
}
