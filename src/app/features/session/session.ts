import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogRepo } from '../../core/data/catalog.repo';
import { ExerciseRepo } from '../../core/data/exercise.repo';
import { type SessionExerciseView, sessionBlocks, supersetMembers, totalSets } from '../../core/data/models';
import { ProgressService } from '../../core/data/progress.service';
import { describeSet } from '../../core/data/stats';
import { WorkoutRepo, isBackdated } from '../../core/data/workout.repo';
import { XP_PER_PR, XP_PER_SESSION, xpForSet } from '../../core/data/xp';
import { SettingsService } from '../../core/settings.service';
import { capitalize, formatDate, formatTime, letter, supersetLabel } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { EmptyState } from '../../shared/empty-state';
import { ExercisePhoto } from '../../shared/exercise-photo';
import { PageHeader } from '../../shared/page-header';
import { SectionTitle } from '../../shared/section-title';
import { UiService } from '../../shared/ui.service';
import { ExercisePicker } from '../library/exercise-picker';
import { SessionFlows } from './session-flows';
import { FinishDialog, LinkDialog, SummaryDialog, type SummaryData } from './session-dialogs';

@Component({
  imports: [PageHeader, Card, EmptyState, ExercisePhoto, SectionTitle, RouterLink, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  template: `
    <div class="page">
      @if (view(); as v) {
        <app-page-header [title]="title()" [back]="readOnly() ? '/history' : '/today'">
          <button type="button" class="icon-btn" aria-label="Opciones" [cdkMenuTriggerFor]="menu"><span aria-hidden="true" class="icon">more_vert</span></button>
        </app-page-header>
        <ng-template #menu>
          <div class="menu" cdkMenu>
            @if (!readOnly()) {
              <button cdkMenuItem (cdkMenuItemTriggered)="editGroups()"><span aria-hidden="true" class="icon">accessibility_new</span> Grupos musculares</button>
            }
            <button cdkMenuItem (cdkMenuItemTriggered)="changeDate()"><span aria-hidden="true" class="icon">edit_calendar</span> Cambiar fecha y hora</button>
            @if (readOnly()) {
              <button cdkMenuItem (cdkMenuItemTriggered)="reopen()"><span aria-hidden="true" class="icon">edit</span> Reabrir para editar</button>
            }
            <button cdkMenuItem class="danger" (cdkMenuItemTriggered)="remove()"><span aria-hidden="true" class="icon">delete</span> Eliminar sesión</button>
          </div>
        </ng-template>

        @if (v.groupIds.size) {
          <div class="chips">
            @for (g of v.groupIds; track g) {
              <span class="chip static">{{ catalog.groupNames().get(g) ?? '?' }}</span>
            }
          </div>
        }
        @if (!readOnly() && backdated()) {
          <app-card class="mt-8" accent="gold" padding="12px">
            <div class="row">
              <span aria-hidden="true" class="icon gold">edit_calendar</span>
              <span>Registrando una sesión pasada: las series quedan con esa fecha y no se inicia el temporizador.</span>
            </div>
          </app-card>
        }

        <div class="stats">
          <div><span class="num">{{ setCount() }}</span><span class="tiny muted">Series</span></div>
          <div><span class="num">{{ v.exercises.length }}</span><span class="tiny muted">Ejercicios</span></div>
          <div><span class="num">{{ duration() }}</span><span class="tiny muted">Duración</span></div>
        </div>

        @if (!v.exercises.length) {
          <app-empty-state icon="fitness_center" title="Sin ejercicios" message="Agrega ejercicios de tu biblioteca para empezar a registrar series." />
        }

        <div class="stack lg">
          @for (block of blocks(); track block[0].sessionExercise.id) {
            @if (block.length === 1) {
              @let e = block[0];
              <app-card [accent]="e.sets.length && settings.isRetro() ? 'secondary' : null" padding="12px" [clickable]="!readOnly()" (click)="openExercise(e)">
                <div class="row">
                  <app-exercise-photo [photo]="e.exercise.photo" [name]="e.exercise.name" [size]="44" />
                  <span class="title grow">{{ e.exercise.name }}</span>
                  <span class="num gold count">{{ e.sets.length }}</span>
                  @if (!readOnly()) {
                    <button type="button" class="icon-btn" aria-label="Opciones del ejercicio" (click)="$event.stopPropagation(); exerciseMenu(e)">
                      <span aria-hidden="true" class="icon">more_vert</span>
                    </button>
                  }
                </div>
                @for (r of e.sets; track r.set.id) {
                  <div class="set muted" style="padding-left: 56px">{{ r.set.setNumber }}. {{ describe(r) }}</div>
                }
              </app-card>
            } @else {
              <app-card accent="gold" padding="12px" [clickable]="!readOnly()" (click)="openSuperset(block)">
                <div class="row">
                  <span aria-hidden="true" class="icon gold">link</span>
                  <span class="superset grow">{{ label(block.length) }}</span>
                  <span class="num gold">{{ rounds(block) }} {{ rounds(block) === 1 ? 'ronda' : 'rondas' }}</span>
                  @if (!readOnly()) {
                    <span aria-hidden="true" class="icon">chevron_right</span>
                  }
                </div>
                @for (e of block; track e.sessionExercise.id; let i = $index) {
                  <div class="row mt-8">
                    <span class="badge">{{ letter(i) }}</span>
                    <app-exercise-photo [photo]="e.exercise.photo" [name]="e.exercise.name" [size]="36" />
                    <span class="title grow">{{ e.exercise.name }}</span>
                    @if (!readOnly()) {
                      <button type="button" class="icon-btn" aria-label="Opciones del ejercicio" (click)="$event.stopPropagation(); exerciseMenu(e)">
                        <span aria-hidden="true" class="icon">more_vert</span>
                      </button>
                    }
                  </div>
                  @for (r of e.sets; track r.set.id) {
                    <div class="set muted" style="padding-left: 82px">{{ r.set.setNumber }}. {{ describe(r) }}</div>
                  }
                }
              </app-card>
            }
          }
        </div>

        @if (!readOnly() && v.exercises.length) {
          <button type="button" class="btn btn-gold block mt-24" (click)="finish()">
            <span aria-hidden="true" class="icon">flag</span> {{ settings.shout('Terminar partida', 'Terminar sesión') }}
          </button>
        }
        @if (readOnly() && v.session.notes) {
          <app-section-title text="Notas" />
          <p style="white-space: pre-line; margin: 0">{{ v.session.notes }}</p>
        }
      } @else {
        <app-page-header title="Sesión" back="/history" />
        <app-empty-state icon="event_busy" title="Sesión no encontrada">
          <a class="btn btn-outline" routerLink="/today">Ir a Hoy</a>
        </app-empty-state>
      }
    </div>

    @if (view() && !readOnly()) {
      <button type="button" class="fab" (click)="addMenu()"><span aria-hidden="true" class="icon">add</span> Agregar</button>
    }
  `,
  styles: `
    .stats {
      display: flex;
      margin: 16px 0;
      > div {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .num {
        font-size: 20px;
      }
    }
    .count {
      font-size: 20px;
      min-width: 24px;
      text-align: right;
    }
    .set {
      margin-top: 2px;
    }
    .superset {
      font-family: var(--font-display);
      font-weight: 800;
      color: var(--gold);
      font-size: 16px;
    }
    :host-context([data-style='retro']) .superset {
      font-size: 11px;
    }
  `,
})
export default class SessionPage {
  protected readonly workout = inject(WorkoutRepo);
  protected readonly catalog = inject(CatalogRepo);
  protected readonly settings = inject(SettingsService);
  private readonly exercises = inject(ExerciseRepo);
  private readonly progress = inject(ProgressService);
  private readonly ui = inject(UiService);
  private readonly picker = inject(ExercisePicker);
  private readonly flows = inject(SessionFlows);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly describe = describeSet;
  protected readonly label = supersetLabel;
  protected readonly letter = letter;

  private readonly now = signal(Date.now());
  protected readonly view = computed(() => this.workout.session(this.id()));
  protected readonly readOnly = computed(() => this.view()?.session.finishedAt != null);
  protected readonly backdated = computed(() => {
    const v = this.view();
    return !!v && isBackdated(v.session, this.now());
  });
  protected readonly blocks = computed(() => {
    const v = this.view();
    return v ? sessionBlocks(v) : [];
  });
  protected readonly setCount = computed(() => {
    const v = this.view();
    return v ? totalSets(v) : 0;
  });
  protected readonly title = computed(() => {
    const s = this.view()?.session;
    if (!s) return 'Sesión';
    if (!this.readOnly() && !this.backdated()) return this.settings.shout('En juego', 'Sesión');
    const day = formatDate(s.startedAt, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '');
    return `${capitalize(day)} · ${formatTime(s.startedAt)}`;
  });
  protected readonly duration = computed(() => {
    const s = this.view()?.session;
    if (!s || (s.finishedAt == null && this.backdated())) return '—';
    return `${Math.floor(((s.finishedAt ?? this.now()) - s.startedAt) / 60_000)} min`;
  });

  constructor() {
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected rounds(block: SessionExerciseView[]): number {
    return Math.min(...block.map((e) => e.sets.length));
  }

  protected openExercise(e: SessionExerciseView): void {
    if (!this.readOnly()) void this.router.navigate(['/session', this.id(), 'exercise', e.sessionExercise.id]);
  }

  protected openSuperset(block: SessionExerciseView[]): void {
    if (!this.readOnly()) void this.router.navigate(['/session', this.id(), 'superset', block[0].sessionExercise.supersetGroup]);
  }

  protected async addMenu(): Promise<void> {
    const choice = await this.ui.choose('Agregar', [
      { value: 'single', icon: 'fitness_center', title: 'Ejercicio' },
      { value: 'superset', icon: 'link', title: 'Biserie, triserie o circuito', subtitle: 'Elige 2 o más ejercicios que harás seguidos' },
    ]);
    if (choice === 'single') await this.addExercise();
    if (choice === 'superset') await this.addSuperset();
  }

  private async addExercise(): Promise<void> {
    const v = this.view()!;
    const ids = await this.picker.pick({ preferredGroups: v.groupIds, exclude: new Set(v.exercises.map((e) => e.exercise.id)) });
    const seIds = ids.map((id) => this.workout.addExercise(this.id(), id));
    // Si se agregó uno solo, se abre directo para registrar.
    if (seIds.length === 1) void this.router.navigate(['/session', this.id(), 'exercise', seIds[0]]);
  }

  private async addSuperset(): Promise<void> {
    const picked = await this.picker.pick({ preferredGroups: this.view()!.groupIds });
    if (!picked.length) return;
    const ids = picked.filter((id) => this.exercises.byId().get(id)?.exercise.equipmentType !== 'cardio');
    if (ids.length < 2) return this.ui.toast('Elige al menos 2 ejercicios de fuerza (el cardio no va en biseries)');
    const group = this.workout.addSuperset(this.id(), ids);
    if (group) void this.router.navigate(['/session', this.id(), 'superset', group]);
  }

  /** Unir en biserie, separar o quitar. */
  protected async exerciseMenu(e: SessionExerciseView): Promise<void> {
    const v = this.view()!;
    const group = e.sessionExercise.supersetGroup;
    const options: { value: string; icon: string; title: string }[] = [];
    if (e.exercise.equipmentType !== 'cardio') {
      options.push({ value: 'link', icon: 'link', title: group ? 'Agregar otro ejercicio a la biserie' : 'Unir en biserie con…' });
    }
    if (group) options.push({ value: 'unlink', icon: 'link_off', title: 'Separar de la biserie' });
    options.push({ value: 'remove', icon: 'delete', title: 'Quitar de la sesión' });

    const choice = await this.ui.choose(e.exercise.name, options);
    if (choice === 'link') {
      const current = group ? supersetMembers(v, group) : [e];
      const candidates = v.exercises.filter((x) => !current.includes(x) && x.exercise.equipmentType !== 'cardio');
      if (!candidates.length) return this.ui.toast('Agrega primero otro ejercicio a la sesión');
      const selected = await this.ui.open<string[]>(LinkDialog, candidates);
      if (selected?.length) this.workout.linkSuperset(this.id(), [...current.map((x) => x.sessionExercise.id), ...selected]);
    }
    if (choice === 'unlink') this.workout.unlinkSuperset(e.sessionExercise.id);
    if (choice === 'remove') {
      const ok = await this.ui.confirm({
        title: `¿Quitar ${e.exercise.name}?`,
        message: e.sets.length ? `Se borran sus ${e.sets.length} series de esta sesión.` : undefined,
        confirm: 'Quitar',
        danger: e.sets.length > 0,
      });
      if (ok) this.workout.removeSessionExercise(e.sessionExercise.id);
    }
  }

  protected async editGroups(): Promise<void> {
    const v = this.view()!;
    const result = await this.ui.pickGroups({ title: 'Grupos musculares', groups: this.catalog.muscleGroups(), initial: v.groupIds });
    if (result) this.workout.setSessionGroups(this.id(), result);
  }

  protected async changeDate(): Promise<void> {
    const s = this.view()!.session;
    const start = await this.flows.pickPastDateTime(s.startedAt);
    if (start == null) return;
    this.workout.changeSessionStart(this.id(), start);
    // Si ya terminó, también se corrige la hora de fin.
    if (s.finishedAt != null) {
      const end = await this.flows.pickEndTime(start, s.finishedAt + (start - s.startedAt));
      if (end != null) this.workout.setSessionEnd(this.id(), end);
    }
  }

  protected reopen(): void {
    this.workout.reopenSession(this.id());
  }

  protected async remove(): Promise<void> {
    const ok = await this.ui.confirm({ title: '¿Eliminar sesión?', message: 'Se borran sus series. No se puede deshacer.', confirm: 'Eliminar', danger: true });
    if (!ok) return;
    const target = this.readOnly() ? '/history' : '/today';
    this.workout.deleteSession(this.id());
    void this.router.navigateByUrl(target);
  }

  protected async finish(): Promise<void> {
    const v = this.view()!;
    const notes = await this.ui.open<string>(FinishDialog, v.session.notes);
    if (notes === undefined) return;
    // Sesión registrada después: se pregunta la hora real de fin.
    let end: number | undefined;
    if (this.backdated()) {
      end = await this.flows.pickEndTime(v.session.startedAt, this.workout.estimatedEnd(this.id()));
      if (end == null) return;
    }
    this.workout.setNotes(this.id(), notes.trim() || null);
    this.workout.finishSession(this.id(), end);

    const prs = this.progress.xp().prs.filter((p) => p.record.sessionId === this.id());
    const setXp = v.exercises.flatMap((e) => e.sets).reduce((a, r) => a + xpForSet(r), 0);
    const prXp = new Set(prs.map((p) => p.record.set.exerciseId)).size * XP_PER_PR;
    await this.ui.open<void, SummaryData>(SummaryDialog, {
      xp: setXp + prXp + XP_PER_SESSION,
      exercises: v.exercises.length,
      sets: totalSets(v),
      records: [...new Set(prs.map((p) => p.exerciseName))],
    });
    void this.router.navigateByUrl('/today');
  }
}
