// Loop principal: un único requestAnimationFrame. Todos los sistemas implementan update(dt).
import * as THREE from 'three';
import { RENDER } from '../config';
import { Input } from './Input';
import { PS2Renderer } from '../render/PS2Renderer';

export interface System {
  update(dt: number, time: number): void;
}

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: PS2Renderer;
  readonly input: Input;
  private systems: System[] = [];
  private clock = new THREE.Clock();
  private time = 0;
  paused = false;

  constructor(container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(RENDER.fov, innerWidth / innerHeight, 0.05, 80);
    this.renderer = new PS2Renderer(container);
    this.input = new Input(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2(RENDER.fogColor, RENDER.fogDensity);
    this.scene.background = new THREE.Color(RENDER.fogColor);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  add<T extends System>(system: T): T {
    this.systems.push(system);
    return system;
  }

  start(): void {
    this.clock.start();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), RENDER.maxDt);
      if (!this.paused) {
        this.time += dt;
        for (const s of this.systems) s.update(dt, this.time);
      }
      this.renderer.render(this.scene, this.camera, this.time);
      this.input.endFrame();
    };
    loop();
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.resize(innerWidth, innerHeight);
  }
}
