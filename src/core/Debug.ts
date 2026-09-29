// Overlay de depuración (?debug=1): FPS, draw calls, triángulos, posición y atajos.
import type { Game, System } from './Game';
import { t } from '../i18n';

export const DEBUG = new URLSearchParams(location.search).has('debug');

export class DebugOverlay implements System {
  private el = document.createElement('pre');
  private frames = 0;
  private acc = 0;
  private fps = 0;

  constructor(private game: Game) {
    this.el.className = 'debug';
    document.body.appendChild(this.el);
  }

  update(dt: number): void {
    this.frames++;
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.fps = Math.round(this.frames / this.acc);
    this.frames = 0;
    this.acc = 0;
    const { render } = this.game.renderer.info;
    const p = this.game.camera.position;
    this.el.textContent =
      `FPS ${this.fps}\n` +
      `draw ${render.calls}  tris ${render.triangles}\n` +
      `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
      t('debug.help');
  }
}
