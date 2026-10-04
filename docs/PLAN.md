# PLAN DE ACCIÓN — BLACKOUT (demo de 15 min, Three.js)

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
| 9. Nivel final (arte procedural + gore) | ✅ (assets Higgsfield integrados con respaldo procedural) |
| 10. Menú afiche + meta-horror | ✅ |
| 11. Pulido, ritmo y playtest | 🟡 flujo completo verificado por simulación (30/09: partida nueva → final, 5/5 screamers, todas las puertas); falta playtest humano cronometrado |

### Revisión del 30/09/2026 (integración de assets de Higgsfield)
- **Jugado de punta a punta** con entrada simulada (`?debug=1&nopause&mute&cp=new`): portón, 2°B, casillero 17, baño, puerta atascada y candado 6-3-1 abren; S1–S5 se disparan una vez cada uno.
- **Bugs corregidos:** rostro del screamer pegado tras ser atrapado en la persecución · S3 (y con él el resto de la demo) se perdía si S2 saltaba dentro del baño · Lucía ya estaba de frente y nunca "se daba vuelta" · el video del final se borraba al dibujar el falso crash · videos de susto aplastados (16:9 en plano cuadrado) y el de Lucía arrancaba en la cara tranquila · hilos rojos del diario mal ubicados mientras el libro entra animado · la foto de Lucía quedaba dentro de la pared del casillero · Renata y Ana Paula nunca se revelaban en "Personas".
- **Assets integrados:** recortes derivados con `scripts/derive_higgsfield_assets.py` (páginas de la libreta, corcho, marco polaroid con ventana transparente, tira de cinta, puertas, casillero, parquet, grietas del espejo, foto impresa de Lucía); menú con la calle bajo la lluvia detrás de una malla fina; fondo de pantalla del celular; pizarra; caras de los modelos 3D.
- **Pendiente:** playtest humano con audífonos (ritmo y volúmenes), draw calls del patio (~330, sobre el objetivo de 150 aunque a 100+ FPS), prueba en Safari y Firefox.

### Revisión del 01/10/2026 (jugabilidad e historia, pedido de quien juega)
Al probarlo, el juego no se entendía: solo se podía caminar y nada respondía. Decisiones nuevas (ganan sobre AGENTS.md §2 y §19 donde choquen):
- **Prólogo narrado** (`ui/Intro.ts`) antes de la partida nueva: qué pasó con las seis, quién es Lucía, quién eres tú, el SMS, y una tarjeta de controles. Se puede saltar.
- **Puntero siempre visible** con la acción disponible junto a él («[E] Abrir / Leer / Examinar / Recoger»).
- **Manos siempre visibles** (`player/Hands.ts`); la derecha se estira al interactuar.
- **Sin instrucciones paso a paso.** La guía es interna: pensamientos del personaje al examinar y al entrar a cada zona, SMS de Lucía repetidos en pantalla al leerlos, puertas que se sacuden y explican por qué no abren. Cada tecla se recuerda **una sola vez** cuando su herramienta entra en juego; si el jugador pasa ~50 s sin avanzar, el personaje piensa en voz alta (`stuck.*`).
- **Colegio examinable:** ~25 objetos con texto, cuatro documentos legibles (`ui/Document.ts`: comunicado, cuaderno de Isabel, guion de «La Última Función», lista de asistencia), cubículos del baño que se abren.
- **Fichas de las seis chicas:** cada pertenencia encontrada suma una línea a su ficha en «Personas» (se guarda en `uvv.people`).
- **Diario:** las pistas conectables laten; se unen con clic + clic (además de arrastrar).
- **Celular sin clic derecho obligatorio:** [Q] fija la cámara, [Espacio] dispara, [←][→] pasan fotos; la galería abre en la foto más nueva.
- El objetivo aparece al cambiar y se desvanece; queda en el diario.

### Revisión del 01/10/2026, segunda pasada (el juego no avanzaba para quien lo jugaba)
- **[E] siempre hace avanzar la historia.** La cámara y el diario siguen funcionando a mano, pero ya no son obligatorios: al insistir en la 2°B el personaje fotografía la pizarra por la ventanita y luego ata las pistas; el casillero 17 se abre si ya se tienen el cassette y la psicofonía; [E] en el espejo lo mira con la cámara; la grabadora, una vez en la mano, reproduce → graba la sala → rebobina sola; el candado se autocompleta con la foto del espejo.
- **Sin esperas muertas:** S2, S3 y S4 se fuerzan cuando la historia los necesita (antes había hasta 90 s sin nada). `DIRECTOR`: cooldown 45 s, 2 falsas alarmas, respiro 10–16 s. Esto reemplaza la regla de 90 s de AGENTS.md §10.
- **Tres salas nuevas para explorar** en el primer piso, abiertas con [E]: sala de profesores, laboratorio y portería, con documentos (nómina, libro de actas, cuaderno de Ana Paula, bitácora del portero) y objetos examinables.
- **Manos:** solo se ven al bajar la mirada (y al estirarse para usar algo). **Tipografía:** una sola en toda la interfaz (Special Elite, la del inicio); Caveat queda solo en la tiza de la pizarra.
- Verificado con un recorrido «solo WASD + E» de partida nueva a final: 5/5 sustos, ~3,5 min de simulación sin explorar.

### Revisión del 01/10/2026, tercera pasada (menos trabas, más miedo)
- **`decal_blood_drag.png` no se usa:** Higgsfield devolvió la foto de una mano y quedaba estirada en el piso del pasillo. Las marcas de arrastre vuelven a ser las de código. Conviene regenerar ese asset.
- **La 2°B ya no está trabada** (se abre con [E]). La pizarra da su pista al examinarla y las deducciones se hacen solas al conseguir las pistas; el diario queda como registro.
- **S1 garantizado y temprano:** al recoger la credencial (o al entrar a la 2°B) aparece «1 foto nueva» y a los ~9 s el rostro llena el celular, lo mire o no.
- **Sustos de exploración** (una vez cada uno): figura al fondo del pasillo al entrar + tubo que revienta; La Huella (Daniela) visible solo por la cámara, que salta hacia ti; portazo de la 2°B durante el cassette; apagón y figura en el sillón (profesores); frasco que estalla y figura en la puerta (laboratorio); portazo, apagón, risas y figura en el rincón (portería); golpe en el cubículo del baño.
- **Falsas alarmas más seguidas:** menores cada 12–26 s, medias cada 35–70 s.
- **Persecución:** cada captura la vuelve más lenta (tras dos, caminar alcanza). La puerta atascada se puede forzar siempre.

### Revisión del 01/10/2026, cuarta pasada (los niveles son los pisos)
Reemplaza el mapa de un solo piso de AGENTS.md / GUION_DEMO.md:
| Nivel | Piso | Qué hay | Cómo se pasa |
|---|---|---|---|
| 1 · Las huellas | Primer piso | hall, casilleros, 2°B, sala de profesores | grabadora → psicofonía → casillero 17 → **llave de la reja de la escalera** (S1, S2) |
| 2 · Los espejos | Segundo piso | laboratorio, baño de mujeres | foto del espejo → S3 → **cae la cadena de la reja al piso 3** |
| 3 · La última función | Tercer piso | cuarto de servicio, pasillo largo, gimnasio | apagón y llamada (S4) → persecución → candado 6-3-1 → S5 |
- **Implementación:** el pasillo principal se corta con dos cajas de escalera (`FLOOR_WALLS` en `world/School.ts`); cada tramo es un piso. [E] en la escalera funde a negro y te deja en el otro piso con el cartel de nivel (`Script.climb/arrive`, `Hud.level`). Se puede volver a bajar, salvo durante la persecución.
- La llave del casillero 17 ahora abre la reja de la escalera (el baño ya no tiene llave). S4 se dispara al avanzar por el pasillo largo del tercer piso; «La que Imita» sale de la escalera.
- La interacción ignora lo que queda a la espalda del jugador.
- Verificado: partida nueva → final pasando los tres niveles, 5/5 sustos, rejas cerradas antes de tiempo, subir y bajar.

### Revisión del 04/10/2026 (screamers)
- **El rostro ya no es una imagen pegada.** `horror/ScreamerOverlay.ts` es un shader a pantalla completa: corte a negro y el rostro sale de la oscuridad hacia la cámara (embestida en ~0,14 s), recortado en óvalo difuso, con franjas rasgadas, saltos de cuadro, separación de color, grano y parpadeo. Los videos y las imágenes de Higgsfield pasan por el mismo efecto. El destello de entrada respeta «Reducir destellos».
- Durante un susto o un corte a negro se oculta toda la interfaz; el negro queda encima del polvo y la lluvia.
- Bebedero del pasillo rehecho y cubiertas del laboratorio en un tono que no se quema con la linterna.

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
