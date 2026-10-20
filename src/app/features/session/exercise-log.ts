import { Component, type WritableSignal, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import type { SetRecord } from '../../core/data/models';
import { describeSet } from '../../core/data/stats';
import { WorkoutRepo, isBackdated } from '../../core/data/workout.repo';
import type { Row } from '../../core/db/schema';
import { RestTimerService } from '../../core/rest-timer.service';
import { SettingsService } from '../../core/settings.service';
import { SoundService } from '../../core/sound.service';
import { formatKg, shortDate } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { EmptyState } from '../../shared/empty-state';
import { ExercisePhoto } from '../../shared/exercise-photo';
import { PageHeader } from '../../shared/page-header';
import { SectionTitle } from '../../shared/section-title';
import { SetStepper } from '../../shared/set-stepper';
import { UiService } from '../../shared/ui.service';
import { SetActions, describePrs } from './set-actions';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Registro de series de un ejercicio dentro de la sesión (fuerza o cardio). */
@Component({
  imports: [PageHeader, Card, EmptyState, ExercisePhoto, SectionTitle, SetStepper, RouterLink],
  template: `
    <div class="page">
      @if (entry(); as e) {
        <app-page-header [title]="e.exercise.name" [back]="'/session/' + id()">
          <a class="icon-btn" [routerLink]="['/exercise', e.exercise.id]" aria-label="Historial"><span aria-hidden="true" class="icon">show_chart</span></a>
        </app-page-header>

        <div class="row top">
          <app-exercise-photo [photo]="e.exercise.photo" [name]="e.exercise.name" [size]="72" />
          <div class="grow">
            @if (!previous().length) {
              <span class="muted">Primera vez con este ejercicio. ¡A marcar la base!</span>
            } @else {
              <div class="secondary title">Última vez · {{ date(previous()[0].sessionStart) }}</div>
              @for (r of previous().slice(0, 6); track r.set.id) {
                <div class="small muted">{{ r.set.setNumber }}. {{ describe(r) }}</div>
              }
              @if (previous().length > 6) {
                <div class="muted">…</div>
              }
            }
          </div>
        </div>

        @if (isCardio()) {
          <app-section-title [text]="e.sets.length ? 'Otro bloque de cardio' : 'Cardio'" />
          <div class="stack lg">
            <app-set-stepper label="Duración (min)" [value]="'' + minutes()" (minus)="minutes.set(clamp(minutes() - 1, 1, 600))" (plus)="minutes.set(clamp(minutes() + 1, 1, 600))" (edit)="ask(minutes, 'Duración (min)', 1, 600, false)" />
            <app-set-stepper label="Distancia (km) · opcional" [value]="km() > 0 ? kg(km()) : '—'" (minus)="km.set(round1(clamp(km() - 0.1, 0, 999)))" (plus)="km.set(round1(clamp(km() + 0.1, 0, 999)))" (edit)="ask(km, 'Distancia (km)', 0, 999, true)" />
            <app-set-stepper label="Velocidad (km/h) o nivel · opcional" [value]="intensity() > 0 ? kg(intensity()) : '—'" (minus)="intensity.set(clamp(intensity() - 0.5, 0, 99))" (plus)="intensity.set(clamp(intensity() + 0.5, 0, 99))" (edit)="ask(intensity, 'Velocidad o nivel', 0, 99, true)" />
            <label class="field">
              <span>Nota / intervalos (opcional)</span>
              <textarea class="input" rows="2" placeholder="Ej. 2 min caminando / 2 min corriendo × 8" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
            </label>
            <button type="button" class="btn btn-primary block" (click)="saveCardio()"><span aria-hidden="true" class="icon">check</span> Guardar cardio</button>
          </div>
        } @else {
          <app-section-title [text]="'Serie ' + (e.sets.length + 1)">
            <button type="button" class="icon-btn" aria-label="¿Qué es cada tipo?" (click)="actions.showRepTypes(catalog.repTypes())"><span aria-hidden="true" class="icon">help</span></button>
          </app-section-title>
          <div class="chip-row">
            @for (t of catalog.repTypes(); track t.id) {
              <button type="button" class="chip" [class.selected]="t.id === repType()?.id" (click)="repTypeId.set(t.id)" (contextmenu)="$event.preventDefault(); actions.showRepTypes([t])">
                {{ t.name }}{{ t.measure === 'seconds' ? ' ⏱' : '' }}
              </button>
            }
          </div>
          <p class="tiny muted" style="margin: 2px 0 16px">Mantén presionado un tipo para ver qué es · ⏱ = se mide en segundos</p>
          <div class="stack lg">
            <app-set-stepper label="Peso (kg)" [value]="kg(weight())" (minus)="weight.set(clamp(weight() - 2.5, 0, 999))" (plus)="weight.set(clamp(weight() + 2.5, 0, 999))" (edit)="ask(weight, 'Peso (kg)', 0, 999, true)" />
            @if (timed()) {
              <app-set-stepper label="Segundos" [value]="'' + seconds()" (minus)="seconds.set(clamp(seconds() - 5, 1, 3600))" (plus)="seconds.set(clamp(seconds() + 5, 1, 3600))" (edit)="ask(seconds, 'Segundos', 1, 3600, false)" />
            } @else {
              <app-set-stepper label="Repeticiones" [value]="'' + reps()" (minus)="reps.set(clamp(reps() - 1, 1, 999))" (plus)="reps.set(clamp(reps() + 1, 1, 999))" (edit)="ask(reps, 'Repeticiones', 1, 999, false)" />
            }
            <button type="button" class="btn btn-primary block" (click)="saveStrength()">
              <span aria-hidden="true" class="icon">check</span> Guardar serie {{ e.sets.length + 1 }}
            </button>
          </div>
        }

        @if (e.sets.length) {
          <app-section-title [text]="isCardio() ? 'Hoy · ' + cardioMinutes() + ' min' : 'Hoy (' + e.sets.length + ')'" />
          <div class="stack">
            @for (r of reversedSets(); track r.set.id) {
              <app-card padding="10px 14px" clickable (click)="actions.edit(r, catalog.repTypes())">
                <div class="row">
                  @if (isCardio()) {
                    <span aria-hidden="true" class="icon gold">directions_run</span>
                  } @else {
                    <span class="num gold" style="font-size: 20px; min-width: 22px">{{ r.set.setNumber }}</span>
                  }
                  <span class="grow">{{ describe(r) }}</span>
                  <span aria-hidden="true" class="icon sm muted">edit</span>
                </div>
              </app-card>
            }
          </div>
        }

        @if (next(); as n) {
          <a class="btn btn-outline block mt-24" [routerLink]="['/session', id(), 'exercise', n.sessionExercise.id]" [replaceUrl]="true">
            <span aria-hidden="true" class="icon">arrow_forward</span> <span class="ellipsis">Siguiente: {{ n.exercise.name }}</span>
          </a>
        }
      } @else {
        <app-page-header title="Ejercicio" [back]="'/session/' + id()" />
        <app-empty-state icon="help" title="Ejercicio no encontrado" />
      }
    </div>
  `,
})
export default class ExerciseLogPage {
  protected readonly catalog = inject(CatalogRepo);
  protected readonly actions = inject(SetActions);
  private readonly workout = inject(WorkoutRepo);
  private readonly settings = inject(SettingsService);
  private readonly timer = inject(RestTimerService);
  private readonly sound = inject(SoundService);
  private readonly ui = inject(UiService);

  readonly id = input.required<string>();
  readonly seId = input.required<string>();

  protected readonly describe = describeSet;
  protected readonly date = shortDate;
  protected readonly kg = formatKg;
  protected readonly clamp = clamp;
  protected readonly round1 = (v: number) => Math.round(v * 10) / 10;

  // Fuerza
  protected readonly repTypeId = signal<string | null>(null);
  protected readonly weight = signal(0);
  protected readonly reps = signal(10);
  protected readonly seconds = signal(30);
  // Cardio
  protected readonly minutes = signal(20);
  protected readonly km = signal(0); // 0 = sin registrar
  protected readonly intensity = signal(0); // 0 = sin registrar
  protected readonly note = signal('');

  private readonly view = computed(() => this.workout.session(this.id()));
  private readonly index = computed(() => this.view()?.exercises.findIndex((e) => e.sessionExercise.id === this.seId()) ?? -1);
  protected readonly entry = computed(() => (this.index() >= 0 ? this.view()!.exercises[this.index()] : null));
  protected readonly next = computed(() => this.view()?.exercises[this.index() + 1] ?? null);
  protected readonly previous = computed(() => {
    const e = this.entry();
    return e ? this.workout.previousSessionSets(e.exercise.id, this.id()) : [];
  });
  protected readonly isCardio = computed(() => this.entry()?.exercise.equipmentType === 'cardio');
  protected readonly repType = computed(() => {
    const types = this.catalog.repTypes();
    return types.find((t) => t.id === this.repTypeId()) ?? types[0];
  });
  protected readonly timed = computed(() => this.repType()?.measure === 'seconds');
  protected readonly reversedSets = computed(() => [...(this.entry()?.sets ?? [])].reverse());
  protected readonly cardioMinutes = computed(() => Math.floor((this.entry()?.sets ?? []).reduce((a, r) => a + (r.set.durationSec ?? 0), 0) / 60));

  constructor() {
    // Prellena la serie N con la serie N de la última sesión; si no hay, repite la última de hoy.
    let prefilledFor = '';
    effect(() => {
      const e = this.entry();
      const prev = this.previous();
      const types = this.catalog.repTypes();
      if (!e || !types.length) return;
      const key = this.isCardio() ? e.sessionExercise.id : `${e.sessionExercise.id}:${e.sets.length}`;
      if (key === prefilledFor) return;
      prefilledFor = key;
      untracked(() => (this.isCardio() ? this.prefillCardio(e.sets, prev) : this.prefillStrength(e.sets, prev, types)));
    });
  }

  private prefillStrength(sets: SetRecord[], prev: SetRecord[], types: Row<'rep_types'>[]): void {
    const count = sets.length;
    const source = count < prev.length ? prev[count] : (sets.at(-1) ?? prev.at(-1));
    if (!source) {
      if (!this.repTypeId()) this.repTypeId.set(types[0].id);
      return;
    }
    const s = source.set;
    this.repTypeId.set(types.some((t) => t.id === s.repTypeId) ? s.repTypeId : types[0].id);
    this.weight.set(s.weightKg);
    if (s.reps != null) this.reps.set(s.reps);
    if (s.durationSec != null) this.seconds.set(s.durationSec);
  }

  private prefillCardio(sets: SetRecord[], prev: SetRecord[]): void {
    const s = (sets.at(-1) ?? prev.at(-1))?.set;
    if (!s) return;
    this.minutes.set(clamp(Math.round((s.durationSec ?? 1200) / 60), 1, 600));
    this.km.set(s.distanceKm ?? 0);
    this.intensity.set(s.intensity ?? 0);
    this.note.set(s.note ?? '');
  }

  protected async ask(target: WritableSignal<number>, title: string, min: number, max: number, decimal: boolean): Promise<void> {
    const current = target();
    const v = await this.ui.number(title, current > 0 ? formatKg(current) : '', decimal);
    if (v != null) target.set(clamp(decimal ? v : Math.round(v), min, max));
  }

  protected saveStrength(): void {
    const e = this.entry()!;
    const type = this.repType();
    const session = this.view()!.session;
    const id = this.workout.addSet(e.sessionExercise.id, e.exercise.id, {
      repTypeId: type.id,
      reps: this.timed() ? null : this.reps(),
      durationSec: this.timed() ? this.seconds() : null,
      weightKg: this.weight(),
      distanceKm: null,
      intensity: null,
      note: null,
    });
    this.sound.vibrate([40]);
    const prs = this.actions.prsFor(id, e.exercise.id, session);
    if (prs.size) {
      this.sound.play('pr');
      this.ui.toast(`${this.settings.shout('NEW RECORD!', '¡Nuevo récord!')} · ${describePrs(prs)}`, { icon: 'emoji_events', kind: 'record', ms: 4500 });
    }
    // Al registrar una sesión pasada no tiene sentido el descanso.
    if (!isBackdated(session)) this.timer.start(e.exercise.defaultRestSec ?? this.settings.defaultRestSec(), e.exercise.name);
  }

  protected saveCardio(): void {
    const e = this.entry()!;
    this.workout.addSet(e.sessionExercise.id, e.exercise.id, {
      repTypeId: this.catalog.cardioRepType().id,
      reps: null,
      durationSec: this.minutes() * 60,
      weightKg: 0,
      distanceKm: this.km() > 0 ? this.km() : null,
      intensity: this.intensity() > 0 ? this.intensity() : null,
      note: this.note().trim() || null,
    });
    this.sound.vibrate([40]);
    this.ui.toast('Cardio guardado');
  }
}
