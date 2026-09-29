// Rostros procedurales. Nunca son personas reales.
// - portrait(): retrato "fotocopia" en B/N para el afiche y el diario.
// - screamerFace(): rostro deformado para los sustos (gore moderado).
import { canvas, bloodDrip } from './canvas';
import { rng } from './rng';

export interface PortraitOpts {
  seed: number;
  /** 0 = normal, 1 = monstruoso. */
  scary?: number;
  /** Desplazamiento de las pupilas (-1..1) para "mirar al cursor". */
  lookX?: number;
  lookY?: number;
  /** Peinado: 0 flequillo recto, 1 raya al medio, 2 cola. */
  hair?: number;
  size?: number;
}

/** Dibuja un rostro en el contexto (fondo incluido). */
export function drawFace(ctx: CanvasRenderingContext2D, o: PortraitOpts, S: number): void {
  const r = rng(o.seed);
  const scary = o.scary ?? 0;
  const cx = S / 2 + (r() - 0.5) * S * 0.04;
  const cy = S * 0.5;
  const fw = S * (0.26 + r() * 0.03);
  const fh = S * (0.34 + r() * 0.03) * (1 + scary * 0.12);
  const hair = o.hair ?? Math.floor(r() * 3);

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, scary ? '#050505' : '#8e8e8e');
  bg.addColorStop(1, scary ? '#000' : '#5f5f5f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Pelo trasero (largo)
  ctx.fillStyle = '#0d0b0b';
  ctx.beginPath();
  ctx.ellipse(cx, cy - fh * 0.15, fw * 1.35, fh * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hair !== 2) ctx.fillRect(cx - fw * 1.35, cy - fh * 0.1, fw * 2.7, S);

  // Cuello + hombros (uniforme)
  ctx.fillStyle = scary ? '#b9b3a8' : '#c9beb2';
  ctx.fillRect(cx - fw * 0.38, cy + fh * 0.7, fw * 0.76, fh * 0.6);
  ctx.fillStyle = '#e9e6df';
  ctx.beginPath();
  ctx.moveTo(cx - fw * 2.2, S);
  ctx.lineTo(cx - fw * 0.6, cy + fh * 1.1);
  ctx.lineTo(cx + fw * 0.6, cy + fh * 1.1);
  ctx.lineTo(cx + fw * 2.2, S);
  ctx.fill();
  ctx.fillStyle = '#1c2233';
  ctx.beginPath();
  ctx.moveTo(cx - fw * 2.2, S);
  ctx.lineTo(cx - fw * 1.0, cy + fh * 1.2);
  ctx.lineTo(cx - fw * 0.3, S);
  ctx.moveTo(cx + fw * 2.2, S);
  ctx.lineTo(cx + fw * 1.0, cy + fh * 1.2);
  ctx.lineTo(cx + fw * 0.3, S);
  ctx.fill();

  // Cara
  const skin = ctx.createRadialGradient(cx - fw * 0.3, cy - fh * 0.3, fw * 0.2, cx, cy, fh * 1.1);
  if (scary) {
    skin.addColorStop(0, '#d9d6cf');
    skin.addColorStop(0.7, '#9d978d');
    skin.addColorStop(1, '#4a4640');
  } else {
    skin.addColorStop(0, '#efe3d8');
    skin.addColorStop(0.75, '#c9b3a3');
    skin.addColorStop(1, '#8a7466');
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, fw, fh, 0, 0, Math.PI * 2);
  ctx.fill();
  // mandíbula
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.95, cy + fh * 0.1);
  ctx.quadraticCurveTo(cx, cy + fh * (1.25 + scary * 0.4), cx + fw * 0.95, cy + fh * 0.1);
  ctx.fill();

  const eyeY = cy - fh * 0.08;
  const eyeDX = fw * 0.42;
  const lookX = (o.lookX ?? 0) * fw * 0.06;
  const lookY = (o.lookY ?? 0) * fw * 0.04;

  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDX;
    const size = fw * (0.2 + (scary ? (side > 0 ? 0.12 : 0.04) : 0));
    if (scary) {
      // Cuencas negras desiguales
      const g = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, size * 2);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(30,10,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, size * 2, size * 1.6, side * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f1e8';
      ctx.beginPath();
      ctx.arc(ex + lookX + side * size * 0.2, eyeY + lookY, Math.max(1, size * 0.14), 0, Math.PI * 2);
      ctx.fill();
      // lágrimas de sangre
      bloodDrip(ctx, r, ex + (r() - 0.5) * size, eyeY + size * 1.2, fh * (0.5 + r() * 0.6), Math.max(1.5, S / 110));
    } else {
      // sombra de párpado
      ctx.fillStyle = 'rgba(90,60,50,0.35)';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY - size * 0.2, size * 1.35, size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2eee6';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, size * 1.1, size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a120e';
      ctx.beginPath();
      ctx.arc(ex + lookX, eyeY + lookY, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(ex - size * 1.15, eyeY - size * 0.6, size * 2.3, Math.max(1, size * 0.22));
    }
    // cejas
    ctx.strokeStyle = '#1b1411';
    ctx.lineWidth = Math.max(1, S / 90);
    ctx.beginPath();
    ctx.moveTo(ex - size * 1.2, eyeY - size * (1.4 + scary * 0.6));
    ctx.quadraticCurveTo(ex, eyeY - size * (1.9 + (scary ? side * 0.5 : 0)), ex + size * 1.2, eyeY - size * 1.3);
    ctx.stroke();
  }

  // Nariz
  ctx.strokeStyle = 'rgba(80,55,45,0.55)';
  ctx.lineWidth = Math.max(1, S / 140);
  ctx.beginPath();
  ctx.moveTo(cx - fw * 0.02, eyeY + fh * 0.12);
  ctx.lineTo(cx - fw * 0.08, cy + fh * 0.28);
  ctx.lineTo(cx + fw * 0.08, cy + fh * 0.3);
  ctx.stroke();

  // Boca
  const my = cy + fh * 0.52;
  if (scary) {
    const mw = fw * (0.45 + scary * 0.35);
    const mh = fh * (0.25 + scary * 0.45);
    ctx.fillStyle = '#050000';
    ctx.beginPath();
    ctx.moveTo(cx - mw, my);
    ctx.quadraticCurveTo(cx, my - mh * 0.35, cx + mw, my);
    ctx.quadraticCurveTo(cx, my + mh * 1.6, cx - mw, my);
    ctx.fill();
    // comisuras rasgadas
    ctx.strokeStyle = '#3a0508';
    ctx.lineWidth = Math.max(1, S / 100);
    ctx.beginPath();
    ctx.moveTo(cx - mw, my);
    ctx.lineTo(cx - mw - fw * 0.25, my - fh * 0.12);
    ctx.moveTo(cx + mw, my);
    ctx.lineTo(cx + mw + fw * 0.25, my - fh * 0.12);
    ctx.stroke();
    // dientes
    ctx.fillStyle = '#cfc6b0';
    for (let i = -3; i <= 3; i++) {
      const tx = cx + i * mw * 0.24;
      ctx.beginPath();
      ctx.moveTo(tx - mw * 0.08, my + mh * 0.05);
      ctx.lineTo(tx, my + mh * (0.28 + r() * 0.2));
      ctx.lineTo(tx + mw * 0.08, my + mh * 0.05);
      ctx.fill();
    }
    bloodDrip(ctx, r, cx - mw * 0.5, my + mh * 1.1, fh * 0.5, S / 90);
  } else {
    ctx.fillStyle = '#8a4b4b';
    ctx.beginPath();
    ctx.ellipse(cx, my, fw * 0.28, fh * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2020';
    ctx.lineWidth = Math.max(1, S / 160);
    ctx.beginPath();
    ctx.moveTo(cx - fw * 0.27, my);
    ctx.quadraticCurveTo(cx, my + fh * 0.02, cx + fw * 0.27, my);
    ctx.stroke();
  }

  // Pelo delantero
  ctx.fillStyle = '#0d0b0b';
  if (hair === 0) {
    ctx.beginPath();
    ctx.ellipse(cx, cy - fh * 0.62, fw * 1.12, fh * 0.52, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - fw * 1.05, cy - fh * 0.66, fw * 2.1, fh * 0.34);
  } else {
    ctx.beginPath();
    ctx.moveTo(cx, cy - fh * 1.05);
    ctx.quadraticCurveTo(cx - fw * 1.3, cy - fh * 0.9, cx - fw * 1.05, cy + fh * 0.9);
    ctx.lineTo(cx - fw * 0.8, cy + fh * 0.9);
    ctx.quadraticCurveTo(cx - fw * 0.9, cy - fh * 0.6, cx, cy - fh * 0.85);
    ctx.quadraticCurveTo(cx + fw * 0.9, cy - fh * 0.6, cx + fw * 0.8, cy + fh * 0.9);
    ctx.lineTo(cx + fw * 1.05, cy + fh * 0.9);
    ctx.quadraticCurveTo(cx + fw * 1.3, cy - fh * 0.9, cx, cy - fh * 1.05);
    ctx.fill();
  }
  // mechones sueltos
  ctx.strokeStyle = '#0d0b0b';
  ctx.lineWidth = Math.max(1, S / 200);
  for (let i = 0; i < 18 + scary * 30; i++) {
    const sx = cx + (r() - 0.5) * fw * 2.2;
    ctx.beginPath();
    ctx.moveTo(sx, cy - fh * 0.9);
    ctx.bezierCurveTo(sx + (r() - 0.5) * fw, cy, sx + (r() - 0.5) * fw, cy + fh * 0.5, sx + (r() - 0.5) * fw * 0.8, cy + fh * (0.6 + r() * scary));
    ctx.stroke();
  }
}

/** Efecto fotocopia: escala de grises, contraste alto, tramado y ruido. */
export function photocopy(ctx: CanvasRenderingContext2D, S: number, seed: number, strength = 1): void {
  const r = rng(seed + 7);
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % S;
    const py = Math.floor(i / 4 / S);
    let v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    v = (v - 128) * (1 + 0.6 * strength) + 128;
    const dot = ((px % 3) + (py % 3)) / 4 - 0.5;
    v += dot * 26 * strength + (r() - 0.5) * 40 * strength;
    v = Math.max(0, Math.min(255, v));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  // rayas de tóner
  for (let i = 0; i < 3 * strength; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`;
    ctx.fillRect(r() * S, 0, 1 + r() * 2, S);
  }
}

export function portraitCanvas(o: PortraitOpts): HTMLCanvasElement {
  const S = o.size ?? 128;
  const [c, ctx] = canvas(S, S);
  drawFace(ctx, o, S);
  photocopy(ctx, S, o.seed, 0.8);
  return c;
}

export function screamerCanvas(seed: number, size = 256): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  drawFace(ctx, { seed, scary: 1, hair: 1 }, size);
  // desaturar y ensuciar
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] * 0.35 + img.data[i + 1] * 0.5 + img.data[i + 2] * 0.15;
    const red = img.data[i] > img.data[i + 1] * 2.2;
    if (!red) img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 0.95;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
