import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { type RoutineDayPlan, isPlanEmpty } from '../../core/data/models';
import { RoutineRepo } from '../../core/data/routine.repo';
import { WorkoutRepo } from '../../core/data/workout.repo';
import { WEEKDAY_NAMES, isoWeekday } from '../../core/utils/format';
import { UiService } from '../../shared/ui.service';

export const planTitle = (p: RoutineDayPlan) => `${WEEKDAY_NAMES[p.day.weekday - 1]}${p.day.name ? ' · ' + p.day.name : ''}`;

/** Flujos para empezar sesiones (en vivo, libres o registradas después) y elegir fechas. */
@Injectable({ providedIn: 'root' })
export class SessionFlows {
  private readonly ui = inject(UiService);
  private readonly workout = inject(WorkoutRepo);
  private readonly routine = inject(RoutineRepo);
  private readonly catalog = inject(CatalogRepo);
  private readonly router = inject(Router);

  /** Pide fecha y hora (no futuras). */
  pickPastDateTime(initial?: number): Promise<number | undefined> {
    const d = new Date(Date.now() - 24 * 3600_000);
    d.setHours(18, 0, 0, 0);
    return this.ui.dateTime({ title: '¿Qué día y a qué hora empezaste?', mode: 'datetime', initial: initial ?? d.getTime() });
  }

  /** Pide la hora de fin. Si queda antes del inicio, se asume que terminó al día siguiente. */
  pickEndTime(start: number, initial?: number): Promise<number | undefined> {
    return this.ui.dateTime({ title: '¿A qué hora terminaste?', mode: 'time', initial: initial ?? start + 3600_000, base: start });
  }

  async startFree(startedAt?: number): Promise<void> {
    const groups = await this.ui.pickGroups({ title: '¿Qué vas a entrenar?', groups: this.catalog.muscleGroups(), confirm: 'Empezar' });
    if (!groups) return;
    const id = this.workout.startSession({ groupIds: groups, exerciseIds: [], startedAt, retroactive: startedAt != null });
    void this.router.navigate(['/session', id]);
  }

  startPlan(plan: RoutineDayPlan, startedAt?: number): void {
    const id = this.workout.startSession({
      routineDayId: plan.day.id,
      groupIds: plan.groupIds,
      exerciseIds: plan.exercises.map((e) => e.id),
      supersetGroups: plan.supersetGroups,
      startedAt,
      retroactive: startedAt != null,
    });
    void this.router.navigate(['/session', id]);
  }

  /** Registrar una sesión que ya hiciste: fecha/hora + plantilla o sesión libre. */
  async startPast(): Promise<void> {
    const start = await this.pickPastDateTime();
    if (start == null) return;
    // El día de la semana de la fecha elegida va primero.
    const weekday = isoWeekday(start);
    const templates = this.routine
      .week()
      .filter((p) => !isPlanEmpty(p))
      .sort((a, b) => Number(b.day.weekday === weekday) - Number(a.day.weekday === weekday));
    const choice = await this.ui.choose<RoutineDayPlan | 'free'>('¿Qué entrenaste?', [
      { value: 'free', icon: 'flash_on', title: 'Sesión libre', subtitle: 'Eliges los grupos y agregas los ejercicios' },
      ...templates.map((t) => ({
        value: t,
        icon: 'calendar_month',
        title: planTitle(t),
        subtitle: t.exercises.map((e) => e.name).join(' · '),
      })),
    ]);
    if (choice === 'free') await this.startFree(start);
    else if (choice) this.startPlan(choice, start);
  }
}
