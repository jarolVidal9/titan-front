import { Injectable, computed, inject } from '@angular/core';
import { isSameDay } from '../utils/format';
import { ExerciseRepo } from './exercise.repo';
import { weeklyProgress } from './weekly';
import { WorkoutRepo } from './workout.repo';
import { computeXp } from './xp';

/** Vistas derivadas de todo el historial: XP, logros, récords y avance semanal. */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly workout = inject(WorkoutRepo);
  private readonly exercises = inject(ExerciseRepo);

  readonly xp = computed(() => computeXp(this.workout.allSets(), this.workout.finishedSessions(), this.exercises.names()));
  readonly weekly = computed(() => weeklyProgress(this.workout.allSets(), this.workout.finishedSessions(), Date.now()));

  /** Sesiones terminadas hoy (las más recientes primero). */
  readonly todayDone = computed(() => {
    const now = Date.now();
    return this.workout.summaries().filter((s) => s.session.finishedAt != null && isSameDay(s.session.startedAt, now));
  });
}
