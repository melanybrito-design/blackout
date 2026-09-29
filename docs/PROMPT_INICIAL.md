# PROMPTS PARA CLAUDE CODE

## 1) Prompt maestro (pégalo al abrir una sesión nueva en `gaming_architecture/`)

```
Vas a construir "ÚLTIMA VEZ VISTAS / LAST SEEN", la demo de 15 minutos de un juego de terror
psicológico en primera persona, con estética PS2, en Three.js + TypeScript + Vite, que corre en el navegador.

Antes de escribir código, lee completos:
- AGENTS.md (visión, stack, arquitectura, estilo, Director de Miedo, reglas)
- docs/GUION_DEMO.md (guion minuto a minuto, pistas, textos ES/EN, screamers S1–S5)
- docs/PLAN.md (fases y criterios de aceptación)
- las imágenes de docs/referencias/ (míralas: son la dirección de arte)

Reglas de trabajo:
1. Trabaja SOLO en la fase que te indique. Al terminarla, cumple la "Definición de terminado"
   de AGENTS.md §18: build sin errores, tests en verde, verificación jugando en el Browser pane
   (sin errores en consola, FPS ≥ 55 con ?debug=1) y textos en ES y EN.
2. Todo asset se genera por código (geometría, texturas Canvas, audio Web Audio). Si de verdad
   necesitas un asset externo, solo CC0 (Kenney, Quaternius, Poly Haven, ambientCG, Freesound CC0),
   registrado en ASSETS_CREDITS.md.
3. Nunca uses el micrófono, la webcam ni datos personales. Todos los personajes son ficticios.
4. Gore moderado: sangre y rostros deformados sí; desmembramientos y vísceras no.
5. Cero HUD flotante: la información vive en el celular, la grabadora y el diario.
6. El objetivo número uno es que DÉ MIEDO DE VERDAD: respeta la anatomía del screamer (§11)
   y las reglas del Director (§10). Tensión antes que sustos.
7. Pon los valores de "feel" (tiempos, velocidades, umbrales) en src/config.ts.
8. Al terminar la fase, actualiza la tabla "Estado" de docs/PLAN.md, haz un commit y
   dame un resumen corto: qué hiciste, cómo probarlo (?act=N) y qué sigue.
9. Si algo del guion es técnicamente inviable o poco claro, pregúntame antes de inventar.

Empieza por la FASE 0 y la FASE 1 de docs/PLAN.md.
```

## 2) Prompts por fase (después del maestro, uno por sesión)

**Fase 2**
```
Fase 2 de docs/PLAN.md. Jugador (Pointer Lock, WASD, correr con stamina, agacharse, cabeceo,
colisiones) y todo el colegio del guion en blockout, con puertas, triggers, checkpoints y StoryState
con saltos ?act=N. Verifícalo recorriendo el mapa completo en el Browser pane.
```

**Fase 3**
```
Fase 3. AudioEngine con buses, HRTF y desbloqueo al primer clic. Sintetiza en Web Audio (sin archivos):
lluvia, zumbido fluorescente, drone de tensión parametrizable, pasos por superficie, respiración,
latido, puertas, 3 stingers, ringtone de 2005, vibración y ducking de silencio. Crea una página
?audiotest=1 para escuchar cada sonido y ubicarlo alrededor del oyente.
```

**Fase 4**
```
Fase 4. Viewmodel de manos + celular de tapa: linterna, pantalla VT323 (hora del juego, batería,
SMS, galería) y modo cámara con render target y capa SPECTRAL. Deja jugables el prólogo y el
Acto 1 del guion hasta obtener C3 fotografiando la pizarra.
```

**Fase 5**
```
Fase 5. i18n completo (es/en con test de claves), ClueGraph con tests y el diario overlay estilo
refs 03/05 (polaroids, cinta, letra a mano, hilo rojo SVG, pestañas). El mundo no se pausa.
La conexión C1+C3 abre la 2°B. Verifica el Acto 1 en ambos idiomas.
```

**Fase 6**
```
Fase 6. Grabadora (mano izquierda): grabar 10 s, rebobinar, reproducir, zonas EVP. EVP con síntesis
formántica + subtítulo que se descifra. Cassette 24/10, C4, C5 y la conexión C4+C5. Reproducir sube
la tensión +15 (deja el hook para el Director).
```

**Fase 7**
```
Fase 7. FearDirector como lógica pura con tests (90 s entre mayores, 3 falsas alarmas, RELAX,
ventana garantizada). Pool de eventos menores/medios conectado a audio, luces y props. Panel de
tensión en ?debug=1. Título de pestaña meta-horror. Juega 3 min en el pasillo y ajusta hasta que
los eventos se sientan orgánicos.
```

**Fase 8 ★**
```
Fase 8, la más importante. Entidades (La Huella, La del Espejo con reflejo atrasado, La que Imita
con persecución y checkpoint, Lucía) y los 5 screamers S1–S5 EXACTAMENTE como en docs/GUION_DEMO.md,
con la anatomía de AGENTS.md §11: rostros procedurales en canvas + shader de distorsión, stingers,
shake y silencio previo. Agrega la opción "Reducir destellos". Juega la demo completa y dime,
screamer por screamer, qué setup tiene y por qué funciona.
```

**Fase 9**
```
Fase 9. Arte procedural: texturas canvas (baldosas, casilleros, pizarra, dibujos, afiches, sangre,
óxido), props instanciados, iluminación por zona y lluvia. Gore moderado del baño y del gimnasio.
Compara capturas de cada zona con docs/referencias/01 y 06 y ajusta.
```

**Fase 10**
```
Fase 10. Aviso inicial (fotosensibilidad + audífonos), menú afiche 3D en la reja bajo la lluvia
(ref 02) con fotocopias procedurales de las 6 chicas ficticias, menú de cinta, opciones e idioma,
ojos que siguen al cursor tras 20 s, cambios sutiles al volver, foto "TÚ / S07" post-final, fake
crash y pantalla FIN DE LA DEMO.
```

**Fase 11**
```
Fase 11. Pulido: juega la demo completa 3 veces cronometrando (objetivo 13–17 min) y ajusta
config.ts. Opciones completas, guardado por checkpoint, perfilado (draw calls < 150, sin GC en el
loop), build final y checklist de AGENTS.md §18. Entrégame la lista de bugs conocidos si queda alguno.
```

## 3) Prompts de iteración útiles
- "Este susto no me asustó: [describe]. Analiza por qué con la anatomía §11 y propón 3 variantes."
- "Se ve demasiado limpio. Compáralo con la ref 01 y ensucia: más niebla, menos luz, texturas más degradadas."
- "Juega hasta el minuto X con ?debug=1 y dime cómo se comportó la curva de tensión."
