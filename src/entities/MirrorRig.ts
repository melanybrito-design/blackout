// Cuerpo del jugador visible solo en el espejo, con reflejo que se atrasa y luego se congela.
// También maneja a Renata, que solo existe en los reflejos.
import * as THREE from 'three';
import type { System } from '../core/Game';
import { LAYER, setLayer } from '../core/layers';
import type { PlayerController } from '../player/PlayerController';
import { GirlModel, playerBody } from './GirlModel';

interface Sample {
  t: number;
  x: number;
  z: number;
  yaw: number;
  crouch: boolean;
}

export class MirrorRig implements System {
  readonly body = playerBody();
  readonly renata = new GirlModel({ seed: 3307, scary: 1, hairFront: 0.8, wet: true });
  /** Segundos de atraso del reflejo. */
  delay = 0;
  frozen = false;
  private buf: Sample[] = [];
  private time = 0;

  constructor(
    scene: THREE.Scene,
    private player: PlayerController,
  ) {
    setLayer(this.body, LAYER.PLAYER_BODY);
    scene.add(this.body);
    setLayer(this.renata.root, LAYER.MIRROR_ONLY);
    this.renata.root.visible = false;
    this.renata.pose(0.3);
    scene.add(this.renata.root);
  }

  /** Coloca el cuerpo exactamente donde está el jugador (fotos con guion). */
  snap(): void {
    this.apply({ t: this.time, x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw, crouch: this.player.crouched });
  }

  private apply(s: Sample): void {
    this.body.position.set(s.x, 0, s.z);
    // el modelo mira hacia +z local; el jugador mira hacia -z con yaw 0
    this.body.rotation.y = s.yaw + Math.PI;
    this.body.scale.y = s.crouch ? 0.65 : 1;
  }

  update(dt: number): void {
    this.time += dt;
    const p = this.player;
    this.buf.push({ t: this.time, x: p.position.x, z: p.position.z, yaw: p.yaw, crouch: p.crouched });
    while (this.buf.length > 2 && this.buf[1].t < this.time - 3) this.buf.shift();
    if (this.frozen) return;
    const target = this.time - this.delay;
    let s = this.buf[this.buf.length - 1];
    for (let i = this.buf.length - 1; i >= 0; i--) {
      if (this.buf[i].t <= target) {
        s = this.buf[i];
        break;
      }
    }
    this.apply(s);
  }

  /** Renata pegada al hombro del jugador (solo en el reflejo). */
  showRenataBehind(): void {
    const p = this.player;
    const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(0.55);
    const side = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw)).multiplyScalar(0.25);
    this.renata.root.position.set(p.position.x + back.x + side.x, 0, p.position.z + back.z + side.z);
    this.renata.root.rotation.y = p.yaw + Math.PI;
    this.renata.root.visible = true;
  }

  hideRenata(): void {
    this.renata.root.visible = false;
  }
}
