/** Envoltorio mínimo de IndexedDB con promesas: lo justo para LocalDb. */

export type StoreName = 'records' | 'pending' | 'meta';

export interface WriteOp {
  store: StoreName;
  /** Con `value` se guarda; sin él se borra `key`. */
  key: string;
  value?: unknown;
}

const DB_NAME = 'titan';
const VERSION = 1;

const done = (req: IDBRequest) =>
  new Promise<any>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const committed = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export class Idb {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<Idb> {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ['records', 'pending', 'meta']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    return new Idb(await done(req));
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return done(this.db.transaction(store).objectStore(store).getAll());
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return done(this.db.transaction(store).objectStore(store).get(key));
  }

  /** Aplica todas las operaciones en una sola transacción. */
  async write(ops: WriteOp[]): Promise<void> {
    if (!ops.length) return;
    const stores = [...new Set(ops.map((o) => o.store))];
    const tx = this.db.transaction(stores, 'readwrite');
    for (const op of ops) {
      const s = tx.objectStore(op.store);
      if (op.value === undefined) s.delete(op.key);
      else s.put(op.value, op.key);
    }
    await committed(tx);
  }

  async clear(stores: StoreName[]): Promise<void> {
    const tx = this.db.transaction(stores, 'readwrite');
    for (const s of stores) tx.objectStore(s).clear();
    await committed(tx);
  }
}
