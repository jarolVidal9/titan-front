import { Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { EQUIPMENT_ICON, EQUIPMENT_LABEL } from '../../core/data/exercise.repo';
import type { ExerciseItem } from '../../core/data/models';
import { Card } from '../../shared/card';
import { ExercisePhoto } from '../../shared/exercise-photo';

@Component({
  selector: 'app-exercise-tile',
  imports: [Card, ExercisePhoto],
  template: `
    @let e = item().exercise;
    <app-card padding="10px" [accent]="selected() ? 'secondary' : null" [clickable]="clickable()">
      <div class="row">
        <app-exercise-photo [photo]="e.photo" [name]="e.name" />
        <div class="grow">
          <div class="title clamp-2">{{ e.name }}</div>
          <div class="row meta small muted">
            <span aria-hidden="true" class="icon sm">{{ icon() }}</span>
            <span class="ellipsis">{{ subtitle() }}</span>
          </div>
          @if (e.archived) {
            <div class="tiny danger-text">Archivado</div>
          }
        </div>
        <ng-content />
      </div>
    </app-card>
  `,
  styles: `
    .meta {
      gap: 4px;
      margin-top: 2px;
    }
  `,
})
export class ExerciseTile {
  private readonly catalog = inject(CatalogRepo);

  readonly item = input.required<ExerciseItem>();
  readonly selected = input(false, { transform: booleanAttribute });
  readonly clickable = input(true, { transform: booleanAttribute });

  protected readonly icon = computed(() => EQUIPMENT_ICON[this.item().exercise.equipmentType]);
  protected readonly subtitle = computed(() => {
    const names = this.catalog.groupNames();
    const groups = [...this.item().groupIds].map((id) => names.get(id)).filter(Boolean);
    return [EQUIPMENT_LABEL[this.item().exercise.equipmentType], ...groups].join(' · ');
  });
}
