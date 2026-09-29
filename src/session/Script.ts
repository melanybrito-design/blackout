// Guion de la demo (docs/GUION_DEMO.md): prólogo, 4 actos, final. Conecta pistas, herramientas,
// puertas y los 5 screamers mayores (S1–S5), que dispara el Director de Miedo.
import * as THREE from 'three';
import type { Session } from './Session';
import type { Area } from '../world/School';
import { StoryState, type Checkpoint, type Flag } from '../narrative/StoryState';
import { GirlModel } from '../entities/GirlModel';
import { LAYER } from '../core/layers';
import { GIRLS } from '../narrative/girls';
import { posterCanvas } from '../textures/poster';
import { t as tItem } from '../i18n';

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
  private hintedPhone = false;
  private tmp = new THREE.Vector3();

  constructor(private s: Session) {
    this.daniela = new GirlModel({ seed: SEED.daniela, scary: 1, hairFront: 0.3, wet: true });
    this.daniela.root.visible = false;
    this.daniela.pose(0.25, 0.1);
    s.scene.add(this.daniela.root);
    this.lucia = new GirlModel({ seed: SEED.lucia, scary: 0, hairFront: 0.15 });
    this.lucia.root.position.copy(s.school.anchors.gymCenter);
    this.lucia.root.rotation.y = -Math.PI / 2; // de espaldas a la puerta (oeste)
    this.lucia.pose(0.08);
    s.scene.add(this.lucia.root);

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
      if (this.s.journal.graph.clues.size === 2) this.later(1, () => this.s.hud.hint('hint.journal', 8));
    }
  }

  private goal(key: string): void {
    this.s.journal.setGoal(key);
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
    this.later(1.8, () => this.s.hud.hint('hint.move', 6));
    this.later(4.5, () => {
      this.s.phone.available = true;
      this.s.phone.receiveSms('sms.1');
      this.flag('sms1');
      this.s.hud.hint('hint.phone', 8);
    });
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
      d.bath.locked = false;
    }
    if (has('bathOpen')) d.bath.open();
    if (has('s3Done')) s.school.mirrorBlood.visible = true;
    if (has('gymOpen')) {
      d.gym.locked = false;
      d.gym.open();
    }
    s.director.enabled = true;
    const cp: Record<Checkpoint, [number, number, number, string]> = {
      start: [0, 18.3, 0, 'goal.enter'],
      corridor: [0, -4.6, 0, 'goal.follow'],
      classroom: [3, -10, -Math.PI / 2, 'goal.recorder'],
      bathroom: [0.4, -23.8, Math.PI / 2, 'goal.mirror'],
      chase: [0.4, -25, 0, 'goal.run'],
      gym: [40.5, -35.5, -Math.PI / 2, 'goal.lucia'],
    };
    const [x, z, yaw, goal] = cp[data.checkpoint];
    s.player.teleport(x, z, yaw);
    this.goal(goal);
    s.screamer.blackout(1.2);
    if (data.checkpoint === 'chase') {
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
      I.add({ id, position: door.center(), radius: 0.8, enabled: () => !door.isOpen, use: onTry });

    // Afiche de la reja
    I.add({
      id: 'poster',
      position: new THREE.Vector3(-2.6, 1.45, 15.07),
      radius: 0.5,
      enabled: () => !s.journal.graph.has('c1'),
      use: () => {
        s.audio.play('paper');
        this.addClue('c1', posterCanvas());
      },
    });

    doorItem('gate', d.gate, () => {
      s.audio.play('doorLocked', { pos: d.gate.center() });
      s.hud.hint('door.gate', 3);
    });

    doorItem('2b', d.room2B, () => {
      if (d.room2B.locked) {
        s.audio.play('doorLocked', { pos: d.room2B.center() });
        s.hud.hint(d.room2B.lockedMessage, 4);
        if (!this.story.has('hasBoardPhoto')) this.goal('goal.board');
      } else {
        d.room2B.open();
        s.audio.play('doorOpen', { pos: d.room2B.center() });
      }
    });

    doorItem('bath', d.bath, () => {
      if (!this.story.has('hasBathKey')) {
        s.audio.play('doorLocked', { pos: d.bath.center() });
        s.hud.hint('door.lockedBath', 3);
        return;
      }
      s.audio.play('unlock', { pos: d.bath.center() });
      d.bath.locked = false;
      d.bath.open();
      s.audio.play('doorCreak', { pos: d.bath.center() });
      this.flag('bathOpen');
      this.goal('goal.bath');
    });

    I.add({
      id: 'mid',
      position: d.mid.center(),
      radius: 0.8,
      enabled: () => !d.mid.isOpen,
      hold: 3,
      onHold: (p) => {
        if (!this.story.has('chaseStarted')) return;
        s.hud.hold(p);
        s.mimic.noise = 0.2;
        if (Math.random() < 0.08) s.audio.play('wood', { pos: d.mid.center() });
      },
      use: () => {
        s.hud.hold(0);
        if (!this.story.has('chaseStarted')) {
          s.audio.play('doorLocked', { pos: d.mid.center() });
          s.hud.hint('door.locked', 3);
          return;
        }
        d.mid.locked = false;
        d.mid.open();
        s.audio.play('doorSlam', { pos: d.mid.center(), gain: 0.6 });
        this.flag('midDoorForced');
      },
    });

    doorItem('gym', d.gym, () => {
      if (!this.story.has('chaseStarted') && !this.story.has('s4Done')) {
        s.audio.play('doorLocked', { pos: d.gym.center() });
        s.hud.hint('door.gymCode', 3);
        return;
      }
      s.keypad.open(this.story.has('deduceCode') ? '631' : undefined);
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
      use: () => {
        if (!this.story.has('deduceLocker')) {
          s.audio.play('lockerRattle', { pos: d.locker17.center(), gain: 0.4 });
          s.hud.hint('door.locked', 2.5);
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
        use: () => {
          obj.visible = false;
          s.audio.play('pickup');
          fn();
        },
      });

    pickup('credential', pk.credential, 0.3, () => true, () => {
      this.flag('hasCredential');
      s.hud.hint('pickup', 3, { item: tItem('item.credential') });
      s.journal.knowPerson('daniela');
      this.addClue('c2');
    });
    pickup('recorder', pk.recorder, 0.3, () => true, () => {
      this.flag('hasRecorder');
      s.recorder.available = true;
      s.recorder.toggle(true);
      s.hud.hint('hint.tape', 8);
      this.goal('goal.recorder');
    });
    pickup('photo', pk.photo, 0.2, () => d.locker17.isOpen, () => {
      this.flag('hasLuciaPhoto');
      s.hud.hint('pickup', 3, { item: tItem('item.photo') });
      this.addClue('c6');
    });
    pickup('key', pk.key, 0.2, () => d.locker17.isOpen, () => {
      this.flag('hasBathKey');
      s.hud.hint('pickup', 3, { item: tItem('item.key') });
      this.goal('goal.bath');
    });

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

  private setupTools(): void {
    const s = this.s;
    s.phone.onToggle = (out) => {
      if (out && !this.hintedPhone) {
        this.hintedPhone = true;
        this.later(2.5, () => s.hud.hint('hint.flash', 5));
        this.later(8, () => s.hud.hint('hint.phoneScreens', 6));
      }
      if (out && this.story.has('sms2') && !this.story.has('hasBoardPhoto')) this.later(0.6, () => s.hud.hint('hint.camera', 6));
    };
    s.phone.onPhoto = (p) => {
      if (!p.clue) {
        s.hud.toast('hint.photoSaved', 1.5);
        return;
      }
      this.addClue(p.clue, p.canvas);
      if (p.clue === 'c3') {
        this.flag('hasBoardPhoto');
        this.goal('goal.connect');
        this.cursedPhoto();
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
    s.recorder.onToggle = (out) => out && s.hud.hint('hint.recorder', 5);
    s.recorder.onTapePlayed = () => {
      this.flag('heardTape');
      this.addClue('c4');
      this.later(1.5, () => s.hud.hint('hint.recordRoom', 7));
      this.goal('goal.record');
    };
    s.recorder.onRecordStart = () => s.director.addTension(5);
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
        this.goal('goal.connect');
      } else s.hud.hint('hint.nothing', 3);
    };
    // Tape subtitles
    const origUse = s.recorder.use.bind(s.recorder);
    s.recorder.use = () => {
      const before = s.recorder.state;
      origUse();
      if (before === 'idle' && s.recorder.state === 'playingTape') {
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
      const d = s.school.doors;
      switch (r.connection.flag) {
        case 'deduceRehearsal':
          // El pestillo se abre solo
          this.later(1.2, () => {
            s.audio.play('unlock', { pos: d.room2B.center() });
            d.room2B.locked = false;
            this.later(0.8, () => {
              d.room2B.open();
              s.audio.play('doorCreak', { pos: d.room2B.center() });
            });
            this.goal('goal.classroom');
            this.save('classroom');
          });
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
    if (a === 'hall' && !this.story.has('insideSchool')) {
      this.flag('insideSchool');
      s.director.enabled = true;
      if (!s.journal.graph.has('c1')) this.addClue('c1', posterCanvas());
      this.save('corridor');
    }
    if (a === 'corridor' && !this.story.has('sms2')) {
      this.flag('sms2');
      this.later(1.5, () => s.phone.receiveSms('sms.2'));
      this.goal('goal.follow');
    }
    if (a === 'classroom' && !this.story.has('hasRecorder')) this.goal('goal.recorder');
    if (a === 'bathroom' && !this.story.has('s3Done')) {
      if (this.bathT === 0) {
        this.save('bathroom');
        this.goal('goal.mirror');
        this.later(2, () => s.phone.receiveSms('sms.mirror1'));
        this.later(7, () => s.phone.receiveSms('sms.mirror2'));
      }
      if (this.stage === 'free') this.go('s3_ramp');
    }
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
    s.phone.newPhotos = 2;
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
      s.phone.showScare(s.screamer.face(SEED.daniela).image as HTMLCanvasElement);
      this.hit(SEED.daniela);
      this.later(0.9, () => {
        s.phone.showScare(null);
        s.phone.forced = false;
        s.phone.toggle(false);
        const far = s.school.lights.corridor[6];
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
      s.director.majorFinished();
      this.goal('goal.leave');
      this.go('free');
      s.director.arm('s4');
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
    const all = [...s.school.lights.corridor, ...s.school.lights.long, ...s.school.lights.hall, ...s.school.lights.classroom];
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
    if (this.catches <= 2) this.hit(SEED.anapaula, false, 0.5);
    else s.audio.play('caught');
    s.screamer.blackout(1.4);
    this.later(0.3, () => {
      s.player.teleport(0.4, -25, 0);
      s.player.crouched = false;
      if (!s.school.doors.mid.isOpen) s.school.doors.mid.close();
    });
    this.later(1.6, () => s.mimic.spawnBehind());
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
        const start = this.story.has('hasMirrorCode') ? 4 : 30;
        if (this.bathT > start) s.mirror.delay = Math.min(0.9, s.mirror.delay + dt * 0.05);
        if (s.mirror.delay >= 0.9 && !s.mirror.frozen) {
          s.mirror.frozen = true;
          s.director.arm('s3');
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
        if (d < 2.4 || this.finalT > 40) {
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
        const from = -Math.PI / 2;
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

function shortAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

