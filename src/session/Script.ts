// Guion de la demo (docs/GUION_DEMO.md): prólogo, 4 actos, final. Conecta pistas, herramientas,
// puertas y los 5 screamers mayores (S1–S5), que dispara el Director de Miedo.
import * as THREE from 'three';
import type { Session } from './Session';
import { FLOOR_WALLS, floorAt, type Area } from '../world/School';
import { StoryState, type Checkpoint, type Flag } from '../narrative/StoryState';
import { GirlModel } from '../entities/GirlModel';
import { LAYER } from '../core/layers';
import { GIRLS } from '../narrative/girls';
import { posterCanvas } from '../textures/poster';
import { t as tItem } from '../i18n';
import { ps2Lambert } from '../render/ps2Material';

const SEED = Object.fromEntries(GIRLS.map((g) => [g.id, g.seed])) as Record<string, number>;

type Stage =
  | 'free'
  | 's1_seen'
  | 's1_turned'
  | 's2_wait'
  | 's3_ramp'
  | 's3_wait'
  | 's4_call'
  | 'chase'
  | 'final_approach'
  | 'final_turn'
  | 'ended';

export class Script {
  private stage: Stage = 'free';
  private t = 0;
  private stageT = 0;
  private prevArea: Area | 'none' = 'none';
  private s1Yaw = 0;
  private daniela: GirlModel;
  private lucia: GirlModel;
  private bathT = 0;
  private dripT = 0;
  private rattleT = 0;
  private catches = 0;
  private finalT = 0;
  private s1Queued = false;
  private climbing = false;
  private spectral: GirlModel;
  private spectralT = -1;
  private once = new Set<string>();
  private try2B: () => void = () => undefined;
  private autoShot = false;
  private recIdle = 0;
  private tutorT = 0;
  private keysShown = new Set<string>();
  private beatId = '';
  private beatT = 0;
  private seenAreas = new Set<string>();
  private tmp = new THREE.Vector3();

  constructor(private s: Session) {
    this.daniela = new GirlModel({ seed: SEED.daniela, scary: 1, hairFront: 0.3, wet: true });
    this.daniela.root.visible = false;
    this.daniela.pose(0.25, 0.1);
    s.scene.add(this.daniela.root);
    this.lucia = new GirlModel({ seed: SEED.lucia, scary: 0, hairFront: 0.15 });
    this.lucia.root.position.copy(s.school.anchors.gymCenter);
    // El frente del modelo es +z: con +90° mira al este, de espaldas a la puerta (que está al oeste).
    this.lucia.root.rotation.y = LUCIA_BACK;
    this.lucia.pose(0.08);
    s.scene.add(this.lucia.root);

    // La Huella: Daniela está parada donde terminan las huellas, pero solo la cámara del celular la ve.
    this.spectral = new GirlModel({ seed: SEED.daniela, scary: 1, hairFront: 0.6, wet: true });
    this.spectral.root.position.set(1.05, 0, -9.2);
    this.spectral.root.rotation.y = -0.5;
    this.spectral.pose(0.45, 0.1);
    this.spectral.root.traverse((o) => o.layers.set(LAYER.SPECTRAL));
    s.scene.add(this.spectral.root);

    this.setupInteractables();
    this.setupTools();
  }

  // =============== Utilidades ===============

  private get story(): StoryState {
    return this.s.story;
  }

  private flag(f: Flag): void {
    this.story.set(f);
  }

  private later(sec: number, fn: () => void): void {
    this.s.events.later(sec, fn);
  }

  private go(stage: Stage): void {
    this.stage = stage;
    this.stageT = 0;
  }

  private addClue(id: string, thumb?: HTMLCanvasElement): void {
    if (this.s.journal.addClue(id, thumb)) {
      this.s.hud.toast('hint.newClue');
      this.s.audio.play('pencil');
    }
  }

  /** Una pertenencia o un hecho suma una línea a la ficha de esa chica en el diario. */
  private person(id: string, note = `people.${id}`, announce = true): void {
    if (this.s.journal.knowPerson(id, note) && announce) {
      this.later(2.2, () => this.s.hud.toast('hint.newPerson', 3));
      this.s.audio.play('pencil');
    }
  }

  private goal(key: string): void {
    this.s.journal.setGoal(key);
    this.s.hud.objective(key);
  }

  save(cp: Checkpoint): void {
    this.story.checkpoint = cp;
    this.story.save([...this.s.journal.graph.clues], [...this.s.journal.graph.links]);
  }

  /** Ángulo entre la mirada del jugador y un punto (1 = de frente). */
  private facing(x: number, z: number): number {
    const p = this.s.player;
    const f = p.forward(this.tmp);
    const dx = x - p.position.x;
    const dz = z - p.position.z;
    const d = Math.hypot(dx, dz) || 1;
    return (f.x * dx + f.z * dz) / d;
  }

  // =============== Inicio ===============

  startNew(): void {
    const a = this.s.school.anchors.start;
    this.s.player.teleport(a.x, a.z, 0);
    this.s.screamer.blackout(1.6);
    // El SMS de Lucía ya llegó (se vio en el prólogo): está sin leer en el celular.
    this.s.phone.available = true;
    this.s.phone.sms.push({ key: 'sms.1', time: '20:58' });
    this.s.phone.unreadSms = 1;
    this.flag('sms1');
    this.later(1.8, () => this.s.hud.hint('hint.move', 7));
    this.later(3.2, () => this.s.hud.think('th.start'));
    this.goal('goal.enter');
  }

  /** Restaura desde el guardado (checkpoint). */
  restore(data: NonNullable<ReturnType<typeof StoryState.load>>): void {
    const s = this.s;
    for (const f of data.flags) this.story.set(f);
    this.story.checkpoint = data.checkpoint;
    s.phone.available = true;
    s.phone.sms.push({ key: 'sms.1', time: '20:58' });
    for (const c of data.clues) s.journal.addClue(c);
    for (const l of data.links) {
      const [a, b] = l.split('+');
      s.journal.restoreLink(a, b);
    }
    const has = (f: Flag) => this.story.has(f);
    const d = s.school.doors;
    d.gate.slam();
    d.gate.locked = true;
    if (has('hasCredential')) s.school.pickups.credential.visible = false;
    s.journal.loadPeople();
    if (has('hasCredential')) s.journal.knowPerson('daniela');
    if (has('s3Done')) s.journal.knowPerson('renata');
    if (has('chaseStarted')) s.journal.knowPerson('anapaula');
    if (has('deduceRehearsal')) {
      d.room2B.locked = false;
      d.room2B.open();
    }
    if (has('hasRecorder')) {
      s.recorder.available = true;
      s.school.pickups.recorder.visible = false;
    }
    if (has('heardTape')) s.recorder.tapeUnheard = false;
    if (has('lockerOpened')) d.locker17.open();
    if (has('hasLuciaPhoto')) s.school.pickups.photo.visible = false;
    if (has('hasBathKey')) {
      s.school.pickups.key.visible = false;
      d.stairs2.locked = false;
      d.stairs2.open();
    }
    if (has('s3Done')) {
      d.stairs3.locked = false;
      d.stairs3.open();
    }
    for (let f = 1; f <= 3; f++) this.once.add(`level${f}`);
    if (has('bathOpen')) d.bath.open();
    if (has('s3Done')) s.school.mirrorBlood.visible = true;
    if (has('gymOpen')) {
      d.gym.locked = false;
      d.gym.open();
    }
    s.director.enabled = true;
    const cp: Record<Checkpoint, [number, number, number, string]> = {
      start: [0, 18.3, 0, 'goal.enter'],
      corridor: [0, -4.6, 0, 'goal.search'],
      classroom: [3, -10, -Math.PI / 2, 'goal.recorder'],
      bathroom: [0.4, -23.8, Math.PI / 2, 'goal.mirror'],
      chase: [9, -35.5, -Math.PI / 2, 'goal.run'],
      gym: [40.5, -35.5, -Math.PI / 2, 'goal.lucia'],
    };
    const [x, z, yaw, goal] = cp[data.checkpoint];
    s.player.teleport(x, z, yaw);
    this.goal(goal);
    s.screamer.blackout(1.2);
    if (data.checkpoint === 'chase') {
      this.flag('chaseStarted');
      // Reanudar la persecución: todo a oscuras, ella detrás.
      s.school.setLights('off', 'long');
      s.school.setLights('off', 'corridor');
      this.later(1.5, () => this.startChase());
    }
    if (data.checkpoint === 'gym') {
      s.school.setLights('off', 'long');
      s.school.setLights('off', 'corridor');
    }
  }

  // =============== Interactuables ===============

  private setupInteractables(): void {
    const s = this.s;
    const I = s.interaction;
    const d = s.school.doors;
    const doorItem = (id: string, door: typeof d.gate, onTry: () => void) =>
      I.add({ id, position: door.center(), radius: 0.8, enabled: () => !door.isOpen, use: onTry, label: 'act.open' });

    // Afiche de la reja
    I.add({
      id: 'poster',
      position: new THREE.Vector3(-2.6, 1.45, 15.07),
      radius: 0.5,
      enabled: () => true,
      label: 'act.examine',
      use: () => {
        s.audio.play('paper');
        s.hud.think('ex.poster');
        if (!s.journal.graph.has('c1')) this.addClue('c1', posterCanvas());
      },
    });

    doorItem('gate', d.gate, () => {
      s.audio.play('doorLocked', { pos: d.gate.center() });
      d.gate.rattle();
      s.hud.think('door.gate');
    });

    I.add({
      id: '2b',
      position: d.room2B.center(),
      radius: 0.8,
      enabled: () => !d.room2B.isOpen,
      label: 'act.open',
      use: () => this.try2B(),
    });
    // La 2°B no tiene traba: la puerta cede con un empujón. La historia está adentro.
    d.room2B.locked = false;
    this.try2B = () => {
      d.room2B.open();
      s.audio.play('doorCreak', { pos: d.room2B.center() });
    };

    d.bath.locked = false;
    doorItem('bath', d.bath, () => {
      d.bath.open();
      s.audio.play('doorCreak', { pos: d.bath.center() });
      this.flag('bathOpen');
    });

    // ---- Escaleras: cada piso es un nivel ----
    const stair = (id: string, z: number, to: 1 | 2 | 3, label: string, gate: typeof d.gate | null, canPass: () => string | null) =>
      I.add({
        id,
        position: new THREE.Vector3(0, 1.2, z),
        radius: 1.1,
        enabled: () => !this.climbing && this.stage !== 'chase',
        label,
        use: () => {
          const blocked = canPass();
          if (blocked) {
            gate?.rattle();
            s.audio.play('doorLocked', { pos: new THREE.Vector3(0, 1.2, z) });
            s.hud.think(blocked);
            return;
          }
          if (gate && !gate.isOpen) {
            s.audio.play('unlock', { pos: gate.center() });
            gate.locked = false;
            gate.open();
          }
          this.climb(to);
        },
      });
    const [w1, w2] = FLOOR_WALLS;
    stair('up2', w1 + 2.05, 2, 'act.up', d.stairs2, () => (this.story.has('hasBathKey') ? null : 'stairs.locked'));
    stair('down1', w1 - 0.3, 1, 'act.down', null, () => null);
    stair('up3', w2 + 2.05, 3, 'act.up', d.stairs3, () => (this.story.has('s3Done') ? null : 'stairs.chained'));
    stair('down2', w2 - 0.3, 2, 'act.down', null, () => null);

    I.add({
      id: 'mid',
      position: d.mid.center(),
      radius: 0.8,
      enabled: () => !d.mid.isOpen,
      label: 'act.force',
      hold: 3,
      onHold: (p) => {
        s.hud.hold(p);
        s.mimic.noise = 0.2;
        if (Math.random() < 0.08) s.audio.play('wood', { pos: d.mid.center() });
      },
      use: () => {
        s.hud.hold(0);
        d.mid.locked = false;
        d.mid.open();
        s.audio.play('doorSlam', { pos: d.mid.center(), gain: 0.6 });
        this.flag('midDoorForced');
      },
    });

    doorItem('gym', d.gym, () => {
      if (!this.story.has('chaseStarted') && !this.story.has('s4Done')) {
        s.audio.play('doorLocked', { pos: d.gym.center() });
        d.gym.rattle();
        s.hud.think('door.gymCode');
        return;
      }
      s.keypad.open(this.story.has('deduceCode') || this.story.has('hasMirrorCode') ? '631' : undefined);
      if (!this.story.has('hasMirrorCode')) s.hud.think('stuck.code');
      document.exitPointerLock?.();
    });
    s.keypad.onResult = (ok) => {
      if (!ok) {
        s.audio.play('doorLocked', { pos: d.gym.center() });
        return;
      }
      s.audio.play('unlock', { pos: d.gym.center() });
      d.gym.locked = false;
      d.gym.open();
      s.audio.play('doorCreak', { pos: d.gym.center() });
      this.flag('gymOpen');
      s.game.input.requestLock();
    };
    s.keypad.onClose = () => s.game.input.requestLock();

    // Casillero 17
    I.add({
      id: 'locker17',
      position: new THREE.Vector3(-1.1, 1.1, s.school.anchors.lockerFront.z),
      radius: 0.35,
      enabled: () => !d.locker17.isOpen,
      label: 'act.open',
      use: () => {
        // Con el cassette y la psicofonía en la mano, el personaje ata cabos solo al tocar el 17.
        if (!this.story.has('deduceLocker') && s.journal.graph.has('c4') && s.journal.graph.has('c5')) s.journal.autoLink('c4', 'c5');
        if (!this.story.has('deduceLocker')) {
          s.audio.play('lockerRattle', { pos: d.locker17.center(), gain: 0.4 });
          d.locker17.rattle();
          s.hud.think('door.lockerLocked');
          return;
        }
        d.locker17.open();
        s.audio.play('metalCreak', { pos: d.locker17.center() });
        this.flag('lockerOpened');
        s.director.arm('s2');
      },
    });

    // Recogibles
    const pk = s.school.pickups;
    const pickup = (id: string, obj: THREE.Object3D, radius: number, enabled: () => boolean, fn: () => void) =>
      I.add({
        id,
        position: obj.getWorldPosition(new THREE.Vector3()),
        radius,
        enabled: () => obj.visible && enabled(),
        label: 'act.take',
        use: () => {
          obj.visible = false;
          s.audio.play('pickup');
          fn();
        },
      });

    pickup('credential', pk.credential, 0.3, () => true, () => {
      this.flag('hasCredential');
      s.hud.think('ex.credential');
      this.later(4, () => this.queueS1());
      this.person('daniela');
      this.addClue('c2');
    });
    pickup('recorder', pk.recorder, 0.3, () => true, () => {
      this.flag('hasRecorder');
      s.recorder.available = true;
      s.recorder.toggle(true);
      s.hud.think('ex.recorder');
      this.goal('goal.recorder');
    });
    pickup('photo', pk.photo, 0.2, () => d.locker17.isOpen, () => {
      this.flag('hasLuciaPhoto');
      s.hud.think('ex.photo');
      this.person('lucia', 'people.lucia.photo');
      this.addClue('c6');
    });
    pickup('key', pk.key, 0.2, () => d.locker17.isOpen, () => {
      this.flag('hasBathKey');
      s.hud.think('ex.key');
      s.director.force('s2');
      this.goal('goal.bath');
    });

    this.setupExaminables();

    // Objetivos fotografiables
    s.phone.targets.push(
      {
        id: 'board',
        pos: s.school.anchors.blackboard,
        clue: 'c3',
        maxDist: 14,
        throughGlass: true,
        enabled: () => !s.journal.graph.has('c3'),
      },
      {
        id: 'mirror',
        pos: s.school.mirrorWriting.getWorldPosition(new THREE.Vector3()),
        clue: 'c7',
        maxDist: 6,
        throughGlass: true,
        enabled: () => !s.journal.graph.has('c7'),
      },
    );
  }

  /** Cosas del colegio que se pueden mirar, leer o abrir: no destraban nada, cuentan la historia. */
  private setupExaminables(): void {
    const s = this.s;
    const I = s.interaction;
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    /** Pensamiento al examinar (clave `ex.<id>`). */
    const thought = (id: string, pos: THREE.Vector3, radius: number, sound: 'paper' | 'click' | 'lockerRattle' | 'drip' | 'wood' | null = null, then?: () => void) =>
      I.add({
        id,
        position: pos,
        radius,
        enabled: () => true,
        label: 'act.examine',
        use: () => {
          if (sound) s.audio.play(sound, { pos, gain: 0.5 });
          s.hud.think(`ex.${id}`);
          then?.();
        },
      });
    /** Papel legible (claves `doc.<id>.*`). */
    const paper = (id: string, pos: THREE.Vector3, radius: number, style: 'typed' | 'hand' = 'typed', then?: () => void) =>
      I.add({
        id,
        position: pos,
        radius,
        enabled: () => true,
        label: 'act.read',
        use: () => {
          s.doc.open(id, style);
          then?.();
        },
      });

    // Patio
    thought('bench', at(-5.1, 0.5, 8.25), 0.6);
    // Hall
    paper('notice', at(-3.88, 1.6, -1), 0.75);
    thought('trophies', at(3.4, 1.3, -1.5), 0.7, null, () => this.person('anapaula', 'people.anapaula.trophy'));
    // Pasillo
    thought('clock', at(1.38, 2.35, -6.5), 0.35);
    thought('locker12', at(-1.05, 1.2, -6.55), 0.24, 'lockerRattle', () => {
      this.person('daniela', 'people.daniela.heart');
      this.person('renata', 'people.renata.heart');
    });
    thought('locker21', at(-1.05, 1.2, -10.33), 0.24, 'lockerRattle');
    thought('drawings', at(1.38, 1.65, -16.2), 0.7, 'paper');
    paper('diary', at(0.7, 0.2, -15.5), 0.4, 'hand', () => {
      this.person('isabel');
      this.person('lucia', 'people.lucia.diary');
    });
    thought('fountain', at(-1.3, 0.95, -16), 0.4, 'drip');
    thought('extinguisher', at(1.36, 1.05, -16.8), 0.3);
    thought('drag', at(-0.4, 0.05, -23.2), 0.55);
    thought('bin', at(1.15, 0.5, -27), 0.35, 'paper');
    // Sala 2°B
    paper('script', at(5.4, 0.05, -11), 0.8);
    thought('chair', at(3.49, 0.35, -9.98), 0.45, 'wood');
    thought('board', at(9.38, 1.55, -10), 0.9, null, () => {
      if (s.journal.graph.has('c3')) return;
      this.flag('hasBoardPhoto');
      this.addClue('c3');
      this.later(2.5, () => s.journal.autoLink('c1', 'c3'));
    });
    thought('window', at(5.5, 1.7, -14.88), 0.75);
    const list = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), ps2Lambert({ color: 0xe6e1d2 }));
    list.rotation.set(-Math.PI / 2, 0, 0.3);
    list.position.set(8.5, 0.786, -8.42);
    s.scene.add(list);
    paper('list', at(8.5, 0.8, -8.42), 0.22);
    // Baño
    thought('sink', at(-8.12, 0.95, -23), 0.4, 'drip');
    for (const [i, z] of [-26, -24.5, -22.6].entries())
      I.add({
        id: `mirror${i}`,
        position: at(-8.36, 1.7, z),
        radius: 0.6,
        enabled: () => this.stage === 'free' || this.stage === 's3_ramp',
        label: () => (s.journal.graph.has('c7') ? 'act.examine' : 'act.photoMirror'),
        use: () => {
          if (s.journal.graph.has('c7')) return s.hud.think('ex.mirror');
          s.hud.think('ex.mirrorCam');
          this.autoPhoto(s.school.mirrorWriting.getWorldPosition(new THREE.Vector3()));
        },
      });
    thought('bucket', at(-2.8, 0.3, -28.3), 0.4);
    thought('stallOpen', at(-6.05, 0.9, -19.6), 0.6, null, () => this.person('fernanda'));
    s.school.stalls.forEach((stall, i) => {
      if (stall.open) return;
      I.add({
        id: `stall${i}`,
        position: stall.center,
        radius: 0.6,
        enabled: () => !stall.open,
        label: 'act.open',
        use: () => {
          stall.open = true;
          stall.collider.enabled = false;
          s.audio.play('doorCreak', { pos: stall.center });
          s.director.addTension(6);
          this.later(1, () => s.hud.think(i === 0 ? 'ex.stallA' : 'ex.stallB'));
          if (i !== 0)
            this.later(3.4, () => {
              s.audio.play('bang', { pos: stall.center });
              s.player.shake(0.07, 0.35);
              s.school.lights.bathroom[1].mode = 'dying';
            });
        },
      });
    });
    // Salas abiertas del primer piso
    for (const id of ['staff', 'lab', 'janitor'] as const) {
      const door = s.school.doors[id];
      I.add({
        id: `door_${id}`,
        position: door.center(),
        radius: 0.8,
        enabled: () => !door.isOpen,
        label: 'act.open',
        use: () => {
          door.open();
          s.audio.play('doorCreak', { pos: door.center() });
        },
      });
    }
    // Sala de profesores
    paper('staffList', at(-8.38, 1.6, -15.2), 0.75);
    paper('minutes', at(-4.5, 0.8, -15.9), 0.3);
    thought('seized', at(-5.5, 0.85, -15.8), 0.3, 'wood', () => {
      this.person('renata', 'people.renata.mirror');
      // La luz se va; cuando vuelve, hay alguien sentado en el sillón.
      this.first('staff', () =>
        this.later(2.5, () =>
          this.flickerOut(
            'staff',
            2.6,
            () => s.audio.voiceSynth({ syllables: 3, whisper: true, pos: at(-7.9, 1, -17.4), gain: 0.9, rate: 0.22 }),
            () => {
              s.events.appear(-7.7, -17.4, 1.3, 1.2);
              s.audio.play('stingerSoft');
            },
          ),
        ),
      );
    });
    thought('sofa', at(-7.9, 0.5, -17.4), 0.6);
    thought('cabinet', at(-6.5, 1.2, -13.1), 0.7, 'lockerRattle');
    // Laboratorio
    paper('labbook', at(5.6, 0.93, -22.05), 0.3, 'hand', () => this.person('anapaula', 'people.anapaula.lab'));
    thought('jars', at(9.0, 1.35, -22), 0.9, null, () =>
      this.first('lab', () =>
        this.later(1.8, () => {
          // Un frasco estalla detrás y, al girar, hay alguien en la puerta.
          s.audio.play('glassCrack', { pos: at(3.5, 1, -24.6) });
          s.player.shake(0.05, 0.4);
          s.director.addTension(12);
          s.events.appear(2.2, -22, 2.6, 2.2);
        }),
      ),
    );
    thought('fallenJar', at(8.3, 0.1, -21.2), 0.35);
    thought('labSink', at(2.5, 0.95, -17.3), 0.5, 'drip');
    thought('labWindow', at(5.5, 1.7, -26.88), 0.9);
    // Portería
    paper('log', at(-4.3, 0.8, -35.45), 0.3, 'hand');
    thought('radio', at(-3.5, 0.84, -35.5), 0.25, null, () => {
      s.audio.play('static');
      // Aplausos en la radio, un portazo y la luz que se va: al volver, ella está en el rincón.
      this.first('janitor', () =>
        this.later(2.2, () => {
          const door = s.school.doors.janitor;
          door.close();
          s.audio.play('doorSlam', { pos: door.center() });
          s.player.shake(0.06, 0.4);
          this.flickerOut('janitor', 3, () => s.audio.laughter({ gain: 0.5 }), () => {
            s.events.appear(-6.0, -30.7, 1.4, 1.2);
            s.audio.play('stingerSoft');
          });
        }),
      );
    });
    thought('keys', at(-3.8, 1.55, -30.12), 0.5);
    thought('shelves', at(-6.1, 1.2, -33), 0.8);

    // Pasillo largo
    thought('puddle', at(28.5, 0.05, -35.5), 0.8, 'drip');
    thought('longWindow', at(11, 1.75, -34.12), 0.6);
  }

  /**
   * El personaje saca el celular, levanta la cámara hacia `target` y dispara. Es lo mismo que puede
   * hacer el jugador a mano ([Q] + clic); así [E] nunca deja la historia trabada.
   */
  private autoPhoto(target: THREE.Vector3): void {
    const s = this.s;
    if (this.autoShot) return;
    this.autoShot = true;
    s.scriptFreeze = true;
    s.scriptLookLock = true;
    s.player.lookAt(target, 7);
    if (s.recorder.out) s.recorder.toggle(false);
    if (!s.phone.out) s.phone.toggle(true);
    this.later(0.5, () => s.phone.setCamera(true));
    this.later(1.7, () => (s.phone.pendingPhoto = true));
    this.later(2.5, () => {
      s.phone.setCamera(false);
      s.player.lookAt(null);
      s.scriptFreeze = false;
      s.scriptLookLock = false;
      this.autoShot = false;
    });
  }

  /**
   * S1 garantizado: aparece en la galería una foto que no tomaste (tú, de espaldas) y, mires o no
   * el celular, a los pocos segundos el rostro llena la pantalla.
   */
  private queueS1(): void {
    const s = this.s;
    if (this.s1Queued || this.story.has('s1Done')) return;
    this.s1Queued = true;
    this.cursedPhoto();
    s.audio.play('vibrate');
    this.later(1.2, () => s.hud.think('th.newPhoto'));
    this.later(9, () => s.director.force('s1'));
  }

  /** Sube o baja por la escalera: negro, pasos, y apareces en el otro piso con el cartel del nivel. */
  private climb(to: 1 | 2 | 3): void {
    const s = this.s;
    const from = floorAt(s.player.position.z, s.player.position.x);
    const [w1, w2] = FLOOR_WALLS;
    // Punto de llegada: junto a la caja de escalera del piso de destino.
    const wall = Math.min(from, to) === 1 ? w1 : w2;
    const up = to > from;
    const z = up ? wall - 1.7 : wall + 3.3;
    this.climbing = true;
    s.scriptFreeze = true;
    s.screamer.blackout(1.5);
    for (let i = 0; i < 5; i++) this.later(0.15 + i * 0.24, () => s.audio.step('concrete', false));
    this.later(0.7, () => s.player.teleport(0, z, up ? 0 : Math.PI));
    this.later(1.5, () => {
      s.scriptFreeze = false;
      this.climbing = false;
      this.arrive(to);
    });
  }

  /** Llegada a un piso: cartel de nivel la primera vez y objetivo del nivel. */
  private arrive(floor: 1 | 2 | 3): void {
    const s = this.s;
    if (!this.once.has(`level${floor}`)) {
      this.once.add(`level${floor}`);
      s.hud.level(floor);
      s.audio.play('stingerSoft');
    }
    if (floor === 2 && !this.story.has('s3Done')) this.goal('goal.floor2');
    if (floor === 3 && !this.story.has('chaseStarted')) this.goal('goal.gym');
    if (floor === 2) this.save('bathroom');
  }

  /** Ejecuta `fn` una sola vez por partida (sustos de exploración). */
  private first(id: string, fn: () => void): void {
    if (this.once.has(id)) return;
    this.once.add(id);
    fn();
  }

  /** Apagón breve de una sala con algo que pasa a oscuras. */
  private flickerOut(area: Area, seconds: number, during?: () => void, after?: () => void): void {
    const s = this.s;
    const lights = s.school.lights[area];
    const saved = lights.map((l) => l.mode);
    lights.forEach((l) => (l.mode = 'off'));
    s.audio.play('switchOff');
    s.director.addTension(14);
    if (during) this.later(seconds * 0.45, during);
    this.later(seconds, () => {
      lights.forEach((l, i) => (l.mode = saved[i]));
      after?.();
    });
  }

  /** Recordatorio de una tecla: se muestra una sola vez, cuando esa herramienta empieza a importar. */
  private key(hint: string, seconds = 8): void {
    if (this.keysShown.has(hint) || this.s.scripted) return;
    this.keysShown.add(hint);
    this.s.hud.hint(hint, seconds);
  }

  /**
   * En qué punto de la historia está el jugador y qué pensaría el personaje si se queda dando vueltas.
   * No son instrucciones: es su voz, y solo aparece tras un rato largo sin avanzar.
   */
  private beat(): [id: string, thought: string | null] {
    const s = this.s;
    const has = (f: Flag) => this.story.has(f);
    if (!s.phone.everOut) return ['phone', 'stuck.phone'];
    if (!has('insideSchool')) return ['enter', 'stuck.enter'];
    if (!has('hasRecorder')) return ['classroom', 'stuck.classroom'];
    if (!has('heardTape')) return ['tape', 'stuck.tape'];
    if (!has('hasEVP')) return s.recorder.state === 'recorded' ? ['evp2', 'stuck.rewind'] : ['evp', 'stuck.evp'];
    if (!has('lockerOpened')) return ['locker', 'stuck.locker'];
    if (!has('hasBathKey')) return ['lockerItems', 'stuck.lockerItems'];
    if (!has('bathOpen')) return floorAt(s.player.position.z, s.player.position.x) === 1 ? ['stairs', 'stuck.stairs'] : ['bath', 'stuck.bath'];
    if (!has('hasMirrorCode')) return ['mirror', 'stuck.mirror'];
    if (!has('s3Done')) return ['s3', null];
    if (!has('chaseStarted')) return ['toGym', floorAt(s.player.position.z, s.player.position.x) === 2 ? 'stuck.up3' : null];
    if (!has('gymOpen')) return ['chase', s.area === 'long' && s.player.position.x > 38 ? 'stuck.code' : null];
    return ['end', null];
  }

  /** Una vez por segundo: recordar teclas nuevas (una vez) y soltar un pensamiento si lleva mucho atascado. */
  private guide(): void {
    const s = this.s;
    const ph = s.phone;
    if (s.scripted || s.inMenuLike || ph.callState !== 'none' || this.stage !== 'free') return;
    // Teclas: solo cuando la herramienta entra en juego.
    if (ph.out) this.key('hint.flash');
    if (ph.out && this.story.has('sms2') && ph.unreadSms === 0) this.key('hint.camera', 10);
    if (ph.out && ph.newPhotos > 0) this.key('hint.phoneScreens', 9);
    if (s.journal.graph.clues.size >= 2) this.key('hint.journal', 9);
    if (s.recorder.out) this.key('hint.recorder', 9);

    // Grabadora: si el jugador la deja en la mano, la cinta sigue sola (reproduce → graba la sala → rebobina).
    const rec = s.recorder;
    if (rec.out && this.story.has('hasRecorder') && !this.story.has('hasEVP')) {
      const waiting = rec.state === 'recorded' || (rec.state === 'idle' && (rec.tapeUnheard || s.area === 'classroom'));
      this.recIdle = waiting ? this.recIdle + 1 : 0;
      if (this.recIdle >= 3) {
        this.recIdle = 0;
        rec.use();
      }
    }

    const [id, thought] = this.beat();
    if (id !== this.beatId) {
      this.beatId = id;
      this.beatT = 0;
      return;
    }
    this.beatT += 1;
    if (thought && this.beatT >= 50 && (this.beatT - 50) % 70 === 0) s.hud.think(thought);
    // Mucho rato sin sacar el celular: vuelve a vibrar y se recuerda la tecla.
    if (id === 'phone' && this.beatT % 20 === 9) {
      s.audio.play('vibrate');
      s.hud.hint('hint.phone', 7);
    }
  }

  private setupTools(): void {
    const s = this.s;
    // Cada SMS que se ve en la pantalla se repite como pensamiento: la pantalla del celular es chica.
    s.phone.onSmsRead = (key) => s.hud.think('sms.read', undefined, { text: tItem(key) });
    s.phone.onPhoto = (p) => {
      if (!p.clue) {
        s.hud.toast('hint.photoSaved', 1.5);
        return;
      }
      this.addClue(p.clue, p.canvas);
      if (p.clue === 'c3') {
        this.flag('hasBoardPhoto');
        if (!s.journal.graph.isLinked('c1', 'c3')) this.later(1.5, () => s.journal.autoLink('c1', 'c3'));
        this.queueS1();
      }
      if (p.clue === 'c7') this.flag('hasMirrorCode');
    };
    s.phone.onGalleryView = (p) => {
      if (p.cursed && this.stage === 'free' && !this.story.has('s1Done')) {
        this.s1Yaw = s.player.yaw;
        this.go('s1_seen');
      }
    };

    s.recorder.zones.push({ id: 'classroom', contains: () => s.area === 'classroom', captured: false });
    s.recorder.onTapePlayed = () => {
      this.flag('heardTape');
      this.addClue('c4');
      this.goal('goal.record');
    };
    s.recorder.onRecordStart = () => {
      s.director.addTension(5);
      s.hud.think(s.area === 'classroom' ? 'th.recording' : 'th.recordingElsewhere');
    };
    s.recorder.onPlaybackStart = (zone) => {
      s.director.addTension(15);
      if (zone) {
        s.audio.voiceSynth({ syllables: 9, whisper: true, gain: 1, rate: 0.3, delay: 2.5 });
        this.later(2.5, () => s.hud.subtitle('sub.evp1', 5));
        // Alguien escuchó: pasos descalzos en el pasillo
        this.later(6, () => {
          for (let i = 0; i < 4; i++)
            this.later(i * 0.45, () => s.audio.step('tile', false, new THREE.Vector3(0.5, 0.1, -9 + i * 0.4), true));
          s.hud.subtitle('sub.steps', 2.5);
        });
      } else this.later(2, () => s.hud.subtitle('sub.static', 2));
    };
    s.recorder.onPlaybackEnd = (zone) => {
      if (zone) {
        this.flag('hasEVP');
        this.addClue('c5');
        this.later(2, () => s.journal.autoLink('c4', 'c5'));
      } else s.hud.think('hint.nothing');
    };
    // Tape subtitles
    const origUse = s.recorder.use.bind(s.recorder);
    s.recorder.use = () => {
      const before = s.recorder.state;
      origUse();
      if (before === 'idle' && s.recorder.state === 'playingTape') {
        this.first('slam2B', () =>
          this.later(5.4, () => {
            const door = s.school.doors.room2B;
            if (s.area !== 'classroom' || !door.isOpen) return;
            door.close();
            s.audio.play('doorSlam', { pos: door.center() });
            s.player.shake(0.05, 0.35);
            s.director.addTension(10);
          }),
        );
        this.later(0.4, () => s.hud.subtitle('sub.tape', 2.4));
        this.later(2.8, () => s.hud.subtitle('sub.tape2', 3.6));
        this.later(8, () => s.hud.subtitle('sub.tapeCut', 2));
      }
    };

    s.journal.onOpenChange = (open) => {
      if (!open) s.game.input.requestLock();
    };
    s.journal.onLink = (r) => {
      if (!r.ok || !r.isNew) return;
      this.flag(r.connection.flag as Flag);
      s.hud.toast('hint.deduction');
      if (!s.journal.isOpen) s.hud.think(r.connection.deduction);
      switch (r.connection.flag) {
        case 'deduceRehearsal':
          break;
        case 'deduceLocker':
          this.goal('goal.locker');
          break;
        case 'deduceCode':
          break;
        case 'doubtsPhone':
          break;
      }
    };
  }

  // =============== Áreas ===============

  private onEnterArea(a: Area | "none", _from: Area | "none"): void {
    const s = this.s;
    if (a === 'patio' || a === 'none') return;
    if (!this.seenAreas.has(a) && ['hall', 'corridor', 'classroom', 'bathroom', 'long', 'staff', 'lab', 'janitor'].includes(a) && this.stage === 'free') {
      this.seenAreas.add(a);
      this.later(a === 'corridor' ? 5 : 1.2, () => this.stage === 'free' && !s.scripted && s.hud.think(`th.${a}`));
    }
    if (a === 'hall' && !this.story.has('insideSchool')) {
      this.flag('insideSchool');
      this.later(0.8, () => this.arrive(1));
      s.director.enabled = true;
      if (!s.journal.graph.has('c1')) this.addClue('c1', posterCanvas());
      this.save('corridor');
    }
    if (a === 'corridor' && !this.story.has('sms2')) {
      this.flag('sms2');
      this.later(1.5, () => s.phone.receiveSms('sms.2'));
      this.goal('goal.search');
      // Primer aviso de que no estás a solas: alguien al fondo, y el tubo del fondo revienta.
      this.later(6, () => {
        if (!s.events.figureAtEnd()) return;
        s.audio.play('stingerSoft');
        const far = s.school.lights.corridor[3];
        this.later(1.1, () => {
          far.mode = 'off';
          s.audio.play('bulbPop', { pos: far.group.position });
        });
      });
    }
    if (a === 'classroom' && !this.story.has('hasRecorder')) {
      this.goal('goal.recorder');
      this.queueS1();
    }
    if (a === 'bathroom' && !this.story.has('s3Done')) {
      if (this.bathT === 0) {
        this.save('bathroom');
        this.goal('goal.mirror');
        this.later(2, () => s.phone.receiveSms('sms.mirror1'));
        this.later(7, () => s.phone.receiveSms('sms.mirror2'));
      }
      if (this.stage === 'free') this.go('s3_ramp');
    }
    if (a !== 'bathroom' && this.story.has('s3Done') && !this.story.has('chaseStarted') && floorAt(s.player.position.z, s.player.position.x) === 2) this.goal('goal.up3');
    if (a !== 'bathroom' && this.pendingS4) {
      this.pendingS4 = false;
      this.s4();
    }
    if (a === 'gym' && !this.story.has('chaseDone')) {
      this.endChase();
      this.save('gym');
      this.goal('goal.lucia');
      this.later(1.5, () => s.phone.receiveSms('sms.dont'));
      this.later(4.5, () => s.phone.receiveSms('sms.enter'));
      this.go('final_approach');
    }
  }

  // =============== Screamers ===============

  /** El Director empezó el silencio previo a un mayor. */
  onSilence(id: string): void {
    this.s.hud.clear();
    if (id === 's4') this.s.scripted = true;
  }

  major(id: string): void {
    switch (id) {
      case 's1':
        return this.s1();
      case 's2':
        return this.s2();
      case 's3':
        return this.s3();
      case 's4':
        return this.s4();
      case 's5':
        return this.s5();
    }
  }

  /** Golpe común: rostro a pantalla completa + stinger + temblor + distorsión. */
  private hit(seed: number, big = false, dur = 0.75): void {
    const s = this.s;
    s.audio.unduck(0.05);
    s.audio.play(big ? 'stingerBig' : 'stinger');
    s.screamer.show(seed, dur, big ? 0 : 0.25);
    s.fx.pulse(1, big ? 0.9 : 0.5);
    s.player.shake(0.14, 0.8);
    s.director.addTension(20);
  }

  /** S1 — La foto que no tomaste: genera la foto de espaldas del jugador. */
  private cursedPhoto(): void {
    const s = this.s;
    const p = s.player;
    s.mirror.snap();
    const cam = new THREE.PerspectiveCamera(58, 96 / 120, 0.05, 40);
    cam.layers.set(LAYER.WORLD);
    cam.layers.enable(LAYER.PLAYER_BODY);
    const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    cam.position.set(p.position.x + back.x * 2.4, 1.75, p.position.z + back.z * 2.4);
    // No atravesar paredes: acercar si hay pared
    for (let d = 2.4; d > 0.8; d -= 0.2) {
      cam.position.set(p.position.x + back.x * d, 1.75, p.position.z + back.z * d);
      if (!s.school.collision.blocked(p.position.x, p.position.z, cam.position.x, cam.position.z, 1.2)) break;
    }
    cam.lookAt(p.position.x, 1.45, p.position.z);
    cam.updateMatrixWorld();
    const flashWas = s.phone.flash.intensity;
    const c = s.phone.captureFrom(s.game.renderer.gl, s.scene, cam);
    s.phone.flash.intensity = flashWas;
    s.phone.addPhoto(c, null, true);
    s.phone.newPhotos = 1;
    s.phone.dirty();
    // Si no mira la galería, el celular insiste
    this.later(25, () => {
      if (this.stage === 'free' && !this.story.has('s1Done')) {
        s.audio.play('vibrate');
        s.phone.newPhotos = Math.max(s.phone.newPhotos, 1);
        if (s.phone.out) s.phone.setScreen('gallery');
      }
    });
  }

  private s1(): void {
    const s = this.s;
    // Si el celular está guardado, se abre solo.
    const reveal = () => {
      s.phone.showScare(s.screamer.face(SEED.daniela).image as CanvasImageSource);
      this.hit(SEED.daniela);
      this.later(0.9, () => {
        s.phone.showScare(null);
        s.phone.forced = false;
        s.phone.toggle(false);
        const far = s.school.lights.corridor[2];
        far.mode = 'off';
        s.audio.play('bulbPop', { pos: far.group.position });
        this.flag('s1Done');
        s.director.majorFinished();
        this.go('free');
      });
    };
    s.phone.forced = true;
    if (!s.phone.out) {
      s.phone.toggle(true);
      this.later(0.5, reveal);
    } else reveal();
  }

  private s2(): void {
    const s = this.s;
    const p = s.player;
    s.phone.receiveSms('sms.behind');
    const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    let d = 1.0;
    while (d > 0.5 && s.school.collision.blocked(p.position.x, p.position.z, p.position.x + back.x * d, p.position.z + back.z * d)) d -= 0.1;
    this.daniela.root.position.set(p.position.x + back.x * d, 0, p.position.z + back.z * d);
    this.daniela.lookAt(p.position);
    this.daniela.setScary(true);
    this.daniela.root.visible = true;
    s.audio.duck(5);
    this.go('s2_wait');
  }

  private s2Hit(): void {
    const s = this.s;
    this.hit(SEED.daniela);
    this.later(0.75, () => {
      this.daniela.root.visible = false;
      this.flag('s2Done');
      s.director.majorFinished();
      s.hud.subtitle('sub.steps', 2);
      this.go('free');
    });
  }

  private s3(): void {
    const s = this.s;
    s.school.setLights('off', 'bathroom');
    s.audio.play('switchOff');
    s.mirror.showRenataBehind();
    this.go('s3_wait');
  }

  private s3Hit(): void {
    const s = this.s;
    s.audio.play('glassCrack', { pos: s.school.anchors.sink.clone().setY(1.7) });
    s.school.mirrorCracks.visible = true;
    this.hit(SEED.renata);
    this.later(0.8, () => {
      s.mirror.hideRenata();
      s.mirror.frozen = false;
      s.mirror.delay = 0;
      s.school.setLights('steady', 'bathroom');
      s.school.lights.bathroom[1].mode = 'unstable';
      s.school.mirrorBlood.visible = true;
      this.flag('s3Done');
      this.person('renata', 'people.renata', false);
      s.director.majorFinished();
      this.goal('goal.up3');
      this.go('free');
      // Arriba se suelta la cadena de la reja del tercer piso.
      this.later(3.5, () => {
        s.audio.play('lockerBang', { pos: new THREE.Vector3(0, 1.5, FLOOR_WALLS[1] + 2) });
        s.hud.think('stairs.unchained');
      });
    });
  }

  private pendingS4 = false;

  private s4(): void {
    const s = this.s;
    if (s.area === 'bathroom') {
      // Espera a que salga del baño: el apagón empieza en el pasillo.
      this.pendingS4 = true;
      s.scripted = false;
      return;
    }
    s.scripted = true;
    s.audio.duck(14, 0.004);
    // Apagón que viaja por el colegio
    const L = s.school.lights;
    const all = [...L.corridor, ...L.long, ...L.hall, ...L.classroom, ...L.staff, ...L.lab, ...L.janitor];
    all.sort((a, b) => a.group.position.distanceTo(s.camera.position) - b.group.position.distanceTo(s.camera.position));
    all.forEach((l, i) =>
      this.later(i * 0.18, () => {
        l.mode = 'off';
        if (i % 2 === 0) s.audio.play('switchOff', { pos: l.group.position });
      }),
    );
    this.later(all.length * 0.18 + 2.2, () => {
      s.phone.incomingCall(() => {
        s.audio.voiceSynth({ syllables: 10, pitch: 250, rate: 0.28, tape: true, direct: true, gain: 0.9 });
        s.hud.subtitle('sub.call', 5);
        this.later(4.2, () => {
          s.audio.play('static');
          s.phone.endCall();
          s.phone.flicker(0.8);
          this.startChase();
          s.audio.unduck(2);
          s.scripted = false;
          this.flag('s4Done');
          s.director.majorFinished();
          this.later(3, () => s.phone.receiveSms('sms.rule'));
          this.save('chase');
        });
      });
      s.hud.hint('hint.answer', 6);
    });
    this.go('s4_call');
  }

  private startChase(): void {
    const s = this.s;
    this.flag('chaseStarted');
    s.journal.knowPerson('anapaula');
    this.later(7, () => this.key('hint.crouchChase', 7));
    this.goal('goal.run');
    s.mimic.spawnBehind();
    s.mimic.onCatch = () => this.caught();
    s.director.enabled = true;
    this.go('chase');
  }

  private caught(): void {
    const s = this.s;
    s.mimic.hide();
    this.catches++;
    s.mimic.ease = Math.max(0.45, 1 - this.catches * 0.28);
    const scare = this.catches <= 2;
    if (scare) this.hit(SEED.anapaula, false, 0.5);
    else s.audio.play('caught');
    // El negro entra cuando el rostro termina; el traslado ocurre ya a oscuras.
    s.screamer.blackout(1.4);
    this.later(scare ? 0.6 : 0.3, () => {
      s.player.teleport(4, -35.5, -Math.PI / 2);
      s.player.crouched = false;
      if (!s.school.doors.mid.isOpen) s.school.doors.mid.close();
    });
    this.later(scare ? 1.9 : 1.6, () => s.mimic.spawnBehind());
  }

  private endChase(): void {
    this.flag('chaseDone');
    this.s.mimic.hide();
  }

  private s5(): void {
    const s = this.s;
    this.hit(SEED.lucia, true, 1.1);
    this.later(1.05, () => {
      s.screamer.blackout(999);
      s.audio.duck(999, 0);
      this.flag('s5Done');
      this.flag('finished');
      StoryState.markFinished();
      StoryState.clear();
      this.go('ended');
      this.later(0.4, () => s.onEnd?.());
    });
  }

  // =============== Update ===============

  update(dt: number): void {
    const s = this.s;
    this.t += dt;
    this.stageT += dt;
    const p = s.player;

    this.tutorT -= dt;
    if (this.tutorT <= 0) {
      this.tutorT = 1;
      this.guide();
    }

    // La Huella en el visor: si la encuadras, da un salto hacia ti y desaparece.
    if (this.spectral.root.visible && s.phone.cameraMode) {
      const sp = this.spectral.root.position;
      const dist = Math.hypot(sp.x - p.position.x, sp.z - p.position.z);
      if (this.spectralT < 0 && dist < 9 && this.facing(sp.x, sp.z) > 0.9) {
        this.spectralT = 0;
        s.audio.duck(1.2);
      }
      if (this.spectralT >= 0) {
        this.spectralT += dt;
        if (this.spectralT > 0.9 && this.spectralT < 5) {
          this.spectralT = 5;
          const f = p.forward(this.tmp);
          sp.set(p.position.x + f.x * 1.1, 0, p.position.z + f.z * 1.1);
          this.spectral.lookAt(p.position);
          this.spectral.pose(0.7, 0.5);
          s.audio.unduck(0.05);
          s.audio.play('stinger');
          s.fx.pulse(1, 0.5);
          s.player.shake(0.1, 0.5);
          s.director.addTension(25);
        }
        if (this.spectralT > 5.45) this.spectral.root.visible = false;
      }
    } else if (this.spectralT >= 5) this.spectral.root.visible = false;

    // Nivel 3: el apagón y la llamada llegan cuando ya avanzaste por el pasillo largo (ella sale de la escalera).
    if (this.story.has('s3Done') && !this.story.has('s4Done') && !this.story.has('chaseStarted') && this.stage === 'free' && s.area === 'long' && p.position.x > 6 && !s.director.isArmed('s4') && !s.director.fired.includes('s4'))
      s.director.arm('s4', true);

    // Cubículos del baño abriéndose
    for (const stall of s.school.stalls)
      if (stall.open && stall.mesh.rotation.y < 1.25) stall.mesh.rotation.y = Math.min(1.25, stall.mesh.rotation.y + dt * 1.6);

    // Cambios de área
    if (s.area !== this.prevArea) {
      const from = this.prevArea;
      this.prevArea = s.area;
      this.onEnterArea(s.area, from);
    }

    // Portón: se cierra solo detrás tuyo
    if (!this.story.has('gateClosed') && p.position.z < 12.5) {
      this.flag('gateClosed');
      const g = s.school.doors.gate;
      g.close();
      g.locked = true;
      this.later(0.35, () => s.audio.play('doorSlam', { pos: g.center() }));
      this.later(1.4, () => s.hud.think('th.gate'));
      if (!s.journal.graph.has('c1')) this.later(1, () => this.addClue('c1', posterCanvas()));
    }

    // Casillero 17 golpetea desde adentro
    if (this.story.has('deduceLocker') && !this.story.has('lockerOpened') && s.area === 'corridor') {
      this.rattleT -= dt;
      if (this.rattleT <= 0) {
        this.rattleT = 2.5 + Math.random() * 3;
        s.audio.play('lockerRattle', { pos: s.school.doors.locker17.center() });
        s.school.doors.locker17.pivot.rotation.y = -0.08;
        this.later(0.35, () => (s.school.doors.locker17.pivot.rotation.y = 0));
      }
    }

    // Goteo en el baño
    if (s.area === 'bathroom') {
      this.dripT -= dt;
      if (this.dripT <= 0) {
        this.dripT = 0.9 + Math.random() * 1.6;
        if (this.stage !== 's3_wait') s.audio.play('drip', { pos: s.school.anchors.sink });
      }
    }

    // Si otro susto (S1/S2 atrasados) se disparó dentro del baño, dejó la etapa en 'free':
    // retomar el espejo, o S3 —y con él S4 y el resto de la demo— no llegaría nunca.
    if (this.stage === 'free' && s.area === 'bathroom' && !this.story.has('s3Done')) this.go('s3_ramp');

    switch (this.stage) {
      case 's1_seen': {
        // Espera a que se dé vuelta (o 10 s)
        let dy = Math.abs(p.yaw - this.s1Yaw) % (Math.PI * 2);
        if (dy > Math.PI) dy = Math.PI * 2 - dy;
        if (dy > 2.1 || this.stageT > 10) {
          s.director.arm('s1', this.stageT > 10 && s.director.sinceMajor > 60);
          this.go('s1_turned');
        }
        break;
      }
      case 's2_wait': {
        const a = this.daniela.root.position;
        const face = this.facing(a.x, a.z);
        if (face > 0.8 || this.stageT > 4) {
          if (face <= 0.8) {
            // No se dio vuelta: aparece delante
            const f = p.forward(this.tmp);
            this.daniela.root.position.set(p.position.x + f.x * 0.75, 0, p.position.z + f.z * 0.75);
            this.daniela.lookAt(p.position);
          }
          this.go('free');
          this.s2Hit();
        }
        break;
      }
      case 's3_ramp': {
        if (s.area === 'bathroom') this.bathT += dt;
        const start = this.story.has('hasMirrorCode') ? 3 : 25;
        if (this.bathT > start) s.mirror.delay = Math.min(0.9, s.mirror.delay + dt * 0.1);
        if (s.mirror.delay >= 0.9 && !s.mirror.frozen) {
          s.mirror.frozen = true;
          s.director.arm('s3', true);
        }
        break;
      }
      case 's3_wait': {
        const lookMirror = this.facing(-8.4, p.position.z) > 0.6;
        if ((lookMirror && this.stageT > 1.2) || this.stageT > 6) {
          this.go('free');
          this.s3Hit();
        }
        break;
      }
      case 'final_approach': {
        const gc = s.school.anchors.gymCenter;
        const d = Math.hypot(gc.x - p.position.x, gc.z - p.position.z);
        this.finalT += dt;
        // 3.9 m = el borde del círculo de sillas: basta con acercarse, sin colarse entre ellas.
        if (d < 3.9 || this.finalT > 40) {
          s.scripted = true;
          s.scriptLookLock = true;
          s.scriptFreeze = true;
          p.lookAt(new THREE.Vector3(gc.x, 1.55, gc.z), 3);
          s.hud.subtitle('sub.lucia1', 3);
          s.audio.voiceSynth({ syllables: 2, pitch: 300, rate: 0.35, pos: new THREE.Vector3(gc.x, 1.6, gc.z), gain: 0.6 });
          s.audio.play('stingerSoft');
          this.go('final_turn');
        }
        break;
      }
      case 'final_turn': {
        // Se da vuelta lentamente
        const target = Math.atan2(p.position.x - this.lucia.root.position.x, p.position.z - this.lucia.root.position.z);
        const from = LUCIA_BACK;
        const k = Math.min(1, this.stageT / 3);
        this.lucia.root.rotation.y = from + shortAngle(target - from) * k;
        if (this.stageT > 3.2 && !s.director.isArmed('s5') && !this.story.has('s5Done')) {
          s.director.arm('s5', true);
        }
        break;
      }
    }
  }
}

/** Giro inicial de Lucía: de espaldas a la puerta del gimnasio. */
const LUCIA_BACK = Math.PI / 2;

function shortAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
