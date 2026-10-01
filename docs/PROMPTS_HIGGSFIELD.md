# PROMPTS PARA HIGGSFIELD — BLACKOUT

> Los prompts están en **inglés** (los modelos rinden mejor así); las notas, en español.
> Guarda cada archivo con **el nombre exacto** en la carpeta indicada. Yo los integro al juego.
> Todos los personajes son **ficticios**. No uses fotos de personas reales como referencia.

## Reglas generales

- **Texturas:** usa **1024×1024**, PNG, vista **ortogonal de frente**, **sin sombras ni luz direccional** y sin perspectiva. Deben ser **tileables** (usa la opción *seamless/tile* si existe).
- **Personajes:** genera primero los 6 retratos normales. Después, **usa cada retrato como referencia de personaje** (Soul ID / character reference) para su versión de screamer y para el video, así la cara es la misma.
- **Texto:** no pidas texto dentro de las imágenes (sale deformado). Yo escribo todo el texto en código, en ES y EN.
- **Decals** (sangre, huellas): genéralos sobre **fondo blanco puro**. Yo los convierto a transparencia.
- **Bloque de estilo** que va al final de todos los prompts de mundo y personajes:

```
STYLE: grounded realism, Latin American public school in the 2000s, night, cold fluorescent and
wet blue tones, grime, humidity stains, subtle film grain, J-horror atmosphere (Ringu, Kairo),
photographic detail, no text, no watermark, no logo
```

---

## 1. PERSONAJES — lo que más mejora el juego ★★★

Carpeta: `public/assets/characters/`

### 1.1 Retratos del afiche (6 imágenes, 1024×1024)
Son fotos de credencial escolar en **blanco y negro**, con el mismo encuadre las seis: busto, de frente, fondo gris liso.

Prompt base (reemplaza `[DESCRIPCIÓN]`):
```
Black and white school ID photograph of a fictional Latin American high school girl, [DESCRIPCIÓN],
front-facing, shoulders up, neutral serious expression, white school blouse with navy tie,
plain grey studio background, flat harsh flash lighting, slightly underexposed, 2000s digital
camera, photocopy texture, centered, identical framing, no text
```

| Archivo | [DESCRIPCIÓN] |
|---|---|
| `girl_lucia.png` | 16 years old, long straight black hair with straight blunt bangs, round soft face, gentle eyes |
| `girl_daniela.png` | 17 years old, long wavy dark hair parted in the middle, thin face, dark circles under the eyes |
| `girl_renata.png` | 17 years old, very long straight black hair covering her ears, pale, sharp cheekbones, piercing stare |
| `girl_anapaula.png` | 17 years old, black hair tied in a low ponytail, freckles, slight asymmetrical smirk |
| `girl_fernanda.png` | 16 years old, shoulder-length black hair with bangs, glasses, shy expression |
| `girl_isabel.png` | 16 years old, long black hair with a side part, big dark eyes, slightly tilted head |

### 1.2 Rostros de screamer (4 imágenes, 1024×1024)
Genera cada uno **con la referencia de su retrato 1.1** para que se reconozca a la misma chica.

```
Extreme close-up horror portrait of the same girl from the reference, face filling the frame,
[VARIANTE], deathly pale grey skin, completely black hollow eyes with a tiny white pinpoint pupil,
dark wet hair stuck to the face, mouth stretched unnaturally wide open showing irregular teeth,
black blood tears running from the eyes, lit from below by a harsh phone flashlight, pure black
background, motion blur on the edges, analog horror, J-horror, highly detailed skin texture,
moderate gore, no text
```

| Archivo | [VARIANTE] |
|---|---|
| `scream_daniela.png` | soaking wet, mud on the cheek, head slightly tilted |
| `scream_renata.png` | face pressed against cracked mirror glass, shards reflecting light |
| `scream_anapaula.png` | head tilted 90 degrees sideways, neck twisted, grinning |
| `scream_lucia.png` | the face splitting open vertically from the forehead to the chin, the skin peeling back in strips, the most horrific of all |

### 1.3 Hojas de personaje para modelos 3D (opcional, pero con el mayor impacto)
Sirven para convertirlas en modelos 3D con **image-to-3D** (Higgsfield → GLB). Hace falta una por chica: Lucía, Daniela, Renata y Ana Paula.

```
Full body character turnaround sheet of the same girl from the reference, front view, side view
and back view side by side, standing straight with arms slightly away from the body (A-pose),
Latin American school uniform: white short-sleeve blouse, navy tie, navy pleated knee-length
skirt, white knee socks, black school shoes, long black hair, [ESTADO], neutral grey background,
even studio lighting, no shadows, full body visible head to toe, realistic proportions
```

| Archivo | [ESTADO] |
|---|---|
| `sheet_lucia.png` | clean uniform, calm |
| `sheet_daniela.png` | uniform soaking wet and muddy, barefoot |
| `sheet_renata.png` | uniform wet, hair fully covering the face |
| `sheet_anapaula.png` | uniform torn at the sleeve, dirty knees |

Si haces el 3D: `lucia.glb`, `daniela.glb`, `renata.glb`, `anapaula.glb`, en la misma carpeta. Pide un modelo **low/medium poly (menos de 20k triángulos)** con textura.

### 1.4 Fotos narrativas (1024×1024)
| Archivo | Prompt |
|---|---|
| `photo_lucia.png` | `Candid 2000s low-quality digital photo of the girl from the reference smiling on a school patio during the day, slightly blurry, warm colors, flash, red-eye, printed photo with worn edges, no text` |
| `wallpaper_sisters.png` | `Low resolution 2000s flip phone selfie of two sisters cheek to cheek, the younger one is the girl from the reference, the older one is seen from the side with hair covering the face, dim bedroom light, grainy, pink color cast, nostalgic, no text` |

---

## 2. TEXTURAS DEL COLEGIO ★★

Carpeta: `public/assets/textures/` · Tamaño: 1024×1024 · Tileables · Ortogonales · Sin sombras.

| Archivo | Prompt (+ bloque STYLE) |
|---|---|
| `floor_tiles.png` | `Seamless tileable top-down texture of old checkered vinyl floor tiles, alternating faded beige and dull green squares, 4x4 tiles, scuffs, dirt in the seams, cracks, dried water stains` |
| `wall_school.png` | `Seamless horizontally tileable front view texture of an institutional school hallway wall, bottom 38% glossy dark green paint, top cream paint, thin dark green dividing stripe, humidity stains dripping from the top, scuffs and scratches on the lower part, peeling paint` |
| `ceiling_tiles.png` | `Seamless tileable texture of an acoustic drop ceiling, perforated white panels in a metal grid, yellow-brown water stains, one panel darker with mold` |
| `locker_front.png` | `Front orthographic texture of a single old blue metal school locker door, ventilation slots at top and bottom, blank small white number plate in the middle, handle, rust stains, dents, stickers residue, fills the whole frame` |
| `door_classroom.png` | `Front orthographic texture of an old painted wooden classroom door, small rectangular window in the upper half that is pure solid black, metal handle, scratches, chipped paint, fills the whole frame` |
| `bath_tiles.png` | `Seamless tileable texture of small square white and pale blue ceramic bathroom tiles, dirty grey grout, rust stains, mold in the corners` |
| `gym_floor.png` | `Seamless tileable top-down texture of an old wooden gymnasium parquet floor, long planks, faded worn varnish, scratches, part of a faded painted court line` |
| `wet_concrete.png` | `Seamless tileable top-down texture of wet dark concrete schoolyard ground at night, puddles, cracks, leaves, reflections of cold light` |
| `perimeter_wall.png` | `Seamless tileable texture of a painted brick perimeter wall, grey-beige paint peeling, faded red graffiti tags, humidity streaks` |
| `blackboard.png` | `Front orthographic texture of an empty green school chalkboard with old chalk smudges and erased marks, wooden frame, no writing` |
| `facade.png` (2048×896, no tileable) | `Front orthographic view of the facade of a two-storey 1970s Latin American public school building at night, concrete painted walls, rows of dark windows with metal grilles, one window faintly lit green, humidity stains, central entrance door, rain` |
| `night_window.png` | `Front view of a dark school window at night seen from inside, rain drops and streaks on the glass, faint blue city glow, metal window frame cross` |

### Decals (fondo blanco puro, 1024×1024)
| Archivo | Prompt |
|---|---|
| `decal_blood_splat.png` | `Top-down dried dark red blood splatter stain on a pure white background, realistic, isolated` |
| `decal_blood_drag.png` | `Top-down long dried blood drag marks from fingers on a pure white background, vertical, isolated` |
| `decal_footprints.png` | `Top-down trail of wet bare footprints of a teenage girl on a pure white background, isolated, realistic` |
| `decal_cracks.png` | `Shattered mirror crack pattern radiating from an impact point, thin dark lines on a pure white background, isolated` |

---

## 3. MENÚ, DIARIO Y UI ★★

Carpeta: `public/assets/ui/`

| Archivo | Prompt |
|---|---|
| `menu_plate.png` (1920×1080) | `Night street seen through a chain-link fence in heavy rain, shallow depth of field, a single warm sodium streetlight on the left, wet asphalt reflections, empty, blurred silhouette of a school building in the background, dark and moody, cinematic, lots of empty dark space in the center, no people, no text` + STYLE |
| `journal_paper.png` | `Top-down photo of an old worn notebook double page, lined paper, coffee stains, torn edges, slightly yellow, empty, no writing` |
| `journal_cork.png` | `Seamless tileable top-down texture of an old cork board with pin holes` |
| `polaroid_frame.png` | `Empty white polaroid photo frame, worn and slightly yellowed, with the picture area pure black, on a pure white background` |
| `tape.png` | `Single strip of beige masking tape, torn ends, on a pure white background, top-down` |

---

## 4. VIDEOS ★ (opcionales, pero dan el salto de calidad)

Carpeta: `public/assets/video/` · MP4 · 1080p · Sin audio (el audio lo hago yo en código).

| Archivo | Tipo | Prompt |
|---|---|---|
| `menu_loop.mp4` (10 s, loop) | text-to-video | `Static locked-off camera, night street seen through a chain-link fence in heavy rain, sodium streetlight flickers once, distant lightning flash lights up an old school building in the background, puddles rippling, no people, seamless loop` + STYLE |
| `intro.mp4` (8 s) | text-to-video | `Slow dolly-in towards the rusty half-open gate of a dark Latin American public school at night in heavy rain, one flickering fluorescent light inside the entrance hall, fog, no people, ominous, cinematic` + STYLE |
| `jumpscare_lucia.mp4` (2–3 s) | **image-to-video** usando `girl_lucia.png` como frame inicial | `The girl slowly turns her head towards the camera, then her face suddenly contorts and splits open, her mouth stretching impossibly wide as she lunges at the camera, violent camera shake, pure black background, J-horror` |
| `jumpscare_daniela.mp4` (2 s) | image-to-video desde `scream_daniela.png` | `The drenched girl jerks forward towards the camera in unnatural stuttering frames, water dripping, mouth opening wide, lunging into the lens` |
| `ending_gym.mp4` (6 s) | text-to-video | `Dark school gymnasium lit only by one dying fluorescent light, six chairs in a circle, figures sitting still with burlap sacks over their heads, one empty chair, slow push-in, dust in the air, unsettling silence` + STYLE |

---

## 5. Orden recomendado (máximo impacto primero)

1. Los 6 retratos del afiche (1.1).
2. Los 4 rostros de screamer (1.2).
3. El video `jumpscare_lucia.mp4`.
4. Las texturas `wall_school`, `floor_tiles`, `locker_front`, `door_classroom` y `bath_tiles`.
5. `menu_plate.png` o `menu_loop.mp4`.
6. Las fotos narrativas (1.4) y el resto de las texturas.
7. Hojas de personaje y modelos 3D (1.3).
8. El resto de los videos.
