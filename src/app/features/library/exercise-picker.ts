import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { ExerciseRepo } from '../../core/data/exercise.repo';
import type { ExerciseItem } from '../../core/data/models';
import { cleanDisplayName, normalizeName } from '../../core/utils/normalize';
import { UiService } from '../../shared/ui.service';
import { ExerciseForm } from './exercise-form';
import { ExerciseTile } from './exercise-tile';

export interface PickerOptions {
  /** Los ejercicios de estos grupos salen primero (y se puede filtrar solo por ellos). */
  preferredGroups?: ReadonlySet<string>;
  exclude?: ReadonlySet<string>;
  multiple?: boolean;
}

interface PickerResult {
  ids: string[];
  create?: string;
}

@Component({
  imports: [ExerciseTile],
  template: `
    <div class="search">
      <span aria-hidden="true" class="icon">search</span>
      <input class="input" placeholder="Buscar en la biblioteca" [value]="query()" (input)="query.set($any($event.target).value)" />
    </div>
    @if (preferred.size) {
      <label class="switch">
        <span class="grow small">Solo {{ preferredNames() }}</span>
        <input type="checkbox" [checked]="onlyPreferred()" (change)="onlyPreferred.set($any($event.target).checked)" />
      </label>
    }
    <div class="list">
      @if (!exact()) {
        <button type="button" class="btn btn-outline block" (click)="create()">
          <span aria-hidden="true" class="icon">add</span> {{ query().trim() ? 'Crear "' + clean(query()) + '"' : 'Crear ejercicio nuevo' }}
        </button>
      }
      @for (e of list(); track e.exercise.id) {
        <app-exercise-tile [item]="e" [selected]="selected().includes(e.exercise.id)" (click)="tap(e)">
          @if (multiple) {
            <input type="checkbox" class="check" [checked]="selected().includes(e.exercise.id)" tabindex="-1" aria-hidden="true" />
          }
        </app-exercise-tile>
      } @empty {
        <p class="center muted">Sin ejercicios</p>
      }
    </div>
    @if (multiple) {
      <button type="button" class="btn btn-primary block" [disabled]="!selected().length" (click)="ref.close({ ids: selected() })">
        <span aria-hidden="true" class="icon">check</span> {{ selected().length ? 'Agregar ' + selected().length : 'Elige ejercicios' }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      flex: 1;
    }
    .list {
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0 -4px;
      padding: 4px 8px 8px 4px;
    }
    .check {
      width: 22px;
      height: 22px;
      accent-color: var(--primary);
      pointer-events: none;
    }
  `,
})
class ExercisePickerSheet {
  private readonly repo = inject(ExerciseRepo);
  private readonly catalog = inject(CatalogRepo);
  private readonly data = inject<PickerOptions>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<PickerResult>);

  protected readonly preferred = this.data.preferredGroups ?? new Set<string>();
  protected readonly multiple = this.data.multiple ?? true;
  protected readonly clean = cleanDisplayName;

  protected readonly query = signal('');
  protected readonly selected = signal<string[]>([]);
  protected readonly onlyPreferred = signal(this.preferred.size > 0);

  protected readonly preferredNames = computed(() =>
    [...this.preferred].map((g) => this.catalog.groupNames().get(g)).filter(Boolean).join(', '),
  );
  protected readonly exact = computed(() => {
    const norm = normalizeName(this.query());
    return !!norm && this.repo.items().some((e) => e.exercise.nameNorm === norm);
  });
  protected readonly list = computed(() => {
    const norm = normalizeName(this.query());
    const exclude = this.data.exclude ?? new Set<string>();
    const isPreferred = (e: ExerciseItem) => [...e.groupIds].some((g) => this.preferred.has(g));
    return this.repo
      .items()
      .filter((e) => !exclude.has(e.exercise.id))
      .filter((e) => !norm || e.exercise.nameNorm.includes(norm))
      .filter((e) => !this.onlyPreferred() || norm || isPreferred(e))
      .sort((a, b) => Number(isPreferred(b)) - Number(isPreferred(a)));
  });

  protected tap(e: ExerciseItem): void {
    const id = e.exercise.id;
    if (!this.multiple) return this.ref.close({ ids: [id] });
    this.selected.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  protected create(): void {
    this.ref.close({ ids: [], create: cleanDisplayName(this.query()) });
  }
}

@Component({
  imports: [ExerciseForm],
  template: `
    <h2 class="dialog-title">Nuevo ejercicio</h2>
    <app-exercise-form [initialName]="name" (saved)="ref.close($event)" />
  `,
})
class ExerciseFormDialog {
  protected readonly name = inject<string>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<string>);
}

@Injectable({ providedIn: 'root' })
export class ExercisePicker {
  private readonly ui = inject(UiService);

  /** Devuelve los IDs elegidos (en orden de selección). Permite crear uno nuevo sin duplicar. */
  async pick(options: PickerOptions = {}): Promise<string[]> {
    const result = await this.ui.sheet<PickerResult>(ExercisePickerSheet, options, true);
    if (!result) return [];
    if (result.create == null) return result.ids;
    const id = await this.ui.open<string>(ExerciseFormDialog, result.create);
    return id ? [id] : [];
  }
}
