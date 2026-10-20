import type { Row } from '../db/schema';
import { type SetRecord, countsForStats, isCardio } from './models';

/** Lunes 00:00 de la semana de [ms]. */
export function weekStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}

export interface WeekStat {
  start: number;
  sessions: number;
  sets: number; // series efectivas de fuerza (sin calentamiento)
  trainingMinutes: number; // inicio → fin de las sesiones terminadas
  cardioMinutes: number;
}

/** Últimas [weeks] semanas (la última es la actual), incluidas las vacías. */
export function weeklyProgress(
  sets: SetRecord[],
  finished: Row<'workout_sessions'>[],
  now: number,
  weeks = 8,
): WeekStat[] {
  const current = new Date(weekStart(now));
  const acc = new Map<number, { stat: WeekStat; trainingSec: number; cardioSec: number }>();
  const list: WeekStat[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * i).getTime();
    const stat: WeekStat = { start, sessions: 0, sets: 0, trainingMinutes: 0, cardioMinutes: 0 };
    list.push(stat);
    acc.set(start, { stat, trainingSec: 0, cardioSec: 0 });
  }
  for (const s of finished) {
    const w = acc.get(weekStart(s.startedAt));
    if (!w) continue;
    w.stat.sessions++;
    if (s.finishedAt != null) {
      // Tope de 5 h por sesión por si alguna quedó abierta por error.
      w.trainingSec += Math.min(Math.max(0, Math.floor((s.finishedAt - s.startedAt) / 1000)), 5 * 3600);
    }
  }
  for (const r of sets) {
    const w = acc.get(weekStart(r.sessionStart));
    if (!w || !countsForStats(r)) continue;
    if (isCardio(r)) w.cardioSec += r.set.durationSec ?? 0;
    else w.stat.sets++;
  }
  for (const w of acc.values()) {
    w.stat.trainingMinutes = Math.floor(w.trainingSec / 60);
    w.stat.cardioMinutes = Math.floor(w.cardioSec / 60);
  }
  return list;
}
