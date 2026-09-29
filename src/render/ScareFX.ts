// Controla los uniforms de susto del post-proceso (distorsión, destello, temblor de vértices)
// con decaimiento automático. Los screamers de la Fase 8 lo usan.
import type { System } from '../core/Game';
import type { PS2Renderer } from './PS2Renderer';
import { setSnapAspect } from './ps2Material';
import { RENDER } from '../config';

export class ScareFX implements System {
  private distort = 0;
  private flash = 0;
  /** Opción de accesibilidad "Reducir destellos". */
  reduceFlashes = false;

  constructor(private renderer: PS2Renderer) {}

  pulse(distort: number, flash = 0): void {
    this.distort = Math.max(this.distort, distort);
    if (!this.reduceFlashes) this.flash = Math.max(this.flash, flash);
  }

  update(dt: number): void {
    this.distort = Math.max(0, this.distort - dt * 1.4);
    this.flash = Math.max(0, this.flash - dt * 4);
    const u = this.renderer.post.uniforms;
    u.uDistort.value = this.distort;
    u.uFlash.value = this.flash;
    // Más temblor de vértices mientras dura la distorsión.
    setSnapAspect(innerWidth / innerHeight, RENDER.vertexSnap * (1 - this.distort * 0.6));
  }
}
