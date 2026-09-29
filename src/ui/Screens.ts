// Pantallas HTML: advertencia inicial, menú (cintas sobre el afiche), opciones, créditos y pausa.
import { getLang, setLang, t } from '../i18n';
import { saveSettings, type Settings } from '../core/Settings';
import type { AudioEngine } from '../audio/AudioEngine';

const root = () => document.getElementById('screens')!;

function el(html: string): HTMLDivElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLDivElement;
}

export function showWarning(onContinue: () => void): void {
  const w = el(`<div class="screen warning">
    <div class="warn-box">
      <div class="warn-title">${t('warn.title')}</div>
      <p>${t('warn.body')}</p>
      <p class="warn-head">🎧 ${t('warn.headphones')}</p>
      <div class="warn-lang"><button data-l="es" class="${getLang() === 'es' ? 'on' : ''}">ESPAÑOL</button><button data-l="en" class="${getLang() === 'en' ? 'on' : ''}">ENGLISH</button></div>
      <div class="warn-click">${t('warn.click')}</div>
    </div>
  </div>`);
  root().appendChild(w);
  w.querySelectorAll<HTMLButtonElement>('[data-l]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      setLang(b.dataset.l as 'es' | 'en');
      w.remove();
      showWarning(onContinue);
    }),
  );
  w.addEventListener('click', () => {
    w.classList.add('out');
    setTimeout(() => w.remove(), 600);
    onContinue();
  });
}

export interface MenuActions {
  onNew: () => void;
  onContinue: (() => void) | null;
  settings: Settings;
  applySettings: (s: Settings) => void;
  audio: AudioEngine;
}

export function showMainMenu(a: MenuActions): () => void {
  const m = el(`<div class="screen main-menu"></div>`);
  root().appendChild(m);
  const render = () => {
    m.innerHTML = `
      <div class="mm-title">${t('title')}<span>demo</span></div>
      <div class="mm-tapes">
        <button data-a="new" style="--r:-2deg">${t('menu.new')}</button>
        ${a.onContinue ? `<button data-a="continue" style="--r:1.5deg">${t('menu.continue')}</button>` : ''}
        <button data-a="options" style="--r:-1deg">${t('menu.options')}</button>
        <button data-a="lang" style="--r:2deg">${t('menu.lang')}</button>
        <button data-a="credits" style="--r:-1.5deg">${t('menu.credits')}</button>
      </div>`;
    m.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        a.audio.uiClick();
        switch (b.dataset.a) {
          case 'new':
            a.onNew();
            break;
          case 'continue':
            a.onContinue?.();
            break;
          case 'options':
            showOptions(a.settings, a.applySettings, a.audio);
            break;
          case 'lang':
            setLang(getLang() === 'es' ? 'en' : 'es');
            render();
            break;
          case 'credits':
            showCredits(a.audio);
            break;
        }
      }),
    );
  };
  render();
  return () => m.remove();
}

export function showCredits(audio: AudioEngine): void {
  const c = el(`<div class="screen panel"><div class="panel-box">
    <div class="panel-title">${t('menu.credits')}</div>
    <pre class="credits">${t('credits.body')}</pre>
    <button class="panel-back">${t('menu.back')}</button></div></div>`);
  root().appendChild(c);
  c.querySelector('.panel-back')!.addEventListener('click', () => {
    audio.uiClick();
    c.remove();
  });
}

export function showOptions(s: Settings, apply: (s: Settings) => void, audio: AudioEngine, onClose?: () => void): void {
  const o = el(`<div class="screen panel"><div class="panel-box"></div></div>`);
  root().appendChild(o);
  const box = o.querySelector<HTMLDivElement>('.panel-box')!;
  const range = (key: keyof Settings, label: string, min: number, max: number, step: number) =>
    `<label class="opt"><span>${t(label)}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"/></label>`;
  const toggle = (key: keyof Settings, label: string) =>
    `<label class="opt"><span>${t(label)}</span><button data-t="${key}">${s[key] ? t('opt.on') : t('opt.off')}</button></label>`;
  const render = () => {
    box.innerHTML = `<div class="panel-title">${t('opt.title')}</div>
      ${range('sensitivity', 'opt.sensitivity', 0.3, 2.5, 0.05)}
      ${range('fov', 'opt.fov', 60, 90, 1)}
      ${range('volume', 'opt.volume', 0, 1, 0.02)}
      ${range('brightness', 'opt.brightness', 0.6, 1.8, 0.02)}
      <div class="bright-test"><span class="sym">☥</span><small>${t('opt.brightnessHint')}</small></div>
      ${toggle('reduceFlashes', 'opt.flashes')}
      ${toggle('highQuality', 'opt.quality')}
      ${toggle('subtitles', 'opt.subtitles')}
      <button class="panel-back">${t('menu.back')}</button>`;
    const sym = box.querySelector<HTMLSpanElement>('.sym')!;
    sym.style.opacity = String(Math.max(0.02, (s.brightness - 0.7) * 0.25));
    box.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((inp) =>
      inp.addEventListener('input', () => {
        (s as unknown as Record<string, number>)[inp.dataset.k!] = Number(inp.value);
        sym.style.opacity = String(Math.max(0.02, (s.brightness - 0.7) * 0.25));
        apply(s);
        saveSettings(s);
      }),
    );
    box.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.t as keyof Settings;
        (s as unknown as Record<string, boolean>)[k] = !s[k];
        audio.uiClick();
        apply(s);
        saveSettings(s);
        render();
      }),
    );
    box.querySelector('.panel-back')!.addEventListener('click', () => {
      audio.uiClick();
      o.remove();
      onClose?.();
    });
  };
  render();
}

export function showPause(a: { onResume: () => void; onOptions: () => void; onMenu: () => void; audio: AudioEngine }): () => void {
  const p = el(`<div class="screen pause">
    <div class="pause-title">${t('pause.title')}</div>
    <div class="mm-tapes">
      <button data-a="resume" style="--r:-1.5deg">${t('pause.continue')}</button>
      <button data-a="options" style="--r:1deg">${t('pause.options')}</button>
      <button data-a="menu" style="--r:-1deg">${t('pause.menu')}</button>
    </div></div>`);
  root().appendChild(p);
  p.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) =>
    b.addEventListener('click', () => {
      a.audio.uiClick();
      if (b.dataset.a === 'resume') a.onResume();
      else if (b.dataset.a === 'options') a.onOptions();
      else a.onMenu();
    }),
  );
  return () => p.remove();
}
