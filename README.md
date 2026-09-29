# ÚLTIMA VEZ VISTAS / LAST SEEN — demo

Demo de terror psicológico en primera persona (≈15 min), ES/EN, hecha con Three.js + TypeScript + Vite.
Todo el arte y el audio se generan por código. Ver `AGENTS.md` y `docs/`.

## Jugar
```bash
npm install
npm run dev
```
Abre la URL que muestra Vite. Usa audífonos.

**Controles:** WASD moverse · Shift correr · C agacharse · E interactuar · 1 celular (F linterna, clic der. cámara,
clic izq. foto / cambiar pantalla, rueda galería) · 2 grabadora (clic izq.) · Tab diario · Esc pausa.

## Depuración
- `?debug=1` → FPS, draw calls, tensión del Director, flags. Teclas P (post-fx), G (glitch), L (idioma).
- `?debug=1&cp=corridor|classroom|bathroom|chase|gym` → saltar a un checkpoint.
- `?debug=1&nopause` → no pausar al perder el mouse (pruebas automatizadas).

## Scripts
`npm run build` (typecheck + build) · `npm test` (Vitest) · `npm run preview`.

## Assets de alta calidad
Prompts para generar imágenes y videos en Higgsfield: `docs/PROMPTS_HIGGSFIELD.md` (van en `public/assets/`).
