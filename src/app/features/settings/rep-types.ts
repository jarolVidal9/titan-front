import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { CatalogRepo, DuplicateNameError } from '../../core/data/catalog.repo';
import type { RepMeasure, Row } from '../../core/db/schema';
import { cleanDisplayName } from '../../core/utils/normalize';
import { PageHeader } from '../../shared/page-header';
import { UiService } from '../../shared/ui.service';
import { SetActions } from '../session/set-actions';

interface RepTypeResult {
  name: string;
  measure: RepMeasure;
  counts: boolean;
}

@Component({
  template: `
    <form (submit)="$event.preventDefault(); save()">
      <h2 class="dialog-title">{{ initial ? 'Editar tipo' : 'Nuevo tipo de repetición' }}</h2>
      <input class="input" placeholder="Nombre" [value]="name()" (input)="name.set($any($event.target).value)" />
      <!-- La medida no se cambia al editar: las series ya guardadas dependen de ella. -->
      <div class="segmented mt-16">
        <button type="button" [class.selected]="measure() === 'reps'" [disabled]="!!initial" (click)="measure.set('reps')">Reps</button>
        <button type="button" [class.selected]="measure() === 'seconds'" [disabled]="!!initial" (click)="measure.set('seconds')">Segundos</button>
      </div>
      <label class="switch mt-8">
        <span class="grow">Cuenta para récords y gráficas</span>
        <input type="checkbox" [checked]="counts()" (change)="counts.set($any($event.target).checked)" />
      </label>
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `,
})
class RepTypeDialog {
  protected readonly initial = inject<Row<'rep_types'> | null>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<RepTypeResult>);
  protected readonly name = signal(this.initial?.name ?? '');
  protected readonly measure = signal<RepMeasure>(this.initial?.measure ?? 'reps');
  protected readonly counts = signal(this.initial?.countsForStats ?? true);

  protected save(): void {
    if (!cleanDisplayName(this.name())) return;
    this.ref.close({ name: this.name(), measure: this.measure(), counts: this.counts() });
  }
}

@Component({
  imports: [PageHeader],
  template: `
    <div class="page">
      <app-page-header title="Tipos de repetición" back="/settings">
        <button type="button" class="icon-btn" aria-label="¿Qué es cada tipo?" (click)="actions.showRepTypes(catalog.repTypes())"><span aria-hidden="true" class="icon">help</span></button>
      </app-page-header>
      @for (t of catalog.allRepTypes(); track t.id) {
        <div class="list-item">
          <button type="button" class="grow info" (click)="actions.showRepTypes([t])">
            <span class="title" style="display: block" [style.text-decoration]="t.archived ? 'line-through' : null">{{ t.name }}</span>
            <span class="small muted">{{ subtitle(t) }}</span>
          </button>
          <button type="button" class="icon-btn" aria-label="Editar" (click)="edit(t)"><span aria-hidden="true" class="icon">edit</span></button>
          <button
            type="button"
            class="icon-btn"
            [attr.aria-label]="t.archived ? 'Restaurar' : 'Archivar'"
            [disabled]="activeCount() <= 1 && !t.archived"
            (click)="catalog.setRepTypeArchived(t.id, !t.archived)"
          >
            <span aria-hidden="true" class="icon">{{ t.archived ? 'unarchive' : 'archive' }}</span>
          </button>
        </div>
      }
    </div>
    <button type="button" class="fab" (click)="add()"><span aria-hidden="true" class="icon">add</span> Nuevo</button>
  `,
  styles: `
    .info {
      border: 0;
      background: none;
      text-align: left;
      padding: 0;
      cursor: pointer;
    }
  `,
})
export default class RepTypesPage {
  protected readonly catalog = inject(CatalogRepo);
  protected readonly actions = inject(SetActions);
  private readonly ui = inject(UiService);

  protected readonly activeCount = computed(() => this.catalog.repTypes().length);

  protected subtitle(t: Row<'rep_types'>): string {
    return [
      t.measure === 'seconds' ? 'Se mide en segundos' : 'Se mide en repeticiones',
      t.countsForStats ? '' : 'No cuenta para récords',
      t.archived ? 'Archivado' : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected async add(): Promise<void> {
    const r = await this.ui.open<RepTypeResult>(RepTypeDialog, null);
    if (r) this.catalog.findOrCreateRepType(r.name, r.measure, r.counts);
  }

  protected async edit(t: Row<'rep_types'>): Promise<void> {
    const r = await this.ui.open<RepTypeResult>(RepTypeDialog, t);
    if (!r) return;
    try {
      this.catalog.updateRepType(t.id, r.name, r.counts);
    } catch (e) {
      if (e instanceof DuplicateNameError) this.ui.toast(e.message);
      else throw e;
    }
  }
}
