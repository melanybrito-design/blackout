// Post-final: falso "la página no responde" → corrupción → "sigo en el colegio." → FIN DE LA DEMO.
import { t } from '../i18n';
import type { AudioEngine } from '../audio/AudioEngine';

export function playEnding(audio: AudioEngine, onBack: () => void): void {
  const el = document.createElement('div');
  el.className = 'ending';
  document.body.appendChild(el);
  document.exitPointerLock?.();

  const stage1 = () => {
    el.innerHTML = `<div class="fake-crash">
      <div class="fc-icon">:(</div>
      <div class="fc-title">${t('end.crashTitle')}</div>
      <div class="fc-body">${t('end.crashBody')}</div>
      <div class="fc-buttons"><button data-b="exit">${t('end.exit')}</button><button data-b="wait" class="primary">${t('end.wait')}</button></div>
    </div>`;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', stage2, { once: true }));
  };

  const stage2 = () => {
    audio.play('static');
    el.classList.add('corrupt');
    setTimeout(() => {
      audio.play('stingerSoft');
      el.classList.remove('corrupt');
      el.innerHTML = `<div class="end-final">${t('end.final')}</div>`;
      setTimeout(stage3, 4200);
    }, 1400);
  };

  const stage3 = () => {
    el.innerHTML = `<div class="end-card">
      <div class="end-demo">${t('end.demo')}</div>
      <div class="end-title">${t('title')}</div>
      <div class="end-thanks">${t('end.thanks')}</div>
      <div class="end-back">${t('end.back')}</div>
    </div>`;
    document.title = t('tab.thanks');
    el.addEventListener('click', () => onBack(), { once: true });
  };

  setTimeout(stage1, 2600);
}
