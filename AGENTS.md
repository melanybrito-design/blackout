# AGENTS.md — BLACKOUT (antes «Última vez vistas / Last Seen»)

> Documento maestro para Claude Code. Léelo completo antes de escribir código.
> Si algo de este documento contradice una petición del usuario en el chat, gana el usuario.
> Documentos complementarios: `docs/GUION_DEMO.md` (guion minuto a minuto + textos ES/EN),
> `docs/PLAN.md` (fases y criterios de aceptación), `docs/PROMPT_INICIAL.md` (prompts por fase),
> `docs/referencias/` (6 imágenes de referencia visual).

---

## 1. Visión

**Horror psicológico de investigación en primera persona, estética PS2, que corre en el navegador.**

Seis chicas desaparecieron en el **Colegio San Aurelio** el **24 de octubre de 2024 a las 21:00**. Una de
ellas era **Lucía Ríos**, la hermana menor de quien juega. Un año después, en la noche del aniversario,
llega un SMS desde el número de Lucía: *"sigo en el colegio. ven. no traigas a nadie."* Entras a las 21:00.

El personaje jugable **no tiene nombre ni género definido**: todos los textos le hablan en segunda persona y con formas neutras (en ES y en EN).

**Demo: 15 minutos** (±2), lineal con exploración ligera, 1 ala del colegio, final en cliffhanger.

La pregunta central que el jugador debe sentir todo el tiempo:
**¿los mensajes los escribe mi hermana… o la cosa que se la llevó?**

## 2. Pilares de diseño (en orden de prioridad)

1. **Miedo real, no barato.** Tensión sostenida > sustos. Cada screamer se gana con anticipación y silencio.
2. **Inmersión total.** Nada de HUD flotante. Toda la información vive en objetos del mundo (celular, diario, grabadora).
3. **Tus herramientas te traicionan.** El jugador confía en sus 3 objetos; los sustos más fuertes salen de ellos.
4. **Lo que no se ve.** Niebla, baja resolución, oscuridad y sonido fuera de cámara hacen el trabajo.
5. **Pulido > cantidad.** 15 minutos impecables valen más que 40 mediocres.

## 3. Referencias visuales (`docs/referencias/`)

| Archivo | Qué tomar |
|---|---|
| `01-guarida-ps2-celular.jpg` | Estética PS2/low-poly, niebla volumétrica azulada, manos visibles sosteniendo un celular de tapa, CRTs verdes. |
| `02-afiche-desaparecidas.jpg` | Afiche "DESAPARECIDAS": tipografía grotesca roja, fotos B/N en grilla, collage grunge, cinta, códigos de barra. **Base del menú.** |
| `03-diario-pistas.jpg` y `05-dossier.jpg` | Diario físico con polaroids, clips, cinta adhesiva, notas a mano. **Base de la UI del diario.** |
| `04-manos-mesa-mapa.jpg` | Mapa de relaciones dibujado a mano con flechas; conexiones entre pistas. |
| `06-reporte-anomalias.jpg` | Tipografía monoespaciada, tono CCTV frío, cartel de alerta amarillo. Inspira la regla de anomalías y los textos del celular. |

**Todas las personas del juego son ficticias.** Nunca uses rostros, nombres ni fotos de personas reales.

## 4. Stack técnico

- **Lenguaje:** TypeScript (modo `strict`), ES modules.
- **Build/dev:** Vite (última estable). `npm run dev`, `npm run build`, `npm run preview`.
- **3D:** `three` (última estable) + addons de `three/examples/jsm` (`EffectComposer`, `RenderPass`, `ShaderPass`, `PointerLockControls` o controlador propio, `GLTFLoader`).
- **Animación/tweens:** `gsap` (gratuito) o `@tweenjs/tween.js`.
- **Colisiones:** propias con AABB/cápsula contra cajas del nivel. Si hace falta más precisión: `three-mesh-bvh`.
- **Audio:** **Web Audio API nativa** (sin Howler salvo que sea imprescindible). `PannerNode` con `panningModel: 'HRTF'`.
- **Fuentes:** paquetes `@fontsource/*` (OFL, empaquetadas offline): `Anton` o `Archivo Black` (titulares del afiche), `Special Elite` (máquina de escribir/diario), `VT323` (pantalla del celular), `Caveat` o `Permanent Marker` (letra a mano).
- **Tests:** `vitest` para lógica pura (Director de Miedo, i18n, grafo de pistas, guardado).
- **Sin frameworks de UI** (nada de React/Vue). Las capas 2D son HTML/CSS mínimo + Canvas.

### Política de assets (OBLIGATORIA)
- **Preferencia 1: generado por código.** Geometría con primitivas de three, texturas con `CanvasTexture` (baldosas, casilleros, grafitis, papel, sangre, afiches, rostros degradados), audio sintetizado con Web Audio.
- **Preferencia 2: librerías gratuitas CC0.** Solo: Kenney.nl, Quaternius, Poly Haven, ambientCG, Freesound **solo con licencia CC0**. Registrar cada asset externo en `ASSETS_CREDITS.md` (nombre, URL, licencia).
- **Preferencia 3 (decisión del usuario, 28/09/2026):** imágenes y videos que el usuario genera en **Higgsfield** para este proyecto, según `docs/PROMPTS_HIGGSFIELD.md`. Van en `public/assets/` con los nombres exactos del documento. Todo asset debe tener un **fallback procedural** si falta el archivo.
- **Prohibido:** assets con licencia no libre, ripeados de otros juegos, o rostros de personas reales.
- Presupuesto total del build: **< 40 MB**.

## 5. Arquitectura y estructura de carpetas

```
gaming_architecture/
├── AGENTS.md / CLAUDE.md / ASSETS_CREDITS.md
├── docs/                      # GUION_DEMO, PLAN, PROMPT_INICIAL, referencias/
├── public/assets/             # modelos/texturas/sonidos CC0 (si los hay)
├── src/
│   ├── main.ts                # bootstrap
│   ├── core/                  # Game (loop), Time, EventBus, StateMachine, SaveSystem, Input
│   ├── render/                # Renderer PS2, PostFX (shaders), Materials (vertex snap), Fog, Lights
│   ├── world/                 # Level builder (colegio), Colliders, Doors, Props, Zones/Triggers
│   ├── player/                # PlayerController (mov., cabeceo, respiración), Hands (viewmodel)
│   ├── tools/                 # Phone, Recorder, Journal (+ ToolManager)
│   ├── entities/              # Entity base + Echo(Daniela), Reflection(Renata), Mimic(la que imita), Lucia
│   ├── horror/                # FearDirector, ScareEvents, Screamers, MetaHorror (título de pestaña, fake crash)
│   ├── audio/                 # AudioEngine, Synth (drones, lluvia, zumbido, pasos, stingers, ringtone), Spatial
│   ├── narrative/             # StoryState (flags), ClueGraph, SMS, EVP, Subtitles
│   ├── ui/                    # Menú (afiche 3D), Pausa, Opciones, Avisos, Créditos, Diario (HTML/CSS)
│   ├── i18n/                  # es.json, en.json, t()
│   └── textures/              # generadores Canvas procedurales
└── tests/
```

**Reglas de arquitectura**
- Un único `requestAnimationFrame` en `core/Game.ts`. Todos los sistemas implementan `update(dt)`.
- Comunicación entre sistemas vía `EventBus` tipado (`'scare:major'`, `'clue:linked'`, `'sms:received'`, `'tool:equipped'`, etc.).
- La historia es una **máquina de estados** con flags en `StoryState`; los triggers del nivel solo cambian flags y emiten eventos.
- **Todo texto visible pasa por `t('clave')`.** Cero strings hardcodeadas en la UI o en el mundo.
- Modo debug con `?debug=1`: FPS, posición, tensión del Director, flags de historia, saltar a acto (`?act=3`), noclip (`N`).

## 6. Estilo visual — "PS2 maldito"

Pipeline de render (en `render/`):
1. **Resolución interna baja:** render a `WebGLRenderTarget` de **480×270** (opción "calidad alta" 640×360), escalado a pantalla con filtro `NearestFilter`.
2. **Vertex snapping:** vía `onBeforeCompile` en los materiales, snap de `gl_Position.xy` a una grilla (~160–240 unidades) → el temblor característico de PS1/PS2.
3. **Texturas:** 64×64 a 256×256, `NearestFilter`, sin mipmaps en superficies cercanas.
4. **Niebla:** `FogExp2`, color azul verdoso desaturado `#1b2428`; densidad variable por zona (patio más densa).
5. **Post-proceso (un único shader combinado para rendimiento):** cuantización de color (5–6 bits por canal) + **dithering Bayer 4×4**, grano de película animado, viñeta, aberración cromática leve (sube en sustos), distorsión/scanlines en picos de tensión.
6. **Iluminación:** pocas luces. Fluorescentes (`RectAreaLight` o `PointLight` baratas) que parpadean. Linterna del celular = `SpotLight` con cookie de ruido. La oscuridad es real: sin flash, casi no se ve.
7. **Paleta:** fríos (verde-azulado de fluorescente, azul noche) + acentos cálidos escasos (luz del flash, rojo de sangre y del afiche).
8. **Manos del jugador (viewmodel):** siempre visibles al usar herramientas, igual que en la ref. 01. Guantes o manos pálidas low-poly, con balanceo al caminar.

**Gore moderado:** sangre seca y goteos, uñas en un desagüe, marcas de arrastre, rostros deformados en los screamers, mensajes escritos con sangre. **Sin** desmembramientos, vísceras ni violencia explícita en pantalla.

## 7. Audio (50% del miedo)

- `AudioEngine` central con buses: `master`, `music/drone`, `sfx`, `voice/evp`, `ui`. Compresor en el master.
- **Síntesis procedural:** lluvia (ruido rosa filtrado), zumbido fluorescente (60 Hz + armónicos), drone de tensión (osciladores desafinados + LFO, sube con la tensión), pasos por superficie (baldosa/madera/agua), respiración del jugador (se acelera al correr/tener miedo), latido (en tensión alta), tono de celular estilo 2005 (onda cuadrada), crujidos de metal y puertas, **stingers** (clúster disonante + golpe de ruido + subgrave).
- **Espacial 3D:** todo evento del mundo usa `PannerNode` HRTF. El Director prefiere colocar sonidos **detrás del jugador** (140°–220° respecto a la mirada).
- **El silencio es un evento:** antes de un screamer mayor, hacer *ducking* de todo a casi cero durante 1,5–3 s.
- **EVP (psicofonías):** ruido formántico filtrado con envolvente de voz + subtítulo que se "descifra" letra por letra. Opcional: capa de `speechSynthesis` con tono bajo. Idioma según i18n.
- **No se usa el micrófono ni la webcam del jugador. Nunca.**

## 8. Controles (teclado + mouse, remapeables en fase de pulido)

| Acción | Tecla |
|---|---|
| Moverse / correr / agacharse | WASD / Shift (stamina limitada) / C |
| Mirar | Mouse (Pointer Lock) |
| Interactuar | E |
| Celular (sacar/guardar) | 1 |
| Grabadora (sacar/guardar) | 2 |
| Diario (abrir/cerrar, **el mundo NO se pausa**) | Tab |
| Usar herramienta (foto / grabar / reproducir) | Clic izquierdo |
| Flash de linterna on/off | F |
| Modo cámara del celular | Clic derecho (mantener) |
| Pausa | Esc |

## 9. Las 3 herramientas

### 9.1 Celular de tapa (`tools/Phone.ts`)
- Modelo low-poly de tapa en la mano derecha; se abre con una animación. Pantalla = `CanvasTexture` a 128×160 con fuente VT323.
- **Linterna (flash):** `SpotLight` cálido. La batería baja lento y es solo tensión (no llega a 0 en la demo salvo en un evento con guion).
- **Cámara:** con clic derecho sostenido el celular sube al centro. Su pantalla muestra un **render secundario** (render target 96×120) desde la cámara del jugador, que **incluye la capa espectral** (`layers.enable(SPECTRAL)`): huellas descalzas, escritura en espejos, figuras. A simple vista la capa no se ve.
- **Fotos:** clic izquierdo en modo cámara → la foto se guarda en la galería (se puede revisar) y, si hay una pista en cuadro, se agrega al diario.
- **SMS:** los mensajes de "Lucía" llegan con vibración y sonido. Se leen en la pantalla. La hora del celular usa la hora **ficticia** del juego (arranca 20:58).
- Cerrar el celular = oscuridad casi total.

### 9.2 Grabadora de cassette (`tools/Recorder.ts`)
- Se consigue en el Acto 2. Mano izquierda.
- **Grabar (clic, 10 s):** en zonas "EVP" graba una psicofonía. Fuera de ellas, graba solo ambiente.
- **Rebobinar y reproducir:** se escucha la psicofonía con subtítulo que se descifra; genera una pista en el diario.
- **Riesgo:** reproducir sube la tensión del Director (+15) y puede atraer a una entidad cercana.

### 9.3 Diario-dossier (`tools/Journal.ts` + `ui/journal/`)
- Overlay HTML/CSS con aspecto de libreta física (refs 03/05): papel, polaroids, clips, cinta, letra a mano. La cámara del jugador baja un poco hacia las manos mientras está abierto.
- **El mundo sigue corriendo:** se oye todo, y el Director puede aprovechar ese momento.
- **Conectar pistas:** arrastrar de una pista a otra traza un hilo rojo (SVG). Si la conexión es válida (`ClueGraph`), aparece una deducción escrita a mano y se desbloquea un objetivo o flag. Si no es válida, el hilo se corta con un sonido seco.
- Pestañas: **Pistas**, **Personas** (las 6 chicas; se revela info al avanzar), **Objetivo actual** (una línea a mano, sin marcadores en el mundo).

## 10. Director de Miedo (`horror/FearDirector.ts`)

Sistema que decide **cuándo** asustar. Debe ser lógica pura y testeable con Vitest.

**Estado:** `tension` 0–100 y una fase: `CALM → BUILD → PEAK → RELAX`.

**Entradas (por frame):**
- tiempo desde el último susto mayor y menor
- velocidad del jugador (quieto > 4 s = "guardia baja")
- si el diario o la galería del celular están abiertos (guardia baja)
- si la linterna está apagada / zona oscura
- giros bruscos de cámara hacia atrás (el jugador está paranoico, así que conviene **no** asustarlo ahí y esperar)
- flags de historia (qué screamers con guion están habilitados)

**Pool de eventos:**
- **Menores** (cada 20–45 s en BUILD): paso detrás, puerta lejana que se cierra, parpadeo de fluorescente, casillero que cruje, susurro con la voz de Lucía ("¿me escuchas?"), vibración falsa del celular sin mensaje.
- **Medios** (cada 60–120 s): figura al final del pasillo que desaparece al alumbrarla, objeto que cambió de lugar al darse vuelta, luces que se apagan en secuencia.
- **Mayores/screamers:** solo los 5 con guion (ver `docs/GUION_DEMO.md`). Se **habilitan** por historia y se **disparan** por el Director.

**Reglas duras:**
- Mínimo **90 s** entre screamers mayores y mínimo **3 eventos menores/medios** (falsas alarmas) entre ellos.
- Antes de un mayor: silencio forzado de 1,5–3 s.
- Después de un mayor: fase `RELAX` de 25–40 s sin eventos (dejar respirar hace que el siguiente susto pegue más).
- Nunca dos screamers con la misma estructura seguidos.
- Todo susto tiene **ventana de disparo**: si el jugador sale de la zona, el susto con guion se dispara igual en la siguiente oportunidad válida (la demo no puede quedar sin sus sustos).

## 11. Anatomía de un screamer (obligatoria para los 5 mayores)

1. **Setup:** algo anómalo pero ambiguo.
2. **Falsa resolución:** "no era nada" (el jugador se relaja).
3. **Silencio** (ducking total).
4. **Golpe:** menos de 400 ms desde la aparición hasta ocupar el 60%+ de la pantalla + stinger + shake de cámara + subida de aberración cromática y distorsión.
5. **Salida:** corte a negro 150–300 ms o la entidad desaparece; el audio deja un zumbido residual.

Los rostros de los screamers se generan en código: canvas con rostro pálido, ojos negros de tamaño desigual, boca estirada, distorsión por shader (displacement + glitch), gore moderado (lágrimas de sangre). Low-res a propósito: la mente completa lo que falta.

## 12. Entidades de la demo

| Entidad | Chica | Regla |
|---|---|---|
| **La Huella** | Daniela Soto | Solo es visible por la cámara del celular. Deja huellas descalzas en la capa espectral. |
| **La del Espejo** | Renata Cruz | Solo existe en los reflejos. El reflejo del jugador se atrasa cuando ella está cerca. |
| **La que Imita** | Ana Paula Mejía | En la persecución del Acto 4: **avanza solo cuando el jugador se mueve rápido** (correr o caminar de pie). Agachado y lento, se detiene. Si llega → screamer + reinicio del checkpoint. |
| **Lucía** | hermana | Solo aparece al final. Sus SMS son el hilo narrativo. |

Fernanda Vidal e Isabel Ortega solo aparecen en el afiche y el diario (se reservan para el juego completo).

Modelos de las entidades: humanoide low-poly (primitivas o base CC0 de Quaternius) con uniforme escolar, pelo largo de planos alfa, sin rostro visible salvo en screamers. Animación mínima: quietud y "saltos" de posición entre frames (más inquietante que una animación fluida).

## 13. Idiomas (i18n)

- **Español (neutro latinoamericano)** e **Inglés**. Se elige en el primer arranque y en el menú; persiste en `localStorage`.
- Archivos `src/i18n/es.json` y `src/i18n/en.json` con **las mismas claves** (test de Vitest que lo verifica).
- Traduce: UI, SMS, EVP (subtítulo y voz), notas, pistas, deducciones, texturas con texto (afiche, pizarra, espejo: se regeneran al cambiar el idioma).
- Título del juego: **BLACKOUT** (igual en ES y EN; renombrado el 01/10/2026).

## 14. Menú y meta-horror

- **Aviso inicial (obligatorio):** fotosensibilidad y contenido + "Usa audífonos". Un clic, que además desbloquea el `AudioContext`.
- **Menú = afiche 3D** pegado en una reja bajo la lluvia, con parallax del mouse, gotas y relámpagos ocasionales. Las opciones son tiras de cinta: `NUEVA PARTIDA`, `CONTINUAR`, `OPCIONES`, `IDIOMA`, `CRÉDITOS`.
  - Tras 20 s sin mover el mouse, los ojos de una de las fotos giran hacia el cursor.
  - Cada vez que se vuelve al menú, algo del afiche cambia un poco (foto torcida, mancha nueva, una cara más cerca).
  - Al terminar la demo, el afiche muestra **una séptima foto: "TÚ / S07"** (persistente).
- **Pestaña del navegador:** si el jugador cambia de pestaña, el título pasa a "¿sigues ahí?" / "are you still there?", y luego a "vuelve" / "come back".
- **Fake crash al final:** pantalla de "la página dejó de responder" falsa, dentro del canvas, que luego se "corrompe" con el mensaje final. Nunca debe bloquear el navegador de verdad ni usar `alert()`.

## 15. Accesibilidad y seguridad

- Opción **"Reducir destellos"** (quita strobes y flashes blancos; mantiene los sustos).
- Subtítulos para todo sonido narrativo (SMS, EVP, llamadas).
- Sensibilidad del mouse, FOV (60–90), volumen por bus, brillo con calibración ("apenas debe verse el símbolo").
- Pausa real con Esc en cualquier momento (excepto durante los 400 ms de un golpe).

## 16. Rendimiento

- Objetivo: **60 FPS en una GPU integrada de laptop** (MacBook Air M1 / Intel Iris). La resolución interna baja ayuda.
- Draw calls < 150: fusionar geometría estática (`BufferGeometryUtils.mergeGeometries`), `InstancedMesh` para casilleros, baldosas y sillas.
- Sombras: solo la linterna del jugador, mapa de 512 px.
- Nada de asignar memoria en `update()` (reutilizar vectores).

## 17. Convenciones de código

- Identificadores en **inglés**; comentarios y documentación en **español**.
- Un sistema por archivo, clases pequeñas, sin singletons globales salvo `Game` y `EventBus`.
- Constantes de diseño (tiempos, umbrales del Director, velocidades) en `src/config.ts` para iterar el "feel" sin tocar la lógica.
- Formato con Prettier y lint con ESLint (config mínima).

## 18. Definición de "terminado" (cada fase)

1. `npm run build` sin errores de TypeScript.
2. `npm test` pasa.
3. Verificación en el navegador (Browser pane de Claude Code / `npm run dev`): se jugó el tramo nuevo, sin errores en consola, FPS ≥ 55 con `?debug=1`.
4. Los textos nuevos existen en ES y EN.
5. Se actualiza la sección "Estado" de `docs/PLAN.md`.

## 19. Qué NO hacer

- No usar micrófono, webcam, geolocalización ni datos personales del jugador.
- No agregar HUD flotante, marcadores de objetivo, minimapa ni barras de vida.
- No usar sustos aleatorios sin setup ni sonidos fuertes sin propósito.
- No usar assets con licencia no libre, ni rostros o nombres de personas reales.
- No meter React u otros frameworks de UI; no sobre-ingenierizar (es una demo de 15 min).
- No ampliar el alcance más allá de `docs/GUION_DEMO.md` sin preguntar al usuario.
