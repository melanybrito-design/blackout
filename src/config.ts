// Valores de "feel" del juego. Iterar aquí, no en la lógica.

export const RENDER = {
  /** Alto interno en píxeles (el ancho se deriva del aspecto de la ventana). */
  internalHeight: 270,
  internalHeightHigh: 360,
  /** Grilla de snapping de vértices en NDC (más bajo = más temblor). */
  vertexSnap: 150,
  /** Niveles de color por canal antes del dithering. */
  colorLevels: 28,
  grain: 0.07,
  vignette: 0.55,
  aberration: 0.6,
  fogColor: 0x1b2428,
  fogDensity: 0.085,
  fov: 72,
  maxDt: 0.1,
} as const;

export const PLAYER = {
  eyeHeight: 1.62,
  walkSpeed: 2.1,
  runSpeed: 4.2,
  mouseSensitivity: 0.0022,
} as const;
