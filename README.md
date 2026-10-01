# BLACKOUT — demo

> Antes se llamaba «Última vez vistas / Last Seen».

Demo de terror psicológico en primera persona (≈15 min), ES/EN, hecha con Three.js + TypeScript + Vite.
El audio y los respaldos visuales se generan por código; el paquete visual opcional fue generado con Higgsfield. Ver `AGENTS.md` y `docs/`.

## Jugar
```bash
npm install
npm run dev
```
Abre la URL que muestra Vite. Usa audífonos.

**Controles:** WASD moverse · Shift correr · C agacharse · E usar lo que señala el puntero · 1 celular (F linterna,
Q o clic der. cámara, clic izq. o Espacio foto, clic izq. cambiar pantalla, ←/→ o rueda galería) · 2 grabadora (clic izq.) ·
Tab diario (clic en una pista y luego en otra para unirlas) · Esc pausa.

## Depuración
- `?debug=1` → FPS, draw calls, tensión del Director, flags. Teclas P (post-fx), G (glitch), L (idioma).
- `?debug=1&cp=corridor|classroom|bathroom|chase|gym` → saltar a un checkpoint.
- `?debug=1&nopause` → no pausar al perder el mouse (pruebas automatizadas).
- `?mute` → volumen 0 sin cambiar las opciones guardadas.

## Scripts
`npm run build` (typecheck + build) · `npm test` (Vitest) · `npm run preview`.

## Assets de alta calidad
Los 33 PNG y 5 MP4 de Higgsfield están en `public/assets/characters/`, `public/assets/textures/`, `public/assets/ui/` y `public/assets/video/`. Los prompts están en `docs/PROMPTS_HIGGSFIELD.md` y la procedencia de cada archivo en `docs/HIGGSFIELD_ASSETS.json`.

Varias imágenes no se usan tal cual sino recortadas (marco polaroid con ventana transparente, páginas de la libreta, tira de cinta, puertas, casillero, parquet, grietas, foto impresa de Lucía). Si reemplazas un original, regenera los recortes:
```bash
pip install pillow
python scripts/derive_higgsfield_assets.py
```
Todo asset es opcional: si falta el archivo, el juego usa el respaldo procedural.
