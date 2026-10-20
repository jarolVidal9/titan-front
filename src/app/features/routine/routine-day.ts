import { CdkDrag, CdkDragHandle, type CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Location } from '@angular/common';
import { Component, type OnInit, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { ExerciseRepo } from '../../core/data/exercise.repo';
import { RoutineRepo } from '../../core/data/routine.repo';
import type { Row } from '../../core/db/schema';
import { WEEKDAY_NAMES, supersetLabel } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { ExercisePhoto } from '../../shared/exercise-photo';
import { PageHeader } from '../../shared/page-header';
import { SectionTitle } from '../../shared/section-title';
import { UiService } from '../../shared/ui.service';
import { ExercisePicker } from '../library/exercise-picker';

interface Item {
  exerciseId: string;
  superset: string | null; // mismo valor = biserie
}

/** Plantilla de un día: nombre opcional, grupos musculares y ejercicios en orden. */
@Component({
  imports: [PageHeader, Card, ExercisePhoto, SectionTitle, CdkDropList, CdkDrag, CdkDragHandle, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  template: `
    <div class="page">
      <app-page-header [title]="weekdayName()" back="/routine">
        <button type="button" class="btn btn-text" (click)="save()">Guardar</button>
      </app-page-header>

      <label class="field">
        <span>Nombre (opcional)</span>
        <input class="input" placeholder="Ej. Empuje, Pierna pesada" [value]="name()" (input)="name.set($any($event.target).value); dirty = true" />
      </label>

      <app-section-title text="Grupos musculares" />
      <div class="chips">
        @for (g of catalog.muscleGroups(); track g.id) {
          <button type="button" class="chip" [class.selected]="groups().has(g.id)" (click)="toggleGroup(g.id)">{{ g.name }}</button>
        }
      </div>

      <app-section-title [text]="'Ejercicios (' + items().length + ')'" />
      @if (!items().length) {
        <p class="muted">Agrega ejercicios de tu biblioteca. Arrástralos desde ⠿ para ordenarlos. Con el menú ⋮ puedes unir un ejercicio con el siguiente en biserie.</p>
      }
      <div class="stack" cdkDropList (cdkDropListDropped)="drop($event)">
        @for (it of items(); track it.exerciseId; let i = $index) {
          @let ex = exercises().get(it.exerciseId);
          <app-card cdkDrag cdkDragLockAxis="y" [accent]="it.superset ? 'gold' : null" padding="10px">
            <div class="row">
              @if (it.superset) {
                <span aria-hidden="true" class="icon sm gold">link</span>
              }
              <app-exercise-photo [photo]="ex?.photo ?? null" [name]="ex?.name ?? '?'" [size]="44" />
              <div class="grow">
                <div class="title">{{ ex?.name ?? '—' }}</div>
                @if (it.superset) {
                  <div class="tiny gold" style="font-weight: 700">{{ label(sizeOf(it.superset)) }}</div>
                }
                @if (groupsOf(it.exerciseId); as g) {
                  <div class="tiny muted">{{ g }}</div>
                }
              </div>
              <button type="button" class="icon-btn" aria-label="Opciones" [cdkMenuTriggerFor]="menu"><span aria-hidden="true" class="icon">more_vert</span></button>
              <ng-template #menu>
                <div class="menu" cdkMenu>
                  @if (i + 1 < items().length && ex?.equipmentType !== 'cardio') {
                    <button cdkMenuItem (cdkMenuItemTriggered)="linkWithNext(i)"><span aria-hidden="true" class="icon">link</span> Unir en biserie con el siguiente</button>
                  }
                  @if (it.superset) {
                    <button cdkMenuItem (cdkMenuItemTriggered)="unlink(i)"><span aria-hidden="true" class="icon">link_off</span> Separar de la biserie</button>
                  }
                  <button cdkMenuItem class="danger" (cdkMenuItemTriggered)="remove(i)"><span aria-hidden="true" class="icon">delete</span> Quitar</button>
                </div>
              </ng-template>
              <span aria-hidden="true" class="icon handle" cdkDragHandle aria-label="Arrastrar para ordenar">drag_indicator</span>
            </div>
          </app-card>
        }
      </div>
    </div>

    <button type="button" class="fab" (click)="add()"><span aria-hidden="true" class="icon">add</span> Ejercicio</button>
  `,
  styles: `
    .handle {
      cursor: grab;
      color: var(--muted);
      padding: 8px 4px;
      touch-action: none;
    }
    .cdk-drag-preview {
      box-shadow: 0 12px 30px rgb(0 0 0 / 0.3);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .cdk-drag-animating,
    .cdk-drop-list-dragging app-card:not(.cdk-drag-placeholder) {
      transition: transform 0.2s ease;
    }
  `,
})
export default class RoutineDayPage implements OnInit {
  protected readonly catalog = inject(CatalogRepo);
  private readonly routine = inject(RoutineRepo);
  private readonly exerciseRepo = inject(ExerciseRepo);
  private readonly picker = inject(ExercisePicker);
  private readonly ui = inject(UiService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly weekday = input.required({ transform: numberAttribute });

  protected readonly label = supersetLabel;
  protected readonly name = signal('');
  protected readonly groups = signal(new Set<string>());
  protected readonly items = signal<Item[]>([]);
  protected dirty = false;
  private day?: Row<'routine_days'>;

  protected readonly weekdayName = computed(() => WEEKDAY_NAMES[this.weekday() - 1] ?? 'Rutina');
  protected readonly exercises = computed(() => new Map(this.exerciseRepo.allItems().map((e) => [e.exercise.id, e.exercise])));

  ngOnInit(): void {
    const plan = this.routine.week().find((p) => p.day.weekday === this.weekday());
    if (!plan) return;
    this.day = plan.day;
    this.name.set(plan.day.name ?? '');
    this.groups.set(new Set(plan.groupIds));
    this.items.set(plan.exercises.map((e, i) => ({ exerciseId: e.id, superset: plan.supersetGroups[i] ?? null })));
  }

  protected groupsOf(exerciseId: string): string {
    const names = this.catalog.groupNames();
    return [...(this.exerciseRepo.byId().get(exerciseId)?.groupIds ?? [])].map((g) => names.get(g)).filter(Boolean).join(' · ');
  }

  protected sizeOf(group: string): number {
    return this.items().filter((i) => i.superset === group).length;
  }

  protected toggleGroup(id: string): void {
    this.groups.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
    this.dirty = true;
  }

  protected async add(): Promise<void> {
    const current = new Set(this.items().map((i) => i.exerciseId));
    const ids = await this.picker.pick({ preferredGroups: this.groups(), exclude: current });
    const fresh = ids.filter((id) => !current.has(id));
    if (!fresh.length) return;
    this.items.update((list) => [...list, ...fresh.map((exerciseId) => ({ exerciseId, superset: null }))]);
    this.dirty = true;
  }

  protected drop(e: CdkDragDrop<unknown>): void {
    this.mutate((list) => moveItemInArray(list, e.previousIndex, e.currentIndex));
  }

  /** Une el ejercicio i con el siguiente (si alguno ya estaba en una biserie, se suma a ella). */
  protected linkWithNext(i: number): void {
    this.mutate((list) => {
      if (this.exercises().get(list[i + 1].exerciseId)?.equipmentType === 'cardio') return;
      const used = list.map((x) => Number(x.superset)).filter((n) => n > 0);
      const group = list[i].superset ?? list[i + 1].superset ?? String(used.length ? Math.max(...used) + 1 : 1);
      const old = list[i + 1].superset;
      for (const x of list) if (old != null && x.superset === old) x.superset = group;
      list[i].superset = group;
      list[i + 1].superset = group;
    });
  }

  protected unlink(i: number): void {
    this.mutate((list) => (list[i].superset = null));
  }

  protected remove(i: number): void {
    this.mutate((list) => list.splice(i, 1));
  }

  /** Aplica el cambio y deshace las biseries que dejaron de ser válidas. */
  private mutate(fn: (list: Item[]) => void): void {
    const list = this.items().map((i) => ({ ...i }));
    fn(list);
    // Una biserie solo vale si sus ejercicios quedan seguidos y son al menos 2.
    for (const g of new Set(list.map((x) => x.superset).filter((x) => x != null))) {
      const idx = list.flatMap((x, k) => (x.superset === g ? [k] : []));
      if (idx.length < 2 || idx.at(-1)! - idx[0] + 1 !== idx.length) for (const k of idx) list[k].superset = null;
    }
    this.items.set(list);
    this.dirty = true;
  }

  /** Lo usa el guard de la ruta: si hay cambios sin guardar, pregunta antes de salir. */
  canLeave(): boolean | Promise<boolean> {
    return !this.dirty || this.ui.confirm({ title: '¿Descartar cambios?', confirm: 'Descartar', danger: true });
  }

  protected save(): void {
    if (!this.day) return;
    const items = this.items();
    this.routine.saveDay(this.day, this.name(), this.groups(), items.map((i) => i.exerciseId), items.map((i) => i.superset));
    this.dirty = false;
    this.ui.toast('Rutina guardada');
    if (history.state?.navigationId > 1) this.location.back();
    else void this.router.navigateByUrl('/routine');
  }
}
