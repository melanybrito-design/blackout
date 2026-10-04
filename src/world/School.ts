// Colegio San Aurelio: toda la geometría del ala de la demo, con colisiones, puertas, luces,
// objetos con guion y anclas para entidades. Mapa en docs/GUION_DEMO.md.
//
//   PATIO z[2,20] → HALL z[-4,2] → PASILLO x[-1.5,1.5] z[-37,-4]
//        ├── 2°B      x[1.5,9.5]   z[-15,-5]
//        ├── BAÑO     x[-8.5,-1.5] z[-29,-19]
//        └── PASILLO LARGO x[1.5,42] z[-37,-34] → GIMNASIO x[42,58] z[-44,-27]
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { Game } from '../core/Game';
import { LAYER, setLayer } from '../core/layers';
import { ps2Lambert, applyPS2 } from '../render/ps2Material';
import { ceilingTiles, classroomDoor, floorTiles, lockerBank, lockerFront, schoolWall } from '../textures/procedural';
import {
  bathTiles,
  blackboard,
  bloodSplat,
  bloodWriting,
  bulletinBoard,
  burlap,
  chairCard,
  chainFence,
  doorPlate,
  dragMarks,
  exitSign,
  facade,
  footprint,
  gymFloor,
  kidsDrawing,
  mirrorCracks,
  mirrorWriting,
  nightWindow,
  perimeterWall,
  wallClock,
  wetConcrete,
} from '../textures/world';
import { posterCanvas } from '../textures/poster';
import { canvas, toTexture } from '../textures/canvas';
import { optionalTexture } from '../textures/asset';
import { CollisionWorld, type AABB } from './Collision';
import { Door } from './Door';
import { FluorescentLight, type FlickerMode } from './FluorescentLight';
import { LevelBuilder, type MatDef } from './LevelBuilder';
import { chairGeometry, deskGeometry, instanced, Lightning, mergeByMaterial, ps2Basic, Rain, seatedFigure, type Placement } from './props';
import type { Surface } from '../player/PlayerController';

export type Area = 'patio' | 'hall' | 'corridor' | 'classroom' | 'bathroom' | 'long' | 'gym' | 'staff' | 'lab' | 'janitor';

export const AREAS: Record<Area, [number, number, number, number]> = {
  patio: [-8, 8, 2, 20],
  hall: [-4, 4, -4, 2],
  corridor: [-1.5, 1.5, -37, -4],
  classroom: [1.5, 9.5, -15, -5],
  bathroom: [-8.5, -1.5, -29, -19],
  long: [1.5, 42, -37, -34],
  gym: [42, 58, -44, -27],
  staff: [-8.5, -1.5, -19, -12.6],
  lab: [1.5, 9.5, -27, -17],
  janitor: [-6.5, -1.5, -36, -30],
};

/** Posición en z de las cajas de escalera que cortan el pasillo: piso 1 | piso 2 | piso 3. */
export const FLOOR_WALLS = [-19.4, -29.6] as const;

/** Piso (nivel) en el que está un punto del colegio. */
export function floorAt(z: number, x = 0): 1 | 2 | 3 {
  if (x > 1.6 && z < -33) return 3;
  return z > FLOOR_WALLS[0] ? 1 : z > FLOOR_WALLS[1] ? 2 : 3;
}

export interface School {
  collision: CollisionWorld;
  doors: {
    gate: Door;
    room2B: Door;
    bath: Door;
    locker17: Door;
    mid: Door;
    gym: Door;
    staff: Door;
    lab: Door;
    janitor: Door;
    /** Rejas de las escaleras: al piso 2 y al piso 3. */
    stairs2: Door;
    stairs3: Door;
  };
  lights: Record<Area, FluorescentLight[]>;
  allLights: FluorescentLight[];
  footprints: THREE.Group;
  mirror: Reflector;
  mirrorWriting: THREE.Mesh;
  mirrorCracks: THREE.Mesh;
  mirrorBlood: THREE.Mesh;
  pickups: {
    credential: THREE.Object3D;
    recorder: THREE.Object3D;
    photo: THREE.Object3D;
    key: THREE.Object3D;
  };
  anchors: {
    start: THREE.Vector3;
    blackboard: THREE.Vector3;
    lockerFront: THREE.Vector3;
    gymCenter: THREE.Vector3;
    keypad: THREE.Vector3;
    sink: THREE.Vector3;
    corridorFar: THREE.Vector3;
  };
  lightning: Lightning;
  rain: Rain;
  gymGroup: THREE.Group;
  /** Puertas de los cubículos del baño (se abren con E). */
  stalls: Array<{ mesh: THREE.Mesh; collider: AABB; open: boolean; center: THREE.Vector3 }>;
  surfaceAt(x: number, z: number): Surface;
  areaAt(x: number, z: number): Area | null;
  /** Pone todas las luces de un área (o todas) en un modo. */
  setLights(mode: FlickerMode, area?: Area): void;
}

function mat(tex: THREE.Texture | null, tile: [number, number], color?: number): MatDef {
  return { material: ps2Lambert(tex ? { map: tex } : { color: color ?? 0x777777 }), tile };
}

export function buildSchool(game: Game): School {
  const scene = game.scene;
  const collision = new CollisionWorld();
  const B = new LevelBuilder(scene, collision);

  // ---------- Materiales ----------
  const facadeTex = optionalTexture(facade(), 'textures/facade.png');
  facadeTex.offset.x = 0.5;
  const M = {
    wall: mat(optionalTexture(schoolWall(), 'textures/wall_school.png'), [2, 3]),
    floor: mat(optionalTexture(floorTiles(), 'textures/floor_tiles.png'), [1.6, 1.6]),
    ceil: mat(optionalTexture(ceilingTiles(), 'textures/ceiling_tiles.png'), [0.6, 0.6]),
    bath: mat(optionalTexture(bathTiles(), 'textures/bath_tiles.png'), [1.2, 1.2]),
    wood: mat(optionalTexture(gymFloor(), 'textures/gym_floor_tile.png'), [2.4, 1.8]),
    concrete: mat(optionalTexture(wetConcrete(), 'textures/wet_concrete.png'), [3, 3]),
    facade: mat(facadeTex, [16, 7]),
    perimeter: mat(optionalTexture(perimeterWall(), 'textures/perimeter_wall.png'), [3, 3]),
    dark: mat(null, [1, 1], 0x16181a),
    frame: mat(null, [1, 1], 0x2a2018),
    metal: mat(null, [1, 1], 0x3a4448),
    porcelain: mat(null, [1, 1], 0xc9cfcc),
    stall: mat(null, [1, 1], 0x5d7063),
  };

  const lights: Record<Area, FluorescentLight[]> = {
    patio: [],
    hall: [],
    corridor: [],
    classroom: [],
    bathroom: [],
    long: [],
    gym: [],
    staff: [],
    lab: [],
    janitor: [],
  };
  const allLights: FluorescentLight[] = [];
  const light = (area: Area, x: number, y: number, z: number, mode: FlickerMode, withLight: boolean, rotY = 0, intensity?: number) => {
    const fl = new FluorescentLight(new THREE.Vector3(x, y, z), mode, withLight, intensity);
    fl.group.rotation.y = rotY;
    scene.add(fl.group);
    game.add(fl);
    lights[area].push(fl);
    allLights.push(fl);
    return fl;
  };

  const lightning = game.add(new Lightning());

  // ================= PATIO =================
  B.floor(-8, 8, 2, 20, M.concrete);
  B.wallX(-8, 2, 20, 3, M.perimeter);
  B.wallX(8, 2, 20, 3, M.perimeter);
  B.wallZ(20, -8, 8, 3, M.perimeter);
  // Fachada de 2 pisos con entrada
  B.wallZ(2, -8, 8, 7, M.facade, [[-1, 1]], 2.4, 0.3);
  // Reja con malla y portón
  const fenceTex = chainFence();
  fenceTex.repeat.set(1, 1);
  const fenceMat = applyPS2(new THREE.MeshLambertMaterial({ map: fenceTex, alphaTest: 0.5, side: THREE.DoubleSide }));
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  for (const [x1, x2] of [
    [-8, -1.2],
    [1.2, 8],
  ]) {
    const w = x2 - x1;
    const g = new THREE.PlaneGeometry(w, 2.4);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 1.5, uv.getY(i) * 3.6);
    const m = new THREE.Mesh(g, fenceMat);
    m.position.set((x1 + x2) / 2, 1.2, 15);
    scene.add(m);
    collision.add(x1, x2, 14.95, 15.05, 0, 2.4);
    for (let x = x1; x <= x2 + 0.01; x += 1.7) B.box(x - 0.04, x + 0.04, 0, 2.5, 14.96, 15.04, M.metal, { collide: false });
  }
  B.box(-8, 8, 2.4, 2.5, 14.97, 15.03, M.metal, { collide: false });
  const gateTex = chainFence();
  gateTex.wrapS = gateTex.wrapT = THREE.RepeatWrapping;
  gateTex.repeat.set(3.6, 3.4);
  const gate = new Door(scene, collision, {
    hinge: new THREE.Vector3(-1.2, 0, 15),
    width: 2.4,
    height: 2.3,
    axis: 'x',
    dir: 1,
    openAngle: 1.35,
    thickness: 0.05,
    material: applyPS2(new THREE.MeshLambertMaterial({ map: gateTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x9aa0a0 })),
  });
  game.add(gate);
  gate.open();

  // Afiche en la reja (de cara a la calle, donde empieza el jugador)
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.99),
    ps2Lambert({ map: toTexture(posterCanvas(), false), side: THREE.DoubleSide }),
  );
  poster.position.set(-2.6, 1.45, 15.07);
  poster.rotation.z = 0.03;
  scene.add(poster);

  // Farol de la calle
  B.box(3.9, 4.05, 0, 4.2, 17.9, 18.05, M.metal, { collide: true });
  const lamp = new THREE.PointLight(0xffc98a, 16, 16, 1.4);
  lamp.position.set(3.5, 4, 17.8);
  scene.add(lamp);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), ps2Basic({ color: 0xffe0b0 }));
  lampHead.position.set(3.6, 4.1, 17.9);
  scene.add(lampHead);

  // Banca y árbol seco
  B.box(-6, -4.2, 0.4, 0.46, 8, 8.5, M.frame);
  B.box(-5.9, -5.8, 0, 0.4, 8.1, 8.4, M.metal, { collide: false });
  B.box(-4.4, -4.3, 0, 0.4, 8.1, 8.4, M.metal, { collide: false });
  B.box(5.3, 5.6, 0, 3.4, 8.3, 8.6, M.frame);

  const entryLight = new THREE.PointLight(0xbfe0e8, 7, 9, 1.5);
  entryLight.position.set(0, 2.9, 3.2);
  scene.add(entryLight);
  const entryLamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.2), ps2Basic({ color: 0xdff5f8 }));
  entryLamp.position.set(0, 3, 2.3);
  scene.add(entryLamp);

  const rain = game.add(new Rain(-8, 8, 2, 20, 1100));
  scene.add(rain.mesh);
  const skyFlash = new THREE.HemisphereLight(0xb0c8ff, 0x101014, 0);
  scene.add(skyFlash);
  lightning.flashLight = skyFlash;

  // ================= HALL =================
  B.floor(-4, 4, -4, 2, M.floor);
  B.ceiling(-4, 4, -4, 2, M.ceil);
  B.wallX(-4, -4, 2, 3, M.wall);
  B.wallX(4, -4, 2, 3, M.wall);
  B.wallZ(-4, -4, 4, 3, M.wall, [[-1.5, 1.5]], 3);
  B.wallZ(1.8, -4, 4, 3, M.wall, [[-1, 1]], 2.4, 0.1);
  // Vitrina de trofeos
  B.box(3.4, 3.9, 0, 1.9, -2.5, -0.5, M.dark);
  // Diario mural con afiches
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), ps2Lambert({ map: bulletinBoard(posterCanvas()) }));
  bb.position.set(-3.88, 1.6, -1);
  bb.rotation.y = Math.PI / 2;
  scene.add(bb);
  light('hall', 0, 2.95, -1, 'steady', true);
  light('hall', 0, 2.95, 1, 'unstable', false);

  // ================= PASILLO PRINCIPAL =================
  B.floor(-1.5, 1.5, -37, -4, M.floor);
  B.ceiling(-1.5, 1.5, -37, -4, M.ceil);
  // Huecos de puerta: portería, baño y sala de profesores al oeste; laboratorio y 2°B al este.
  B.wallX(-1.5, -37, -4, 3, M.wall, [[-33.6, -32.4], [-24.6, -23.4], [-14.6, -13.4]]);
  B.wallX(1.5, -34, -4, 3, M.wall, [[-22.6, -21.4], [-10.6, -9.4]]);

  // Casilleros 10–16, 17 (con puerta propia), 18–25
  const LW = 0.42;
  const lockerSide = ps2Lambert({ color: 0x3a525e });
  const bank = (start: number, count: number, zTop: number) => {
    const geo = new THREE.BoxGeometry(0.45, 1.85, LW * count);
    const front = ps2Lambert({ map: lockerBank(start, count) });
    const mesh = new THREE.Mesh(geo, [front, lockerSide, lockerSide, lockerSide, lockerSide, lockerSide]);
    mesh.position.set(-1.5 + 0.225, 0.925, zTop - (LW * count) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    collision.add(-1.5, -1.05, zTop - LW * count, zTop, 0, 1.85);
  };
  bank(10, 7, -5.5);
  const z17 = -5.5 - LW * 7;
  bank(18, 8, z17 - LW);
  // Casillero 17: cuerpo hueco + puerta
  B.box(-1.5, -1.05, 0, 0.02, z17 - LW, z17, M.metal, { collide: false });
  B.box(-1.5, -1.05, 1.83, 1.85, z17 - LW, z17, M.metal, { collide: false });
  // El fondo va por delante de la cara del muro (x = -1.4); si no, se ve la pared dentro del casillero.
  B.box(-1.4, -1.37, 0, 1.85, z17 - LW, z17, M.dark, { collide: false });
  B.box(-1.5, -1.05, 1.1, 1.12, z17 - LW, z17, M.metal, { collide: false });
  collision.add(-1.5, -1.12, z17 - LW, z17, 0, 1.85);
  const locker17 = new Door(scene, collision, {
    hinge: new THREE.Vector3(-1.05, 0, z17),
    width: LW,
    height: 1.85,
    axis: 'z',
    dir: -1,
    openAngle: -1.9,
    thickness: 0.03,
    material: [ps2Lambert({ map: lockerFront(17) }), lockerSide, lockerSide, lockerSide, lockerSide, lockerSide],
  });
  game.add(locker17);
  // Foto de Lucía y llave dentro del casillero
  const [blank, blankCtx] = canvas(8, 8);
  blankCtx.fillStyle = '#e8e2d0';
  blankCtx.fillRect(0, 0, 8, 8);
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.104),
    ps2Lambert({ map: optionalTexture(toTexture(blank, false), 'characters/photo_lucia_print.png') }),
  );
  photo.position.set(-1.36, 1.38, z17 - LW / 2);
  photo.rotation.y = Math.PI / 2;
  photo.rotation.z = 0.1;
  scene.add(photo);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.07), ps2Lambert({ color: 0xb09a4a }));
  key.position.set(-1.3, 1.125, z17 - LW / 2);
  scene.add(key);

  // Puertas del pasillo
  // Puertas: hoja pintada de Higgsfield (con ventanita transparente en la 2°B) sobre el respaldo procedural.
  const doorMat2B = applyPS2(
    new THREE.MeshLambertMaterial({
      map: optionalTexture(classroomDoor(true), 'textures/door_window.png'),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  /** Puerta ciega: la foto es azul, así que cada puerta se distingue con un tinte. */
  const solidDoor = (fallbackTint: string, tint: number) => {
    const m = ps2Lambert({ map: classroomDoor(false, fallbackTint) });
    optionalTexture(m.map!, 'textures/door_solid.png', () => m.color.setHex(tint));
    return m;
  };
  (doorMat2B.map as THREE.Texture).wrapS = THREE.ClampToEdgeWrapping;
  const room2B = new Door(scene, collision, {
    hinge: new THREE.Vector3(1.5, 0, -9.4),
    width: 1.2,
    axis: 'z',
    dir: -1,
    openAngle: -1.45,
    material: doorMat2B,
    locked: true,
  });
  room2B.lockedMessage = 'door.locked2B';
  game.add(room2B);
  const bath = new Door(scene, collision, {
    hinge: new THREE.Vector3(-1.5, 0, -23.4),
    width: 1.2,
    axis: 'z',
    dir: -1,
    openAngle: 1.45,
    material: solidDoor('#56606a', 0xb9c2c4),
    locked: true,
  });
  bath.lockedMessage = 'door.lockedBath';
  game.add(bath);

  const plate = (key: string, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), ps2Lambert({ map: doorPlate(key) }));
    m.position.set(x, 2.45, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  plate('plate.2b', 1.39, -10, -Math.PI / 2);
  plate('plate.bath', -1.39, -24, Math.PI / 2);
  plate('plate.lab', 1.39, -22, -Math.PI / 2);
  plate('plate.staff', -1.39, -14, Math.PI / 2);
  plate('plate.janitor', -1.39, -33, Math.PI / 2);

  // Dibujos infantiles
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), ps2Lambert({ map: kidsDrawing(40 + i) }));
    m.position.set(1.38, 1.5 + (i % 2) * 0.35, -14 - i * 0.9);
    m.rotation.set(0, -Math.PI / 2, (Math.random() - 0.5) * 0.1);
    scene.add(m);
  }
  // Mochila tirada
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.18), ps2Lambert({ color: 0x7a1f24 }));
  bag.position.set(0.7, 0.12, -15.5);
  bag.rotation.set(Math.PI / 2.3, 0.4, 0.2);
  scene.add(bag);
  // Credencial de Daniela en el piso
  const credential = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.005, 0.06), ps2Lambert({ color: 0xd9e4ea }));
  credential.position.set(0.35, 0.01, -7.2);
  credential.rotation.y = 0.5;
  scene.add(credential);
  // Marcas de arrastre hacia el baño
  const drag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 2.4),
    ps2Lambert({ map: dragMarks(), transparent: true, depthWrite: false }),
  );
  drag.rotation.set(-Math.PI / 2, 0, Math.PI / 2.4);
  drag.position.set(-0.4, 0.012, -23.2);
  scene.add(drag);

  // Huellas descalzas espectrales: de la entrada del pasillo a la puerta de la 2°B
  const footprints = new THREE.Group();
  const fpMat = new THREE.MeshBasicMaterial({ map: optionalTexture(footprint(), 'textures/decal_footprints.png'), transparent: true, depthWrite: false });
  const fpGeo = new THREE.PlaneGeometry(0.11, 0.24);
  const path: Array<[number, number]> = [];
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const z = -4.6 - t * 5.1;
    const x = THREE.MathUtils.lerp(0, 1.25, Math.pow(t, 2.2));
    path.push([x, z]);
  }
  path.forEach(([x, z], i) => {
    const m = new THREE.Mesh(fpGeo, fpMat);
    const side = i % 2 ? 0.1 : -0.1;
    m.position.set(x + side, 0.015, z);
    m.rotation.set(-Math.PI / 2, 0, Math.PI + (i > 9 ? -0.6 : 0));
    footprints.add(m);
  });
  // Más huellas mojadas hacia el baño (tras S2)
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(fpGeo, fpMat);
    m.position.set(-0.2 - (i / 9) * 1.1 + (i % 2 ? 0.1 : -0.1), 0.015, -12.5 - i * 1.1);
    m.rotation.set(-Math.PI / 2, 0, Math.PI - 0.15);
    m.name = 'bathPrint';
    footprints.add(m);
  }
  setLayer(footprints, LAYER.SPECTRAL);
  scene.add(footprints);

  ([
    [-6, 'steady', true],
    [-10, 'steady', false],
    [-14, 'unstable', true],
    [-18, 'steady', false],
    [-22, 'steady', true],
    [-26, 'dying', false],
    [-30, 'unstable', true],
    [-34, 'off', false],
  ] as Array<[number, FlickerMode, boolean]>).forEach(([z, m, l]) => light('corridor', 0, 2.95, z, m, l));

  // Utilería del pasillo: zócalos, tuberías, reloj detenido a las 21:00, extintor, basurero, bebedero
  B.box(1.38, 1.4, 0, 0.12, -34, -4, M.frame, { collide: false });
  B.box(-1.4, -1.38, 0, 0.12, -37, -12.3, M.frame, { collide: false });
  B.box(0.95, 1.1, 2.72, 2.84, -37, -4, M.metal, { collide: false });
  B.box(0.75, 0.85, 2.78, 2.88, -37, -4, M.metal, { collide: false });
  for (let z = -6; z > -37; z -= 3) B.box(0.7, 1.4, 2.7, 2.9, z - 0.04, z + 0.04, M.metal, { collide: false });
  const clockMat = ps2Lambert({ map: wallClock(), transparent: true });
  for (const [x, y, z, ry] of [
    [1.38, 2.35, -6.5, -Math.PI / 2],
    [9.38, 2.6, -10, -Math.PI / 2],
  ] as Array<[number, number, number, number]>) {
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), clockMat);
    clock.position.set(x, y, z);
    clock.rotation.y = ry;
    scene.add(clock);
  }
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), ps2Lambert({ color: 0x8e1414 }));
  ext.position.set(1.36, 1.05, -16.8);
  scene.add(ext);
  const bin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.17, 0.55, 10, 1, true),
    ps2Lambert({ color: 0x2c3a33, side: THREE.DoubleSide }),
  );
  bin.position.set(1.15, 0.275, -27);
  scene.add(bin);
  collision.add(0.95, 1.4, -27.25, -26.75, 0, 0.6);
  // Bebedero de acero: placa en la pared, cuenco, pie y la canilla
  B.box(-1.4, -1.36, 0.7, 1.35, -16.45, -15.55, M.metal, { collide: false });
  B.box(-1.4, -1.1, 0.82, 0.96, -16.35, -15.65, M.metal);
  B.box(-1.12, -1.08, 0.86, 1.0, -16.35, -15.65, M.metal, { collide: false });
  B.box(-1.38, -1.24, 0, 0.82, -16.12, -15.88, M.dark, { collide: false });
  B.box(-1.3, -1.24, 0.96, 1.02, -16.03, -15.97, M.porcelain, { collide: false });

  // ================= SALA 2°B =================
  B.floor(1.5, 9.5, -15, -5, M.wood);
  B.ceiling(1.5, 9.5, -15, -5, M.ceil);
  B.wallZ(-5, 1.5, 9.5, 3, M.wall);
  B.wallZ(-15, 1.5, 9.5, 3, M.wall);
  B.wallX(9.5, -15, -5, 3, M.wall);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), ps2Lambert({ map: blackboard() }));
  board.position.set(9.38, 1.55, -10);
  board.rotation.y = -Math.PI / 2;
  scene.add(board);
  B.box(9.3, 9.4, 0.8, 0.86, -11.5, -8.5, M.frame, { collide: false });
  // Escritorio del profesor
  B.box(7.6, 8.8, 0.72, 0.78, -9.0, -8.2, M.frame);
  B.box(7.65, 8.75, 0, 0.72, -8.95, -8.9, M.frame, { collide: false });
  // Grabadora
  const recorder = new THREE.Group();
  const recBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), ps2Lambert({ color: 0x2a2a2c }));
  const recTape = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.005, 0.06), ps2Lambert({ color: 0xcfc8b0 }));
  recTape.position.y = 0.032;
  recorder.add(recBody, recTape);
  recorder.position.set(8.1, 0.81, -8.6);
  recorder.rotation.y = 0.4;
  scene.add(recorder);
  // Ventanas
  for (const x of [3.5, 5.5, 7.5]) {
    const wm = ps2Basic({ map: optionalTexture(nightWindow(), 'textures/night_window.png') });
    lightning.addWindow(wm);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.3), wm);
    w.position.set(x, 1.7, -14.88);
    scene.add(w);
  }
  // Sillas en círculo (ensayo) + una volcada
  const chairMat = ps2Lambert({ color: 0x6a4a30 });
  const circle: Placement[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = 5.2 + Math.cos(a) * 1.9;
    const z = -10.8 + Math.sin(a) * 1.9;
    const ry = Math.atan2(5.2 - x, -10.8 - z);
    if (i === 3) circle.push({ x, z, y: 0.2, ry, rz: Math.PI / 2 });
    else circle.push({ x, z, ry });
  }
  instanced(scene, chairGeometry(), chairMat, circle);
  for (const p of circle) collision.add(p.x - 0.22, p.x + 0.22, p.z - 0.22, p.z + 0.22, 0, 0.9);
  // Mesas apiladas contra la pared norte
  const desks: Placement[] = [];
  for (let i = 0; i < 6; i++) desks.push({ x: 2.4 + i * 1.1, z: -5.5, ry: 0 });
  instanced(scene, deskGeometry(), chairMat, desks);
  collision.add(1.8, 9.2, -5.9, -5, 0, 0.8);
  // Guiones tirados
  const papers: Placement[] = [];
  for (let i = 0; i < 7; i++) papers.push({ x: 4 + Math.random() * 3, y: 0.006 + i * 0.001, z: -12.5 + Math.random() * 3.5, rx: -Math.PI / 2, rz: Math.random() * 6 });
  instanced(scene, new THREE.PlaneGeometry(0.21, 0.29), ps2Lambert({ color: 0xe6e1d2 }), papers);
  light('classroom', 4, 2.95, -10, 'steady', true, Math.PI / 2);
  light('classroom', 7.5, 2.95, -10, 'unstable', true, Math.PI / 2);

  // ================= BAÑO =================
  B.floor(-8.5, -1.5, -29, -19, M.bath);
  B.ceiling(-8.5, -1.5, -29, -19, M.ceil);
  B.wallX(-8.5, -29, -19, 3, M.bath);
  B.wallZ(-19, -8.5, -1.5, 3, M.bath);
  B.wallZ(-29, -8.5, -1.5, 3, M.bath);
  B.wallX(-1.64, -29, -19, 3, M.bath, [[-24.6, -23.4]], 2.2, 0.04);
  // Lavamanos
  const sinks = [-21.5, -23, -24.5, -26];
  for (const z of sinks) {
    B.box(-8.4, -7.85, 0.78, 0.92, z - 0.3, z + 0.3, M.porcelain);
    B.box(-8.35, -8.15, 0, 0.78, z - 0.08, z + 0.08, M.porcelain, { collide: false });
    B.box(-8.42, -8.36, 0.92, 1.05, z - 0.02, z + 0.02, M.metal, { collide: false });
  }
  // Sangre en el lavamanos 2 y uñas en el desagüe
  const sinkBlood = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 0.45),
    ps2Lambert({ map: optionalTexture(bloodSplat(77), 'textures/decal_blood_splat.png'), transparent: true, depthWrite: false }),
  );
  sinkBlood.rotation.x = -Math.PI / 2;
  sinkBlood.position.set(-8.12, 0.925, -23);
  scene.add(sinkBlood);
  for (let i = 0; i < 5; i++) {
    const x = -8.12 + (Math.random() - 0.5) * 0.05;
    const z = -23 + (Math.random() - 0.5) * 0.05;
    B.box(x - 0.006, x + 0.006, 0.928, 0.931, z - 0.005, z + 0.005, M.porcelain, { collide: false });
  }
  // Espejo (reflejo real): ve al mundo + cuerpo del jugador + lo que solo existe en espejos
  const mirror = new Reflector(new THREE.PlaneGeometry(6.2, 1.15), {
    textureWidth: 384,
    textureHeight: 72,
    color: 0x9aa4a6,
    multisample: 0,
  });
  mirror.position.set(-8.36, 1.7, -23.75);
  mirror.rotation.y = Math.PI / 2;
  scene.add(mirror);
  const refCam = mirror.getReflectionCamera(game.camera);
  refCam.layers.set(LAYER.WORLD);
  refCam.layers.enable(LAYER.PLAYER_BODY);
  refCam.layers.enable(LAYER.MIRROR_ONLY);
  B.box(-8.42, -8.34, 1.08, 1.12, -26.9, -20.6, M.metal, { collide: false });
  B.box(-8.42, -8.34, 2.28, 2.32, -26.9, -20.6, M.metal, { collide: false });
  const writing = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.35),
    new THREE.MeshBasicMaterial({ map: mirrorWriting(), transparent: true, depthWrite: false }),
  );
  writing.position.set(-8.33, 1.75, -24.5);
  writing.rotation.y = Math.PI / 2;
  setLayer(writing, LAYER.SPECTRAL);
  scene.add(writing);
  const cracks = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 1.15),
    new THREE.MeshBasicMaterial({ map: optionalTexture(mirrorCracks(), 'textures/decal_cracks_clean.png'), transparent: true, depthWrite: false }),
  );
  cracks.position.set(-8.33, 1.7, -23.2);
  cracks.rotation.y = Math.PI / 2;
  cracks.visible = false;
  scene.add(cracks);
  const blood = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.68),
    ps2Lambert({ map: bloodWriting(), transparent: true, depthWrite: false }),
  );
  blood.position.set(-8.32, 1.7, -21.8);
  blood.rotation.y = Math.PI / 2;
  blood.visible = false;
  scene.add(blood);
  // Cubículos contra la pared norte
  for (let i = 0; i < 4; i++) {
    const x = -8.3 + i * 1.5;
    B.box(x - 0.03, x + 0.03, 0.15, 2.1, -20.4, -19, M.stall);
  }
  const stalls: School['stalls'] = [];
  for (let i = 0; i < 3; i++) {
    const x = -8.3 + i * 1.5;
    const open = i === 1;
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.95, 0.04), M.stall.material);
    d.geometry.translate(0.7, 0.975, 0);
    d.position.set(x + 0.03, 0.15, -20.4);
    d.rotation.y = open ? 1.2 : 0.15;
    scene.add(d);
    const collider = collision.add(x, x + 1.45, -20.45, -20.35, 0, 2);
    collider.enabled = !open;
    stalls.push({ mesh: d, collider, open, center: new THREE.Vector3(x + 0.75, 1.1, -20.4) });
  }
  // Balde y trapero
  B.box(-3, -2.6, 0, 0.35, -28.5, -28.1, M.dark);
  light('bathroom', -5, 2.95, -22, 'steady', true, Math.PI / 2);
  light('bathroom', -5, 2.95, -26, 'unstable', true, Math.PI / 2);

  // ================= SALAS PARA EXPLORAR (primer piso) =================
  // No traban la historia: se abren con E y cuentan lo que pasó con las seis.
  const sideDoor = (x: number, zHinge: number, tint: number) => {
    const d = new Door(scene, collision, {
      hinge: new THREE.Vector3(x, 0, zHinge),
      width: 1.2,
      axis: 'z',
      dir: -1,
      openAngle: x < 0 ? 1.45 : -1.45,
      material: solidDoor('#5a5246', tint),
    });
    game.add(d);
    return d;
  };
  const sheet = (x: number, y: number, z: number, ry: number, color = 0xe6e1d2) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), ps2Lambert({ color }));
    m.rotation.set(-Math.PI / 2, 0, ry);
    m.position.set(x, y, z);
    scene.add(m);
  };

  // ---- Sala de profesores (oeste, entre los casilleros y el baño) ----
  B.floor(-8.5, -1.5, -19, -12.6, M.wood);
  B.ceiling(-8.5, -1.5, -19, -12.6, M.ceil);
  B.wallX(-8.5, -19, -12.6, 3, M.wall);
  B.wallZ(-12.6, -8.5, -1.5, 3, M.wall);
  B.wallZ(-18.86, -8.5, -1.6, 3, M.wall, [], 2.2, 0.06);
  const staffDoor = sideDoor(-1.5, -13.4, 0xc9b596);
  B.box(-6.2, -3.8, 0.7, 0.76, -16.6, -15.2, M.frame); // mesa de reuniones
  B.box(-6.1, -6.0, 0, 0.7, -16.5, -15.3, M.frame, { collide: false });
  B.box(-4.0, -3.9, 0, 0.7, -16.5, -15.3, M.frame, { collide: false });
  B.box(-8.3, -7.5, 0, 0.45, -18.5, -16.3, M.dark); // sillón
  B.box(-8.3, -8.1, 0.45, 0.9, -18.5, -16.3, M.dark, { collide: false });
  B.box(-7.6, -5.4, 0, 1.9, -13.1, -12.7, M.metal); // archivero
  B.box(-3.2, -2.2, 0, 0.9, -13.15, -12.7, M.frame); // mesita del café
  const staffChairs: Placement[] = [
    { x: -5.6, z: -14.7, ry: 0 },
    { x: -4.4, z: -14.8, ry: 0.3 },
    { x: -5.4, z: -17.1, ry: Math.PI },
    { x: -4.2, z: -17.2, ry: Math.PI - 0.5 },
  ];
  instanced(scene, chairGeometry(), chairMat, staffChairs);
  for (const p of staffChairs) collision.add(p.x - 0.22, p.x + 0.22, p.z - 0.22, p.z + 0.22, 0, 0.9);
  const staffBoard = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), ps2Lambert({ map: bulletinBoard(posterCanvas()) }));
  staffBoard.position.set(-8.38, 1.6, -15.2);
  staffBoard.rotation.y = Math.PI / 2;
  scene.add(staffBoard);
  sheet(-4.5, 0.766, -15.9, 0.4); // libro de actas
  const seized = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.24), ps2Lambert({ color: 0x6b5132 }));
  seized.position.set(-5.5, 0.83, -15.8);
  seized.rotation.y = 0.3;
  scene.add(seized);
  light('staff', -5, 2.95, -15.8, 'unstable', true, Math.PI / 2, 9);

  // ---- Laboratorio (este, al sur de la 2°B) ----
  B.floor(1.5, 9.5, -27, -17, M.floor);
  B.ceiling(1.5, 9.5, -27, -17, M.ceil);
  B.wallZ(-17, 1.5, 9.5, 3, M.wall);
  B.wallZ(-27, 1.5, 9.5, 3, M.wall);
  B.wallX(9.5, -27, -17, 3, M.wall);
  const labDoor = sideDoor(1.5, -21.4, 0xb9c2c4);
  for (const z of [-19.4, -22, -24.6]) {
    B.box(3.4, 8.0, 0, 0.86, z - 0.4, z + 0.4, M.dark); // mesones
    B.box(3.35, 8.05, 0.86, 0.9, z - 0.45, z + 0.45, M.stall, { collide: false });
  }
  B.box(9.0, 9.4, 0, 2.0, -26.2, -17.8, M.frame); // estantería de frascos
  B.box(8.95, 9.4, 0.98, 1.02, -26.2, -17.8, M.metal, { collide: false });
  B.box(8.95, 9.4, 1.48, 1.52, -26.2, -17.8, M.metal, { collide: false });
  B.box(2.0, 3.0, 0, 0.9, -17.55, -17.1, M.porcelain); // lavatorio
  const jars: Placement[] = [];
  for (let i = 0; i < 16; i++) jars.push({ x: 9.05, y: (i % 2 ? 1.6 : 1.1) + 0.01, z: -18.3 - i * 0.5 });
  instanced(scene, new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), ps2Lambert({ color: 0x6f8f6a }), jars);
  const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), ps2Lambert({ color: 0x6f8f6a }));
  fallen.position.set(8.3, 0.07, -21.2);
  fallen.rotation.z = Math.PI / 2;
  scene.add(fallen);
  for (const x of [4, 7]) {
    const wm = ps2Basic({ map: optionalTexture(nightWindow(), 'textures/night_window.png') });
    lightning.addWindow(wm);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.3), wm);
    w.position.set(x, 1.7, -26.88);
    scene.add(w);
  }
  sheet(5.6, 0.906, -22.05, -0.3, 0xd9d2b4); // cuaderno de laboratorio
  light('lab', 4.2, 2.95, -22, 'dying', true, Math.PI / 2, 9);
  light('lab', 7.6, 2.95, -22, 'off', false, Math.PI / 2);

  // ---- Portería (oeste, al sur del baño) ----
  B.floor(-6.5, -1.5, -36, -30, M.concrete);
  B.ceiling(-6.5, -1.5, -36, -30, M.ceil);
  B.wallZ(-30, -6.5, -1.5, 3, M.perimeter);
  B.wallZ(-36, -6.5, -1.5, 3, M.perimeter);
  B.wallX(-6.5, -36, -30, 3, M.perimeter);
  const janitorDoor = sideDoor(-1.5, -32.4, 0x8f9aa6);
  B.box(-6.4, -5.9, 0, 2.0, -35.6, -30.4, M.metal); // estantes
  B.box(-4.8, -3.2, 0.7, 0.76, -35.8, -35.1, M.frame); // escritorio
  B.box(-4.7, -4.6, 0, 0.7, -35.7, -35.2, M.frame, { collide: false });
  B.box(-3.4, -3.3, 0, 0.7, -35.7, -35.2, M.frame, { collide: false });
  B.box(-2.4, -2.0, 0, 0.35, -30.9, -30.5, M.dark); // balde
  instanced(scene, chairGeometry(), chairMat, [{ x: -4, z: -34.5, ry: Math.PI }]);
  collision.add(-4.22, -3.78, -34.72, -34.28, 0, 0.9);
  const keyBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), ps2Lambert({ color: 0x4a3a28 }));
  keyBoard.position.set(-3.8, 1.55, -30.12);
  keyBoard.rotation.y = Math.PI;
  scene.add(keyBoard);
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.1), ps2Lambert({ color: 0x2a2a2c }));
  radio.position.set(-3.5, 0.84, -35.5);
  scene.add(radio);
  sheet(-4.3, 0.766, -35.45, 0.15);
  light('janitor', -4, 2.95, -33, 'unstable', true, Math.PI / 2, 7);

  // ================= ESCALERAS (los niveles son los pisos) =================
  // El pasillo principal se corta en tres tramos, uno por piso. Cada corte es una caja de escalera:
  // del lado de abajo se ven los peldaños que suben tras una reja; del lado de arriba, el hueco que baja.
  const voidMat = ps2Basic({ color: 0x020303 });
  const barTex = chainFence();
  barTex.wrapS = barTex.wrapT = THREE.RepeatWrapping;
  barTex.repeat.set(4.2, 3.4);
  const stairwell = (zWall: number, upKey: string, downKey: string) => {
    B.wallZ(zWall, -1.5, 1.5, 3, M.wall);
    // Peldaños que suben (lado norte = piso de abajo)
    for (let i = 0; i < 6; i++) {
      const z2 = zWall + 0.1 + (6 - i) * 0.3;
      B.box(-1.4, 1.4, 0, (i + 1) * 0.18, z2 - 0.3, z2, M.concrete, { collide: false });
    }
    collision.add(-1.5, 1.5, zWall, zWall + 1.9, 0, 3);
    const up = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.95), voidMat);
    up.position.set(0, 2.05, zWall + 0.115);
    scene.add(up);
    B.box(-1.4, -1.34, 0, 1.6, zWall + 0.1, zWall + 1.9, M.metal, { collide: false }); // barandas
    B.box(1.34, 1.4, 0, 1.6, zWall + 0.1, zWall + 1.9, M.metal, { collide: false });
    plate(upKey, 1.39, zWall + 2.6, -Math.PI / 2);
    const gate = new Door(scene, collision, {
      hinge: new THREE.Vector3(-1.45, 0, zWall + 2.05),
      width: 2.9,
      height: 2.6,
      axis: 'x',
      dir: 1,
      openAngle: 1.45,
      thickness: 0.05,
      material: applyPS2(new THREE.MeshLambertMaterial({ map: barTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x9aa0a0 })),
      locked: true,
    });
    game.add(gate);
    // Hueco que baja (lado sur = piso de arriba)
    const down = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.2), voidMat);
    down.position.set(0, 1.1, zWall - 0.115);
    down.rotation.y = Math.PI;
    scene.add(down);
    B.box(-0.95, -0.85, 0, 2.3, zWall - 0.2, zWall - 0.1, M.frame, { collide: false });
    B.box(0.85, 0.95, 0, 2.3, zWall - 0.2, zWall - 0.1, M.frame, { collide: false });
    B.box(-0.95, 0.95, 2.2, 2.3, zWall - 0.2, zWall - 0.1, M.frame, { collide: false });
    plate(downKey, -1.39, zWall - 0.9, Math.PI / 2);
    return gate;
  };
  const stairs2 = stairwell(FLOOR_WALLS[0], 'plate.up2', 'plate.down1');
  const stairs3 = stairwell(FLOOR_WALLS[1], 'plate.up3', 'plate.down2');

  // ================= PASILLO LARGO =================
  B.floor(-1.5, 42, -37, -34, M.floor);
  B.ceiling(1.5, 42, -37, -34, M.ceil);
  B.wallZ(-34, 1.5, 42, 3, M.wall);
  B.wallZ(-37, -1.5, 42, 3, M.wall);
  B.wallX(42, -37, -34, 3, M.wall, [[-36.1, -34.9]]);
  B.wallX(22, -37, -34, 3, M.wall, [[-36.1, -34.9]], 2.2, 0.15);
  for (let x = 5; x < 41; x += 6) {
    const wm = ps2Basic({ map: optionalTexture(nightWindow(), 'textures/night_window.png') });
    lightning.addWindow(wm);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), wm);
    w.position.set(x, 1.75, -34.12);
    w.rotation.y = Math.PI;
    scene.add(w);
  }
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    applyPS2(new THREE.MeshPhongMaterial({ color: 0x05080a, specular: 0x8aa4b0, shininess: 90, transparent: true, opacity: 0.85 })),
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(3.1, 1.3, 1);
  puddle.position.set(28.5, 0.012, -35.5);
  scene.add(puddle);

  // Mesas volcadas como obstáculos
  B.box(8.6, 9.4, 0, 0.8, -37, -35.5, M.frame);
  B.box(14.6, 15.4, 0, 0.8, -35.4, -34, M.frame);
  B.box(30, 31.2, 0, 0.75, -37, -35.8, M.frame);
  const mid = new Door(scene, collision, {
    hinge: new THREE.Vector3(22, 0, -34.9),
    width: 1.2,
    axis: 'z',
    dir: -1,
    openAngle: -1.4,
    material: solidDoor('#4a3a2a', 0xc9b596),
    locked: true,
  });
  mid.lockedMessage = 'door.stuck';
  game.add(mid);
  const signMat = new THREE.MeshBasicMaterial({ map: exitSign() });
  for (const x of [21.9, 41.9]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), signMat);
    s.position.set(x, 2.5, -35.5);
    s.rotation.y = -Math.PI / 2;
    scene.add(s);
    const glow = new THREE.PointLight(0x2aff6a, 0.9, 3.5, 2);
    glow.position.set(x - 0.3, 2.4, -35.5);
    scene.add(glow);
  }
  plate('plate.gym', 41.9, -35.5, -Math.PI / 2);
  for (let i = 0; i < 8; i++) light('long', 4 + i * 5, 2.95, -35.5, i === 5 ? 'dying' : 'steady', i % 2 === 0, Math.PI / 2);

  // ================= GIMNASIO =================
  B.floor(42, 58, -44, -27, M.wood);
  B.ceiling(42, 58, -44, -27, M.dark, 6);
  B.wallX(42, -44, -27, 6, M.perimeter, [[-36.1, -34.9]], 2.2);
  B.wallX(58, -44, -27, 6, M.perimeter);
  B.wallZ(-27, 42, 58, 6, M.perimeter);
  B.wallZ(-44, 42, 58, 6, M.perimeter);
  const gymDoor = new Door(scene, collision, {
    hinge: new THREE.Vector3(42, 0, -34.9),
    width: 1.2,
    axis: 'z',
    dir: -1,
    openAngle: -1.5,
    material: solidDoor('#3b4b58', 0x8f9aa6),
    locked: true,
  });
  gymDoor.lockedMessage = 'door.gymCode';
  game.add(gymDoor);
  // Candado
  const padlock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.08), ps2Lambert({ color: 0x8c8c80 }));
  padlock.position.set(41.9, 1.05, -35.9);
  scene.add(padlock);
  // Aro de básquetbol
  B.box(57.6, 57.9, 3.1, 4.2, -36.4, -34.6, M.porcelain, { collide: false });
  B.box(57.9, 58, 0, 4.2, -35.6, -35.4, M.metal, { collide: false });

  const gymGroup = new THREE.Group();
  const figures = new THREE.Group();
  const gc = new THREE.Vector3(51, 0, -35.5);
  const gymChairs: Placement[] = [];
  const uniformMat = ps2Lambert({ color: 0xd9d6cc });
  const skinMat = ps2Lambert({ color: 0xb8aa9c });
  const skirtMat = ps2Lambert({ color: 0x1d2436 });
  const bagMat = ps2Lambert({ map: burlap() });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.PI;
    const x = gc.x + Math.cos(a) * 3.2;
    const z = gc.z + Math.sin(a) * 3.2;
    const ry = Math.atan2(gc.x - x, gc.z - z);
    gymChairs.push({ x, z, ry });
    collision.add(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, 1.2);
    if (i >= 1 && i <= 5) {
      const f = seatedFigure(uniformMat, skinMat, skirtMat, bagMat);
      f.position.set(x, 0, z);
      f.rotation.y = ry;
      figures.add(f);
    }
    if (i === 6) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), ps2Lambert({ map: chairCard() }));
      card.position.set(x, 0.48, z);
      card.rotation.set(-Math.PI / 2 + 0.3, 0, -ry, 'YXZ');
      card.rotation.set(-1.2, ry, 0, 'YXZ');
      gymGroup.add(card);
    }
  }
  instanced(scene, chairGeometry(), chairMat, gymChairs);
  gymGroup.add(mergeByMaterial(figures));
  scene.add(gymGroup);
  const gymDrag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 6),
    ps2Lambert({ map: dragMarks(), transparent: true, depthWrite: false }),
  );
  gymDrag.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  gymDrag.position.set(45.5, 0.012, -35.5);
  scene.add(gymDrag);
  light('gym', 51, 5.9, -35.5, 'dying', true, 0, 16);
  light('gym', 46, 5.9, -31, 'off', true, 0, 12);

  // Luz ambiente mínima: la oscuridad es real
  scene.add(new THREE.AmbientLight(0x22313a, 0.35));
  scene.add(new THREE.HemisphereLight(0x2b3a44, 0x080806, 0.18));

  B.finalize();

  const areaAt = (x: number, z: number): Area | null => {
    for (const [name, [x1, x2, z1, z2]] of Object.entries(AREAS) as Array<[Area, [number, number, number, number]]>)
      if (x >= x1 && x <= x2 && z >= z1 && z <= z2) return name;
    return null;
  };

  return {
    collision,
    doors: { gate, room2B, bath, locker17, mid, gym: gymDoor, staff: staffDoor, lab: labDoor, janitor: janitorDoor, stairs2, stairs3 },
    lights,
    allLights,
    footprints,
    mirror,
    mirrorWriting: writing,
    mirrorCracks: cracks,
    mirrorBlood: blood,
    pickups: { credential, recorder, photo, key },
    anchors: {
      start: new THREE.Vector3(0, 0, 18.3),
      blackboard: new THREE.Vector3(9.38, 1.55, -10),
      lockerFront: new THREE.Vector3(-0.6, 0, z17 - LW / 2),
      gymCenter: gc,
      keypad: new THREE.Vector3(41.95, 1.05, -35.9),
      sink: new THREE.Vector3(-8.12, 0.95, -23),
      corridorFar: new THREE.Vector3(0, 0, -6),
    },
    lightning,
    rain,
    gymGroup,
    stalls,
    surfaceAt(x, z) {
      const a = areaAt(x, z);
      if (a === 'patio') return 'concrete';
      if (a === 'classroom' || a === 'gym' || a === 'staff') return 'wood';
      if (a === 'janitor') return 'concrete';
      if (a === 'long' && x > 25.5 && x < 31.5) return 'water';
      return 'tile';
    },
    areaAt,
    setLights(mode, area) {
      for (const l of area ? lights[area] : allLights) l.mode = mode;
    },
  };
}
