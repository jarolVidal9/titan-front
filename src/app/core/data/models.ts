import type { Row } from '../db/schema';

/** Serie con su tipo de repetición y la fecha de la sesión (para historial y estadísticas). */
export interface SetRecord {
  set: Row<'workout_sets'>;
  repType: Row<'rep_types'>;
  sessionId: string;
  sessionStart: number;
}

export const isTimed = (r: SetRecord) => r.repType.measure === 'seconds';
export const isCardio = (r: SetRecord) => r.repType.measure === 'cardio';
export const countsForStats = (r: SetRecord) => r.repType.countsForStats;

export interface ExerciseItem {
  exercise: Row<'exercises'>;
  groupIds: ReadonlySet<string>;
}

export interface SessionExerciseView {
  sessionExercise: Row<'session_exercises'>;
  exercise: Row<'exercises'>;
  sets: SetRecord[];
}

export interface SessionView {
  session: Row<'workout_sessions'>;
  groupIds: ReadonlySet<string>;
  exercises: SessionExerciseView[];
}

export const totalSets = (v: SessionView) => v.exercises.reduce((a, e) => a + e.sets.length, 0);

/**
 * Ejercicios agrupados en bloques: los consecutivos con el mismo grupo forman
 * una biserie/triserie/circuito; el resto va solo.
 */
export function sessionBlocks(v: SessionView): SessionExerciseView[][] {
  const result: SessionExerciseView[][] = [];
  for (const e of v.exercises) {
    const g = e.sessionExercise.supersetGroup;
    const last = result.at(-1);
    if (g != null && last && last[0].sessionExercise.supersetGroup === g) last.push(e);
    else result.push([e]);
  }
  return result;
}

export const supersetMembers = (v: SessionView, group: string) =>
  v.exercises.filter((e) => e.sessionExercise.supersetGroup === group);

export interface SessionSummary {
  session: Row<'workout_sessions'>;
  exerciseNames: string[];
  setCount: number;
  /** Minutos entre inicio y fin (null si sigue en curso). */
  minutes: number | null;
}

export interface RoutineDayPlan {
  day: Row<'routine_days'>;
  groupIds: ReadonlySet<string>;
  exercises: Row<'exercises'>[]; // ordenados por posición
  supersetGroups: (string | null)[]; // paralelo a exercises: mismo valor = biserie
}

export const isPlanEmpty = (p: RoutineDayPlan) => p.groupIds.size === 0 && p.exercises.length === 0;
