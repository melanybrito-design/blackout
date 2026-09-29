import '@fontsource/special-elite';
import '@fontsource/vt323';
import '@fontsource/anton';
import '@fontsource/archivo-black';
import '@fontsource/caveat';
import '@fontsource/permanent-marker';
import './style.css';
import { Game } from './core/Game';
import { DEBUG, DebugOverlay } from './core/Debug';
import { ScareFX } from './render/ScareFX';
import { AudioEngine } from './audio/AudioEngine';
import { Session } from './session/Session';
import { MenuScene } from './ui/Menu';
import { showMainMenu, showOptions, showPause, showWarning } from './ui/Screens';
import { playEnding } from './ui/Ending';
import { loadSettings, type Settings } from './core/Settings';
import { setSensitivityScale } from './player/PlayerController';
import { StoryState, type Checkpoint, type Flag } from './narrative/StoryState';
import { getLang, setLang, t } from './i18n';

async function loadFonts(): Promise<void> {
  const fams = ['16px "Special Elite"', '16px VT323', '16px Anton', '16px "Archivo Black"', '16px Caveat', '16px "Permanent Marker"'];
  await Promise.all(fams.map((f) => document.fonts.load(f).catch(() => undefined)));
}

/** Guardados sintéticos para saltar a un checkpoint en depuración (?debug=1&cp=bathroom). */
function debugSave(cp: Checkpoint): NonNullable<ReturnType<typeof StoryState.load>> {
  const steps: Array<[Checkpoint, Flag[], string[], string[]]> = [
    ['corridor', ['gateClosed', 'sms1', 'insideSchool'], ['c1'], []],
    ['classroom', ['sms2', 'hasCredential', 'hasBoardPhoto', 'deduceRehearsal', 's1Done'], ['c2', 'c3'], ['c1+c3']],
    ['bathroom', ['hasRecorder', 'heardTape', 'hasEVP', 'deduceLocker', 'lockerOpened', 's2Done', 'hasLuciaPhoto', 'hasBathKey', 'bathOpen'], ['c4', 'c5', 'c6'], ['c4+c5']],
    ['chase', ['hasMirrorCode', 's3Done', 'deduceCode'], ['c7'], ['c6+c7']],
    ['gym', ['s4Done', 'chaseStarted', 'midDoorForced', 'gymOpen'], [], []],
  ];
  const flags: Flag[] = [];
  const clues: string[] = [];
  const links: string[] = [];
  for (const [name, f, c, l] of steps) {
    flags.push(...f);
    clues.push(...c);
    links.push(...l);
    if (name === cp) break;
  }
  return { flags, checkpoint: cp, clues, links };
}

async function main(): Promise<void> {
  await loadFonts();
  const app = document.getElementById('app')!;
  const game = new Game(app);
  const playCamera = game.camera;
  const audio = game.add(new AudioEngine(playCamera), 'always');
  const fx = game.add(new ScareFX(game.renderer), 'always');
  const settings = loadSettings();
  let session: Session | null = null;
  let closeMenu: (() => void) | null = null;
  let closePause: (() => void) | null = null;
  let ended = false;

  const applySettings = (s: Settings) => {
    setSensitivityScale(s.sensitivity);
    playCamera.fov = s.fov;
    playCamera.updateProjectionMatrix();
    audio.setVolume(s.volume);
    game.renderer.post.uniforms.uBrightness.value = s.brightness;
    fx.reduceFlashes = s.reduceFlashes;
    if ((game.renderer.internalHeight > 400) !== s.highQuality) game.renderer.setQuality(s.highQuality);
    if (session) session.hud.subtitles = s.subtitles;
  };
  applySettings(settings);

  const backToMenu = () => {
    location.hash = 'menu';
    location.reload();
  };

  const openMenu = () => {
    const menu = new MenuScene(game, audio, StoryState.isFinished());
    game.setView(menu.scene, menu.camera);
    audio.camera = menu.camera;
    game.setActive('menu');
    const save = StoryState.load();
    closeMenu = showMainMenu({
      onNew: () => start(null),
      onContinue: save ? () => start(save) : null,
      settings,
      applySettings,
      audio,
    });
    if (StoryState.isFinished()) {
      document.title = t('tab.thanks');
      setTimeout(() => (document.title = t('title')), 4000);
    }
  };

  const start = (save: ReturnType<typeof StoryState.load>) => {
    closeMenu?.();
    closeMenu = null;
    if (!save) StoryState.clear();
    game.camera = playCamera;
    session = new Session(game, audio, fx);
    session.hud.subtitles = settings.subtitles;
    audio.camera = playCamera;
    game.setActive('play');
    if (save) session.script.restore(save);
    else session.script.startNew();
    session.onEnd = () => {
      ended = true;
      playEnding(audio, backToMenu);
    };
    game.input.requestLock();
    if (DEBUG) (window as unknown as Record<string, unknown>).__session = session;
  };

  // Pausa al perder el pointer lock (salvo diario, candado o final)
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === game.renderer.domElement;
    if (!session || ended) return;
    if (locked) {
      closePause?.();
      closePause = null;
      game.paused = false;
      return;
    }
    if (session.journal.isOpen || session.keypad.isOpen || closePause) return;
    if (DEBUG && new URLSearchParams(location.search).has("nopause")) return;
    game.paused = true;
    closePause = showPause({
      audio,
      onResume: () => game.input.requestLock(),
      onOptions: () => showOptions(settings, applySettings, audio),
      onMenu: backToMenu,
    });
  });
  // Si el diario/candado se cierran sin volver a capturar el mouse, un clic en el juego lo hace.
  game.renderer.domElement.addEventListener('click', () => {
    if (session && !ended && !game.input.locked) game.input.requestLock();
  });

  // Meta-horror: la pestaña te llama
  let tabTimer = 0;
  document.addEventListener('visibilitychange', () => {
    if (!session || ended) return;
    clearTimeout(tabTimer);
    if (document.hidden) {
      document.title = t('tab.still');
      tabTimer = window.setTimeout(() => (document.title = t('tab.back')), 6000);
    } else document.title = t('title');
  });

  if (DEBUG) {
    (window as unknown as Record<string, unknown>).__game = game;
    (window as unknown as Record<string, unknown>).__audio = audio;
    game.add(new DebugOverlay(game, () => session), 'always');
    game.add(
      {
        update() {
          const inp = game.input;
          if (inp.rawPressed('KeyP')) {
            const u = game.renderer.post.uniforms.uEnabled;
            u.value = u.value > 0.5 ? 0 : 1;
          }
          if (inp.rawPressed('KeyG')) fx.pulse(1, 0.6);
          if (inp.rawPressed('KeyL')) setLang(getLang() === 'es' ? 'en' : 'es');
        },
      },
      'always',
    );
  }

  game.start();
  const params = new URLSearchParams(location.search);
  const cp = params.get('cp') as Checkpoint | 'new' | null;
  showWarning(() => {
    audio.unlock();
    if (DEBUG && cp) start(cp === 'new' ? null : debugSave(cp));
    else openMenu();
  });
}

void main();
