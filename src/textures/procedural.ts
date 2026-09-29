// Generadores de texturas en Canvas. Todo el arte base del colegio sale de aquí.
import * as THREE from 'three';
import { rng } from './rng';

type Draw = (ctx: CanvasRenderingContext2D, r: () => number, w: number, h: number) => void;

function make(w: number, h: number, seed: number, draw: Draw, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, rng(seed), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

/** Mugre: manchas suaves oscuras + salpicaduras. */
function grime(ctx: CanvasRenderingContext2D, r: () => number, w: number, h: number, amount: number): void {
  for (let i = 0; i < amount; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 2 + r() * w * 0.15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(20,18,10,${0.08 + r() * 0.12})`);
    g.addColorStop(1, 'rgba(20,18,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function noise(ctx: CanvasRenderingContext2D, r: () => number, w: number, h: number, strength: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * strength;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Baldosa institucional ajedrezada beige / verde gastado. */
export function floorTiles(): THREE.CanvasTexture {
  return make(256, 256, 11, (ctx, r, w, h) => {
    const s = w / 4;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const light = (x + y) % 2 === 0;
        const v = r() * 14;
        ctx.fillStyle = light ? `rgb(${168 + v},${160 + v},${138 + v})` : `rgb(${70 + v},${92 + v},${80 + v})`;
        ctx.fillRect(x * s, y * s, s, s);
      }
    ctx.strokeStyle = 'rgba(30,30,25,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
    grime(ctx, r, w, h, 26);
    // grietas
    ctx.strokeStyle = 'rgba(25,22,18,0.5)';
    for (let i = 0; i < 3; i++) {
      let x = r() * w;
      let y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 14;
        y += (r() - 0.5) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    noise(ctx, r, w, h, 18);
  });
}

/** Pared de colegio: zócalo verde abajo, crema arriba, franja divisoria, manchas de humedad. */
export function schoolWall(): THREE.CanvasTexture {
  return make(256, 256, 23, (ctx, r, w, h) => {
    ctx.fillStyle = '#b9b39a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3f5a4c';
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = '#2b3b33';
    ctx.fillRect(0, h * 0.6, w, h * 0.03);
    // humedad que baja desde arriba
    for (let i = 0; i < 5; i++) {
      const x = r() * w;
      const len = h * (0.15 + r() * 0.4);
      const g = ctx.createLinearGradient(x, 0, x, len);
      g.addColorStop(0, 'rgba(60,55,35,0.35)');
      g.addColorStop(1, 'rgba(60,55,35,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 3 - r() * 6, 0, 6 + r() * 10, len);
    }
    grime(ctx, r, w, h, 18);
    // rayones en el zócalo
    ctx.strokeStyle = 'rgba(200,200,180,0.18)';
    for (let i = 0; i < 12; i++) {
      const x = r() * w;
      const y = h * 0.65 + r() * h * 0.33;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 4);
      ctx.stroke();
    }
    noise(ctx, r, w, h, 14);
  });
}

/** Plafón de techo con perforaciones y manchas de agua. */
export function ceilingTiles(): THREE.CanvasTexture {
  return make(64, 64, 37, (ctx, r, w, h) => {
    ctx.fillStyle = '#9d9a8c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(40,40,35,0.35)';
    for (let y = 3; y < h; y += 5) for (let x = 3; x < w; x += 5) if (r() > 0.3) ctx.fillRect(x, y, 1, 1);
    ctx.strokeStyle = '#5a584f';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    if (r() > 0.2) {
      const x = r() * w;
      const y = r() * h;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 18);
      g.addColorStop(0, 'rgba(110,85,40,0.5)');
      g.addColorStop(0.8, 'rgba(110,85,40,0.25)');
      g.addColorStop(1, 'rgba(110,85,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    noise(ctx, r, w, h, 12);
  });
}

/** Frente de casillero metálico con rejillas, número y óxido. */
export function lockerFront(num: number): THREE.CanvasTexture {
  return make(64, 128, 100 + num, (ctx, r, w, h) => {
    ctx.fillStyle = '#4d6a78';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a525e';
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(w - 3, 0, 3, h);
    // rejillas de ventilación
    ctx.fillStyle = '#1d2a31';
    for (let i = 0; i < 5; i++) ctx.fillRect(14, 10 + i * 5, 36, 2);
    for (let i = 0; i < 5; i++) ctx.fillRect(14, h - 32 + i * 5, 36, 2);
    // manilla
    ctx.fillStyle = '#9aa2a4';
    ctx.fillRect(w - 16, h * 0.48, 6, 14);
    // placa con número
    ctx.fillStyle = '#d8d2bd';
    ctx.fillRect(22, 40, 20, 11);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(num), 32, 49);
    // óxido y abolladuras
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(${110 + r() * 40},${55 + r() * 20},25,${0.2 + r() * 0.3})`;
      const x = r() * w;
      const y = r() * h;
      ctx.fillRect(x, y, 1 + r() * 4, 1 + r() * 7);
    }
    grime(ctx, r, w, h, 8);
    noise(ctx, r, w, h, 16);
  });
}

/** Puerta de madera pintada con ventanita. */
export function classroomDoor(windowHole = true, tint = "#6b4a2e"): THREE.CanvasTexture {
  return make(64, 128, windowHole ? 51 : 52, (ctx, r, w, h) => {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(40,25,12,${0.15 + r() * 0.2})`;
      const x = r() * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + (r() - 0.5) * 4, h);
      ctx.stroke();
    }
    if (windowHole) {
      ctx.strokeStyle = "#3b2616";
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 18, 32, 34);
    }
    ctx.fillStyle = '#b8b09a';
    ctx.fillRect(w - 12, h * 0.52, 7, 4);
    grime(ctx, r, w, h, 10);
    noise(ctx, r, w, h, 14);
    if (windowHole) ctx.clearRect(18, 20, 28, 30);
  });
}

/** Banco de casilleros en una sola textura (un draw call por banco). */
export function lockerBank(startNum: number, count: number): THREE.CanvasTexture {
  const fronts = Array.from({ length: count }, (_, i) => lockerFront(startNum + i));
  return make(64 * count, 128, 900 + startNum, (ctx) => {
    fronts.forEach((t, i) => {
      ctx.drawImage(t.image as HTMLCanvasElement, i * 64, 0);
      t.dispose();
    });
    ctx.fillStyle = 'rgba(10,14,16,0.9)';
    for (let i = 1; i < count; i++) ctx.fillRect(i * 64 - 1, 0, 2, 128);
  });
}
