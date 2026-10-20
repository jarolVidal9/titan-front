import { Injectable, type Signal, type WritableSignal, computed, signal } from '@angular/core';
import { Idb, type WriteOp } from './idb';
import { TABLES, type Row, type SyncRecord, type TableName, type Tables } from './schema';
import { SEED_UPDATED_AT, seedRecords } from './seed';

interface StoredRecord extends SyncRecord {}

interface Version {
  updatedAt: number;
  deleted: boolean;
}

/** Internamente las tablas son mapas sin tipar; la API pública devuelve las filas tipadas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMap = Map<string, any>;

const keyOf = (table: TableName, uid: string) => `${table}/${uid}`;

/**
 * Base de datos local: todo vive en memoria como signals (las vistas son `computed`) y se
 * persiste en IndexedDB en segundo plano. Cada escritura local queda pendiente de sincronizar.
 */
@Injectable({ providedIn: 'root' })
export class LocalDb {
  private idb?: Idb;
  // Mapas mutables con `equal: () => false`: cada escritura notifica sin copiar la tabla entera.
  private readonly tables = Object.fromEntries(
    TABLES.map((t) => [t, signal<AnyMap>(new Map(), { equal: () => false })]),
  ) as Record<TableName, WritableSignal<AnyMap>>;
  private readonly lists = new Map<TableName, Signal<unknown[]>>();

  /** updatedAt/deleted de cada registro, incluidos los borrados (para last-write-wins). */
  private readonly versions = new Map<string, Version>();
  /** Claves con cambios locales sin subir → updatedAt de ese cambio. */
  private readonly pending = new Map<string, number>();
  private readonly dirty = new Set<string>();
  private flushScheduled = false;
  private persistChain = Promise.resolve();
  private readonly changeListeners: (() => void)[] = [];

  readonly ready = signal(false);
  readonly pendingCount = signal(0);

  async init(): Promise<void> {
    let records: StoredRecord[] = [];
    let pending: { key: string; updatedAt: number }[] = [];
    try {
      this.idb = await Idb.open();
      [records, pending] = await Promise.all([this.idb.getAll<StoredRecord>('records'), this.idb.getAll<{ key: string; updatedAt: number }>('pending')]);
    } catch (e) {
      // Sin IndexedDB (algunos modos privados): la app funciona igual, solo en memoria.
      console.warn('IndexedDB no disponible; los datos no se guardarán en este navegador.', e);
      this.idb = undefined;
    }
    for (const r of records) this.load(r);
    for (const p of pending) this.pending.set(p.key, p.updatedAt);
    this.pendingCount.set(this.pending.size);
    for (const t of TABLES) this.tables[t].set(this.tables[t]());
    if (this.versions.size === 0) this.seed();
    this.ready.set(true);
  }

  /** Se llama tras cada cambio local (para programar la sincronización). */
  onLocalChange(cb: () => void): void {
    this.changeListeners.push(cb);
  }

  // ---------- Lectura ----------

  map<T extends TableName>(table: T): Signal<ReadonlyMap<string, Row<T>>> {
    return this.tables[table] as Signal<ReadonlyMap<string, Row<T>>>;
  }

  list<T extends TableName>(table: T): Signal<Row<T>[]> {
    let s = this.lists.get(table);
    if (!s) this.lists.set(table, (s = computed(() => [...this.tables[table]().values()])));
    return s as Signal<Row<T>[]>;
  }

  get<T extends TableName>(table: T, id: string | null | undefined): Row<T> | undefined {
    return id == null ? undefined : (this.tables[table]().get(id) as Row<T> | undefined);
  }

  // ---------- Escritura local ----------

  put<T extends TableName>(table: T, id: string, data: Tables[T]): Row<T> {
    const row = { ...data, id } as Row<T>;
    this.tables[table].update((m) => m.set(id, row));
    this.touch(table, id, false);
    return row;
  }

  patch<T extends TableName>(table: T, id: string, changes: Partial<Tables[T]>): void {
    const current = this.get(table, id);
    if (!current) return;
    const { id: _, ...data } = { ...current, ...changes };
    this.put(table, id, data as unknown as Tables[T]);
  }

  delete(table: TableName, id: string): void {
    if (!this.tables[table]().has(id)) return;
    this.tables[table].update((m) => {
      m.delete(id);
      return m;
    });
    this.touch(table, id, true);
  }

  private touch(table: TableName, uid: string, deleted: boolean, updatedAt?: number): void {
    const key = keyOf(table, uid);
    // Siempre mayor que la versión anterior, aunque el reloj vaya raro.
    const ts = updatedAt ?? Math.max(Date.now(), (this.versions.get(key)?.updatedAt ?? 0) + 1);
    this.versions.set(key, { updatedAt: ts, deleted });
    this.pending.set(key, ts);
    this.pendingCount.set(this.pending.size);
    this.markDirty(key);
    for (const cb of this.changeListeners) cb();
  }

  // ---------- Sincronización ----------

  pendingChanges(limit: number): SyncRecord[] {
    const out: SyncRecord[] = [];
    for (const [key, updatedAt] of this.pending) {
      if (out.length >= limit) break;
      out.push(this.recordFor(key, updatedAt));
    }
    return out;
  }

  /** Quita de pendientes lo subido, salvo que se haya vuelto a editar mientras tanto. */
  ackPushed(records: SyncRecord[]): void {
    for (const r of records) {
      const key = keyOf(r.table, r.uid);
      if (this.pending.get(key) === r.updatedAt) {
        this.pending.delete(key);
        this.markDirty(key);
      }
    }
    this.pendingCount.set(this.pending.size);
  }

  /** Aplica cambios del servidor: solo los más nuevos que lo local (last-write-wins). */
  applyRemote(records: SyncRecord[]): number {
    let applied = 0;
    const touched = new Set<TableName>();
    for (const r of records) {
      if (!TABLES.includes(r.table)) continue;
      const key = keyOf(r.table, r.uid);
      const local = this.versions.get(key);
      if (local && local.updatedAt >= r.updatedAt) continue;
      this.versions.set(key, { updatedAt: r.updatedAt, deleted: r.deleted });
      const m = this.tables[r.table]() as Map<string, unknown>;
      if (r.deleted || r.data == null) m.delete(r.uid);
      else m.set(r.uid, { ...(r.data as object), id: r.uid });
      if (this.pending.delete(key)) this.pendingCount.set(this.pending.size);
      this.markDirty(key);
      touched.add(r.table);
      applied++;
    }
    for (const t of touched) this.tables[t].set(this.tables[t]());
    return applied;
  }

  /** Al iniciar sesión: todo lo local se sube (el servidor decide por fecha). */
  markAllPending(): void {
    for (const [key, v] of this.versions) {
      this.pending.set(key, v.updatedAt);
      this.markDirty(key);
    }
    this.pendingCount.set(this.pending.size);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return this.idb?.get<T>('meta', key);
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.idb?.write([{ store: 'meta', key, value }]);
  }

  /** Borra todo lo local (al cerrar sesión) y vuelve a sembrar los catálogos base. */
  async reset(): Promise<void> {
    await this.persistChain;
    this.dirty.clear();
    this.versions.clear();
    this.pending.clear();
    this.pendingCount.set(0);
    for (const t of TABLES) this.tables[t].set(new Map());
    await this.idb?.clear(['records', 'pending', 'meta']);
    this.seed();
  }

  /**
   * Reemplaza todos los datos por [records] (o por solo los catálogos base si no se pasa nada).
   * Se hace con borrados y escrituras normales, así el cambio también se sincroniza.
   */
  replaceAll(records: SyncRecord[] = []): void {
    const incoming = new Map<string, { table: TableName; uid: string; data: object }>();
    for (const s of seedRecords()) incoming.set(keyOf(s.table, s.id), { table: s.table, uid: s.id, data: s.data });
    for (const r of records) {
      if (!r.deleted && r.data && TABLES.includes(r.table)) incoming.set(keyOf(r.table, r.uid), { table: r.table, uid: r.uid, data: r.data as object });
    }
    for (const t of TABLES) {
      for (const uid of [...this.tables[t]().keys()]) if (!incoming.has(keyOf(t, uid))) this.delete(t, uid);
    }
    for (const { table, uid, data } of incoming.values()) {
      const { id: _, ...clean } = data as { id?: string };
      this.put(table, uid, clean as Tables[typeof table]);
    }
  }

  /** Todos los registros vivos (para el backup). */
  exportAll(): SyncRecord[] {
    const out: SyncRecord[] = [];
    for (const [key, v] of this.versions) if (!v.deleted) out.push(this.recordFor(key, v.updatedAt));
    return out;
  }

  /** Espera a que IndexedDB tenga todo lo escrito hasta ahora. */
  flushed(): Promise<void> {
    this.flush();
    return this.persistChain;
  }

  // ---------- Interno ----------

  private seed(): void {
    for (const { table, id, data } of seedRecords()) {
      (this.tables[table]() as Map<string, unknown>).set(id, { ...data, id });
      this.touch(table, id, false, SEED_UPDATED_AT);
    }
    for (const t of TABLES) this.tables[t].set(this.tables[t]());
  }

  private load(r: StoredRecord): void {
    this.versions.set(keyOf(r.table, r.uid), { updatedAt: r.updatedAt, deleted: r.deleted });
    if (!r.deleted && r.data != null) {
      (this.tables[r.table]() as Map<string, unknown>).set(r.uid, { ...(r.data as object), id: r.uid });
    }
  }

  private recordFor(key: string, updatedAt: number): SyncRecord {
    const slash = key.indexOf('/');
    const table = key.slice(0, slash) as TableName;
    const uid = key.slice(slash + 1);
    const row = this.tables[table]().get(uid);
    if (!row) return { table, uid, data: null, updatedAt, deleted: true };
    const { id: _, ...data } = row as Row<TableName>;
    return { table, uid, data, updatedAt, deleted: false };
  }

  private markDirty(key: string): void {
    this.dirty.add(key);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => this.flush());
  }

  /** Persiste en una sola transacción todo lo que cambió en este tick. */
  private flush(): void {
    this.flushScheduled = false;
    if (!this.dirty.size || !this.idb) return;
    const ops: WriteOp[] = [];
    for (const key of this.dirty) {
      const v = this.versions.get(key);
      if (v) ops.push({ store: 'records', key, value: this.recordFor(key, v.updatedAt) });
      const p = this.pending.get(key);
      ops.push(p === undefined ? { store: 'pending', key } : { store: 'pending', key, value: { key, updatedAt: p } });
    }
    this.dirty.clear();
    const idb = this.idb;
    this.persistChain = this.persistChain
      .then(() => idb.write(ops))
      .catch((e) => console.error('No se pudo guardar en IndexedDB', e));
  }
}
