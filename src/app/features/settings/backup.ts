import type { SyncRecord } from '../../core/db/schema';

const APP_ID = 'titan';
const VERSION = 1;

export interface Backup {
  app: typeof APP_ID;
  version: number;
  createdAt: number;
  records: SyncRecord[];
}

export class BackupError extends Error {}

export function createBackup(records: SyncRecord[]): Blob {
  const backup: Backup = { app: APP_ID, version: VERSION, createdAt: Date.now(), records };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `titan_backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** Lee y valida el archivo sin tocar nada. */
export async function readBackup(file: File): Promise<Backup> {
  let parsed: Partial<Backup>;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new BackupError('El archivo no es un backup válido.');
  }
  if (parsed.app !== APP_ID || !Array.isArray(parsed.records)) throw new BackupError('El archivo no es un backup de TITAN.');
  if ((parsed.version ?? 0) > VERSION) throw new BackupError('El backup es de una versión más nueva de la app.');
  return parsed as Backup;
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
