import { Injectable, computed, inject } from '@angular/core';
import { LocalDb } from '../db/local-db';
import type { Row, WorkoutSet } from '../db/schema';
import type { SessionSummary, SessionView, SetRecord } from './models';

const MINUTE = 60_000;

/**
 * Una sesión "registrada después" (marcada al crearla o al reabrirla, o que empezó hace
 * más de 12 h) no usa temporizador y sus series reciben horas dentro de la sesión
 * (no la hora actual), para que historial, récords y "última vez" respeten el orden real.
 */
export const BACKFILL_AFTER_MS = 12 * 60 * MINUTE;

export const isBackdated = (s: Row<'workout_sessions'>, now = Date.now()) =>
  s.retroactive || now - s.startedAt > BACKFILL_AFTER_MS;

export interface StartSessionOptions {
  routineDayId?: string | null;
  groupIds: Iterable<string>;
  exerciseIds: string[];
  /** Paralelo a exerciseIds (biseries de la plantilla). */
  supersetGroups?: (string | null)[];
  startedAt?: number;
  retroactive?: boolean;
}

export type SetValues = Pick<WorkoutSet, 'repTypeId' | 'reps' | 'durationSec' | 'weightKg' | 'distanceKm' | 'intensity' | 'note'>;

const bySetOrder = (a: SetRecord, b: SetRecord) => a.set.createdAt - b.set.createdAt || a.set.id.localeCompare(b.set.id);

@Injectable({ providedIn: 'root' })
export class WorkoutRepo {
  private readonly db = inject(LocalDb);

  // ---------- Vistas ----------

  readonly sessions = computed(() => [...this.db.list('workout_sessions')()].sort((a, b) => b.startedAt - a.startedAt));
  readonly activeSession = computed(() => this.sessions().find((s) => s.finishedAt == null) ?? null);
  readonly finishedSessions = computed(() => this.sessions().filter((s) => s.finishedAt != null));

  /** Todas las series en orden cronológico, con su tipo y su sesión. */
  readonly allSets = computed<SetRecord[]>(() => {
    const ses = this.db.map('session_exercises')();
    const sessions = this.db.map('workout_sessions')();
    const types = this.db.map('rep_types')();
    const out: SetRecord[] = [];
    for (const set of this.db.list('workout_sets')()) {
      const se = ses.get(set.sessionExerciseId);
      const session = se && sessions.get(se.sessionId);
      if (!session) continue;
      const repType = types.get(set.repTypeId) ?? placeholderRepType(set);
      out.push({ set, repType, sessionId: session.id, sessionStart: session.startedAt });
    }
    return out.sort(bySetOrder);
  });

  readonly setsByExercise = computed(() => groupBy(this.allSets(), (r) => r.set.exerciseId));

  private readonly setsBySessionExercise = computed(() => {
    const map = groupBy(this.allSets(), (r) => r.set.sessionExerciseId);
    for (const list of map.values()) list.sort((a, b) => a.set.setNumber - b.set.setNumber);
    return map;
  });

  private readonly exercisesBySession = computed(() => {
    const map = groupBy(this.db.list('session_exercises')(), (se) => se.sessionId);
    for (const list of map.values()) list.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    return map;
  });

  readonly summaries = computed<SessionSummary[]>(() => {
    const exercises = this.db.map('exercises')();
    const bySe = this.setsBySessionExercise();
    return this.sessions().map((session) => {
      const ses = this.exercisesBySession().get(session.id) ?? [];
      return {
        session,
        exerciseNames: ses.map((se) => exercises.get(se.exerciseId)?.name).filter((n): n is string => !!n),
        setCount: ses.reduce((a, se) => a + (bySe.get(se.id)?.length ?? 0), 0),
        minutes: session.finishedAt == null ? null : Math.floor((session.finishedAt - session.startedAt) / MINUTE),
      };
    });
  });

  /** Vista completa de una sesión. Reactiva: úsala dentro de un `computed`. */
  session(id: string): SessionView | null {
    const session = this.db.get('workout_sessions', id);
    if (!session) return null;
    const exercises = this.db.map('exercises')();
    const bySe = this.setsBySessionExercise();
    return {
      session,
      groupIds: new Set(this.db.list('session_muscle_groups')().filter((g) => g.sessionId === id).map((g) => g.muscleGroupId)),
      exercises: (this.exercisesBySession().get(id) ?? [])
        .filter((se) => exercises.has(se.exerciseId))
        .map((se) => ({ sessionExercise: se, exercise: exercises.get(se.exerciseId)!, sets: bySe.get(se.id) ?? [] })),
    };
  }

  exerciseRecords(exerciseId: string): SetRecord[] {
    return this.setsByExercise().get(exerciseId) ?? [];
  }

  /**
   * Series de la última sesión ANTERIOR a [sessionId] en la que se hizo el ejercicio
   * (si registras una sesión pasada, "la última vez" es la previa a esa fecha).
   */
  previousSessionSets(exerciseId: string, sessionId: string): SetRecord[] {
    const current = this.db.get('workout_sessions', sessionId);
    const others = this.exerciseRecords(exerciseId).filter(
      (r) => r.sessionId !== sessionId && (!current || r.sessionStart <= current.startedAt),
    );
    const last = others.at(-1)?.sessionId;
    return last ? others.filter((r) => r.sessionId === last).sort((a, b) => a.set.setNumber - b.set.setNumber) : [];
  }

  // ---------- Sesiones ----------

  startSession(o: StartSessionOptions): string {
    const id = crypto.randomUUID();
    this.db.put('workout_sessions', id, {
      startedAt: o.startedAt ?? Date.now(),
      finishedAt: null,
      routineDayId: o.routineDayId ?? null,
      notes: null,
      retroactive: o.retroactive ?? false,
    });
    for (const g of o.groupIds) this.db.put('session_muscle_groups', `${id}:${g}`, { sessionId: id, muscleGroupId: g });
    const seIds = o.exerciseIds.map((exerciseId, position) => {
      const seId = crypto.randomUUID();
      this.db.put('session_exercises', seId, { sessionId: id, exerciseId, position, supersetGroup: null });
      return seId;
    });
    // Cada grupo de la plantilla pasa a ser una biserie de la sesión.
    const byGroup = new Map<string, string[]>();
    (o.supersetGroups ?? []).forEach((g, i) => {
      if (g != null && seIds[i]) byGroup.set(g, [...(byGroup.get(g) ?? []), seIds[i]]);
    });
    for (const members of byGroup.values()) if (members.length >= 2) this.setGroup(members, members[0]);
    return id;
  }

  finishSession(id: string, finishedAt?: number): void {
    const session = this.db.get('workout_sessions', id);
    if (!session) return;
    this.setSessionEnd(id, finishedAt ?? (isBackdated(session) ? this.estimatedEnd(id) : Date.now()));
  }

  /** Fin estimado de una sesión registrada después: última serie + 2 min (o 1 h si no hay series). */
  estimatedEnd(id: string): number {
    const session = this.db.get('workout_sessions', id)!;
    if (session.finishedAt != null) return session.finishedAt;
    return (this.lastSetTime(id) ?? session.startedAt + 58 * MINUTE) + 2 * MINUTE;
  }

  /** Fija la hora de fin; nunca antes del inicio. */
  setSessionEnd(id: string, end: number): void {
    const session = this.db.get('workout_sessions', id);
    if (session) this.db.patch('workout_sessions', id, { finishedAt: Math.max(end, session.startedAt) });
  }

  /** Cambia la fecha/hora de inicio y desplaza el fin y todas sus series en la misma cantidad. */
  changeSessionStart(id: string, newStart: number): void {
    const session = this.db.get('workout_sessions', id);
    if (!session) return;
    const delta = newStart - session.startedAt;
    this.db.patch('workout_sessions', id, {
      startedAt: newStart,
      finishedAt: session.finishedAt == null ? null : session.finishedAt + delta,
    });
    for (const r of this.setsOfSession(id)) this.db.patch('workout_sets', r.set.id, { createdAt: r.set.createdAt + delta });
  }

  reopenSession(id: string): void {
    this.db.patch('workout_sessions', id, { finishedAt: null, retroactive: true });
  }

  deleteSession(id: string): void {
    for (const r of this.setsOfSession(id)) this.db.delete('workout_sets', r.set.id);
    for (const se of this.exercisesBySession().get(id) ?? []) this.db.delete('session_exercises', se.id);
    for (const g of this.db.list('session_muscle_groups')()) if (g.sessionId === id) this.db.delete('session_muscle_groups', g.id);
    this.db.delete('workout_sessions', id);
  }

  setNotes(id: string, notes: string | null): void {
    this.db.patch('workout_sessions', id, { notes });
  }

  setSessionGroups(id: string, groupIds: ReadonlySet<string>): void {
    for (const g of this.db.list('session_muscle_groups')()) {
      if (g.sessionId === id && !groupIds.has(g.muscleGroupId)) this.db.delete('session_muscle_groups', g.id);
    }
    for (const g of groupIds) {
      if (!this.db.get('session_muscle_groups', `${id}:${g}`)) {
        this.db.put('session_muscle_groups', `${id}:${g}`, { sessionId: id, muscleGroupId: g });
      }
    }
  }

  /** Añade el ejercicio a la sesión. Si ya estaba, devuelve el existente (no se duplica). */
  addExercise(sessionId: string, exerciseId: string): string {
    const list = this.exercisesBySession().get(sessionId) ?? [];
    const existing = list.find((se) => se.exerciseId === exerciseId);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    const position = Math.max(-1, ...list.map((se) => se.position)) + 1;
    this.db.put('session_exercises', id, { sessionId, exerciseId, position, supersetGroup: null });
    return id;
  }

  removeSessionExercise(seId: string): void {
    const se = this.db.get('session_exercises', seId);
    if (!se) return;
    for (const r of this.setsBySessionExercise().get(seId) ?? []) this.db.delete('workout_sets', r.set.id);
    this.db.delete('session_exercises', seId);
    this.dissolveSmallGroups(se.sessionId);
  }

  // ---------- Biseries / triseries / circuitos ----------

  /** Une los ejercicios en una biserie (o tri/circuito). Quedan seguidos, en el lugar del primero. */
  linkSuperset(sessionId: string, seIds: string[]): void {
    if (seIds.length < 2) return;
    const all = this.exercisesBySession().get(sessionId) ?? [];
    const members = all.filter((e) => seIds.includes(e.id));
    if (members.length < 2) return;
    const insertAt = all.indexOf(members[0]);
    const rest = all.filter((e) => !seIds.includes(e.id));
    const ordered = [...rest.filter((e) => all.indexOf(e) < insertAt), ...members, ...rest.filter((e) => all.indexOf(e) > insertAt)];
    ordered.forEach((e, position) => {
      if (e.position !== position) this.db.patch('session_exercises', e.id, { position });
    });
    this.setGroup(
      members.map((e) => e.id),
      members[0].id,
    );
    this.dissolveSmallGroups(sessionId);
  }

  /** Saca el ejercicio de su biserie (si quedan menos de 2, la biserie se deshace). */
  unlinkSuperset(seId: string): void {
    const se = this.db.get('session_exercises', seId);
    if (!se) return;
    this.setGroup([seId], null);
    this.dissolveSmallGroups(se.sessionId);
  }

  /** Agrega varios ejercicios a la sesión ya unidos en biserie. Devuelve el grupo. */
  addSuperset(sessionId: string, exerciseIds: string[]): string | null {
    const seIds = exerciseIds.map((ex) => this.addExercise(sessionId, ex));
    this.linkSuperset(sessionId, seIds);
    return this.db.get('session_exercises', seIds[0])?.supersetGroup ?? null;
  }

  private setGroup(seIds: string[], group: string | null): void {
    for (const id of seIds) this.db.patch('session_exercises', id, { supersetGroup: group });
  }

  private dissolveSmallGroups(sessionId: string): void {
    const groups = groupBy(
      (this.exercisesBySession().get(sessionId) ?? []).filter((e) => e.supersetGroup != null),
      (e) => e.supersetGroup!,
    );
    for (const members of groups.values()) {
      if (members.length < 2) this.setGroup(members.map((e) => e.id), null);
    }
  }

  // ---------- Series ----------

  addSet(sessionExerciseId: string, exerciseId: string, values: SetValues): string {
    const existing = this.setsBySessionExercise().get(sessionExerciseId) ?? [];
    const id = crypto.randomUUID();
    this.db.put('workout_sets', id, {
      ...values,
      sessionExerciseId,
      exerciseId,
      setNumber: Math.max(0, ...existing.map((r) => r.set.setNumber)) + 1,
      createdAt: this.newSetTime(sessionExerciseId),
    });
    return id;
  }

  updateSet(id: string, values: SetValues): void {
    this.db.patch('workout_sets', id, values);
  }

  /** Borra la serie y renumera las restantes del mismo ejercicio en la sesión. */
  deleteSet(set: Row<'workout_sets'>): void {
    this.db.delete('workout_sets', set.id);
    (this.setsBySessionExercise().get(set.sessionExerciseId) ?? []).forEach((r, i) => {
      if (r.set.setNumber !== i + 1) this.db.patch('workout_sets', r.set.id, { setNumber: i + 1 });
    });
  }

  // ---------- Interno ----------

  private setsOfSession(sessionId: string): SetRecord[] {
    return this.allSets().filter((r) => r.sessionId === sessionId);
  }

  private lastSetTime(sessionId: string): number | null {
    const sets = this.setsOfSession(sessionId);
    return sets.length ? Math.max(...sets.map((r) => r.set.createdAt)) : null;
  }

  /** Hora para una serie nueva: ahora, o 2 min después de la última serie si la sesión es de otro momento. */
  private newSetTime(sessionExerciseId: string): number {
    const se = this.db.get('session_exercises', sessionExerciseId);
    const session = se && this.db.get('workout_sessions', se.sessionId);
    if (!session || !isBackdated(session)) return Date.now();
    return (this.lastSetTime(session.id) ?? session.startedAt) + 2 * MINUTE;
  }
}

function groupBy<T>(items: Iterable<T>, key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Si el tipo de una serie aún no llegó por sincronización, se infiere de la serie. */
function placeholderRepType(set: Row<'workout_sets'>): Row<'rep_types'> {
  const measure = set.reps == null ? (set.distanceKm != null || set.intensity != null ? 'cardio' : 'seconds') : 'reps';
  return { id: set.repTypeId, name: '—', nameNorm: '', measure, countsForStats: true, isDefault: false, archived: false, position: 999 };
}
