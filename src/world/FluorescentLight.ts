// Tubo fluorescente con parpadeo procedural. Puede tener PointLight real o ser solo emisivo.
import * as THREE from 'three';
import type { System } from '../core/Game';
import { applyPS2 } from '../render/ps2Material';

export type FlickerMode = 'steady' | 'unstable' | 'dying' | 'off';

const tubeGeo = new THREE.BoxGeometry(0.18, 0.06, 1.25);
const TUBE_COLOR = new THREE.Color(0xdff5e8);

export class FluorescentLight implements System {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight | null;
  private tubeMat: THREE.MeshBasicMaterial;
  private baseIntensity: number;
  private stutter = 0;
  private nextStutter: number;
  level = 1;

  constructor(
    position: THREE.Vector3,
    public mode: FlickerMode = 'steady',
    withLight = true,
    intensity = 11,
  ) {
    this.baseIntensity = intensity;
    this.tubeMat = applyPS2(new THREE.MeshBasicMaterial({ color: 0xdff5e8 }));
    const tube = new THREE.Mesh(tubeGeo, this.tubeMat);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.05, 1.35),
      applyPS2(new THREE.MeshLambertMaterial({ color: 0x55584f })),
    );
    housing.position.y = 0.04;
    this.group.add(tube, housing);
    this.group.position.copy(position);
    this.light = withLight ? new THREE.PointLight(0xcfeede, intensity, 8.5, 1.5) : null;
    if (this.light) {
      this.light.position.y = -0.15;
      this.group.add(this.light);
    }
    this.nextStutter = 2 + Math.random() * 6;
  }

  update(dt: number, time: number): void {
    let v = 1;
    switch (this.mode) {
      case 'off':
        v = 0;
        break;
      case 'steady':
        v = 0.96 + Math.sin(time * 120) * 0.02;
        break;
      case 'unstable': {
        this.nextStutter -= dt;
        if (this.nextStutter <= 0) {
          this.stutter = 0.25 + Math.random() * 0.9;
          this.nextStutter = 3 + Math.random() * 7;
        }
        if (this.stutter > 0) {
          this.stutter -= dt;
          v = Math.random() > 0.45 ? 1 : 0.05;
        }
        break;
      }
      case 'dying':
        v = Math.random() > 0.82 ? 0.8 + Math.random() * 0.2 : 0.02;
        break;
    }
    v *= this.level;
    this.tubeMat.color.copy(TUBE_COLOR).multiplyScalar(0.08 + 0.92 * v);
    if (this.light) this.light.intensity = this.baseIntensity * v;
  }
}
