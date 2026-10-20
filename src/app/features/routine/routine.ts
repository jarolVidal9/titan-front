import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { type RoutineDayPlan, isPlanEmpty } from '../../core/data/models';
import { RoutineRepo } from '../../core/data/routine.repo';
import { WEEKDAY_NAMES, isoWeekday } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { PageHeader } from '../../shared/page-header';

@Component({
  imports: [PageHeader, Card, RouterLink],
  template: `
    <div class="page">
      <app-page-header title="Rutina semanal" />
      <div class="stack lg">
        @for (d of routine.week(); track d.day.id) {
          @let isToday = d.day.weekday === today;
          <app-card [accent]="isToday ? 'gold' : null" clickable [routerLink]="['/routine', d.day.weekday]">
            <div class="row">
              <span class="day" [class.today]="isToday">{{ short(d) }}</span>
              <div class="grow">
                <div class="title">{{ heading(d) }}</div>
                @if (!empty(d)) {
                  <div class="small muted">{{ detail(d) }}</div>
                }
              </div>
              @if (isToday) {
                <span class="gold" style="font-weight: 700">HOY</span>
              }
              <span aria-hidden="true" class="icon">chevron_right</span>
            </div>
          </app-card>
        }
      </div>
    </div>
  `,
  styles: `
    .day {
      width: 52px;
      flex: none;
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 800;
      color: var(--secondary);
      &.today {
        color: var(--gold);
      }
    }
    :host-context([data-style='retro']) .day {
      font-size: 12px;
    }
  `,
})
export default class RoutinePage {
  protected readonly routine = inject(RoutineRepo);
  private readonly catalog = inject(CatalogRepo);
  protected readonly today = isoWeekday(Date.now());
  protected readonly empty = isPlanEmpty;

  protected short(d: RoutineDayPlan): string {
    return WEEKDAY_NAMES[d.day.weekday - 1].slice(0, 3).toUpperCase();
  }

  private groups(d: RoutineDayPlan): string {
    const names = this.catalog.groupNames();
    return [...d.groupIds].map((g) => names.get(g)).filter(Boolean).join(' + ');
  }

  protected heading(d: RoutineDayPlan): string {
    if (isPlanEmpty(d)) return 'Descanso / sin plan';
    return d.day.name ?? (this.groups(d) || 'Rutina');
  }

  protected detail(d: RoutineDayPlan): string {
    const groups = this.groups(d);
    return [d.day.name && groups ? groups : null, `${d.exercises.length} ejercicios`].filter(Boolean).join(' · ');
  }
}
