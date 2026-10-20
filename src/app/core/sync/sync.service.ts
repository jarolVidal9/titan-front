import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocalDb } from '../db/local-db';
import type { SyncRecord } from '../db/schema';
import { AuthService, apiErrorMessage } from './auth.service';

interface SyncResponse {
  applied: number;
  conflicts: SyncRecord[];
  changes: SyncRecord[];
  cursor: number;
  hasMore: boolean;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

const BATCH = 500;
const DEBOUNCE_MS = 1500;
const INTERVAL_MS = 60_000;

/**
 * Sincroniza en segundo plano con `POST /sync`: sube lo pendiente y baja lo nuevo desde el cursor.
 * La app nunca espera a la red; si no hay conexión, lo pendiente queda guardado y se reintenta.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly db = inject(LocalDb);
  private readonly auth = inject(AuthService);

  readonly status = signal<SyncStatus>('idle');
  readonly lastSyncAt = signal<number | null>(null);
  readonly lastError = signal<string | null>(null);

  private running = false;
  private again = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.db.onLocalChange(() => this.schedule());
    // Al iniciar sesión (o al arrancar con sesión) se sincroniza de inmediato.
    effect(() => {
      if (this.auth.loggedIn() && this.db.ready()) void this.syncNow();
    });
    const onOnline = () => void this.syncNow();
    const onVisible = () => document.visibilityState === 'visible' && void this.syncNow();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => document.visibilityState === 'visible' && void this.syncNow(), INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
      clearTimeout(this.timer);
    });
  }

  /** Agrupa varios cambios seguidos en una sola llamada. */
  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), DEBOUNCE_MS);
  }

  async syncNow(): Promise<void> {
    if (!this.auth.loggedIn() || !this.db.ready()) return;
    if (!navigator.onLine) {
      this.status.set('offline');
      return;
    }
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.status.set('syncing');
    try {
      do {
        this.again = false;
        await this.cycle();
      } while (this.again);
      this.status.set('idle');
      this.lastError.set(null);
      this.lastSyncAt.set(Date.now());
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) this.auth.markExpired();
      this.status.set(e instanceof HttpErrorResponse && e.status === 0 ? 'offline' : 'error');
      this.lastError.set(apiErrorMessage(e));
    } finally {
      this.running = false;
    }
  }

  /** Sube y baja por lotes hasta que no quede nada en ningún sentido. */
  private async cycle(): Promise<void> {
    let deviceId = await this.db.getMeta<string>('deviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      await this.db.setMeta('deviceId', deviceId);
    }
    let since = (await this.db.getMeta<number>('cursor')) ?? 0;
    for (;;) {
      const changes = this.db.pendingChanges(BATCH);
      const res = await firstValueFrom(
        this.http.post<SyncResponse>(`${environment.apiUrl}/sync`, { deviceId, since, changes }),
      );
      this.db.ackPushed(changes);
      this.db.applyRemote([...res.conflicts, ...res.changes]);
      since = res.cursor;
      await this.db.setMeta('cursor', since);
      if (!res.hasMore && this.db.pendingCount() === 0) break;
    }
    await this.db.flushed();
  }
}
