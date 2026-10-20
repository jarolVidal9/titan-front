import { Injectable, inject } from '@angular/core';
import type { SetRecord } from '../../core/data/models';
import { type PrKind, detectPrs } from '../../core/data/stats';
import { WorkoutRepo } from '../../core/data/workout.repo';
import type { Row } from '../../core/db/schema';
import { RepTypeInfoSheet } from '../settings/rep-type-info';
import { UiService } from '../../shared/ui.service';
import { EditCardioDialog, EditSetDialog, type SetEdit } from './edit-set-dialogs';

@Injectable({ providedIn: 'root' })
export class SetActions {
  private readonly ui = inject(UiService);
  private readonly workout = inject(WorkoutRepo);

  async edit(record: SetRecord, repTypes: Row<'rep_types'>[]): Promise<void> {
    const result =
      record.repType.measure === 'cardio'
        ? await this.ui.open<SetEdit>(EditCardioDialog, record)
        : await this.ui.open<SetEdit>(EditSetDialog, { record, repTypes });
    if (result === undefined) return;
    if (result === null) this.workout.deleteSet(record.set);
    else this.workout.updateSet(record.set.id, result);
  }

  /** Récords de una serie recién guardada: solo cuenta lo hecho ANTES de esta sesión. */
  prsFor(setId: string, exerciseId: string, session: Row<'workout_sessions'>): Set<PrKind> {
    const records = this.workout.exerciseRecords(exerciseId);
    const candidate = records.find((r) => r.set.id === setId);
    if (!candidate) return new Set();
    return detectPrs(
      candidate,
      records.filter((r) => r.sessionId !== session.id && r.sessionStart <= session.startedAt),
    );
  }

  showRepTypes(types: Row<'rep_types'>[]): void {
    void this.ui.sheet(RepTypeInfoSheet, types, types.length > 2);
  }
}

export function describePrs(kinds: Set<PrKind>): string {
  return [kinds.has('weight') && 'peso máximo', kinds.has('oneRm') && '1RM estimado', kinds.has('hold') && 'mayor tiempo']
    .filter(Boolean)
    .join(' y ');
}
