// Atmósfera: haces de luz volumétricos falsos bajo los fluorescentes y polvo flotando.
import * as THREE from 'three';
import type { System } from '../core/Game';

const shaftMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uLevel: { value: 1 }, uColor: { value: new THREE.Color(0x9fd6c4) } },
    vertexShader: `
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        vY = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uLevel; uniform vec3 uColor;
      varying float vY; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float a = pow(vY, 2.2) * edge * 0.07 * uLevel;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });

const shaftGeo = new THREE.CylinderGeometry(0.16, 1.05, 2.8, 12, 1, true);

/** Cono de luz bajo un fluorescente; `level` sigue al parpadeo. */
export function lightShaft(): { mesh: THREE.Mesh; setLevel: (v: number) => void } {
  const mat = shaftMat();
  const mesh = new THREE.Mesh(shaftGeo, mat);
  mesh.position.y = -1.45;
  mesh.renderOrder = 5;
  return { mesh, setLevel: (v) => (mat.uniforms.uLevel.value = v) };
}

/** Motas de polvo alrededor de la cámara (un draw call). */
export class Dust implements System {
  readonly points: THREE.Points;
  private mat: THREE.ShaderMaterial;

  constructor(private camera: THREE.Camera, count = 420) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = Math.random() * 6;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: `
        uniform float uTime; uniform vec3 uCam; varying float vA;
        void main() {
          vec3 p = position + vec3(sin(uTime * 0.13 + position.y) * 0.3, -uTime * 0.04, cos(uTime * 0.11 + position.x) * 0.3);
          p = mod(p - uCam + 3.0, 6.0) - 3.0 + uCam;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(0.3, 1.0, d) * (1.0 - smoothstep(2.0, 3.0, d));
          gl_PointSize = 2.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(vec3(0.75, 0.78, 0.72) * vA * 0.35, 1.0); }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  update(_dt: number, time: number): void {
    this.mat.uniforms.uTime.value = time;
    this.camera.getWorldPosition(this.mat.uniforms.uCam.value);
  }
}
