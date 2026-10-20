import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExerciseRepo } from '../../core/data/exercise.repo';
import { ProgressService } from '../../core/data/progress.service';
import { type PrKind, estimateOneRm } from '../../core/data/stats';
import { WorkoutRepo } from '../../core/data/workout.repo';
import { XP_PER_PR, type PrEvent } from '../../core/data/xp';
import { formatDate, formatKg, shortDateYear } from '../../core/utils/format';
import { normalizeName } from '../../core/utils/normalize';
import { Card } from '../../shared/card';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';
import { ProgressBar } from '../../shared/progress-bar';
import { SectionTitle } from '../../shared/section-title';
import { XpCard } from '../gamification/xp-card';
import { ExerciseTile } from '../library/exercise-tile';
import { SessionFlows } from '../session/session-flows';

type Tab = 'sessions' | 'exercises' | 'achievements';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sessions', label: 'Sesiones' },
  { id: 'exercises', label: 'Ejercicios' },
  { id: 'achievements', label: 'Logros' },
];

@Component({
  imports: [PageHeader, Card, EmptyState, ProgressBar, SectionTitle, XpCard, ExerciseTile, RouterLink],
  template: `
    <div class="page">
      <app-page-header title="Historial">
        <button type="button" class="icon-btn" aria-label="Registrar una sesión que ya hice" title="Registrar una sesión que ya hice" (click)="flows.startPast()">
          <span aria-hidden="true" class="icon">edit_calendar</span>
        </button>
      </app-page-header>

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" [class.active]="current() === t.id" [attr.aria-selected]="current() === t.id" (click)="select(t.id)">{{ t.label }}</button>
        }
      </div>

      @switch (current()) {
        @case ('sessions') {
          @if (!workout.summaries().length) {
            <app-empty-state icon="history" title="Aún no hay sesiones" message="Empieza una desde la pestaña Hoy." />
          }
          <div class="stack">
            @for (s of workout.summaries(); track s.session.id) {
              @let inProgress = s.session.finishedAt == null;
              <app-card [accent]="inProgress ? 'gold' : null" clickable [routerLink]="['/session', s.session.id]">
                <div class="row">
                  <div class="date">
                    <span class="num secondary">{{ day(s.session.startedAt) }}</span>
                    <span class="tiny">{{ month(s.session.startedAt) }}</span>
                  </div>
                  <div class="grow">
                    <div class="title">{{ inProgress ? 'En curso' : s.setCount + ' series · ' + s.minutes + ' min' }}</div>
                    <div class="small muted clamp-2">{{ s.exerciseNames.length ? s.exerciseNames.join(' · ') : 'Sin ejercicios' }}</div>
                  </div>
                  <span aria-hidden="true" class="icon">chevron_right</span>
                </div>
              </app-card>
            }
          </div>
        }
        @case ('exercises') {
          <div class="search">
            <span aria-hidden="true" class="icon">search</span>
            <input class="input" type="search" placeholder="Buscar" [value]="query()" (input)="query.set($any($event.target).value)" />
          </div>
          @if (!withHistory().length) {
            <app-empty-state icon="show_chart" title="Sin historial" message="Aquí aparecen los ejercicios con series registradas." />
          }
          <div class="stack lg mt-16">
            @for (e of withHistory(); track e.item.exercise.id) {
              <app-exercise-tile [item]="e.item" [routerLink]="['/exercise', e.item.exercise.id]">
                <span class="num" style="font-size: 18px; padding-right: 8px">{{ e.count }}</span>
              </app-exercise-tile>
            }
          </div>
        }
        @case ('achievements') {
          @let xp = progress.xp();
          <app-xp-card />
          <app-section-title text="Logros" />
          <div class="stack">
            @for (a of xp.achievements; track a.title) {
              <app-card [accent]="a.unlocked ? 'gold' : null" padding="12px">
                <div class="row">
                  <span aria-hidden="true" class="icon lg" [class.gold]="a.unlocked" [class.muted]="!a.unlocked" [class.filled]="a.unlocked" style="font-size: 32px">
                    {{ a.unlocked ? 'military_tech' : 'lock' }}
                  </span>
                  <div class="grow">
                    <div class="title">{{ a.title }}</div>
                    <div class="small muted">{{ a.description }}</div>
                    @if (!a.unlocked) {
                      <app-progress-bar class="mt-8" [value]="a.progress" [height]="6" [segments]="12" color="var(--cyan)" />
                    }
                  </div>
                </div>
              </app-card>
            }
          </div>
          <app-section-title [text]="'Récords personales (' + xp.prs.length + ')'" />
          @if (!xp.prs.length) {
            <p class="muted">Supera tu mejor marca en cualquier ejercicio para ganar +{{ xpPerPr }} XP.</p>
          }
          @for (p of xp.prs.slice(0, 50); track $index) {
            <a class="list-item" [routerLink]="['/exercise', p.record.set.exerciseId]" style="text-decoration: none">
              <span aria-hidden="true" class="icon gold filled">emoji_events</span>
              <span class="grow">
                <span class="title" style="display: block">{{ p.exerciseName }}</span>
                <span class="small muted">{{ prDetail(p) }}</span>
              </span>
            </a>
          }
        }
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      margin: 0 -16px 16px;
      border-bottom: 1px solid var(--outline);
      button {
        flex: 1;
        padding: 12px 8px;
        border: 0;
        border-bottom: 3px solid transparent;
        background: none;
        color: var(--muted);
        font-weight: 700;
        cursor: pointer;
        &.active {
          color: var(--primary);
          border-color: var(--primary);
        }
      }
    }
    :host-context([data-style='retro']) .tabs {
      border-bottom: 2px solid var(--plate);
      button.active {
        color: var(--cyan);
        border-color: var(--cyan);
      }
    }
    .date {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 40px;
      .num {
        font-size: 24px;
        line-height: 1.1;
      }
    }
  `,
})
export default class HistoryPage {
  protected readonly workout = inject(WorkoutRepo);
  protected readonly progress = inject(ProgressService);
  protected readonly flows = inject(SessionFlows);
  private readonly exercises = inject(ExerciseRepo);
  private readonly router = inject(Router);

  readonly tab = input<Tab>(); // query param, para volver a la misma pestaña

  protected readonly tabs = TABS;
  protected readonly xpPerPr = XP_PER_PR;
  private readonly picked = signal<Tab | null>(null);
  protected readonly current = computed(() => this.picked() ?? this.tab() ?? 'sessions');
  protected readonly query = signal('');

  /** Incluye archivados: su historial sigue disponible. Los más usados primero. */
  protected readonly withHistory = computed(() => {
    const norm = normalizeName(this.query());
    return this.exercises
      .allItems()
      .map((item) => ({ item, count: this.workout.setsByExercise().get(item.exercise.id)?.length ?? 0 }))
      .filter((e) => e.count > 0 && (!norm || e.item.exercise.nameNorm.includes(norm)))
      .sort((a, b) => b.count - a.count);
  });

  protected select(tab: Tab): void {
    this.picked.set(tab);
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  protected day(ms: number): string {
    return String(new Date(ms).getDate());
  }

  protected month(ms: number): string {
    return formatDate(ms, { month: 'short' }).replace('.', '').toUpperCase();
  }

  protected prDetail(p: PrEvent): string {
    const s = p.record.set;
    const has = (k: PrKind) => p.kinds.has(k);
    return [
      shortDateYear(p.record.sessionStart),
      has('weight') ? `Peso ${formatKg(s.weightKg)} kg` : null,
      has('oneRm') ? `1RM ${formatKg(Math.round(estimateOneRm(s.weightKg, s.reps ?? 0)))} kg` : null,
      has('hold') ? `${s.durationSec} s` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
