import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { type SessionExerciseView, supersetMembers } from '../../core/data/models';
import { describeSet } from '../../core/data/stats';
import { WorkoutRepo, isBackdated } from '../../core/data/workout.repo';
import { RestTimerService } from '../../core/rest-timer.service';
import { SettingsService } from '../../core/settings.service';
import { SoundService } from '../../core/sound.service';
import { formatKg, letter, supersetLabel } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { EmptyState } from '../../shared/empty-state';
import { ExercisePhoto } from '../../shared/exercise-photo';
import { PageHeader } from '../../shared/page-header';
import { SectionTitle } from '../../shared/section-title';
import { SetStepper } from '../../shared/set-stepper';
import { UiService } from '../../shared/ui.service';
import { SetActions } from './set-actions';

interface Entry {
  repTypeId: string | null;
  weight: number;
  reps: number;
  seconds: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Registro por rondas de una biserie/triserie/circuito: una serie de cada ejercicio
 * y el descanso al final de la ronda.
 */
@Component({
  imports: [PageHeader, Card, EmptyState, ExercisePhoto, SectionTitle, SetStepper, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  template: `
    <div class="page">
      @if (members().length >= 2) {
        <app-page-header [title]="label(members().length)" [back]="'/session/' + id()" />
        <p class="small muted" style="margin: 0">
          Haz una serie de cada ejercicio seguidas y guarda la ronda. El descanso empieza al final.
        </p>
        <app-section-title [text]="'Ronda ' + round()" />

        <div class="stack lg">
          @for (m of members(); track m.sessionExercise.id; let i = $index) {
            @let entry = entries()[m.sessionExercise.id];
            @let type = typeOf(entry);
            <app-card [accent]="settings.isRetro() ? 'cyan' : null" padding="12px">
              <div class="row">
                <span class="badge">{{ letter(i) }}</span>
                <app-exercise-photo [photo]="m.exercise.photo" [name]="m.exercise.name" [size]="36" />
                <span class="title grow">{{ m.exercise.name }}</span>
                <button type="button" class="chip" [cdkMenuTriggerFor]="types" (contextmenu)="$event.preventDefault(); actions.showRepTypes([type])">
                  {{ type.name }} ▾
                </button>
                <ng-template #types>
                  <div class="menu" cdkMenu>
                    @for (t of catalog.repTypes(); track t.id) {
                      <button cdkMenuItem (cdkMenuItemTriggered)="patch(m, { repTypeId: t.id })">{{ t.name }}{{ t.measure === 'seconds' ? ' ⏱' : '' }}</button>
                    }
                  </div>
                </ng-template>
              </div>
              @if (lastTime(m); as last) {
                <p class="tiny muted" style="margin: 6px 0 0">Última vez: {{ describe(last) }}</p>
              }
              <div class="stack mt-8">
                <app-set-stepper label="Peso (kg)" [value]="kg(entry?.weight ?? 0)" (minus)="patch(m, { weight: clamp((entry?.weight ?? 0) - 2.5, 0, 999) })" (plus)="patch(m, { weight: clamp((entry?.weight ?? 0) + 2.5, 0, 999) })" (edit)="ask(m, 'weight', 'Peso (kg)', 0, 999, true)" />
                @if (type.measure === 'seconds') {
                  <app-set-stepper label="Segundos" [value]="'' + (entry?.seconds ?? 30)" (minus)="patch(m, { seconds: clamp((entry?.seconds ?? 30) - 5, 1, 3600) })" (plus)="patch(m, { seconds: clamp((entry?.seconds ?? 30) + 5, 1, 3600) })" (edit)="ask(m, 'seconds', 'Segundos', 1, 3600, false)" />
                } @else {
                  <app-set-stepper label="Repeticiones" [value]="'' + (entry?.reps ?? 10)" (minus)="patch(m, { reps: clamp((entry?.reps ?? 10) - 1, 1, 999) })" (plus)="patch(m, { reps: clamp((entry?.reps ?? 10) + 1, 1, 999) })" (edit)="ask(m, 'reps', 'Repeticiones', 1, 999, false)" />
                }
              </div>
            </app-card>
          }
        </div>

        <button type="button" class="btn btn-primary block mt-24" (click)="saveRound()">
          <span aria-hidden="true" class="icon">check</span> Guardar ronda {{ round() }}
        </button>

        @if (roundsDone().length) {
          <app-section-title text="Rondas de hoy" />
          <div class="stack">
            @for (r of roundsDone(); track r) {
              <app-card padding="12px">
                <div class="num gold">Ronda {{ r }}</div>
                @for (m of members(); track m.sessionExercise.id; let i = $index) {
                  @if (setOf(m, r); as rec) {
                    <button type="button" class="list-item" style="min-height: 36px; padding: 4px 0" (click)="actions.edit(rec, catalog.repTypes())">
                      <span class="secondary" style="font-weight: 800">{{ letter(i) }}</span>
                      <span class="grow">{{ m.exercise.name }}: {{ describe(rec) }}</span>
                      <span aria-hidden="true" class="icon sm muted">edit</span>
                    </button>
                  }
                }
              </app-card>
            }
          </div>
        }
      } @else {
        <app-page-header title="Biserie" [back]="'/session/' + id()" />
        <app-empty-state icon="link_off" title="Esta biserie ya no existe" />
      }
    </div>
  `,
})
export default class SupersetLogPage {
  protected readonly catalog = inject(CatalogRepo);
  protected readonly actions = inject(SetActions);
  protected readonly settings = inject(SettingsService);
  private readonly workout = inject(WorkoutRepo);
  private readonly timer = inject(RestTimerService);
  private readonly sound = inject(SoundService);
  private readonly ui = inject(UiService);

  readonly id = input.required<string>();
  readonly group = input.required<string>();

  protected readonly describe = describeSet;
  protected readonly kg = formatKg;
  protected readonly label = supersetLabel;
  protected readonly letter = letter;
  protected readonly clamp = clamp;

  protected readonly entries = signal<Record<string, Entry>>({});

  private readonly view = computed(() => this.workout.session(this.id()));
  protected readonly members = computed(() => {
    const v = this.view();
    return v ? supersetMembers(v, this.group()) : [];
  });
  private readonly previous = computed(
    () => new Map(this.members().map((m) => [m.sessionExercise.id, this.workout.previousSessionSets(m.exercise.id, this.id())])),
  );
  protected readonly round = computed(() => Math.min(...this.members().map((m) => m.sets.length)) + 1);
  protected readonly roundsDone = computed(() => {
    const max = Math.max(0, ...this.members().map((m) => m.sets.length));
    return Array.from({ length: max }, (_, i) => max - i);
  });

  constructor() {
    // Prellena la serie N de cada ejercicio con su serie N de la sesión anterior (o la última de hoy).
    const prefilledFor = new Map<string, number>();
    effect(() => {
      const members = this.members();
      const previous = this.previous();
      const types = this.catalog.repTypes();
      if (!types.length) return;
      untracked(() => {
        const next = { ...this.entries() };
        for (const m of members) {
          const id = m.sessionExercise.id;
          const count = m.sets.length;
          if (prefilledFor.get(id) === count) continue;
          prefilledFor.set(id, count);
          const prev = previous.get(id) ?? [];
          const s = (count < prev.length ? prev[count] : (m.sets.at(-1) ?? prev.at(-1)))?.set;
          const e: Entry = next[id] ?? { repTypeId: null, weight: 0, reps: 10, seconds: 30 };
          next[id] = s
            ? {
                repTypeId: types.some((t) => t.id === s.repTypeId) ? s.repTypeId : types[0].id,
                weight: s.weightKg,
                reps: s.reps ?? e.reps,
                seconds: s.durationSec ?? e.seconds,
              }
            : { ...e, repTypeId: e.repTypeId ?? types[0].id };
        }
        this.entries.set(next);
      });
    });
  }

  protected typeOf(entry: Entry | undefined) {
    const types = this.catalog.repTypes();
    return types.find((t) => t.id === entry?.repTypeId) ?? types[0];
  }

  protected lastTime(m: SessionExerciseView) {
    const prev = this.previous().get(m.sessionExercise.id) ?? [];
    return prev.length ? prev[Math.min(m.sets.length, prev.length - 1)] : null;
  }

  protected setOf(m: SessionExerciseView, round: number) {
    return m.sets.find((s) => s.set.setNumber === round) ?? null;
  }

  protected patch(m: SessionExerciseView, changes: Partial<Entry>): void {
    const id = m.sessionExercise.id;
    this.entries.update((all) => ({ ...all, [id]: { ...all[id], ...changes } }));
  }

  protected async ask(m: SessionExerciseView, field: 'weight' | 'reps' | 'seconds', title: string, min: number, max: number, decimal: boolean): Promise<void> {
    const current = this.entries()[m.sessionExercise.id]?.[field] ?? 0;
    const v = await this.ui.number(title, formatKg(current), decimal);
    if (v != null) this.patch(m, { [field]: clamp(decimal ? v : Math.round(v), min, max) });
  }

  protected saveRound(): void {
    const session = this.view()!.session;
    let anyPr = false;
    for (const m of this.members()) {
      const e = this.entries()[m.sessionExercise.id];
      const type = this.typeOf(e);
      const timed = type.measure === 'seconds';
      const id = this.workout.addSet(m.sessionExercise.id, m.exercise.id, {
        repTypeId: type.id,
        reps: timed ? null : (e?.reps ?? 10),
        durationSec: timed ? (e?.seconds ?? 30) : null,
        weightKg: e?.weight ?? 0,
        distanceKm: null,
        intensity: null,
        note: null,
      });
      if (this.actions.prsFor(id, m.exercise.id, session).size) anyPr = true;
    }
    this.sound.vibrate([40]);
    if (anyPr) {
      this.sound.play('pr');
      this.ui.toast(this.settings.shout('NEW RECORD! en la ronda', '¡Nuevo récord en esta ronda!'), { icon: 'emoji_events', kind: 'record' });
    }
    // El descanso va después de la ronda completa (no entre ejercicios).
    if (!isBackdated(session)) {
      const rests = this.members()
        .map((m) => m.exercise.defaultRestSec)
        .filter((r): r is number => r != null);
      const rest = rests.length ? Math.max(...rests) : this.settings.defaultRestSec();
      this.timer.start(rest, this.members().map((m) => m.exercise.name).join(' + '));
    }
  }
}
