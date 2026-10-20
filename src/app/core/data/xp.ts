import type { Row } from '../db/schema';
import { type SetRecord, countsForStats, isCardio, isTimed } from './models';
import { type PrKind, detectPrs, setVolume } from './stats';

export const XP_PER_SESSION = 50;
export const XP_PER_PR = 100;

/**
 * XP de una serie válida: 10 + 1 por cada 100 kg de volumen (o por cada 10 s en isométricas).
 * Cardio: 10 + 1 por cada 2 minutos.
 */
export function xpForSet(r: SetRecord): number {
  if (!countsForStats(r)) return 0;
  if (isCardio(r)) return 10 + Math.floor((r.set.durationSec ?? 0) / 120);
  if (isTimed(r)) return 10 + Math.floor((r.set.durationSec ?? 0) / 10);
  return 10 + Math.floor(setVolume(r.set.weightKg, r.set.reps) / 100);
}

/** XP acumulada necesaria para alcanzar el nivel [level] (nivel 1 = 0 XP). */
export const xpForLevel = (level: number) => (level <= 1 ? 0 : Math.round(100 * Math.pow(level - 1, 1.5)));

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface Achievement {
  title: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0..1
}

export interface PrEvent {
  record: SetRecord;
  kinds: Set<PrKind>;
  exerciseName: string;
}

export interface XpSummary {
  totalXp: number;
  prs: PrEvent[]; // los más recientes primero
  finishedSessions: number;
  totalSets: number; // series efectivas de fuerza
  achievements: Achievement[];
  level: number;
  levelStartXp: number;
  nextLevelXp: number;
  levelProgress: number;
}

export const EMPTY_XP: XpSummary = summary(0, [], 0, 0, []);

function summary(totalXp: number, prs: PrEvent[], finishedSessions: number, totalSets: number, achievements: Achievement[]): XpSummary {
  const level = levelForXp(totalXp);
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return {
    totalXp,
    prs,
    finishedSessions,
    totalSets,
    achievements,
    level,
    levelStartXp,
    nextLevelXp,
    levelProgress: (totalXp - levelStartXp) / (nextLevelXp - levelStartXp),
  };
}

/**
 * La XP no se guarda: se deriva siempre de los datos. Así, editar o borrar series la
 * recalcula y sincroniza sola sin tablas extra. [sets] debe venir en orden cronológico.
 */
export function computeXp(
  sets: SetRecord[],
  finished: Row<'workout_sessions'>[],
  exerciseNames: ReadonlyMap<string, string>,
): XpSummary {
  let xp = 0;
  const prs: PrEvent[] = [];
  const history = new Map<string, SetRecord[]>();
  const prAwarded = new Set<string>(); // ejercicio|sesión: máximo un PR con XP por ejercicio y sesión

  for (const r of sets) {
    xp += xpForSet(r);
    const exId = r.set.exerciseId;
    const prev = history.get(exId) ?? [];
    history.set(exId, prev);
    // Solo se compara contra sesiones anteriores, no contra series de la misma sesión.
    const kinds = detectPrs(r, prev.filter((p) => p.sessionId !== r.sessionId));
    if (kinds.size) {
      prs.push({ record: r, kinds, exerciseName: exerciseNames.get(exId) ?? 'Ejercicio' });
      const key = `${exId}|${r.sessionId}`;
      if (!prAwarded.has(key)) {
        prAwarded.add(key);
        xp += XP_PER_PR;
      }
    }
    prev.push(r);
  }
  xp += finished.length * XP_PER_SESSION;

  const level = levelForXp(xp);
  const n = finished.length;
  const strengthSets = sets.filter((r) => countsForStats(r) && !isCardio(r)).length;
  const goal = (title: string, description: string, value: number, target: number): Achievement => ({
    title,
    description,
    unlocked: value >= target,
    progress: Math.min(1, value / target),
  });
  const sessions = (t: string, target: number) => goal(t, `${target} sesiones completadas`, n, target);
  const setsGoal = (t: string, target: number) => goal(t, `${target} series registradas`, strengthSets, target);
  const lvl = (t: string, target: number) => goal(t, `Alcanza el nivel ${target}`, level, target);

  return summary(xp, prs.reverse(), n, strengthSets, [
    sessions('Primer paso', 1),
    sessions('Constante', 10),
    sessions('Veterano', 50),
    sessions('Leyenda', 100),
    goal('Nuevo récord', 'Supera tu primer récord personal', prs.length, 1),
    goal('Cazador de récords', '10 récords personales', prs.length, 10),
    setsGoal('Cien series', 100),
    setsGoal('Titán', 1000),
    lvl('Nivel 5', 5),
    lvl('Nivel 10', 10),
  ]);
}
