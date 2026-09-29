// Overlay de depuración (?debug=1): FPS, draw calls, posición, tensión y flags de historia.
import type { Game, System } from './Game';
import type { Session } from '../session/Session';
import { t } from '../i18n';

export const DEBUG = new URLSearchParams(location.search).has('debug');

export class DebugOverlay implements System {
  private el = document.createElement('pre');
  private frames = 0;
  private acc = 0;
  private fps = 0;

  constructor(
    private game: Game,
    private session: () => Session | null,
  ) {
    this.el.className = 'debug';
    document.body.appendChild(this.el);
  }

  update(dt: number): void {
    this.frames++;
    this.acc += dt || 0.016;
    if (this.acc < 0.5) return;
    this.fps = Math.round(this.frames / this.acc);
    this.frames = 0;
    this.acc = 0;
    const { render } = this.game.renderer.info;
    const p = this.game.camera.position;
    const s = this.session();
    let extra = '';
    if (s) {
      extra =
        `\narea ${s.area}  tension ${s.director.tension.toFixed(0)}  ${s.director.phase}  fake ${s.director.fakeOuts}` +
        `\nsinceMajor ${s.director.sinceMajor.toFixed(0)}s  fired ${s.director.fired.join(',')}` +
        `\nflags ${s.story.all().slice(-6).join(',')}`;
    }
    this.el.textContent =
      `FPS ${this.fps}  draw ${render.calls}  tris ${render.triangles}\n` +
      `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}` +
      extra +
      `\n${t('debug.help')}`;
  }
}
