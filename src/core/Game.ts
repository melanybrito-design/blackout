// Loop principal: un único requestAnimationFrame. Los sistemas se agrupan ('menu', 'play', 'always')
// y solo se actualizan los grupos activos.
import * as THREE from 'three';
import { RENDER } from '../config';
import { Input } from './Input';
import { PS2Renderer } from '../render/PS2Renderer';
import { LAYER } from './layers';

export interface System {
  update(dt: number, time: number): void;
}

export type SystemGroup = 'always' | 'menu' | 'play';

export class Game {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  readonly renderer: PS2Renderer;
  readonly input: Input;
  private groups: Record<SystemGroup, System[]> = { always: [], menu: [], play: [] };
  private active = new Set<SystemGroup>(['always']);
  private clock = new THREE.Clock();
  time = 0;
  paused = false;
  /** Hooks previos al render (render targets secundarios). */
  readonly preRender: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(RENDER.fov, innerWidth / innerHeight, 0.03, 90);
    this.camera.layers.enable(LAYER.VIEWMODEL);
    this.renderer = new PS2Renderer(container);
    this.input = new Input(this.renderer.domElement);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  add<T extends System>(system: T, group: SystemGroup = 'play'): T {
    this.groups[group].push(system);
    return system;
  }

  setActive(...groups: SystemGroup[]): void {
    this.active = new Set<SystemGroup>(['always', ...groups]);
  }

  isActive(group: SystemGroup): boolean {
    return this.active.has(group);
  }

  setView(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.scene = scene;
    this.camera = camera;
    this.resize();
  }

  start(): void {
    this.clock.start();
    const loop = () => {
      requestAnimationFrame(loop);
      this.step(Math.min(this.clock.getDelta(), RENDER.maxDt));
    };
    loop();
  }

  /** Avanza un frame (también usado por las pruebas automatizadas). */
  step(dt: number, render = true): void {
    {
      if (!this.paused) {
        this.time += dt;
        for (const g of ['always', 'menu', 'play'] as SystemGroup[]) {
          if (!this.active.has(g)) continue;
          for (const s of this.groups[g]) s.update(dt, this.time);
        }
      } else {
        for (const s of this.groups.always) s.update(0, this.time);
      }
      if (render) {
        for (const fn of this.preRender) fn();
        this.renderer.render(this.scene, this.camera, this.time);
      }
      this.input.endFrame();
    }
  }

  resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.resize(innerWidth, innerHeight);
  }
}
