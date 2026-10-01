// Texturas del colegio por zona (además de las base de procedural.ts).
import type * as THREE from 'three';
import { canvas, toTexture, liveTexture, grime, noise, bloodDrip, shakyText } from './canvas';
import { rng } from './rng';
import { t } from '../i18n';
import { optionalImage } from './asset';

/** Baldosas blancas/celestes del baño. */
export function bathTiles(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const r = rng(301);
  const s = 16;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const v = r() * 18;
      ctx.fillStyle = `rgb(${170 + v},${192 + v},${196 + v})`;
      ctx.fillRect(x * s, y * s, s, s);
    }
  ctx.fillStyle = 'rgba(40,50,48,0.7)';
  for (let i = 0; i <= 8; i++) {
    ctx.fillRect(i * s - 0.5, 0, 1, 128);
    ctx.fillRect(0, i * s - 0.5, 128, 1);
  }
  grime(ctx, r, 128, 128, 30, 0.16);
  noise(ctx, r, 128, 128, 14);
  return toTexture(c);
}

/** Parquet de gimnasio con líneas de cancha. */
export function gymFloor(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const r = rng(411);
  for (let y = 0; y < 128; y += 8) {
    let x = -r() * 40;
    while (x < 128) {
      const len = 30 + r() * 40;
      const v = r() * 25;
      ctx.fillStyle = `rgb(${120 + v},${82 + v * 0.7},${48 + v * 0.4})`;
      ctx.fillRect(x, y, len, 8);
      ctx.fillStyle = 'rgba(30,18,8,0.6)';
      ctx.fillRect(x, y, 1, 8);
      x += len;
    }
    ctx.fillStyle = 'rgba(30,18,8,0.5)';
    ctx.fillRect(0, y, 128, 1);
  }
  grime(ctx, r, 128, 128, 20, 0.14);
  noise(ctx, r, 128, 128, 12);
  return toTexture(c);
}

/** Concreto mojado del patio. */
export function wetConcrete(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const r = rng(521);
  ctx.fillStyle = '#4a4d4c';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 12; i++) {
    const x = r() * 128;
    const y = r() * 128;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + r() * 25);
    g.addColorStop(0, 'rgba(20,30,34,0.55)');
    g.addColorStop(1, 'rgba(20,30,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  ctx.strokeStyle = 'rgba(15,15,15,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(128, 64);
  ctx.moveTo(64, 0);
  ctx.lineTo(64, 128);
  ctx.stroke();
  noise(ctx, r, 128, 128, 26);
  return toTexture(c);
}

/** Fachada: muro de concreto pintado con ventanas oscuras (2 pisos). */
export function facade(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const r = rng(631);
  ctx.fillStyle = '#8e8a78';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#5c6a5c';
  ctx.fillRect(0, 100, 128, 28);
  for (const wy of [18, 62]) {
    ctx.fillStyle = '#0a0f12';
    ctx.fillRect(24, wy, 80, 30);
    ctx.fillStyle = '#2d3336';
    ctx.fillRect(62, wy, 4, 30);
    ctx.fillRect(24, wy + 13, 80, 3);
    if (r() > 0.5) {
      ctx.fillStyle = 'rgba(80,110,100,0.25)';
      ctx.fillRect(28, wy + 3, 30, 9);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = r() * 128;
    const g = ctx.createLinearGradient(x, 0, x, 128);
    g.addColorStop(0, 'rgba(40,40,30,0.4)');
    g.addColorStop(1, 'rgba(40,40,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 4 + r() * 8, 128);
  }
  noise(ctx, r, 128, 128, 20);
  return toTexture(c);
}

/** Muro perimetral de ladrillo pintado. */
export function perimeterWall(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const r = rng(733);
  ctx.fillStyle = '#6d6a60';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 12) {
    const off = (y / 12) % 2 ? 16 : 0;
    for (let x = -off; x < 128; x += 32) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
      ctx.fillRect(x + 1, y + 1, 30, 10);
    }
  }
  // grafiti
  ctx.fillStyle = 'rgba(150,20,30,0.55)';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('S.A.', 12, 70);
  noise(ctx, r, 128, 128, 22);
  return toTexture(c);
}

/** Reja de malla (con alfa). */
export function chainFence(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  ctx.strokeStyle = '#8a9290';
  ctx.lineWidth = 1.5;
  for (let i = -64; i < 128; i += 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.moveTo(i + 64, 0);
    ctx.lineTo(i, 64);
    ctx.stroke();
  }
  return toTexture(c);
}

/** Pizarra con tiza: ENSAYO 21:00 — NO FALTAR (i18n). */
export function blackboard(): THREE.CanvasTexture {
  // La pizarra vacía es una foto opcional; el texto siempre se escribe en código (ES/EN).
  let photo: HTMLImageElement | null = null;
  const K = 2;
  const tex = liveTexture(256 * K, 128 * K, (ctx, w, h) => {
    const r = rng(811);
    if (photo) {
      ctx.drawImage(photo, 0, 0, w, h);
      ctx.fillStyle = 'rgba(8,14,12,0.35)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#1f2c25';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(200,210,200,${0.02 + r() * 0.05})`;
        ctx.fillRect(r() * w, r() * h, (20 + r() * 60) * K, (4 + r() * 10) * K);
      }
    }
    // Que ninguna línea se salga de la pizarra (el inglés y el español miden distinto).
    const font = 'Caveat, cursive';
    const line = (key: string, x: number, y: number, size: number) => {
      const text = t(key);
      ctx.font = `${size * K}px ${font}`;
      const room = w - (x + 14) * K;
      const k = Math.min(1, room / (ctx.measureText(text).width * 1.04));
      shakyText(ctx, r, text, x * K, y * K, size * K * k, font);
    };
    ctx.fillStyle = 'rgba(235,235,225,0.9)';
    line('board.line1', 18, 44, 26);
    line('board.line2', 22, 78, 20);
    ctx.fillStyle = 'rgba(235,235,225,0.6)';
    line('board.line3', 22, 106, 15);
    if (!photo) {
      ctx.strokeStyle = '#4b3a22';
      ctx.lineWidth = 6 * K;
      ctx.strokeRect(0, 0, w, h);
    }
  });
  optionalImage('textures/blackboard.png', (image) => {
    photo = image;
    (tex.userData.redraw as () => void)();
  });
  return tex;
}

/** Ventana de noche con lluvia (emisiva tenue). */
export function nightWindow(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  const r = rng(907);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#16222c');
  g.addColorStop(1, '#070b0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(140,170,180,0.25)';
  for (let i = 0; i < 26; i++) {
    const x = r() * 64;
    const y = r() * 64;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 2, y + 4 + r() * 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#20272a';
  ctx.fillRect(30, 0, 4, 64);
  ctx.fillRect(0, 30, 64, 4);
  ctx.strokeStyle = '#20272a';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 64, 64);
  return toTexture(c, false);
}

/** Cartel de salida de emergencia (i18n). */
export function exitSign(): THREE.CanvasTexture {
  return liveTexture(64, 32, (ctx, w, h) => {
    ctx.fillStyle = '#0b5d2a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9ffe4';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('sign.exit'), w / 2, 21);
  });
}

/** Letrero de puerta (2°B, BAÑO, GIMNASIO...). */
export function doorPlate(key: string): THREE.CanvasTexture {
  return liveTexture(64, 24, (ctx, w, h) => {
    ctx.fillStyle = '#d5cdb4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b1b1b';
    // Achicar la letra hasta que el nombre entre en la placa.
    let size = 13;
    do ctx.font = `bold ${size}px sans-serif`;
    while (ctx.measureText(t(key)).width > w - 6 && --size > 6);
    ctx.textAlign = 'center';
    ctx.fillText(t(key), w / 2, 12 + size * 0.38);
  });
}

/** Diario mural con afiches de desaparecidas y avisos. */
export function bulletinBoard(missingPoster: HTMLCanvasElement): THREE.CanvasTexture {
  return liveTexture(256, 128, (ctx, w, h) => {
    const r = rng(1001);
    ctx.fillStyle = '#7b5a36';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(40,25,10,${r() * 0.3})`;
      ctx.fillRect(r() * w, r() * h, 1, 1);
    }
    // Avisos
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(20 + i * 50, 18 + r() * 40);
      ctx.rotate((r() - 0.5) * 0.2);
      ctx.fillStyle = ['#e9e3cf', '#f0d9d9', '#dfe9f0'][i % 3];
      ctx.fillRect(0, 0, 40, 46);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let l = 0; l < 6; l++) ctx.fillRect(4, 8 + l * 6, 22 + r() * 10, 2);
      ctx.restore();
    }
    // Afiches de desaparecidas repetidos
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(40 + i * 75, 30 + r() * 20);
      ctx.rotate((r() - 0.5) * 0.15);
      ctx.drawImage(missingPoster, 0, 0, 52, 72);
      ctx.restore();
    }
    ctx.fillStyle = '#e4ddc6';
    ctx.font = '12px "Special Elite", monospace';
    ctx.fillText(t('board.bulletin'), 8, h - 8);
  });
}

/** Mancha de sangre (alfa). */
export function bloodSplat(seed: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  const r = rng(seed);
  ctx.fillStyle = 'rgba(70,4,6,0.85)';
  ctx.beginPath();
  ctx.ellipse(32, 32, 14 + r() * 6, 10 + r() * 6, r() * 3, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const d = 14 + r() * 16;
    ctx.beginPath();
    ctx.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1 + r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, false);
}

/** Marcas de arrastre con sangre seca (alfa). */
export function dragMarks(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 256);
  const r = rng(1203);
  for (let i = 0; i < 4; i++) {
    let x = 18 + i * 9;
    ctx.strokeStyle = `rgba(60,6,6,${0.35 + r() * 0.3})`;
    ctx.lineWidth = 2 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y < 256; y += 16) {
      x += (r() - 0.5) * 3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(c, false);
}

/** Huella de pie descalzo mojada (alfa) — capa espectral. */
export function footprint(): THREE.CanvasTexture {
  const [c, ctx] = canvas(32, 64);
  ctx.fillStyle = 'rgba(190,230,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(16, 40, 8, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16, 16, 9, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(7 + i * 4.5, 4 + Math.abs(i - 1) * 1.2, 2.2 - i * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, false);
}

/** Escritura en el espejo "6 – 3 – 1" (espectral). */
export function mirrorWriting(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 64);
  const r = rng(1301);
  ctx.fillStyle = 'rgba(210,235,255,0.9)';
  shakyText(ctx, r, '6 - 3 - 1', 10, 44, 36, 'Caveat, cursive');
  // dedos arrastrados
  ctx.fillStyle = 'rgba(210,235,255,0.35)';
  for (let i = 0; i < 4; i++) ctx.fillRect(14 + i * 28 + r() * 8, 48, 2, 10 + r() * 12);
  return toTexture(c, false);
}

/** Texto con sangre en el espejo (i18n: "ya viene"). */
export function bloodWriting(): THREE.CanvasTexture {
  return liveTexture(256, 96, (ctx) => {
    const r = rng(1409);
    ctx.fillStyle = 'rgba(120,6,10,0.95)';
    shakyText(ctx, r, t('mirror.blood'), 16, 60, 54, '"Permanent Marker", Caveat, cursive');
    for (let i = 0; i < 9; i++) bloodDrip(ctx, r, 24 + r() * 200, 50 + r() * 15, 12 + r() * 30, 2);
  });
}

/** Grietas del espejo roto (alfa). */
export function mirrorCracks(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 128);
  const r = rng(1511);
  const cx = 150;
  const cy = 60;
  ctx.strokeStyle = 'rgba(230,240,240,0.8)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    let x = cx;
    let y = cy;
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += Math.cos(a + (r() - 0.5) * 0.6) * (8 + r() * 12);
      y += Math.sin(a + (r() - 0.5) * 0.6) * (8 + r() * 12);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let ring = 1; ring < 4; ring++) {
    ctx.beginPath();
    ctx.arc(cx, cy, ring * 14 + r() * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) bloodDrip(ctx, r, cx + (r() - 0.5) * 60, cy + (r() - 0.5) * 20, 20 + r() * 40, 2);
  return toTexture(c, false);
}

/** Dibujos infantiles pegados en la pared. */
export function kidsDrawing(seed: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 48);
  const r = rng(seed);
  ctx.fillStyle = '#ece6d4';
  ctx.fillRect(0, 0, 64, 48);
  const cols = ['#c0392b', '#2471a3', '#229954', '#d4ac0d', '#1c1c1c'];
  // casa / sol / figuras
  ctx.strokeStyle = cols[Math.floor(r() * 5)];
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 22, 20, 16);
  ctx.beginPath();
  ctx.moveTo(8, 22);
  ctx.lineTo(20, 12);
  ctx.lineTo(32, 22);
  ctx.stroke();
  ctx.fillStyle = '#d4ac0d';
  ctx.beginPath();
  ctx.arc(52, 10, 5, 0, Math.PI * 2);
  ctx.fill();
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const x = 36 + i * 5;
    ctx.strokeStyle = i === n - 1 && seed % 2 ? '#000' : cols[i % 5];
    ctx.beginPath();
    ctx.arc(x, 28, 2, 0, Math.PI * 2);
    ctx.moveTo(x, 30);
    ctx.lineTo(x, 38);
    ctx.stroke();
  }
  return toTexture(c, false);
}

/** Letrero de piso "S07" / tarjeta de silla. */
export function chairCard(): THREE.CanvasTexture {
  return liveTexture(64, 40, (ctx, w, h) => {
    ctx.fillStyle = '#e8e1cc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8e0d14';
    ctx.font = 'bold 20px Anton, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S07', w / 2, 26);
    ctx.fillStyle = '#222';
    ctx.font = '9px sans-serif';
    ctx.fillText(t('gym.card'), w / 2, 36);
  });
}

/** Tela de saco (para las figuras del gimnasio). */
export function burlap(): THREE.CanvasTexture {
  const [c, ctx] = canvas(32, 32);
  const r = rng(1709);
  ctx.fillStyle = '#7a6a4c';
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 32; i += 2) {
    ctx.fillStyle = 'rgba(40,30,15,0.35)';
    ctx.fillRect(0, i, 32, 1);
    ctx.fillRect(i, 0, 1, 32);
  }
  ctx.fillStyle = 'rgba(80,5,8,0.7)';
  ctx.beginPath();
  ctx.ellipse(16, 20, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  noise(ctx, r, 32, 32, 20);
  return toTexture(c);
}

/** Reloj de pared detenido a las 21:00. */
export function wallClock(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#e8e3d3';
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1b1b1b';
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(32 + Math.sin(a) * 24 - 1, 32 - Math.cos(a) * 24 - 1, 2, 3);
  }
  // 21:00 → aguja corta en 9, larga en 12
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(18, 32);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(32, 11);
  ctx.stroke();
  ctx.strokeStyle = '#a3121b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 32);
  ctx.lineTo(44, 50);
  ctx.stroke();
  // vidrio rajado
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(10, 20);
  ctx.lineTo(28, 30);
  ctx.lineTo(24, 48);
  ctx.stroke();
  return toTexture(c, false);
}
