// Menú principal = el afiche "DESAPARECIDAS" pegado en una reja bajo la lluvia (ref. 02).
// - Parallax con el mouse, lluvia, relámpagos.
// - 20 s sin mover el mouse: una de las chicas mira hacia el cursor.
// - Cada visita cambia algo del afiche. Tras terminar la demo aparece "TÚ / S07".
import * as THREE from 'three';
import type { Game, System } from '../core/Game';
import { RENDER } from '../config';
import { ps2Lambert, applyPS2 } from '../render/ps2Material';
import { chainFence, perimeterWall } from '../textures/world';
import { toTexture } from '../textures/canvas';
import { drawPoster, POSTER_H, POSTER_W } from '../textures/poster';
import { Lightning, Rain } from '../world/props';
import { bus } from '../core/EventBus';
import type { AudioEngine } from '../audio/AudioEngine';

const VISITS_KEY = 'uvv.visits';

export class MenuScene implements System {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private posterCtx: CanvasRenderingContext2D;
  private posterTex: THREE.CanvasTexture;
  private poster: THREE.Mesh;
  private mouse = new THREE.Vector2();
  private idle = 0;
  private looking = false;
  private lookIndex: number;
  readonly visits: number;
  private lightning: Lightning;

  constructor(
    game: Game,
    private audio: AudioEngine,
    private finished: boolean,
  ) {
    this.visits = readVisits();
    writeVisits(this.visits + 1);
    this.lookIndex = [3, 2, 1, 4, 5, 0][this.visits % 6];

    this.camera = new THREE.PerspectiveCamera(RENDER.fov * 0.62, innerWidth / innerHeight, 0.05, 50);
    this.camera.position.set(0.18, 1.5, 1.35);
    this.scene.background = new THREE.Color(0x07090b);
    this.scene.fog = new THREE.FogExp2(0x07090b, 0.16);

    // Muro de fondo y reja
    const wallTex = perimeterWall();
    wallTex.repeat.set(4, 2);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), ps2Lambert({ map: wallTex }));
    wall.position.set(0, 2, -2.4);
    const fenceTex = chainFence();
    fenceTex.repeat.set(14, 7);
    const fence = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5),
      applyPS2(new THREE.MeshLambertMaterial({ map: fenceTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x9aa0a0 })),
    );
    fence.position.set(0, 1.8, -0.04);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5, 0.08), ps2Lambert({ color: 0x3a4448 }));
    post.position.set(-0.75, 1.8, -0.06);
    this.scene.add(wall, fence, post);

    // Afiche
    const pc = document.createElement('canvas');
    pc.width = POSTER_W;
    pc.height = POSTER_H;
    this.posterCtx = pc.getContext('2d')!;
    this.posterTex = toTexture(pc, false);
    this.posterTex.minFilter = THREE.LinearFilter;
    this.redraw();
    this.poster = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.02, 8, 8), ps2Lambert({ map: this.posterTex }));
    // curvatura leve (papel mojado)
    const pos = this.poster.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 3) * 0.012 + Math.random() * 0.004);
    this.poster.geometry.computeVertexNormals();
    this.poster.position.set(0, 1.5, 0);
    this.poster.rotation.z = 0.025 + (this.visits % 3) * 0.008;
    this.scene.add(this.poster);
    // Cinta adhesiva
    const tapeMat = ps2Lambert({ color: 0xcfc49a, transparent: true, opacity: 0.8 });
    for (const [x, y, r] of [
      [-0.3, 2.0, 0.5],
      [0.31, 2.0, -0.4],
      [-0.3, 1.0, -0.5],
    ]) {
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.04), tapeMat);
      tape.position.set(x, y, 0.012);
      tape.rotation.z = r;
      this.scene.add(tape);
    }

    // Luces
    const lamp = new THREE.SpotLight(0xffd4a0, 9, 8, 0.6, 0.7, 1.2);
    lamp.position.set(-1.2, 3.4, 1.4);
    lamp.target = this.poster;
    this.scene.add(lamp);
    this.scene.add(new THREE.AmbientLight(0x1c2630, 0.5));
    const sky = new THREE.HemisphereLight(0xb0c8ff, 0x101014, 0);
    this.scene.add(sky);

    const rain = new Rain(-2, 2, -0.2, 1.2, 900, 4);
    this.scene.add(rain.mesh);
    game.add(rain, 'menu');
    this.lightning = new Lightning();
    this.lightning.flashLight = sky;
    this.lightning.onStrike = () => setTimeout(() => this.audio.play('thunder'), 500 + Math.random() * 1500);
    game.add(this.lightning, 'menu');
    game.add(this, 'menu');

    window.addEventListener('mousemove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.idle = 0;
      if (this.looking) {
        this.looking = false;
        // las pupilas vuelven a su lugar... un segundo tarde
        setTimeout(() => this.redraw(), 900);
      }
    });
    bus.on('lang:changed', () => this.redraw());
  }

  private redraw(lookX = 0, lookY = 0, look = false): void {
    drawPoster(this.posterCtx, {
      visits: this.visits,
      finished: this.finished,
      lookIndex: look ? this.lookIndex : -1,
      lookX,
      lookY,
    });
    this.posterTex.needsUpdate = true;
  }

  update(dt: number, time: number): void {
    // Parallax
    const tx = 0.18 + this.mouse.x * 0.08;
    const ty = 1.5 + this.mouse.y * 0.05;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 2);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 2);
    this.camera.position.z = 1.35 + Math.sin(time * 0.3) * 0.02;
    this.camera.lookAt(0.08, 1.48, 0);

    this.idle += dt;
    if (this.idle > 20 && !this.looking) {
      this.looking = true;
      // dirección al cursor desde la foto (aprox. en coordenadas de pantalla)
      const col = this.lookIndex % 3;
      const row = Math.floor(this.lookIndex / 3);
      const fx = (col - 1) * 0.35 + 0.15;
      const fy = 0.25 - row * 0.4;
      const lx = THREE.MathUtils.clamp((this.mouse.x - fx) * 2.5, -1, 1);
      const ly = THREE.MathUtils.clamp(-(this.mouse.y - fy) * 2.5, -1, 1);
      this.redraw(Math.round(lx * 4) / 4, Math.round(ly * 4) / 4, true);
      this.audio.play('paper', { gain: 0.3 });
    }

    this.audio.outdoor = 1;
    this.audio.tension = 0.18;
    this.audio.hum = 0;
    this.audio.heart = 0;
    this.audio.breath = 0;
  }
}

function readVisits(): number {
  try {
    return Number(localStorage.getItem(VISITS_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeVisits(v: number): void {
  try {
    localStorage.setItem(VISITS_KEY, String(v));
  } catch {
    /* sin almacenamiento */
  }
}
