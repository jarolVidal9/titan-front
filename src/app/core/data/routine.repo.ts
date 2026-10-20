import { Injectable, computed, inject } from '@angular/core';
import { LocalDb } from '../db/local-db';
import type { Row } from '../db/schema';
import { routineDayUid } from '../db/seed';
import type { RoutineDayPlan } from './models';

@Injectable({ providedIn: 'root' })
export class RoutineRepo {
  private readonly db = inject(LocalDb);

  /** Los 7 días (lunes a domingo) con su plantilla. */
  readonly week = computed<RoutineDayPlan[]>(() => {
    const days = this.db.map('routine_days')();
    const exercises = this.db.map('exercises')();
    const groups = this.db.list('routine_day_muscle_groups')();
    const rows = [...this.db.list('routine_day_exercises')()].sort((a, b) => a.position - b.position);
    return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const day: Row<'routine_days'> = days.get(routineDayUid(weekday)) ?? { id: routineDayUid(weekday), weekday, name: null };
      const mine = rows.filter((r) => r.routineDayId === day.id && exercises.has(r.exerciseId));
      return {
        day,
        groupIds: new Set(groups.filter((g) => g.routineDayId === day.id).map((g) => g.muscleGroupId)),
        exercises: mine.map((r) => exercises.get(r.exerciseId)!),
        supersetGroups: mine.map((r) => r.supersetGroup),
      };
    });
  });

  saveDay(day: Row<'routine_days'>, name: string, groupIds: ReadonlySet<string>, exerciseIds: string[], supersetGroups: (string | null)[]): void {
    const trimmed = name.trim();
    this.db.put('routine_days', day.id, { weekday: day.weekday, name: trimmed || null });

    for (const g of this.db.list('routine_day_muscle_groups')()) {
      if (g.routineDayId === day.id && !groupIds.has(g.muscleGroupId)) this.db.delete('routine_day_muscle_groups', g.id);
    }
    for (const g of groupIds) {
      const id = `${day.id}:${g}`;
      if (!this.db.get('routine_day_muscle_groups', id)) {
        this.db.put('routine_day_muscle_groups', id, { routineDayId: day.id, muscleGroupId: g });
      }
    }

    // Un UID por posición: reordenar sobreescribe en lugar de crear y borrar filas.
    for (const r of this.db.list('routine_day_exercises')()) {
      if (r.routineDayId === day.id && r.position >= exerciseIds.length) this.db.delete('routine_day_exercises', r.id);
    }
    exerciseIds.forEach((exerciseId, position) => {
      const id = `${day.id}:${position}`;
      const supersetGroup = supersetGroups[position] ?? null;
      const current = this.db.get('routine_day_exercises', id);
      if (current?.exerciseId === exerciseId && current.supersetGroup === supersetGroup && current.routineDayId === day.id) return;
      this.db.put('routine_day_exercises', id, { routineDayId: day.id, exerciseId, position, supersetGroup });
    });
  }
}
