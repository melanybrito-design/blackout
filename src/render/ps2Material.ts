// Parche de material "PS2": snapping de vértices a una grilla en espacio de pantalla.
import * as THREE from 'three';
import { RENDER } from '../config';

/** Uniform compartido por todos los materiales: se ajusta en vivo (p. ej. más temblor en sustos). */
export const snapUniform = { value: new THREE.Vector2(RENDER.vertexSnap * (16 / 9), RENDER.vertexSnap) };

export function setSnapAspect(aspect: number, grid: number = RENDER.vertexSnap): void {
  snapUniform.value.set(grid * aspect, grid);
}

export function applyPS2<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snapUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnap;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 p = gl_Position;
          p.xy = floor(p.xy / p.w * uSnap + 0.5) / uSnap * p.w;
          gl_Position = p;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'ps2';
  return material;
}

/** Material Lambert con textura nearest y snapping; el material base del mundo. */
export function ps2Lambert(params: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial(params);
  if (m.map) {
    m.map.magFilter = THREE.NearestFilter;
    m.map.minFilter = THREE.NearestMipmapNearestFilter;
    m.map.colorSpace = THREE.SRGBColorSpace;
  }
  return applyPS2(m);
}
