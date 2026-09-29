import '@fontsource/special-elite';
import '@fontsource/vt323';
import './style.css';
import { Game } from './core/Game';
import { bus } from './core/EventBus';
import { DEBUG, DebugOverlay } from './core/Debug';
import { ScareFX } from './render/ScareFX';
import { buildTestCorridor, CORRIDOR } from './world/TestCorridor';
import { FreeLookController } from './player/FreeLookController';
import { getLang, setLang, t } from './i18n';

const app = document.getElementById('app')!;
const overlay = document.getElementById('overlay')!;

const game = new Game(app);
const fx = game.add(new ScareFX(game.renderer));
buildTestCorridor(game);
game.add(
  new FreeLookController(game.camera, game.input, {
    minX: -CORRIDOR.width / 2 + 0.35,
    maxX: CORRIDOR.width / 2 - 0.35,
    minZ: -CORRIDOR.length + 2.4,
    maxZ: 1.6,
  }),
);

let started = false;
function renderOverlay(): void {
  overlay.innerHTML = started
    ? `<div class="big">${t('pause.title')}</div><div>${t('pause.resume')}</div>`
    : `<div class="big">${t('title')}</div><div>${t('boot.click')}</div><div class="small">${t('boot.headphones')}</div>`;
}
renderOverlay();
bus.on('lang:changed', renderOverlay);

overlay.addEventListener('click', () => game.input.requestLock());
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === game.renderer.domElement;
  if (locked && !started) {
    started = true;
    bus.emit('game:start');
  }
  overlay.classList.toggle('hidden', locked);
  if (!locked) renderOverlay();
});

if (DEBUG) {
  (window as unknown as { __game: Game }).__game = game;
  game.add(new DebugOverlay(game));
  let high = false;
  game.add({
    update() {
      const inp = game.input;
      if (inp.wasPressed('KeyP')) {
        const u = game.renderer.post.uniforms.uEnabled;
        u.value = u.value > 0.5 ? 0 : 1;
      }
      if (inp.wasPressed('KeyQ')) game.renderer.setQuality((high = !high));
      if (inp.wasPressed('KeyG')) fx.pulse(1, 0.6);
      if (inp.wasPressed('KeyL')) setLang(getLang() === 'es' ? 'en' : 'es');
    },
  });
}

game.start();
