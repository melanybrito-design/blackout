// Teclado + mouse con Pointer Lock. Los deltas del mouse y la rueda se acumulan por frame.

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /** Si es false, se ignoran teclas de juego (menús HTML abiertos). */
  enabled = true;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const code = `Mouse${e.button}`;
      this.pressed.add(code);
      this.down.add(code);
    });
    document.addEventListener('mouseup', (e) => this.down.delete(`Mouse${e.button}`));
    document.addEventListener('wheel', (e) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.target;
      if (!this.locked) {
        this.down.delete('Mouse0');
        this.down.delete('Mouse2');
      }
    });
  }

  requestLock(): void {
    try {
      const p = this.target.requestPointerLock?.() as unknown as Promise<void> | undefined;
      p?.catch?.(() => undefined);
    } catch {
      /* el navegador puede rechazarlo sin gesto */
    }
  }

  isDown(code: string): boolean {
    return this.enabled && this.down.has(code);
  }

  /** true solo en el frame en que se presionó la tecla. */
  wasPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code);
  }

  /** Para herramientas de depuración: ignora `enabled`. */
  rawPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Llamar al final de cada frame. */
  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
