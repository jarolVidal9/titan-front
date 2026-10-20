import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { SoundService } from './sound.service';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

/** No cuenta "ticks": guarda la hora de fin, así el tiempo es correcto aunque la pestaña se suspenda. */
export interface TimerState {
  status: TimerStatus;
  totalSec: number;
  endsAt: number | null;
  pausedRemainingMs: number | null;
  label: string | null;
}

const IDLE: TimerState = { status: 'idle', totalSec: 0, endsAt: null, pausedRemainingMs: null, label: null };
const STORE_KEY = 'titan.timer';

export function remainingMs(s: TimerState, now: number): number {
  if (s.status === 'running') return Math.max(0, s.endsAt! - now);
  if (s.status === 'paused') return s.pausedRemainingMs ?? 0;
  return 0;
}

@Injectable({ providedIn: 'root' })
export class RestTimerService {
  private readonly sound = inject(SoundService);
  private readonly now = signal(Date.now());
  private ticker?: ReturnType<typeof setInterval>;
  private autoHide?: ReturnType<typeof setTimeout>;

  readonly state = signal<TimerState>(IDLE);
  readonly remaining = computed(() => remainingMs(this.state(), this.now()));
  readonly remainingSec = computed(() => Math.ceil(this.remaining() / 1000));
  /** 1 = recién iniciado, 0 = terminado. */
  readonly progress = computed(() => {
    const s = this.state();
    return s.totalSec <= 0 ? 0 : Math.min(1, Math.max(0, this.remaining() / (s.totalSec * 1000)));
  });
  readonly isActive = computed(() => ['running', 'paused'].includes(this.state().status));

  constructor() {
    this.restore();
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.ticker);
      clearTimeout(this.autoHide);
    });
  }

  start(seconds: number, label: string | null = null): void {
    clearTimeout(this.autoHide);
    this.set({ status: 'running', totalSec: seconds, endsAt: Date.now() + seconds * 1000, pausedRemainingMs: null, label });
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  }

  pause(): void {
    const s = this.state();
    if (s.status === 'running') this.set({ ...s, status: 'paused', pausedRemainingMs: remainingMs(s, Date.now()), endsAt: null });
  }

  resume(): void {
    const s = this.state();
    if (s.status === 'paused') this.set({ ...s, status: 'running', endsAt: Date.now() + (s.pausedRemainingMs ?? 0), pausedRemainingMs: null });
  }

  add10(): void {
    const s = this.state();
    if (s.status === 'running') this.set({ ...s, endsAt: s.endsAt! + 10_000, totalSec: s.totalSec + 10 });
    if (s.status === 'paused') this.set({ ...s, pausedRemainingMs: (s.pausedRemainingMs ?? 0) + 10_000, totalSec: s.totalSec + 10 });
  }

  skip(): void {
    this.set(IDLE);
  }

  dismissFinished(): void {
    if (this.state().status === 'finished') this.set(IDLE);
  }

  private set(next: TimerState): void {
    this.state.set(next);
    this.now.set(Date.now());
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento: el descanso no sobrevive a recargar la página.
    }
    clearInterval(this.ticker);
    if (next.status === 'running') this.ticker = setInterval(() => this.tick(), 250);
  }

  private tick(): void {
    const now = Date.now();
    this.now.set(now);
    const s = this.state();
    if (s.status === 'running' && now >= s.endsAt!) {
      this.set({ ...s, status: 'finished' });
      this.celebrateEnd(s.label);
    }
  }

  private celebrateEnd(label: string | null): void {
    this.sound.play('rest_end');
    this.sound.vibrate();
    if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('¡A la siguiente serie!', { body: label ?? 'Terminó el descanso', icon: 'branding/icon.png', tag: 'rest-timer' });
    }
    this.autoHide = setTimeout(() => this.dismissFinished(), 8000);
  }

  /** Si terminó mientras la página estaba cerrada, no se vuelve a avisar. */
  private restore(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as TimerState | null;
      if (!saved || saved.status === 'idle' || saved.status === 'finished') return;
      if (saved.status === 'running' && Date.now() >= saved.endsAt!) return this.set(IDLE);
      this.set(saved);
    } catch {
      // Estado corrupto o sin almacenamiento: se empieza en reposo.
    }
  }
}
