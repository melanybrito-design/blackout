// Diario-dossier (refs 03/05): overlay HTML con polaroids, cinta, letra a mano e hilo rojo.
// El mundo NO se pausa mientras está abierto.
import { ClueGraph, CONNECTIONS, type LinkResult } from '../narrative/ClueGraph';
import { GIRLS } from '../narrative/girls';
import { portraitCanvas } from '../textures/faces';
import { posterCanvas } from '../textures/poster';
import { canvas } from '../textures/canvas';
import { optionalImage } from '../textures/asset';
import { t } from '../i18n';
import { bus } from '../core/EventBus';
import type { AudioEngine } from '../audio/AudioEngine';

type Tab = 'clues' | 'people' | 'goal';

/** Posición de cada polaroid en el tablero (% del área) y rotación. */
const PEOPLE_KEY = 'uvv.people';

const LAYOUT: Record<string, [number, number, number]> = {
  c1: [6, 8, -4],
  c2: [36, 4, 3],
  c3: [68, 10, -2],
  c4: [8, 52, 5],
  c5: [38, 50, -3],
  c6: [66, 54, 4],
  c7: [52, 28, -6],
};

export class Journal {
  readonly graph = new ClueGraph();
  isOpen = false;
  available = true;
  goalKey = 'goal.enter';
  private tab: Tab = 'clues';
  private el: HTMLDivElement;
  private board!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private note!: HTMLDivElement;
  private deductions: string[] = [];
  private thumbs = new Map<string, string>();
  /** `sticky`: se eligió una pista con un clic y el hilo sigue al cursor hasta el segundo clic. */
  private drag: { from: string; line: SVGLineElement; sticky?: boolean } | null = null;
  /** Ficha de cada chica: las notas (claves i18n) que el jugador fue reuniendo sobre ella. */
  private people = new Map<string, string[]>([['lucia', ['people.lucia']]]);
  /** Fotos opcionales de Higgsfield para las miniaturas (si faltan, queda el dibujo procedural). */
  private photos = new Map<string, HTMLImageElement>();

  onOpenChange: ((open: boolean) => void) | null = null;
  onLink: ((r: LinkResult) => void) | null = null;

  constructor(private audio: AudioEngine) {
    this.el = document.createElement('div');
    this.el.className = 'journal hidden';
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') this.close();
    });
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    bus.on('lang:changed', () => this.isOpen && this.render());
    for (const [id, path] of [
      ['c2', 'characters/girl_daniela.png'],
      ['c6', 'characters/photo_lucia_print.png'],
    ] as const)
      optionalImage(path, (image) => {
        this.photos.set(id, image);
        this.thumbs.delete(id);
        if (this.isOpen) this.render();
      });
  }

  // ---------- API ----------

  addClue(id: string, thumb?: HTMLCanvasElement): boolean {
    if (thumb) this.thumbs.set(id, thumb.toDataURL());
    const added = this.graph.add(id);
    if (this.isOpen) this.render();
    return added;
  }

  /** Agrega una nota a la ficha de una chica. Devuelve true si era nueva. */
  knowPerson(id: string, note = `people.${id}`): boolean {
    const notes = this.people.get(id) ?? [];
    if (notes.includes(note)) return false;
    notes.push(note);
    this.people.set(id, notes);
    try {
      localStorage.setItem(PEOPLE_KEY, JSON.stringify([...this.people]));
    } catch {
      /* sin almacenamiento */
    }
    if (this.isOpen) this.render();
    return true;
  }

  /** Recupera las fichas de la partida guardada. */
  loadPeople(): void {
    try {
      const raw = localStorage.getItem(PEOPLE_KEY);
      if (raw) for (const [id, notes] of JSON.parse(raw) as Array<[string, string[]]>) this.people.set(id, notes);
    } catch {
      /* sin almacenamiento */
    }
  }

  setGoal(key: string): void {
    this.goalKey = key;
    if (this.isOpen) this.render();
  }

  /** Restaura conexiones (guardado). */
  restoreLink(a: string, b: string): void {
    const r = this.graph.link(a, b);
    if (r.ok) this.deductions.push(r.connection.deduction);
  }

  /** El personaje ata dos pistas por su cuenta (al intentar la puerta que esa deducción abre). */
  autoLink(a: string, b: string): boolean {
    const r = this.graph.link(a, b);
    if (!r.ok || !r.isNew) return false;
    this.deductions.push(r.connection.deduction);
    if (this.isOpen) this.render();
    this.onLink?.(r);
    return true;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (!this.available || this.isOpen) return;
    this.isOpen = true;
    this.audio.play('paper');
    this.render();
    this.el.classList.remove('hidden');
    document.exitPointerLock?.();
    this.onOpenChange?.(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.audio.play('paper');
    this.el.classList.add('hidden');
    this.cancelDrag();
    this.onOpenChange?.(false);
  }

  // ---------- Render ----------

  private render(): void {
    const tabs: Array<[Tab, string]> = [
      ['clues', t('journal.tab.clues')],
      ['people', t('journal.tab.people')],
      ['goal', t('journal.tab.goal')],
    ];
    this.el.innerHTML = `
      <div class="jr-book">
        <div class="jr-left">
          <div class="jr-title">${t('journal.title')}</div>
          <div class="jr-tabs">${tabs
            .map(([id, label]) => `<button data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${label}</button>`)
            .join('')}</div>
          <div class="jr-goal-mini">${t(this.goalKey)}</div>
          <div class="jr-help">${t('journal.help')}</div>
        </div>
        <div class="jr-right"></div>
        <div class="jr-clip jr-clip-a"></div><div class="jr-clip jr-clip-b"></div>
      </div>`;
    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        this.audio.play('paper');
        this.render();
      }),
    );
    const right = this.el.querySelector<HTMLDivElement>('.jr-right')!;
    if (this.tab === 'clues') this.renderClues(right);
    else if (this.tab === 'people') this.renderPeople(right);
    else this.renderGoal(right);
  }

  private renderClues(root: HTMLDivElement): void {
    root.innerHTML = `<div class="jr-board"><svg class="jr-strings"></svg></div><div class="jr-note"></div>`;
    this.board = root.querySelector('.jr-board')!;
    this.svg = root.querySelector('svg')!;
    this.note = root.querySelector('.jr-note')!;
    if (this.graph.clues.size === 0) {
      this.note.textContent = t('journal.empty');
      return;
    }
    // Las pistas que todavía pueden conectarse con otra laten suave: orientan sin resolver.
    const hot = new Set(this.graph.pending().flatMap((c) => [c.a, c.b]));
    this.board.addEventListener('mousedown', (e) => {
      if (e.target === this.board && this.drag?.sticky) this.cancelDrag();
    });
    for (const id of this.graph.clues) {
      const [x, y, r] = LAYOUT[id] ?? [40, 40, 0];
      const p = document.createElement('div');
      p.className = `jr-polaroid${hot.has(id) ? ' hot' : ''}`;
      p.dataset.id = id;
      p.style.left = `${x}%`;
      p.style.top = `${y}%`;
      p.style.setProperty('--r', `${r}deg`);
      p.innerHTML = `<img src="${this.thumb(id)}" draggable="false"/><span>${t(`clue.${id}.t`)}</span><i class="tape"></i>`;
      p.addEventListener('mouseenter', () => (this.note.textContent = t(`clue.${id}.d`)));
      p.addEventListener('mousedown', (e) => this.startDrag(id, e));
      this.board.appendChild(p);
    }
    requestAnimationFrame(() => this.drawStrings());
    if (this.deductions.length) this.note.textContent = t(this.deductions[this.deductions.length - 1]);
  }

  private renderPeople(root: HTMLDivElement): void {
    root.innerHTML = `<div class="jr-people">${GIRLS.map((g) => {
      const notes = this.people.get(g.id);
      const known = !!notes;
      const fallback = portraitCanvas({ seed: g.seed, hair: g.hair, size: 96 }).toDataURL();
      return `<div class="jr-person ${known ? '' : 'unknown'}"><img src="/assets/characters/girl_${g.id}.png" data-fallback="${fallback}"/><b>${g.name} · ${g.code}</b><span>${
        known ? notes.map((n) => t(n)).join('<br/>') : t('people.unknown')
      }</span></div>`;
    }).join('')}</div>`;
    root.querySelectorAll<HTMLImageElement>('img[data-fallback]').forEach((image) => {
      image.addEventListener('error', () => {
        image.src = image.dataset.fallback!;
      }, { once: true });
    });
  }

  private renderGoal(root: HTMLDivElement): void {
    root.innerHTML = `<div class="jr-goal"><div class="jr-goal-big">${t(this.goalKey)}</div>${this.deductions
      .map((d) => `<div class="jr-deduction">— ${t(d)}</div>`)
      .join('')}</div>`;
  }

  private center(id: string): [number, number] | null {
    const p = this.board.querySelector<HTMLDivElement>(`[data-id="${id}"]`);
    if (!p) return null;
    // Coordenadas de layout (no de pantalla): el libro está en perspectiva y entra animado.
    return [p.offsetLeft + p.offsetWidth / 2, p.offsetTop + p.offsetHeight * 0.1];
  }

  /** Punto de pantalla → coordenadas locales del tablero (que está inclinado en perspectiva). */
  private toBoard(e: MouseEvent): [number, number] {
    const br = this.board.getBoundingClientRect();
    return [
      ((e.clientX - br.left) / br.width) * this.board.clientWidth,
      ((e.clientY - br.top) / br.height) * this.board.clientHeight,
    ];
  }

  private drawStrings(): void {
    if (!this.svg) return;
    this.svg.querySelectorAll('line.fixed').forEach((l) => l.remove());
    for (const c of CONNECTIONS) {
      if (!this.graph.isLinked(c.a, c.b)) continue;
      const a = this.center(c.a);
      const b = this.center(c.b);
      if (!a || !b) continue;
      const line = this.line(a, b);
      line.classList.add('fixed');
      this.svg.appendChild(line);
    }
  }

  private line(a: [number, number], b: [number, number]): SVGLineElement {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', String(a[0]));
    l.setAttribute('y1', String(a[1]));
    l.setAttribute('x2', String(b[0]));
    l.setAttribute('y2', String(b[1]));
    return l;
  }

  // ---------- Arrastre de hilo ----------

  private startDrag(id: string, e: MouseEvent): void {
    e.preventDefault();
    // Segundo clic del modo "clic + clic": conectar con la pista elegida antes.
    if (this.drag?.sticky) {
      const { from, line } = this.drag;
      this.drag = null;
      this.board.querySelector('.sel')?.classList.remove('sel');
      if (id === from) line.remove();
      else this.tryLink(from, id, line);
      return;
    }
    const a = this.center(id);
    if (!a) return;
    const line = this.line(a, a);
    line.classList.add('temp');
    this.svg.appendChild(line);
    this.drag = { from: id, line };
    this.audio.play('pencil');
  }

  private onMove(e: MouseEvent): void {
    if (!this.drag) return;
    const [x, y] = this.toBoard(e);
    this.drag.line.setAttribute('x2', String(x));
    this.drag.line.setAttribute('y2', String(y));
  }

  private onUp(e: MouseEvent): void {
    if (!this.drag) return;
    const target = (e.target as HTMLElement).closest?.('.jr-polaroid') as HTMLDivElement | null;
    if (this.drag.sticky) return;
    const from = this.drag.from;
    const line = this.drag.line;
    if (target?.dataset.id === from) {
      // Soltó sobre la misma pista: queda elegida y el hilo espera el clic en la otra.
      this.drag.sticky = true;
      target.classList.add('sel');
      this.note.textContent = t('journal.pick');
      return;
    }
    this.drag = null;
    if (!target) {
      line.remove();
      return;
    }
    this.tryLink(from, target.dataset.id!, line);
  }

  private tryLink(from: string, to: string, line: SVGLineElement): void {
    const r = this.graph.link(from, to);
    if (r.ok) {
      line.remove();
      if (r.isNew) {
        this.deductions.push(r.connection.deduction);
        this.audio.play('pencil');
      }
      this.note.textContent = t(r.connection.deduction);
      this.note.classList.remove('flash');
      void this.note.offsetWidth;
      this.note.classList.add('flash');
      this.drawStrings();
      const still = new Set(this.graph.pending().flatMap((c) => [c.a, c.b]));
      this.board.querySelectorAll<HTMLDivElement>('.jr-polaroid').forEach((p) => p.classList.toggle('hot', still.has(p.dataset.id!)));
    } else {
      line.classList.add('snap');
      this.audio.play('snap');
      this.note.textContent = t('journal.wrong');
      setTimeout(() => line.remove(), 350);
    }
    this.onLink?.(r);
  }

  private cancelDrag(): void {
    this.board?.querySelector('.sel')?.classList.remove('sel');
    this.drag?.line.remove();
    this.drag = null;
  }

  // ---------- Miniaturas ----------

  private thumb(id: string): string {
    const cached = this.thumbs.get(id);
    if (cached) return cached;
    const [c, ctx] = canvas(96, 96);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, 96, 96);
    switch (id) {
      case 'c1':
        ctx.drawImage(posterCanvas(), 14, 0, 68, 96);
        break;
      case 'c2':
        ctx.fillStyle = '#6f8fa3';
        ctx.fillRect(0, 0, 96, 96);
        ctx.fillStyle = '#d9e4ea';
        ctx.fillRect(10, 22, 76, 50);
        ctx.drawImage(this.photos.get('c2') ?? portraitCanvas({ seed: 2203, hair: 1, size: 64 }), 14, 28, 28, 32);
        ctx.fillStyle = '#333';
        for (let i = 0; i < 4; i++) ctx.fillRect(48, 32 + i * 8, 30 - i * 4, 3);
        ctx.fillStyle = 'rgba(70,50,20,0.5)';
        ctx.fillRect(10, 60, 76, 12);
        break;
      case 'c4':
        ctx.fillStyle = '#2b2b2e';
        ctx.fillRect(8, 26, 80, 48);
        ctx.fillStyle = '#d8d0b6';
        ctx.fillRect(16, 32, 64, 22);
        ctx.fillStyle = '#222';
        ctx.font = '14px Caveat';
        ctx.fillText('24/10', 34, 48);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(34, 62, 6, 0, 7);
        ctx.arc(62, 62, 6, 0, 7);
        ctx.fill();
        break;
      case 'c5':
        ctx.strokeStyle = '#9fdcaa';
        ctx.beginPath();
        for (let x = 0; x < 96; x++) {
          const a = x > 40 && x < 70 ? 26 : 5;
          ctx.lineTo(x, 48 + Math.sin(x * 0.9) * a * Math.random());
        }
        ctx.stroke();
        break;
      case 'c6': {
        const photo = this.photos.get('c6');
        if (photo) {
          // recorte cuadrado centrado en Lucía
          const side = photo.naturalHeight;
          ctx.drawImage(photo, (photo.naturalWidth - side) * 0.62, 0, side, side, 0, 0, 96, 96);
        } else ctx.drawImage(portraitCanvas({ seed: 4011, hair: 0, size: 96 }), 0, 0);
        break;
      }
      case 'c3':
      case 'c7':
        ctx.fillStyle = '#9fdcaa';
        ctx.font = '22px Caveat';
        ctx.fillText(id === 'c3' ? '21:00' : '6-3-1', 18, 56);
        break;
    }
    const url = c.toDataURL();
    this.thumbs.set(id, url);
    return url;
  }
}
