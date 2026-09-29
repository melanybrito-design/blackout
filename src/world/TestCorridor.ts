// Escena de prueba de la Fase 1: pasillo principal del colegio en bruto,
// usada para validar el look PS2 (niebla, snapping, dithering, luz fluorescente).
import * as THREE from 'three';
import type { Game } from '../core/Game';
import { ps2Lambert } from '../render/ps2Material';
import { ceilingTiles, classroomDoor, floorTiles, lockerBank, schoolWall } from '../textures/procedural';
import { FluorescentLight } from './FluorescentLight';

export const CORRIDOR = { width: 3, height: 3, length: 36 } as const;

function plane(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h, Math.ceil(w), Math.ceil(h)), mat);
}

function repeated(tex: THREE.Texture, x: number, y: number): THREE.Texture {
  const t = tex.clone();
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}

export function buildTestCorridor(game: Game): void {
  const { scene } = game;
  const { width: W, height: H, length: L } = CORRIDOR;

  const floorTex = floorTiles();
  const wallTex = schoolWall();
  const ceilTex = ceilingTiles();

  const floor = plane(W, L, ps2Lambert({ map: repeated(floorTex, W / 1.6, L / 1.6) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -L / 2 + 2);

  const ceiling = plane(W, L, ps2Lambert({ map: repeated(ceilTex, W / 0.6, L / 0.6) }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, -L / 2 + 2);

  const wallMat = ps2Lambert({ map: repeated(wallTex, L / 2, 1) });
  const left = plane(L, H, wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, H / 2, -L / 2 + 2);
  const right = plane(L, H, wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(W / 2, H / 2, -L / 2 + 2);

  const endWall = plane(W, H, ps2Lambert({ map: repeated(wallTex, 1.5, 1) }));
  endWall.position.set(0, H / 2, -L + 2);
  const startWall = endWall.clone();
  startWall.rotation.y = Math.PI;
  startWall.position.z = 2;

  scene.add(floor, ceiling, left, right, endWall, startWall);

  // Casilleros en la pared izquierda: 2 bancos de 8 (10–17 y 18–25).
  const lockerW = 0.42;
  const bankGeo = new THREE.BoxGeometry(0.45, 1.85, lockerW * 8);
  [
    { start: 10, z: -6 },
    { start: 18, z: -6 - lockerW * 8 - 0.02 },
  ].forEach(({ start, z }) => {
    const front = ps2Lambert({ map: lockerBank(start, 8) });
    const side = ps2Lambert({ color: 0x3a525e });
    // BoxGeometry: orden de caras +x, -x, +y, -y, +z, -z. El frente mira a +x (hacia el pasillo).
    const bank = new THREE.Mesh(bankGeo, [front, side, side, side, side, side]);
    bank.position.set(-W / 2 + 0.225, 0.925, z - (lockerW * 8) / 2);
    scene.add(bank);
  });

  // Puertas de salas en la pared derecha (2°B y otra).
  const doorMat = ps2Lambert({ map: classroomDoor() });
  const frameMat = ps2Lambert({ color: 0x2a2018 });
  for (const z of [-9, -21]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 1.0), [
      frameMat,
      doorMat,
      frameMat,
      frameMat,
      frameMat,
      frameMat,
    ]);
    door.position.set(W / 2 - 0.02, 1.05, z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.25, 1.2), frameMat);
    frame.position.set(W / 2 + 0.02, 1.12, z);
    scene.add(frame, door);
  }

  // Utilería mínima: mochila caída y una silla volcada.
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.18), ps2Lambert({ color: 0x7a1f24 }));
  bag.position.set(0.6, 0.12, -13);
  bag.rotation.set(Math.PI / 2.3, 0.4, 0.2);
  const chairMat = ps2Lambert({ color: 0x5b3f28 });
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), chairMat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.04), chairMat);
  back.position.set(0, 0.22, -0.2);
  chair.add(seat, back);
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.03), ps2Lambert({ color: 0x333333 }));
    leg.position.set(x, -0.22, z);
    chair.add(leg);
  }
  chair.position.set(-0.4, 0.2, -24);
  chair.rotation.set(0, 0.7, Math.PI / 2);
  scene.add(bag, chair);

  // Fluorescentes cada 4 m: el fondo se va apagando hacia la oscuridad.
  const modes: Array<[import('./FluorescentLight').FlickerMode, boolean]> = [
    ['steady', true],
    ['steady', false],
    ['unstable', true],
    ['steady', false],
    ['steady', true],
    ['dying', true],
    ['off', false],
    ['unstable', true],
    ['off', false],
  ];
  modes.forEach(([mode, withLight], i) => {
    const fl = new FluorescentLight(new THREE.Vector3(0, H - 0.05, -i * 4), mode, withLight);
    scene.add(fl.group);
    game.add(fl);
  });

  scene.add(new THREE.AmbientLight(0x2a3a44, 0.6));
  scene.add(new THREE.HemisphereLight(0x33444c, 0x0c0c0a, 0.25));
}
