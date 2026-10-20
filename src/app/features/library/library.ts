import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { ExerciseRepo } from '../../core/data/exercise.repo';
import { cleanDisplayName, normalizeName } from '../../core/utils/normalize';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';
import { ExerciseTile } from './exercise-tile';

@Component({
  imports: [PageHeader, ExerciseTile, EmptyState, RouterLink],
  template: `
    <div class="page">
      <app-page-header title="Biblioteca">
        <button type="button" class="icon-btn" [attr.aria-pressed]="showArchived()" [attr.aria-label]="showArchived() ? 'Ocultar archivados' : 'Ver archivados'" (click)="showArchived.set(!showArchived())">
          <span aria-hidden="true" class="icon" [class.filled]="showArchived()">inventory_2</span>
        </button>
      </app-page-header>

      <div class="search">
        <span aria-hidden="true" class="icon">search</span>
        <input class="input" type="search" placeholder="Buscar ejercicio o máquina" [value]="query()" (input)="query.set($any($event.target).value)" />
      </div>
      <div class="chip-row mt-8">
        <button type="button" class="chip" [class.selected]="!groupId()" (click)="groupId.set(null)">Todos</button>
        @for (g of catalog.muscleGroups(); track g.id) {
          <button type="button" class="chip" [class.selected]="groupId() === g.id" (click)="groupId.set(groupId() === g.id ? null : g.id)">{{ g.name }}</button>
        }
      </div>

      @if (!items().length) {
        <app-empty-state icon="fitness_center" title="Tu biblioteca está vacía" message="Agrega tus máquinas y ejercicios una sola vez; todo el historial se acumula en cada uno.">
          <a class="btn btn-primary" routerLink="/library/new"><span aria-hidden="true" class="icon">add</span> Agregar el primero</a>
        </app-empty-state>
      } @else if (!filtered().length) {
        <app-empty-state icon="search_off" title="Sin resultados">
          @if (query().trim()) {
            <button type="button" class="btn btn-primary" (click)="create()"><span aria-hidden="true" class="icon">add</span> Crear "{{ clean(query()) }}"</button>
          }
        </app-empty-state>
      } @else {
        <div class="stack lg mt-8">
          @for (e of filtered(); track e.exercise.id) {
            <app-exercise-tile [item]="e" [routerLink]="['/exercise', e.exercise.id]">
              <a class="icon-btn" [routerLink]="['/library', e.exercise.id, 'edit']" aria-label="Editar" (click)="$event.stopPropagation()">
                <span aria-hidden="true" class="icon">edit</span>
              </a>
            </app-exercise-tile>
          }
        </div>
      }
    </div>

    <button type="button" class="fab" (click)="create()"><span aria-hidden="true" class="icon">add</span> Nuevo</button>
  `,
})
export default class LibraryPage {
  protected readonly catalog = inject(CatalogRepo);
  private readonly repo = inject(ExerciseRepo);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly groupId = signal<string | null>(null);
  protected readonly showArchived = signal(false);
  protected readonly clean = cleanDisplayName;

  protected readonly items = computed(() => (this.showArchived() ? this.repo.allItems() : this.repo.items()));
  protected readonly filtered = computed(() => {
    const norm = normalizeName(this.query());
    const group = this.groupId();
    return this.items().filter((e) => (!norm || e.exercise.nameNorm.includes(norm)) && (!group || e.groupIds.has(group)));
  });

  protected create(): void {
    const name = this.query().trim();
    void this.router.navigate(['/library/new'], { queryParams: name ? { name } : {} });
  }
}
