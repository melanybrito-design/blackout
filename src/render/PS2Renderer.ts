// Renderiza la escena a un render target de baja resolución y la escala a pantalla
// con filtro nearest a través del shader de post-proceso.
import * as THREE from 'three';
import { RENDER } from '../config';
import { postFragment, postVertex } from './postShader';
import { setSnapAspect } from './ps2Material';

export class PS2Renderer {
  readonly gl: THREE.WebGLRenderer;
  private target: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly post: THREE.ShaderMaterial;
  internalHeight: number = RENDER.internalHeight;

  constructor(container: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.BasicShadowMap;
    container.appendChild(this.gl.domElement);

    this.target = new THREE.WebGLRenderTarget(480, 270, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
    });

    this.post = new THREE.ShaderMaterial({
      vertexShader: postVertex,
      fragmentShader: postFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(480, 270) },
        uTime: { value: 0 },
        uLevels: { value: RENDER.colorLevels },
        uGrain: { value: RENDER.grain },
        uVignette: { value: RENDER.vignette },
        uAberration: { value: RENDER.aberration },
        uDistort: { value: 0 },
        uFlash: { value: 0 },
        uEnabled: { value: 1 },
        uBrightness: { value: 1 },
      },
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
  }

  get domElement(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  get info(): THREE.WebGLInfo {
    return this.gl.info;
  }

  resize(w: number, h: number): void {
    this.gl.setSize(w, h);
    const ih = this.internalHeight;
    const iw = Math.round(ih * (w / h));
    this.target.setSize(iw, ih);
    this.post.uniforms.uRes.value.set(iw, ih);
    setSnapAspect(w / h);
  }

  setQuality(high: boolean): void {
    this.internalHeight = high ? RENDER.internalHeightHigh : RENDER.internalHeight;
    this.resize(innerWidth, innerHeight);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number): void {
    this.post.uniforms.uTime.value = time;
    this.gl.info.autoReset = false;
    this.gl.info.reset();
    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCamera);
  }
}
