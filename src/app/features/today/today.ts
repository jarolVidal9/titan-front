import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { type RoutineDayPlan, isPlanEmpty } from '../../core/data/models';
import { ProgressService } from '../../core/data/progress.service';
import { RoutineRepo } from '../../core/data/routine.repo';
import { WorkoutRepo } from '../../core/data/workout.repo';
import { SettingsService } from '../../core/settings.service';
import { AuthService } from '../../core/sync/auth.service';
import { SyncService } from '../../core/sync/sync.service';
import { capitalize, formatDate, formatTime, isoWeekday } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { SectionTitle } from '../../shared/section-title';
import { XpCard } from '../gamification/xp-card';
import { SessionFlows, planTitle } from '../session/session-flows';
import { ProgressSection } from './progress-section';

@Component({
  imports: [Card, SectionTitle, XpCard, ProgressSection, RouterLink, NgTemplateOutlet],
  template: `
    <div class="page">
      <header class="brand">
        <img src="branding/emblem-192.png" alt="" />
        <div class="grow">
          <div class="name">TITAN</div>
          <div class="muted small">Diario de entrenamiento</div>
        </div>
        @if (auth.token()) {
          <a class="icon-btn" routerLink="/settings" [attr.aria-label]="syncLabel()" [title]="syncLabel()">
            <span aria-hidden="true" class="icon" [class.spin]="sync.status() === 'syncing'">{{ syncIcon() }}</span>
          </a>
        }
      </header>

      <app-xp-card class="mt-16" />

      @if (workout.activeSession(); as session) {
        <app-section-title [text]="settings.shout('Partida en curso', 'Sesión en curso')" />
        <app-card accent="gold" clickable [routerLink]="['/session', session.id]">
          <div class="row">
            <span aria-hidden="true" class="icon lg filled gold">play_circle</span>
            <div class="grow">
              <div class="title">Continuar sesión</div>
              <div class="muted">Iniciada {{ time(session.startedAt) }}</div>
            </div>
            <span aria-hidden="true" class="icon">chevron_right</span>
          </div>
        </app-card>
      } @else if (progress.todayDone().length && !showStart()) {
        <app-section-title [text]="todayTitle" />
        <div class="stack">
          @for (s of progress.todayDone(); track s.session.id) {
            <app-card accent="gold" clickable [routerLink]="['/session', s.session.id]">
              <div class="row">
                <span aria-hidden="true" class="icon lg filled gold">check_circle</span>
                <div class="grow">
                  <div class="title">{{ settings.shout('¡Stage clear!', 'Entrenamiento de hoy completado') }}</div>
                  <div class="small muted">
                    {{ time(s.session.startedAt) }} – {{ time(s.session.finishedAt!) }} · {{ s.setCount }} series · {{ s.minutes }} min
                  </div>
                  @if (s.exerciseNames.length) {
                    <div class="small muted clamp-2">{{ s.exerciseNames.join(' · ') }}</div>
                  }
                </div>
                <span aria-hidden="true" class="icon">chevron_right</span>
              </div>
            </app-card>
          }
        </div>
        <button type="button" class="btn btn-text mt-8" (click)="showStart.set(true)"><span aria-hidden="true" class="icon">add</span> Hacer otra sesión hoy</button>
      } @else {
        <app-section-title [text]="todayTitle" />
        @if (todayPlan(); as plan) {
          <ng-container [ngTemplateOutlet]="planCard" [ngTemplateOutletContext]="{ $implicit: plan, highlight: true }" />
        } @else {
          <app-card>
            <span class="muted">No hay rutina para hoy. Puedes hacer una sesión libre o usar la plantilla de otro día.</span>
          </app-card>
        }
        <button type="button" class="btn btn-outline block mt-16" (click)="flows.startFree()"><span aria-hidden="true" class="icon">flash_on</span> Sesión libre</button>
        <button type="button" class="btn btn-text block mt-8" (click)="flows.startPast()"><span aria-hidden="true" class="icon">edit_calendar</span> Registrar una sesión que ya hice</button>

        @if (otherPlans().length) {
          <app-section-title text="Otras plantillas" />
          <div class="stack">
            @for (p of otherPlans(); track p.day.id) {
              <ng-container [ngTemplateOutlet]="planCard" [ngTemplateOutletContext]="{ $implicit: p, highlight: false }" />
            }
          </div>
        }
      }

      <app-progress-section />
    </div>

    <ng-template #planCard let-plan let-highlight="highlight">
      <app-card [accent]="highlight ? 'gold' : null">
        <div class="title">{{ planTitle(plan) }}</div>
        @if (groupsOf(plan); as groups) {
          <div class="secondary">{{ groups }}</div>
        }
        <p class="small muted clamp-2" style="margin: 8px 0 14px">
          {{ plan.exercises.length ? names(plan) : 'Sin ejercicios: los agregas durante la sesión.' }}
        </p>
        <button type="button" class="btn btn-primary block" (click)="flows.startPlan(plan)">
          <span aria-hidden="true" class="icon">play_arrow</span> {{ highlight ? settings.shout('Start!', 'Empezar rutina') : 'Usar esta plantilla' }}
        </button>
      </app-card>
    </ng-template>
  `,
  styles: `
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 12px;
      img {
        width: 44px;
        height: 44px;
        border-radius: 12px;
      }
      .name {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 2px;
        line-height: 1.2;
      }
    }
    :host-context([data-style='retro']) .brand {
      img {
        width: 56px;
        height: 56px;
        border-radius: 0;
        image-rendering: pixelated;
      }
      .name {
        font-family: 'Press Start 2P', monospace;
        font-size: 20px;
        color: var(--gold);
        letter-spacing: 0;
        line-height: 1.6;
      }
    }
    .spin {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export default class TodayPage {
  protected readonly workout = inject(WorkoutRepo);
  protected readonly progress = inject(ProgressService);
  protected readonly settings = inject(SettingsService);
  protected readonly flows = inject(SessionFlows);
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  private readonly routine = inject(RoutineRepo);
  private readonly catalog = inject(CatalogRepo);

  /** Si ya entrenaste hoy, las opciones para empezar otra sesión quedan ocultas hasta pedirlas. */
  protected readonly showStart = signal(false);
  protected readonly todayTitle = `Hoy · ${capitalize(formatDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'short' }).replace(',', '').replace('.', ''))}`;
  protected readonly time = formatTime;
  protected readonly planTitle = planTitle;

  private readonly weekday = isoWeekday(Date.now());
  protected readonly todayPlan = computed(() => {
    const plan = this.routine.week().find((p) => p.day.weekday === this.weekday);
    return plan && !isPlanEmpty(plan) ? plan : null;
  });
  protected readonly otherPlans = computed(() => this.routine.week().filter((p) => !isPlanEmpty(p) && p.day.weekday !== this.weekday));

  protected readonly syncIcon = computed(() => {
    if (this.auth.expired()) return 'error';
    return { idle: 'cloud_done', syncing: 'sync', offline: 'cloud_off', error: 'error' }[this.sync.status()];
  });
  protected readonly syncLabel = computed(() => {
    if (this.auth.expired()) return 'Sesión vencida: vuelve a entrar';
    return { idle: 'Sincronizado', syncing: 'Sincronizando…', offline: 'Sin conexión: se sincroniza al volver', error: 'Error al sincronizar' }[
      this.sync.status()
    ];
  });

  protected groupsOf(plan: RoutineDayPlan): string {
    const names = this.catalog.groupNames();
    return [...plan.groupIds].map((g) => names.get(g)).filter(Boolean).join(' + ');
  }

  protected names(plan: RoutineDayPlan): string {
    return plan.exercises.map((e) => e.name).join(' · ');
  }
}
