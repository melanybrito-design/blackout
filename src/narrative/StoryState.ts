// Estado de la historia: flags, acto actual y checkpoint. Persistente en localStorage.

export type Flag =
  | 'gateClosed'
  | 'sms1'
  | 'insideSchool'
  | 'sms2'
  | 'hasCredential'
  | 'hasBoardPhoto'
  | 'deduceRehearsal'
  | 'door2BOpen'
  | 'hasRecorder'
  | 'heardTape'
  | 'hasEVP'
  | 'deduceLocker'
  | 's1Done'
  | 'lockerOpened'
  | 's2Done'
  | 'hasLuciaPhoto'
  | 'hasBathKey'
  | 'doubtsPhone'
  | 'deduceDaniela'
  | 'deduceCode'
  | 'bathOpen'
  | 'hasMirrorCode'
  | 's3Done'
  | 's4Done'
  | 'chaseStarted'
  | 'midDoorForced'
  | 'chaseDone'
  | 'gymOpen'
  | 's5Done'
  | 'finished';

export type Checkpoint = 'start' | 'corridor' | 'classroom' | 'bathroom' | 'chase' | 'gym';

interface SaveData {
  flags: Flag[];
  checkpoint: Checkpoint;
  clues: string[];
  links: string[];
}

const KEY = 'uvv.save';
const DONE_KEY = 'uvv.finished';

export class StoryState {
  private flags = new Set<Flag>();
  checkpoint: Checkpoint = 'start';
  private listeners: Array<(f: Flag) => void> = [];

  has(f: Flag): boolean {
    return this.flags.has(f);
  }

  set(f: Flag): void {
    if (this.flags.has(f)) return;
    this.flags.add(f);
    for (const l of this.listeners) l(f);
  }

  onSet(fn: (f: Flag) => void): void {
    this.listeners.push(fn);
  }

  all(): Flag[] {
    return [...this.flags];
  }

  save(clues: string[], links: string[]): void {
    const data: SaveData = { flags: this.all(), checkpoint: this.checkpoint, clues, links };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* sin almacenamiento */
    }
  }

  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch {
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* sin almacenamiento */
    }
  }

  static markFinished(): void {
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* sin almacenamiento */
    }
  }

  static isFinished(): boolean {
    try {
      return localStorage.getItem(DONE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
