import { Component, inject } from '@angular/core';
import { CatalogRepo, DuplicateNameError } from '../../core/data/catalog.repo';
import type { Row } from '../../core/db/schema';
import { cleanDisplayName } from '../../core/utils/normalize';
import { PageHeader } from '../../shared/page-header';
import { UiService } from '../../shared/ui.service';

@Component({
  imports: [PageHeader],
  template: `
    <div class="page">
      <app-page-header title="Grupos musculares" back="/settings" />
      @for (g of catalog.allMuscleGroups(); track g.id) {
        <div class="list-item" style="cursor: default">
          <div class="grow">
            <div class="title" [style.text-decoration]="g.archived ? 'line-through' : null">{{ g.name }}</div>
            <div class="small muted">{{ tags(g) }}</div>
          </div>
          <button type="button" class="icon-btn" aria-label="Renombrar" (click)="rename(g)"><span aria-hidden="true" class="icon">edit</span></button>
          <button type="button" class="icon-btn" [attr.aria-label]="g.archived ? 'Restaurar' : 'Archivar'" (click)="catalog.setMuscleGroupArchived(g.id, !g.archived)">
            <span aria-hidden="true" class="icon">{{ g.archived ? 'unarchive' : 'archive' }}</span>
          </button>
        </div>
      }
    </div>
    <button type="button" class="fab" (click)="add()"><span aria-hidden="true" class="icon">add</span> Nuevo</button>
  `,
})
export default class MuscleGroupsPage {
  protected readonly catalog = inject(CatalogRepo);
  private readonly ui = inject(UiService);

  protected tags(g: Row<'muscle_groups'>): string {
    return [g.isDefault && 'Base', g.archived && 'Archivado'].filter(Boolean).join(' · ');
  }

  protected async add(): Promise<void> {
    const name = await this.ui.prompt({ title: 'Nuevo grupo muscular' });
    if (!name || !cleanDisplayName(name)) return;
    const g = this.catalog.findOrCreateMuscleGroup(name);
    if (g.name !== cleanDisplayName(name)) this.ui.toast(`Ya existía como "${g.name}"`);
  }

  protected async rename(g: Row<'muscle_groups'>): Promise<void> {
    const name = await this.ui.prompt({ title: 'Renombrar', initial: g.name });
    if (!name || !cleanDisplayName(name)) return;
    try {
      this.catalog.renameMuscleGroup(g.id, name);
    } catch (e) {
      if (e instanceof DuplicateNameError) this.ui.toast(e.message);
      else throw e;
    }
  }
}
