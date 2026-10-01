// Utilidades de canvas compartidas por los generadores de texturas.
import * as THREE from 'three';
import { bus } from '../core/EventBus';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function toTexture(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Textura con texto que se redibuja al cambiar el idioma.
 * draw recibe el contexto limpio y debe dibujar todo.
 */
export function liveTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const [c, ctx] = canvas(w, h);
  draw(ctx, w, h);
  const tex = toTexture(c, false);
  const redraw = () => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    tex.needsUpdate = true;
  };
  bus.on('lang:changed', redraw);
  // Para texturas que además esperan una imagen opcional (p. ej. la pizarra).
  tex.userData.redraw = redraw;
  return tex;
}

export function grime(ctx: CanvasRenderingContext2D, r: () => number, w: number, h: number, amount: number, alpha = 0.12): void {
  for (let i = 0; i < amount; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 2 + r() * w * 0.15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(20,18,10,${alpha * (0.6 + r())})`);
    g.addColorStop(1, 'rgba(20,18,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

export function noise(ctx: CanvasRenderingContext2D, r: () => number, w: number, h: number, strength: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * strength;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Gotas/chorreado de sangre desde (x, y). */
export function bloodDrip(ctx: CanvasRenderingContext2D, r: () => number, x: number, y: number, len: number, width = 3): void {
  ctx.fillStyle = `rgba(${90 + r() * 40},8,10,0.9)`;
  ctx.beginPath();
  ctx.ellipse(x, y, width * 1.6, width, 0, 0, Math.PI * 2);
  ctx.fill();
  let cx = x;
  for (let i = 0; i < len; i += 2) {
    cx += (r() - 0.5) * 0.8;
    const wv = width * (1 - i / len) * 0.9 + 0.6;
    ctx.fillRect(cx - wv / 2, y + i, wv, 2.5);
  }
  ctx.beginPath();
  ctx.arc(cx, y + len, width * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

/** Texto a mano alzada con leve temblor por letra. */
export function shakyText(ctx: CanvasRenderingContext2D, r: () => number, text: string, x: number, y: number, size: number, font: string): void {
  ctx.font = `${size}px ${font}`;
  let cx = x;
  for (const ch of text) {
    ctx.save();
    ctx.translate(cx, y + (r() - 0.5) * size * 0.12);
    ctx.rotate((r() - 0.5) * 0.12);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += ctx.measureText(ch).width * (0.95 + r() * 0.1);
  }
}
