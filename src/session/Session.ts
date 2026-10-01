// Sesión de juego: construye el nivel y todos los sistemas, y los conecta.
import * as THREE from 'three';
import type { Game, System } from '../core/Game';
import { RENDER } from '../config';
import { buildSchool, type Area, type School } from '../world/School';
import { PlayerController } from '../player/PlayerController';
import { Interaction } from '../world/Interaction';
import { StoryState } from '../narrative/StoryState';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ScareFX } from '../render/ScareFX';
import { Hud } from '../ui/Hud';
import { Phone } from '../tools/Phone';
import { Recorder } from '../tools/Recorder';
import { Journal } from '../tools/Journal';
import { FearDirector } from '../horror/FearDirector';
import { HorrorEvents } from '../horror/Events';
import { ScreamerOverlay } from '../horror/ScreamerOverlay';
import { MirrorRig } from '../entities/MirrorRig';
import { Mimic } from '../entities/Mimic';
import { Keypad } from '../ui/Keypad';
import { Script } from './Script';
import { Dust } from '../world/atmosphere';
import { Hands } from '../player/Hands';
import { DocumentView } from '../ui/Document';

export class Session implements System {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly school: School;
  readonly player: PlayerController;
  readonly interaction: Interaction;
  readonly story = new StoryState();
  readonly hud: Hud;
  readonly phone: Phone;
  readonly recorder: Recorder;
  readonly journal: Journal;
  readonly director = new FearDirector();
  readonly events: HorrorEvents;
  readonly screamer: ScreamerOverlay;
  readonly mirror: MirrorRig;
  readonly mimic: Mimic;
  readonly keypad: Keypad;
  readonly hands: Hands;
  readonly doc: DocumentView;
  readonly script: Script;
  area: Area | 'none' = 'none';
  /** Secuencia con guion en curso (sin eventos aleatorios, controles limitados). */
  scripted = false;
  onEnd: (() => void) | null = null;

  constructor(
    readonly game: Game,
    readonly audio: AudioEngine,
    readonly fx: ScareFX,
  ) {
    this.camera = game.camera;
    this.scene.fog = new THREE.FogExp2(RENDER.fogColor, RENDER.fogDensity);
    this.scene.background = new THREE.Color(RENDER.fogColor);
    this.scene.add(this.camera);
    game.setView(this.scene, this.camera);

    this.school = buildSchool(game);
    const dust = game.add(new Dust(this.camera));
    this.scene.add(dust.points);
    this.player = game.add(new PlayerController(this.camera, game.input, this.school.collision));
    this.player.surfaceAt = this.school.surfaceAt;
    this.player.onStep = (surface, running) => this.audio.step(surface, running);
    this.interaction = game.add(new Interaction(this.camera, game.input));
    this.hud = game.add(new Hud());
    this.phone = game.add(new Phone(this.camera, game.input, audio, this.school.collision));
    this.recorder = game.add(new Recorder(this.camera, game.input, audio));
    this.journal = new Journal(audio);
    this.screamer = game.add(new ScreamerOverlay(this.camera));
    this.events = game.add(new HorrorEvents(this));
    this.mirror = game.add(new MirrorRig(this.scene, this.player));
    this.mimic = game.add(new Mimic(this.scene, this.player, audio));
    this.keypad = new Keypad('631', audio);
    this.doc = new DocumentView(audio);
    this.hands = game.add(new Hands(this.camera, this.player));
    this.hands.rightBusy = () => this.phone.out;
    this.hands.leftBusy = () => this.recorder.out;
    this.interaction.onUse = () => this.hands.reach();
    this.script = new Script(this);
    game.add(this);

    // Render del visor del celular y fotos (necesitan el renderer)
    game.preRender.push(() => {
      const gl = game.renderer.gl;
      if (this.phone.pendingPhoto) {
        this.phone.pendingPhoto = false;
        this.phone.takePhoto(gl, this.scene);
      }
      this.phone.renderViewfinder(gl, this.scene);
    });

    this.school.lightning.onStrike = () => {
      const delay = 400 + Math.random() * 1400;
      setTimeout(() => this.audio.play('thunder'), delay);
    };
  }

  /** ¿El jugador tiene el control normal? */
  get inMenuLike(): boolean {
    return this.journal.isOpen || this.keypad.isOpen || this.doc.isOpen;
  }

  update(dt: number): void {
    const p = this.player;
    this.area = this.school.areaAt(p.position.x, p.position.z) ?? this.area;

    // Documento abierto: se cierra con E, clic o Espacio (en el frame siguiente al que lo abrió).
    const raw = this.game.input;
    if (this.doc.isOpen && (raw.rawPressed('KeyE') || raw.rawPressed('Mouse0') || raw.rawPressed('Space') || raw.rawPressed('Tab'))) {
      this.doc.close();
    } else if (this.game.input.rawPressed('Tab') && !this.keypad.isOpen && !this.doc.isOpen && !this.scripted) {
      this.journal.toggle();
    }

    // Control del jugador
    p.frozen = this.inMenuLike || this.scriptFreeze;
    p.lookEnabled = !this.inMenuLike && !this.scriptLookLock;
    this.interaction.blocked = this.inMenuLike || this.phone.callState === 'ringing' || this.scripted;
    this.game.input.enabled = !this.keypad.isOpen && !this.doc.isOpen;
    this.hands.hidden = this.journal.isOpen || this.keypad.isOpen;

    // Enrutado del clic entre herramientas
    this.phone.clickBlocked = this.recorder.out && !this.phone.cameraMode;
    this.recorder.clickBlocked = this.phone.out && this.phone.cameraMode;

    // Audio ambiente
    const a = this.area;
    this.audio.outdoor = a === 'patio' ? 1 : a === 'hall' ? 0.35 : 0.06;
    let hum = 0;
    const lights = a !== 'none' ? this.school.lights[a] : [];
    for (const l of lights) {
      if (l.mode === 'off') continue;
      const d = Math.hypot(l.group.position.x - p.position.x, l.group.position.z - p.position.z);
      hum += Math.max(0, 1 - d / 6) * l.level;
    }
    this.audio.hum = Math.min(1, hum);
    const tn = this.director.tension / 100;
    this.audio.tension = tn;
    this.audio.heart = this.mimic.active ? Math.max(0.5, 1 - this.mimic.distance / 20) : Math.max(0, (tn - 0.55) / 0.45);
    this.audio.breath = p.running ? 0.55 : 0.12 + tn * 0.35;
    this.audio.breathRate = p.running ? 0.95 : 0.26 + tn * 0.35;

    // Director de Miedo
    const evs = this.director.update(dt, {
      still: p.stillTime,
      reading: this.journal.isOpen || (this.phone.out && this.phone.screen !== 'home'),
      lookingBack: p.turnRate > 2.5,
      scripted: this.scripted || this.mimic.active,
    });
    for (const e of evs) {
      if (e.kind === 'minor') this.events.minor();
      else if (e.kind === 'medium') this.events.medium();
      else if (e.kind === 'silence') {
        this.audio.duck(e.seconds + 0.4);
        this.script.onSilence(e.id);
      } else if (e.kind === 'major') this.script.major(e.id);
    }

    this.script.update(dt);
  }

  scriptFreeze = false;
  scriptLookLock = false;
}
