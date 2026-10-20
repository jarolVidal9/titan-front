import { formatKg, formatMinutes } from '../utils/format';
import { type SetRecord, countsForStats, isCardio, isTimed } from './models';

/** 1RM estimado con la fórmula de Epley. Con 1 rep, el 1RM es el propio peso. */
export function estimateOneRm(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export const setVolume = (weightKg: number, reps: number | null) => (reps == null ? 0 : weightKg * reps);

/** "80 kg × 10 reps · Lenta", "45 s" o "20 min · 3.5 km". */
export function describeSet(r: SetRecord): string {
  const s = r.set;
  if (isCardio(r)) {
    return [
      formatMinutes(s.durationSec ?? 0),
      s.distanceKm != null ? `${formatKg(s.distanceKm)} km` : null,
      s.intensity != null ? `vel/nivel ${formatKg(s.intensity)}` : null,
      s.note || null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const amount = isTimed(r) ? `${s.durationSec ?? 0} s` : `${s.reps ?? 0} reps`;
  const weight = s.weightKg > 0 ? `${formatKg(s.weightKg)} kg × ` : '';
  const type = r.repType.isDefault && r.repType.name === 'Normal' ? '' : ` · ${r.repType.name}`;
  return `${weight}${amount}${type}`;
}

export type StatMetric = 'maxWeight' | 'volume' | 'oneRm' | 'duration';

export const METRIC_LABEL: Record<StatMetric, string> = {
  maxWeight: 'Peso máx',
  volume: 'Volumen',
  oneRm: '1RM est.',
  duration: 'Duración',
};

export const metricUnit = (m: StatMetric) => (m === 'duration' ? 'min' : 'kg');

export interface SessionPoint {
  sessionId: string;
  date: number;
  maxWeight: number;
  volume: number;
  bestOneRm: number;
  maxSeconds: number;
  cardioMinutes: number;
  distanceKm: number;
}

export function pointValue(p: SessionPoint, m: StatMetric): number {
  switch (m) {
    case 'maxWeight':
      return p.maxWeight;
    case 'volume':
      return p.volume;
    case 'oneRm':
      return p.bestOneRm;
    case 'duration':
      return p.cardioMinutes;
  }
}

export interface RecordValue {
  value: number;
  date: number;
  detail?: string;
}

export interface ExerciseStats {
  points: SessionPoint[]; // una por sesión, en orden cronológico
  maxWeight?: RecordValue;
  bestOneRm?: RecordValue;
  bestVolume?: RecordValue;
  longestHold?: RecordValue;
  longestCardio?: RecordValue; // minutos en una sesión
  longestDistance?: RecordValue; // km en una sesión
  totalSets: number;
}

/**
 * Agrega las series de un ejercicio por sesión. Las series que no cuentan
 * (p. ej. calentamiento) se muestran en el historial, pero no entran en las métricas.
 */
export function computeExerciseStats(records: SetRecord[]): ExerciseStats {
  const bySession = new Map<string, SetRecord[]>();
  for (const r of records) {
    const list = bySession.get(r.sessionId) ?? [];
    list.push(r);
    bySession.set(r.sessionId, list);
  }
  const points: SessionPoint[] = [];
  const stats: ExerciseStats = { points, totalSets: records.length };
  const better = (current: RecordValue | undefined, value: number) => value > 0 && value > (current?.value ?? 0);

  for (const [sessionId, all] of bySession) {
    const sets = all.filter(countsForStats);
    if (!sets.length) continue;
    const date = all[0].sessionStart;
    let mw = 0, vol = 0, orm = 0, cardioMin = 0, km = 0, secs = 0;
    let mwDetail: string | undefined, ormDetail: string | undefined;
    for (const r of sets) {
      const s = r.set;
      if (isCardio(r)) {
        cardioMin += (s.durationSec ?? 0) / 60;
        km += s.distanceKm ?? 0;
        continue;
      }
      if (isTimed(r)) {
        if ((s.durationSec ?? 0) > secs) secs = s.durationSec ?? 0;
        if (s.weightKg > mw) {
          mw = s.weightKg;
          mwDetail = `${s.durationSec ?? 0} s`;
        }
        continue;
      }
      const reps = s.reps ?? 0;
      vol += setVolume(s.weightKg, reps);
      if (s.weightKg > mw) {
        mw = s.weightKg;
        mwDetail = `${reps} reps`;
      }
      const e = estimateOneRm(s.weightKg, reps);
      if (e > orm) {
        orm = e;
        ormDetail = `${formatKg(s.weightKg)} kg × ${reps}`;
      }
    }
    points.push({ sessionId, date, maxWeight: mw, volume: vol, bestOneRm: orm, maxSeconds: secs, cardioMinutes: cardioMin, distanceKm: km });
    if (better(stats.longestCardio, cardioMin)) stats.longestCardio = { value: cardioMin, date };
    if (better(stats.longestDistance, km)) stats.longestDistance = { value: km, date };
    if (better(stats.maxWeight, mw)) stats.maxWeight = { value: mw, date, detail: mwDetail };
    if (better(stats.bestOneRm, orm)) stats.bestOneRm = { value: orm, date, detail: ormDetail };
    if (better(stats.bestVolume, vol)) stats.bestVolume = { value: vol, date };
    if (better(stats.longestHold, secs)) stats.longestHold = { value: secs, date };
  }
  points.sort((a, b) => a.date - b.date);
  return stats;
}

export type PrKind = 'weight' | 'oneRm' | 'hold';

/**
 * ¿La serie [candidate] supera todo lo anterior (de otras series del mismo ejercicio)?
 * Solo hay récord si existe historial previo: la primera vez no cuenta.
 */
export function detectPrs(candidate: SetRecord, previous: Iterable<SetRecord>): Set<PrKind> {
  const result = new Set<PrKind>();
  if (!countsForStats(candidate) || isCardio(candidate)) return result;
  const prior = [...previous].filter((r) => r.set.id !== candidate.set.id && countsForStats(r));
  if (!prior.length) return result;
  const c = candidate.set;
  if (isTimed(candidate)) {
    const priorTimed = prior.filter(isTimed);
    if (!priorTimed.length) return result;
    const maxSecs = Math.max(...priorTimed.map((r) => r.set.durationSec ?? 0));
    if ((c.durationSec ?? 0) > maxSecs) result.add('hold');
    return result;
  }
  const priorReps = prior.filter((r) => !isTimed(r));
  if (!priorReps.length) return result;
  const maxW = Math.max(...priorReps.map((r) => r.set.weightKg));
  const max1 = Math.max(...priorReps.map((r) => estimateOneRm(r.set.weightKg, r.set.reps ?? 0)));
  if (c.weightKg > 0 && c.weightKg > maxW) result.add('weight');
  if (estimateOneRm(c.weightKg, c.reps ?? 0) > max1 + 0.01) result.add('oneRm');
  return result;
}
