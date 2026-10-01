// Prólogo narrado antes de la partida nueva: qué pasó con las seis, quién es Lucía y por qué
// estás frente al portón. Termina con los controles. Clic / Espacio avanza; se puede saltar.
import { t } from '../i18n';
import { keycaps } from './Hud';
import { posterCanvas } from '../textures/poster';
import type { AudioEngine } from '../audio/AudioEngine';

type Backdrop = { video: string } | { image: string } | { poster: true } | null;

interface Slide {
  backdrop: Backdrop;
  /** Claves i18n: encabezado opcional + párrafo. */
  head?: string;
  body: string;
  /** SMS que aparece al terminar el párrafo. */
  sms?: string;
  onShow?: () => void;
}

export function playIntro(audio: AudioEngine, onDone: () => void): void {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `<div class="intro-bg"></div><div class="intro-shade"></div>
    <div class="intro-text"><div class="intro-head"></div><div class="intro-body"></div><div class="intro-sms"></div></div>
    <button class="intro-skip">${t('intro.skip')}</button><div class="intro-next">${t('intro.next')}</div>`;
  document.getElementById('screens')!.appendChild(el);
  const bg = el.querySelector<HTMLDivElement>('.intro-bg')!;
  const head = el.querySelector<HTMLDivElement>('.intro-head')!;
  const body = el.querySelector<HTMLDivElement>('.intro-body')!;
  const sms = el.querySelector<HTMLDivElement>('.intro-sms')!;
  const next = el.querySelector<HTMLDivElement>('.intro-next')!;

  const slides: Slide[] = [
    { backdrop: { video: '/assets/video/intro.mp4' }, head: 'intro.1.head', body: 'intro.1.body' },
    { backdrop: { poster: true }, body: 'intro.2.body' },
    { backdrop: { image: '/assets/characters/photo_lucia_print.png' }, body: 'intro.3.body' },
    { backdrop: { image: '/assets/characters/wallpaper_sisters.png' }, body: 'intro.4.body' },
    { backdrop: null, body: 'intro.5.body', sms: 'sms.1', onShow: () => audio.play('vibrate') },
    { backdrop: { video: '/assets/video/intro.mp4' }, body: 'intro.6.body' },
  ];

  let index = -1;
  let typing = 0;
  let full = '';
  let shown = 0;
  let finished = false;

  const setBackdrop = (b: Backdrop) => {
    bg.classList.remove('on');
    window.setTimeout(() => {
      bg.innerHTML = '';
      bg.style.backgroundImage = '';
      if (b && 'video' in b) {
        const v = document.createElement('video');
        v.src = b.video;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.autoplay = true;
        bg.appendChild(v);
        void v.play().catch(() => undefined);
      } else if (b && 'image' in b) bg.style.backgroundImage = `url('${b.image}')`;
      else if (b && 'poster' in b) bg.style.backgroundImage = `url('${posterCanvas().toDataURL()}')`;
      bg.classList.toggle('poster', !!b && 'poster' in b);
      bg.classList.add('on');
    }, 350);
  };

  const revealSms = (s: Slide) => {
    if (!s.sms) return;
    sms.innerHTML = `<small>${t('sms.from')} · 20:58</small>${t(s.sms)}`;
    sms.classList.add('on');
    audio.play('sms');
  };

  const completeTyping = () => {
    window.clearInterval(typing);
    typing = 0;
    body.textContent = full;
    next.classList.add('on');
    revealSms(slides[index]);
  };

  const showSlide = () => {
    const s = slides[index];
    setBackdrop(s.backdrop);
    head.textContent = s.head ? t(s.head) : '';
    sms.classList.remove('on');
    next.classList.remove('on');
    full = t(s.body);
    shown = 0;
    body.textContent = '';
    audio.play('paper', { gain: 0.5 });
    s.onShow?.();
    typing = window.setInterval(() => {
      shown += 2;
      body.textContent = full.slice(0, shown);
      if (shown >= full.length) completeTyping();
    }, 34);
  };

  const showControls = () => {
    el.classList.add('controls');
    setBackdrop(null);
    head.textContent = t('intro.controls.head');
    sms.classList.remove('on');
    body.innerHTML = keycaps(t('intro.controls.body')).replace(/\n/g, '<br/>');
    next.textContent = t('intro.start');
    next.classList.add('on');
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearInterval(typing);
    window.removeEventListener('keydown', onKey);
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 700);
    onDone();
  };

  const advance = () => {
    if (finished) return;
    if (typing) return completeTyping();
    index++;
    if (index < slides.length) showSlide();
    else if (index === slides.length) showControls();
    else finish();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') advance();
  };
  window.addEventListener('keydown', onKey);
  el.addEventListener('click', advance);
  el.querySelector('.intro-skip')!.addEventListener('click', (e) => {
    e.stopPropagation();
    // Saltar la historia lleva a los controles; desde los controles, a jugar.
    if (index < slides.length) {
      window.clearInterval(typing);
      typing = 0;
      index = slides.length;
      showControls();
    } else finish();
  });
  advance();
}
