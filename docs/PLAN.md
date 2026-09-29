# PLAN DE ACCIÓN — ÚLTIMA VEZ VISTAS (demo de 15 min, Three.js)

> Orden pensado para tener **algo jugable y que asuste lo antes posible** y después agregar capas.
> Cada fase termina con la "Definición de terminado" de `AGENTS.md §18`.
> Hazlas **en orden**; no empieces la siguiente sin cumplir los criterios de la anterior.

## Estado
| Fase | Estado |
|---|---|
| 0. Setup | ✅ |
| 1. Motor y look PS2 | ✅ (120 FPS, 55 draw calls) |
| 2. Jugador y nivel gris | ✅ |
| 3. Audio procedural | ✅ |
| 4. Celular | ✅ |
| 5. Diario + pistas + i18n | ✅ |
| 6. Grabadora + EVP | ✅ |
| 7. Director de Miedo + eventos menores | ✅ |
| 8. Entidades + screamers S1–S5 | ✅ |
| 9. Nivel final (arte procedural + gore) | ✅ (pendiente: assets Higgsfield) |
| 10. Menú afiche + meta-horror | ✅ |
| 11. Pulido, ritmo y playtest | 🟡 flujo completo verificado por simulación; falta playtest humano cronometrado |

---

## Fase 0 — Setup (≈30 min)
- `npm create vite@latest . -- --template vanilla-ts`, instalar `three @types/three gsap @fontsource/anton @fontsource/special-elite @fontsource/vt323 @fontsource/caveat`, `vitest eslint prettier`.
- Crear la estructura de carpetas de `AGENTS.md §5`, `src/config.ts`, `ASSETS_CREDITS.md` y `.gitignore`. Hacer `git init` con un commit inicial.
- `.claude/launch.json` para `npm run dev` (puerto 5173), para verificar en el Browser pane.
**Acepta si:** `npm run dev` muestra una escena vacía y `npm test` corre.

## Fase 1 — Motor y look PS2 (≈2 h)
- `core/Game.ts` (loop, dt limitado), `EventBus` tipado, `Input`, `StateMachine`.
- `render/`: render a target de 480×270 con upscale nearest, material con vertex snapping (`onBeforeCompile`), shader post combinado (cuantización + Bayer + grano + viñeta + aberración controlable), `FogExp2`.
- Escena de prueba: un pasillo de cubos con un fluorescente parpadeante.
- Overlay de debug (`?debug=1`).
**Acepta si:** la escena **ya se ve** como la ref. 01 (temblor de vértices, dithering, niebla) a ≥ 60 FPS.

## Fase 2 — Jugador y nivel en gris (≈3 h)
- `PlayerController`: Pointer Lock, WASD, correr con stamina, agacharse, cabeceo, colisiones AABB y pasos por superficie (evento).
- `world/LevelBuilder`: todo el mapa del guion en **blockout** (patio, hall, pasillo, 2°B, baño, pasillo largo, gimnasio) con puertas (abrir, trabada, con llave, con candado), triggers/zonas y checkpoints.
- `narrative/StoryState` con los flags del guion y saltos `?act=N`.
**Acepta si:** se recorre el colegio completo de punta a punta en ~3 min sin atravesar paredes.

## Fase 3 — Audio procedural (≈3 h)
- `AudioEngine` con buses, compresor, desbloqueo en el primer clic y HRTF.
- Sintetizadores: lluvia, zumbido fluorescente, drone de tensión (parámetro 0–1), pasos por superficie, respiración, latido, puertas y metal, stingers (3 variantes), ringtone de 2005, vibración y ducking de silencio.
**Acepta si:** con audífonos, un paso puesto detrás se percibe **detrás**, y el colegio "suena vivo" sin ningún archivo de audio.

## Fase 4 — Celular (≈4 h)
- Viewmodel de manos + celular de tapa (primitivas), animación de abrir/cerrar, linterna con cookie.
- Pantalla `CanvasTexture` (VT323): hora del juego, batería, SMS (bandeja + notificación + vibración) y galería.
- Modo cámara: render target secundario con la capa `SPECTRAL`, fotos que detectan pistas en cuadro (raycast/frustum) y galería navegable.
- Prólogo y Acto 1 jugables (SMS 1–2, huellas, credencial y foto de la pizarra).
**Acepta si:** las huellas solo se ven por el celular y fotografiar la pizarra crea la pista C3.

## Fase 5 — Diario, pistas e i18n (≈4 h)
- `i18n` con `t()`, `es.json`/`en.json`, test de claves idénticas y selector de idioma (regenera texturas con texto).
- `ClueGraph` (tests), `Journal` overlay HTML/CSS estilo refs 03/05: polaroids, cinta, letra a mano, hilo rojo SVG, pestañas Pistas/Personas/Objetivo. El mundo no se pausa.
- Conexión C1+C3 que abre la 2°B.
**Acepta si:** el Acto 1 se completa en ES y en EN solo con elementos del mundo (sin HUD).

## Fase 6 — Grabadora y EVP (≈3 h)
- Viewmodel de la mano izquierda con la grabadora, grabar 10 s / rebobinar / reproducir (con sonido mecánico), zonas EVP.
- EVP: síntesis formántica + subtítulo que se descifra; cassette 24/10; C4, C5 y la conexión C4+C5.
**Acepta si:** el Acto 2 es jugable y la psicofonía da escalofríos con audífonos.

## Fase 7 — Director de Miedo y eventos menores (≈4 h)
- `FearDirector` como lógica pura, con tests de: 90 s mínimos, 3 falsas alarmas, RELAX después de un mayor, ventana de disparo garantizada.
- Pool de eventos menores y medios conectados al audio, las luces y los props. Panel de debug con la tensión en vivo.
- Título de pestaña meta-horror (`visibilitychange`).
**Acepta si:** en 3 minutos de pasillo sin guion, los eventos se sienten orgánicos y no repetitivos.

## Fase 8 — Entidades y screamers S1–S5 (≈6 h) ★ fase crítica
- Modelo base de chica (primitivas/Quaternius CC0), uniforme y pelo, con movimiento "a saltos".
- Generador de rostros de screamer en canvas y shader de distorsión/glitch. Cámara con shake. Stingers.
- La Huella (Acto 1), La del Espejo (espejo por render target con delay circular), La que Imita (persecución con checkpoint), Lucía (final).
- Los 5 screamers siguiendo exactamente la anatomía de `AGENTS.md §11` y el guion.
- Opción "Reducir destellos".
**Acepta si:** jugando del minuto 0 al final, cada screamer ocurre una vez, en su acto, con su setup, y **ninguno se siente barato**.

## Fase 9 — Arte procedural del nivel y gore (≈5 h)
- Generadores de texturas en canvas: baldosas sucias, casilleros numerados, pizarra con tiza, dibujos infantiles, afiches, papel mojado, grafiti, sangre seca y goteos, óxido.
- Props: sillas y mesas (instanced), mochilas, guiones de teatro, lavamanos y cubículos, gimnasio con aros y sillas en círculo, figuras con bolsas.
- Iluminación por zona, lluvia en el patio (partículas) y gotas en ventanas.
**Acepta si:** capturas de pantalla de cada zona se sienten del mismo mundo que las refs 01 y 06.

## Fase 10 — Menú afiche y meta-horror (≈4 h)
- Aviso de fotosensibilidad/audífonos, que desbloquea el audio.
- Afiche 3D en la reja, lluvia, parallax y relámpagos. Fotos de las 6 chicas como "fotocopias degradadas" procedurales (no son personas reales). Menú de cinta, opciones, idioma y créditos.
- Ojos que siguen al cursor tras 20 s de inactividad, cambios sutiles en cada regreso y foto "TÚ / S07" después del final.
- Fake crash del post-final y pantalla de "FIN DE LA DEMO".
**Acepta si:** alguien que abre el juego por primera vez se queda mirando el menú antes de hacer clic.

## Fase 11 — Pulido y playtest (≈4 h)
- Jugar la demo completa 3 veces cronometrando: el objetivo es 13–17 min. Ajustar `config.ts`.
- Afinar volúmenes, pausa, opciones (sensibilidad, FOV, brillo con calibración) y guardado por checkpoint.
- Perfilar el rendimiento (draw calls < 150, sin GC en el loop) y `npm run build` final. Probar en Chrome, Safari y Firefox.
- Checklist: cero strings sin traducir, cero errores en consola, `ASSETS_CREDITS.md` completo.
**Acepta si:** la demo se juega de principio a fin en ES y EN sin bugs bloqueantes.

---

**Estimado total: ≈ 42 h de trabajo de Claude Code** en unas 11–15 sesiones. Conviene una sesión por fase, empezando cada una con el prompt de fase de `docs/PROMPT_INICIAL.md`.
