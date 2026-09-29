// Afiche "DESAPARECIDAS / MISSING" (ref. 02). Se usa en el menú, en la reja y en el diario mural.
import { canvas, bloodDrip } from './canvas';
import { drawFace, photocopy } from './faces';
import { rng } from './rng';
import { GIRLS } from '../narrative/girls';
import { t } from '../i18n';

export interface PosterOpts {
  /** Índice de la chica que mira al cursor (-1 = ninguna). */
  lookIndex?: number;
  lookX?: number;
  lookY?: number;
  /** Veces que se volvió al menú: agrega cambios sutiles. */
  visits?: number;
  /** Tras terminar la demo aparece la foto "TÚ / S07". */
  finished?: boolean;
}

export const POSTER_W = 512;
export const POSTER_H = 724;

const portraitCache = new Map<string, HTMLCanvasElement>();

function portrait(i: number, lookX: number, lookY: number, zoom: number): HTMLCanvasElement {
  const key = `${i}:${lookX.toFixed(2)}:${lookY.toFixed(2)}:${zoom}`;
  let c = portraitCache.get(key);
  if (c) return c;
  const g = GIRLS[i];
  const S = 128;
  const [pc, ctx] = canvas(S, S);
  if (zoom !== 1) {
    ctx.translate(S / 2, S / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-S / 2, -S / 2);
  }
  drawFace(ctx, { seed: g.seed, hair: g.hair, lookX, lookY }, S);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  photocopy(ctx, S, g.seed, 0.9);
  if (portraitCache.size > 60) portraitCache.clear();
  portraitCache.set(key, pc);
  c = pc;
  return c;
}

export function drawPoster(ctx: CanvasRenderingContext2D, o: PosterOpts = {}): void {
  const W = POSTER_W;
  const H = POSTER_H;
  const r = rng(2024);
  const visits = o.visits ?? 0;

  // Papel envejecido
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 10 + r() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(150,110,60,${0.05 + r() * 0.12})`);
    g.addColorStop(1, 'rgba(150,110,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Título
  ctx.fillStyle = '#b3121b';
  ctx.textAlign = 'center';
  ctx.font = `92px Anton, "Archivo Black", Impact, sans-serif`;
  const title = t('poster.title');
  let size = 92;
  while (ctx.measureText(title).width > W - 40 && size > 40) {
    size -= 4;
    ctx.font = `${size}px Anton, Impact, sans-serif`;
  }
  ctx.fillText(title, W / 2, 104);
  // erosión del título
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(233,228,214,${0.4 + r() * 0.6})`;
    ctx.fillRect(20 + r() * (W - 40), 20 + r() * 90, 1 + r() * 3, 1 + r() * 3);
  }
  ctx.fillStyle = '#141414';
  ctx.font = `24px Anton, Impact, sans-serif`;
  ctx.fillText(t('poster.subtitle'), W / 2, 142);

  // Grilla 3x2
  const cw = 136;
  const ch = 150;
  const gx = (W - cw * 3 - 24) / 2;
  GIRLS.forEach((g, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gx + col * (cw + 12);
    const y = 162 + row * (ch + 70);
    const look = o.lookIndex === i;
    const zoom = visits >= 2 && i === 3 ? 1 + Math.min(0.3, (visits - 1) * 0.08) : 1;
    ctx.save();
    if (visits >= 1 && i === (visits % 6)) {
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.rotate(0.03 * ((visits % 2) * 2 - 1));
      ctx.translate(-(x + cw / 2), -(y + ch / 2));
    }
    ctx.drawImage(portrait(i, look ? (o.lookX ?? 0) : 0, look ? (o.lookY ?? 0) : 0, zoom), x, y, cw, ch);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9b1016';
    ctx.font = 'bold 15px "Archivo Black", Arial, sans-serif';
    ctx.fillText(`${g.name.split(' ')[0]} / ${g.code}`, x, y + ch + 20);
    ctx.fillStyle = '#141414';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(`${t('poster.dob')}: ${g.dob}`, x, y + ch + 38);
    ctx.fillText(t('poster.missing'), x, y + ch + 55);
  });

  // Pie
  ctx.textAlign = 'center';
  ctx.fillStyle = '#141414';
  ctx.font = '20px Anton, Impact, sans-serif';
  ctx.fillText(t('poster.footer1'), W / 2, 612);
  ctx.fillText(t('poster.footer2'), W / 2, 638);
  ctx.fillStyle = '#b3121b';
  ctx.fillRect(0, 660, W, 64);
  ctx.fillStyle = '#f1ece0';
  ctx.font = '28px Anton, Impact, sans-serif';
  ctx.fillText(t('poster.call'), W / 2, 703);

  // Manchas (más con cada visita)
  const stains = 3 + Math.min(visits, 8) * 2;
  for (let i = 0; i < stains; i++) {
    const x = r() * W;
    const y = 150 + r() * 480;
    ctx.fillStyle = `rgba(110,60,30,${0.15 + r() * 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, 3 + r() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  if (visits >= 3) {
    const rr = rng(visits);
    for (let i = 0; i < Math.min(6, visits - 2); i++) bloodDrip(ctx, rr, 60 + rr() * 390, 150 + rr() * 60, 30 + rr() * 90, 2.5);
  }

  // Foto 7: TÚ / S07
  if (o.finished) {
    ctx.save();
    ctx.translate(W - 150, 520);
    ctx.rotate(0.12);
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(-6, -6, 132, 170);
    ctx.fillStyle = '#060606';
    ctx.fillRect(0, 0, 120, 120);
    // silueta de espaldas (la foto del jugador)
    ctx.fillStyle = '#1a1c1e';
    ctx.beginPath();
    ctx.ellipse(60, 50, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(22, 74, 76, 46);
    ctx.fillStyle = '#9b1016';
    ctx.font = 'bold 16px "Archivo Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('poster.you'), 60, 142);
    ctx.fillStyle = 'rgba(255,255,230,0.6)';
    ctx.fillRect(30, -14, 60, 16);
    ctx.restore();
  }
}

export function posterCanvas(o: PosterOpts = {}): HTMLCanvasElement {
  const [c, ctx] = canvas(POSTER_W, POSTER_H);
  drawPoster(ctx, o);
  return c;
}
