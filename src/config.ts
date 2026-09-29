// Valores de "feel" del juego. Iterar aquí, no en la lógica.

export const RENDER = {
  /** Alto interno en píxeles (el ancho se deriva del aspecto de la ventana). */
  internalHeight: 360,
  internalHeightHigh: 540,
  /** Grilla de snapping de vértices en NDC (más bajo = más temblor). */
  vertexSnap: 230,
  /** Niveles de color por canal antes del dithering. */
  colorLevels: 40,
  grain: 0.055,
  vignette: 0.55,
  aberration: 0.5,
  fogColor: 0x10171a,
  fogDensity: 0.085,
  fov: 72,
  maxDt: 0.1,
} as const;

export const PLAYER = {
  eyeHeight: 1.62,
  crouchEyeHeight: 1.0,
  radius: 0.3,
  walkSpeed: 2.1,
  runSpeed: 4.0,
  crouchSpeed: 1.0,
  stamina: 5,
  staminaRegen: 0.7,
  mouseSensitivity: 0.0022,
  stepLength: 0.72,
  interactRange: 1.9,
} as const;

export const DIRECTOR = {
  /** Segundos mínimos entre screamers mayores. */
  majorCooldown: 90,
  /** Falsas alarmas mínimas entre mayores. */
  fakeOutsBetweenMajors: 3,
  relaxMin: 25,
  relaxMax: 40,
  minorMin: 20,
  minorMax: 45,
  mediumMin: 60,
  mediumMax: 120,
  /** Quieto más de esto = guardia baja. */
  lowGuardStill: 4,
  /** Si un mayor espera más que esto, se fuerza en la siguiente oportunidad. */
  majorMaxWait: 35,
  silenceMin: 1.5,
  silenceMax: 3,
} as const;

export const CHASE = {
  /** Velocidad del jugador sobre la cual la que Imita avanza. */
  moveThreshold: 1.25,
  walkFactor: 1.55,
  runFactor: 1.75,
  catchDistance: 1.1,
  startGap: 16,
} as const;

export const TIMING = {
  /** Hora de juego inicial en minutos desde medianoche (20:58). */
  clockStart: 20 * 60 + 58,
  /** Segundos reales por minuto de juego. */
  secondsPerGameMinute: 60,
} as const;
