// Diario-dossier (refs 03/05): overlay HTML con polaroids, cinta, letra a mano e hilo rojo.
// El mundo NO se pausa mientras está abierto.
import { ClueGraph, CONNECTIONS, type LinkResult } from '../narrative/ClueGraph';
import { GIRLS } from '../narrative/girls';
import { portraitCanvas } from '../textures/faces';
import { posterCanvas } from '../textures/poster';
import { canvas } from '../textures/canvas';
import { t } from '../i18n';
import { bus } from '../core/EventBus';
import type { AudioEngine } from '../audio/AudioEngine';

type Tab = 'clues' | 'people' | 'goal';

/** Posición de cada polaroid en el tablero (% del área) y rotación. */
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
  private drag: { from: string; line: SVGLineElement } | null = null;
  private knownPeople = new Set<string>(['lucia']);

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
  }

  // ---------- API ----------

  addClue(id: string, thumb?: HTMLCanvasElement): boolean {
    if (thumb) this.thumbs.set(id, thumb.toDataURL());
    const added = this.graph.add(id);
    if (this.isOpen) this.render();
    return added;
  }

  knowPerson(id: string): void {
    this.knownPeople.add(id);
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
    for (const id of this.graph.clues) {
      const [x, y, r] = LAYOUT[id] ?? [40, 40, 0];
      const p = document.createElement('div');
      p.className = 'jr-polaroid';
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
      const known = this.knownPeople.has(g.id);
      const img = portraitCanvas({ seed: g.seed, hair: g.hair, size: 96 }).toDataURL();
      return `<div class="jr-person ${known ? '' : 'unknown'}"><img src="${img}"/><b>${g.name} · ${g.code}</b><span>${
        known ? t(`people.${g.id}`) : t('people.unknown')
      }</span></div>`;
    }).join('')}</div>`;
  }

  private renderGoal(root: HTMLDivElement): void {
    root.innerHTML = `<div class="jr-goal"><div class="jr-goal-big">${t(this.goalKey)}</div>${this.deductions
      .map((d) => `<div class="jr-deduction">— ${t(d)}</div>`)
      .join('')}</div>`;
  }

  private center(id: string): [number, number] | null {
    const p = this.board.querySelector<HTMLDivElement>(`[data-id="${id}"]`);
    if (!p) return null;
    const br = this.board.getBoundingClientRect();
    const r = p.getBoundingClientRect();
    return [r.left + r.width / 2 - br.left, r.top + 18 - br.top];
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
    const br = this.board.getBoundingClientRect();
    this.drag.line.setAttribute('x2', String(e.clientX - br.left));
    this.drag.line.setAttribute('y2', String(e.clientY - br.top));
  }

  private onUp(e: MouseEvent): void {
    if (!this.drag) return;
    const target = (e.target as HTMLElement).closest?.('.jr-polaroid') as HTMLDivElement | null;
    const from = this.drag.from;
    const line = this.drag.line;
    this.drag = null;
    if (!target || target.dataset.id === from) {
      line.remove();
      return;
    }
    const r = this.graph.link(from, target.dataset.id!);
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
    } else {
      line.classList.add('snap');
      this.audio.play('snap');
      this.note.textContent = t('journal.wrong');
      setTimeout(() => line.remove(), 350);
    }
    this.onLink?.(r);
  }

  private cancelDrag(): void {
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
        ctx.drawImage(portraitCanvas({ seed: 2203, hair: 1, size: 64 }), 14, 28, 28, 32);
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
      case 'c6':
        ctx.drawImage(portraitCanvas({ seed: 4011, hair: 0, size: 96 }), 0, 0);
        break;
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
