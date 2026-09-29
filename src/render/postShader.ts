// Post-proceso combinado en un solo pase: cuantización + dithering Bayer 4x4 + grano +
// viñeta + aberración cromática + distorsión de susto. Todo sobre la grilla de baja resolución.

export const postVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const postFragment = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;          // resolución interna
uniform float uTime;
uniform float uLevels;
uniform float uGrain;
uniform float uVignette;
uniform float uAberration;  // en píxeles internos
uniform float uDistort;     // 0..1 distorsión de susto
uniform float uFlash;       // 0..1 destello blanco
uniform float uEnabled;
uniform float uBrightness;
varying vec2 vUv;

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
                          3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return m[i] / 16.0 - 0.5;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 px = floor(vUv * uRes);
  vec2 uv = (px + 0.5) / uRes;

  if (uEnabled < 0.5) {
    gl_FragColor = vec4(toSRGB(texture2D(tScene, vUv).rgb), 1.0);
    return;
  }

  // Distorsión horizontal por líneas (sustos / glitch)
  float line = floor(uv.y * uRes.y / 3.0);
  float jitter = (hash(vec2(line, floor(uTime * 24.0))) - 0.5) * uDistort * 0.08;
  jitter *= step(0.6, hash(vec2(line * 1.7, floor(uTime * 12.0))));
  uv.x += jitter;

  // Aberración cromática radial
  vec2 dir = (uv - 0.5);
  float ab = (uAberration + uDistort * 4.0) / uRes.x;
  vec3 col;
  col.r = texture2D(tScene, uv + dir * ab * 2.0).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - dir * ab * 2.0).b;

  col *= uBrightness * 1.15;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14); // ACES aprox.
  col = toSRGB(col);

  // Viñeta
  float v = smoothstep(0.85, 0.2, length(dir * vec2(1.0, 0.8)) * (1.0 + uVignette));
  col *= mix(1.0, v, uVignette + uDistort * 0.3);

  // Grano por píxel interno
  float g = hash(px + fract(uTime * 7.13) * 91.0) - 0.5;
  col += g * uGrain;

  col = mix(col, vec3(1.0), uFlash);

  // Cuantización con dithering ordenado
  float d = bayer4(px);
  col = floor(col * uLevels + d + 0.5) / uLevels;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
