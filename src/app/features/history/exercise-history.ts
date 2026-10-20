import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EQUIPMENT_LABEL, ExerciseRepo } from '../../core/data/exercise.repo';
import type { SetRecord } from '../../core/data/models';
import {
  METRIC_LABEL,
  type RecordValue,
  type StatMetric,
  computeExerciseStats,
  describeSet,
  metricUnit,
  pointValue,
} from '../../core/data/stats';
import { WorkoutRepo } from '../../core/data/workout.repo';
import { capitalize, dayMonth, formatDate, formatKg, shortDateYear } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { EmptyState } from '../../shared/empty-state';
import { ExercisePhoto } from '../../shared/exercise-photo';
import { LineChart } from '../../shared/line-chart';
import { PageHeader } from '../../shared/page-header';
import { SectionTitle } from '../../shared/section-title';

interface Tile {
  label: string;
  value: string;
  record: RecordValue;
}

/** Todo el historial de un ejercicio: récords, gráfica y sesiones. */
@Component({
  imports: [PageHeader, Card, EmptyState, ExercisePhoto, LineChart, SectionTitle, RouterLink],
  template: `
    <div class="page">
      <app-page-header [title]="item()?.exercise?.name ?? 'Historial'" back="/history?tab=exercises">
        @if (item()) {
          <a class="icon-btn" [routerLink]="['/library', id(), 'edit']" aria-label="Editar"><span aria-hidden="true" class="icon">edit</span></a>
        }
      </app-page-header>

      @if (item(); as it) {
        <div class="row">
          <app-exercise-photo [photo]="it.exercise.photo" [name]="it.exercise.name" [size]="64" />
          <div class="grow">
            <div class="muted">{{ equipment[it.exercise.equipmentType] }}</div>
            <div class="num gold">{{ stats().totalSets }} series · {{ stats().points.length }} sesiones</div>
          </div>
        </div>
      }

      @if (!stats().totalSets) {
        <app-empty-state icon="show_chart" title="Sin historial todavía" message="Registra series de este ejercicio en una sesión." />
      } @else {
        <app-section-title text="Récords personales" />
        <div class="grid">
          @for (t of tiles(); track t.label) {
            <app-card padding="12px" [accent]="'gold'">
              <div class="row tiny muted" style="gap: 4px"><span aria-hidden="true" class="icon sm gold filled">emoji_events</span> {{ t.label }}</div>
              <div class="num value">{{ t.value }}</div>
              <div class="tiny muted ellipsis">{{ recordDetail(t.record) }}</div>
            </app-card>
          }
        </div>

        <app-section-title [text]="isCardio() ? 'Duración por sesión (min)' : 'Progreso'" />
        @if (!isCardio()) {
          <div class="segmented" style="margin-bottom: 16px">
            @for (m of strengthMetrics; track m) {
              <button type="button" [class.selected]="metric() === m" (click)="metric.set(m)">{{ labels[m] }}</button>
            }
          </div>
        }
        @if (chart().length >= 2) {
          <app-line-chart [data]="chart()" [ariaLabel]="labels[activeMetric()]" [format]="formatAxis" />
        } @else {
          <p class="muted center" style="padding: 64px 0">
            {{ chart().length ? 'Registra otra sesión para ver la tendencia' : 'Aún no hay datos para esta métrica' }}
          </p>
        }

        <app-section-title text="Sesiones" />
        <div class="stack">
          @for (s of sessions(); track s.id) {
            <app-card padding="12px" clickable [routerLink]="['/session', s.id]">
              <div class="secondary title">{{ s.date }}</div>
              @for (r of s.sets; track r.set.id) {
                <div>{{ r.set.setNumber }}. {{ describe(r) }}</div>
              }
            </app-card>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
    .value {
      font-size: 22px;
      margin: 4px 0 2px;
    }
  `,
})
export default class ExerciseHistoryPage {
  private readonly exercises = inject(ExerciseRepo);
  private readonly workout = inject(WorkoutRepo);

  readonly id = input.required<string>();

  protected readonly equipment = EQUIPMENT_LABEL;
  protected readonly labels = METRIC_LABEL;
  protected readonly strengthMetrics: StatMetric[] = ['maxWeight', 'oneRm'];
  protected readonly describe = describeSet;
  protected readonly formatAxis = (v: number) => formatKg(Math.round(v));
  protected readonly metric = signal<StatMetric>('maxWeight');

  protected readonly item = computed(() => this.exercises.byId().get(this.id()) ?? null);
  private readonly records = computed(() => this.workout.exerciseRecords(this.id()));
  protected readonly stats = computed(() => computeExerciseStats(this.records()));
  protected readonly isCardio = computed(() => this.item()?.exercise.equipmentType === 'cardio');
  protected readonly activeMetric = computed<StatMetric>(() => (this.isCardio() ? 'duration' : this.metric()));

  protected readonly tiles = computed<Tile[]>(() => {
    const s = this.stats();
    const out: Tile[] = [];
    if (s.maxWeight) out.push({ label: 'Peso máx', value: `${formatKg(s.maxWeight.value)} kg`, record: s.maxWeight });
    if (s.bestOneRm) out.push({ label: '1RM estimado', value: `${formatKg(Math.round(s.bestOneRm.value))} kg`, record: s.bestOneRm });
    if (s.longestHold) out.push({ label: 'Mayor tiempo', value: `${s.longestHold.value} s`, record: s.longestHold });
    if (s.longestCardio) out.push({ label: 'Sesión más larga', value: `${Math.round(s.longestCardio.value)} min`, record: s.longestCardio });
    if (s.longestDistance) out.push({ label: 'Mayor distancia', value: `${formatKg(s.longestDistance.value)} km`, record: s.longestDistance });
    return out;
  });

  protected readonly chart = computed(() => {
    const m = this.activeMetric();
    return this.stats()
      .points.filter((p) => pointValue(p, m) > 0)
      .map((p) => ({
        label: dayMonth(p.date),
        value: pointValue(p, m),
        tooltip: `${formatKg(Math.round(pointValue(p, m) * 10) / 10)} ${metricUnit(m)}\n${shortDateYear(p.date)}`,
      }));
  });

  protected readonly sessions = computed(() => {
    const bySession = new Map<string, SetRecord[]>();
    for (const r of this.records()) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r]);
    return [...bySession.entries()]
      .map(([id, sets]) => ({
        id,
        start: sets[0].sessionStart,
        date: capitalize(formatDate(sets[0].sessionStart, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '')),
        sets: sets.sort((a, b) => a.set.setNumber - b.set.setNumber),
      }))
      .sort((a, b) => b.start - a.start);
  });

  protected recordDetail(r: RecordValue): string {
    return [shortDateYear(r.date), r.detail].filter(Boolean).join(' · ');
  }
}
