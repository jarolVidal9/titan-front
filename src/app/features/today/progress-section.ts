import { Component, computed, inject, signal } from '@angular/core';
import { ProgressService } from '../../core/data/progress.service';
import type { WeekStat } from '../../core/data/weekly';
import { dayMonth, formatHours, shortDate } from '../../core/utils/format';
import { BarChart } from '../../shared/bar-chart';
import { Card } from '../../shared/card';
import { SectionTitle } from '../../shared/section-title';

type Metric = 'sets' | 'sessions' | 'time' | 'cardio';

const METRICS: { id: Metric; label: string; title: string }[] = [
  { id: 'sets', label: 'Series', title: 'Series por semana' },
  { id: 'sessions', label: 'Sesiones', title: 'Sesiones por semana' },
  { id: 'time', label: 'Tiempo', title: 'Tiempo entrenando por semana (min)' },
  { id: 'cardio', label: 'Cardio', title: 'Cardio por semana (min)' },
];

const valueOf = (m: Metric, w: WeekStat) =>
  m === 'sets' ? w.sets : m === 'sessions' ? w.sessions : m === 'time' ? w.trainingMinutes : w.cardioMinutes;

function formatValue(m: Metric, v: number): string {
  if (m === 'sets') return `${v} ${v === 1 ? 'serie' : 'series'}`;
  if (m === 'sessions') return `${v} ${v === 1 ? 'sesión' : 'sesiones'}`;
  if (m === 'time') return formatHours(v);
  return `${v} min`;
}

function delta(now: number, before: number, fmt: (n: number) => string = String): string {
  if (now === 0 && before === 0) return '—';
  const d = now - before;
  return d === 0 ? '= que la anterior' : `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))} vs anterior`;
}

/** "Tu avance": la semana vs la anterior + barras de las últimas 8 semanas. */
@Component({
  selector: 'app-progress-section',
  imports: [Card, SectionTitle, BarChart],
  template: `
    <app-section-title text="Tu avance" />
    @if (!hasData()) {
      <app-card><span class="muted">Cuando registres sesiones verás aquí tu avance semana a semana.</span></app-card>
    } @else {
      <div class="tiles">
        @for (t of tiles(); track t.label) {
          <app-card padding="12px">
            <div class="tiny muted">{{ t.label }}</div>
            <div class="num value">{{ t.value }}</div>
            <div class="tiny muted ellipsis">{{ t.delta }}</div>
          </app-card>
        }
      </div>
      <p class="tiny muted" style="margin: 6px 0 12px">Esta semana vs. la anterior</p>
      <app-card padding="14px 12px 8px">
        <div class="title">{{ current().title }}</div>
        <div class="chips mt-8">
          @for (m of metrics; track m.id) {
            <button type="button" class="chip" [class.selected]="metric() === m.id" (click)="metric.set(m.id)">{{ m.label }}</button>
          }
        </div>
        @if (bars().some(hasValue)) {
          <app-bar-chart class="mt-16" [data]="bars()" [ariaLabel]="current().title" />
        } @else {
          <p class="muted center" style="padding: 56px 0">Sin datos de {{ current().label.toLowerCase() }} en estas semanas</p>
        }
      </app-card>
    }
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .value {
      font-size: 22px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class ProgressSection {
  private readonly progress = inject(ProgressService);

  protected readonly metrics = METRICS;
  protected readonly metric = signal<Metric>('sets');
  protected readonly current = computed(() => METRICS.find((m) => m.id === this.metric())!);
  protected readonly hasValue = (b: { value: number }) => b.value > 0;

  private readonly weeks = this.progress.weekly;
  protected readonly hasData = computed(() => this.weeks().some((w) => w.sessions > 0 || w.sets > 0 || w.cardioMinutes > 0));

  protected readonly tiles = computed(() => {
    const weeks = this.weeks();
    const now = weeks.at(-1)!;
    const before = weeks.at(-2)!;
    return [
      { label: 'Sesiones', value: String(now.sessions), delta: delta(now.sessions, before.sessions) },
      { label: 'Series', value: String(now.sets), delta: delta(now.sets, before.sets) },
      { label: 'Tiempo', value: formatHours(now.trainingMinutes), delta: delta(now.trainingMinutes, before.trainingMinutes, formatHours) },
    ];
  });

  protected readonly bars = computed(() => {
    const m = this.metric();
    const weeks = this.weeks();
    return weeks.map((w, i) => ({
      label: i === weeks.length - 1 ? 'Esta' : dayMonth(w.start),
      value: valueOf(m, w),
      tooltip: `${formatValue(m, valueOf(m, w))}\nSemana del ${shortDate(w.start)}`,
    }));
  });
}
