import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Component, type OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
import { CatalogRepo } from '../../core/data/catalog.repo';
import {
  EQUIPMENT_ICON,
  EQUIPMENT_LABEL,
  EQUIPMENT_TYPES,
  ExerciseExistsError,
  ExerciseRepo,
  shrinkPhoto,
} from '../../core/data/exercise.repo';
import type { EquipmentType, Row } from '../../core/db/schema';
import { SettingsService } from '../../core/settings.service';
import { formatDuration } from '../../core/utils/format';
import { cleanDisplayName, normalizeName } from '../../core/utils/normalize';
import { Card } from '../../shared/card';
import { ExercisePhoto } from '../../shared/exercise-photo';
import { SectionTitle } from '../../shared/section-title';
import { UiService } from '../../shared/ui.service';

const REST_PRESETS = [60, 90, 120];

interface Draft {
  name: string;
  equipmentType: EquipmentType;
  groupIds: string[];
  photo: string | null;
  defaultRestSec: number | null;
  archived: boolean;
}

/** Crear o editar un ejercicio. Emite el ID del ejercicio guardado (o del existente elegido). */
@Component({
  selector: 'app-exercise-form',
  imports: [Card, ExercisePhoto, SectionTitle, FormField, FormRoot, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  template: `
    @let d = model();
    <form [formRoot]="form">
      <div class="photo">
        <app-exercise-photo [photo]="d.photo" [name]="d.name" [size]="140" />
        <button type="button" class="camera" aria-label="Foto" [cdkMenuTriggerFor]="photoMenu">
          <span aria-hidden="true" class="icon">photo_camera</span>
        </button>
        <ng-template #photoMenu>
          <div class="menu" cdkMenu>
            <button cdkMenuItem (cdkMenuItemTriggered)="camera.click()"><span aria-hidden="true" class="icon">photo_camera</span> Tomar foto</button>
            <button cdkMenuItem (cdkMenuItemTriggered)="gallery.click()"><span aria-hidden="true" class="icon">upload_file</span> Elegir una imagen</button>
            @if (d.photo) {
              <button cdkMenuItem (cdkMenuItemTriggered)="patch({ photo: null })"><span aria-hidden="true" class="icon">delete</span> Quitar foto</button>
            }
          </div>
        </ng-template>
        <input #camera type="file" accept="image/*" capture="environment" hidden (change)="pickPhoto($event)" />
        <input #gallery type="file" accept="image/*" hidden (change)="pickPhoto($event)" />
      </div>

      <label class="field mt-24">
        <span>Nombre</span>
        <input class="input" [formField]="form.name" placeholder="Ej. Prensa de pierna" autocapitalize="sentences" />
        @if (form.name().touched()) {
          @for (e of form.name().errors(); track e.kind) {
            <span class="error">{{ e.message }}</span>
          }
        }
      </label>

      @if (exactMatch(); as match) {
        <app-card class="mt-8" accent="gold" padding="12px">
          <div class="row">
            <span aria-hidden="true" class="icon gold">info</span>
            <span class="grow">"{{ match.name }}" ya está en tu biblioteca{{ match.archived ? ' (archivado)' : '' }}.</span>
            @if (!exerciseId()) {
              <button type="button" class="btn btn-text sm" (click)="useExisting(match)">Usar existente</button>
            }
          </div>
        </app-card>
      } @else if (suggestions().length && !exerciseId()) {
        <p class="muted small" style="margin: 10px 0 6px">¿Quizás es alguno de estos?</p>
        <div class="chips">
          @for (s of suggestions(); track s.id) {
            <button type="button" class="chip" (click)="useExisting(s)"><span aria-hidden="true" class="icon">north_west</span> {{ s.name }}</button>
          }
        </div>
      }

      <app-section-title text="Tipo" />
      <div class="chips">
        @for (t of types; track t) {
          <button type="button" class="chip" [class.selected]="d.equipmentType === t" (click)="setType(t)">
            <span aria-hidden="true" class="icon">{{ icons[t] }}</span> {{ labels[t] }}
          </button>
        }
      </div>
      @if (d.equipmentType === 'cardio') {
        <p class="small muted" style="margin: 8px 0 0">
          Se registra por tiempo, con distancia y velocidad/nivel opcionales. Sin temporizador de descanso.
        </p>
      }

      <app-section-title text="Grupos musculares">
        <button type="button" class="btn btn-text sm" (click)="addGroup()"><span aria-hidden="true" class="icon sm">add</span> Nuevo</button>
      </app-section-title>
      <div class="chips">
        @for (g of catalog.muscleGroups(); track g.id) {
          <button type="button" class="chip" [class.selected]="d.groupIds.includes(g.id)" (click)="toggleGroup(g.id)">{{ g.name }}</button>
        }
      </div>

      @if (d.equipmentType !== 'cardio') {
        <app-section-title text="Descanso por defecto" />
        <div class="chips">
          <button type="button" class="chip" [class.selected]="d.defaultRestSec === null" (click)="patch({ defaultRestSec: null })">
            Global ({{ format(settings.defaultRestSec()) }})
          </button>
          @for (s of restPresets; track s) {
            <button type="button" class="chip" [class.selected]="d.defaultRestSec === s" (click)="patch({ defaultRestSec: s })">{{ format(s) }}</button>
          }
          <button type="button" class="chip" [class.selected]="customRest()" (click)="pickRest()">
            {{ customRest() ? format(d.defaultRestSec!) : 'Otro' }}
          </button>
        </div>
      }

      @if (exerciseId()) {
        <label class="switch mt-16">
          <span class="grow">
            <span style="display: block">Archivado</span>
            <span class="small muted">Se oculta de la biblioteca pero conserva todo su historial</span>
          </span>
          <input type="checkbox" [formField]="form.archived" />
        </label>
      }

      <button type="submit" class="btn btn-primary block mt-24">
        <span aria-hidden="true" class="icon">check</span> {{ exerciseId() ? 'Guardar cambios' : 'Crear ejercicio' }}
      </button>
    </form>
  `,
  styles: `
    .photo {
      position: relative;
      width: 140px;
      margin: 8px auto 0;
    }
    .camera {
      position: absolute;
      right: -8px;
      bottom: -8px;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--primary);
      color: var(--on-primary);
      cursor: pointer;
    }
    :host-context([data-style='retro']) .camera {
      border-radius: 0;
      border: 2px solid var(--cyan);
      background: var(--violet);
    }
  `,
})
export class ExerciseForm implements OnInit {
  protected readonly repo = inject(ExerciseRepo);
  protected readonly catalog = inject(CatalogRepo);
  protected readonly settings = inject(SettingsService);
  private readonly ui = inject(UiService);

  readonly exerciseId = input<string | null>(null);
  readonly initialName = input<string | null>(null);
  readonly saved = output<string>();

  protected readonly types = EQUIPMENT_TYPES;
  protected readonly labels = EQUIPMENT_LABEL;
  protected readonly icons = EQUIPMENT_ICON;
  protected readonly restPresets = REST_PRESETS;
  protected readonly format = formatDuration;

  protected readonly model = signal<Draft>({
    name: '',
    equipmentType: 'maquina',
    groupIds: [],
    photo: null,
    defaultRestSec: null,
    archived: false,
  });

  protected readonly form = form(
    this.model,
    (p) => {
      required(p.name, { message: 'Escribe un nombre' });
    },
    { submission: { action: async () => this.save() } },
  );

  protected readonly suggestions = computed(() =>
    this.repo.suggestions(this.model().name).filter((e) => e.id !== this.exerciseId()),
  );
  protected readonly exactMatch = computed(() => {
    const norm = normalizeName(this.model().name);
    return this.suggestions().find((e) => e.nameNorm === norm) ?? null;
  });
  protected readonly customRest = computed(() => {
    const r = this.model().defaultRestSec;
    return r != null && !REST_PRESETS.includes(r);
  });

  ngOnInit(): void {
    const id = this.exerciseId();
    const item = id ? this.repo.byId().get(id) : undefined;
    if (item) {
      const e = item.exercise;
      this.model.set({
        name: e.name,
        equipmentType: e.equipmentType,
        groupIds: [...item.groupIds],
        photo: e.photo,
        defaultRestSec: e.defaultRestSec,
        archived: e.archived,
      });
    } else {
      this.patch({ name: cleanDisplayName(this.initialName() ?? '') });
    }
  }

  protected patch(changes: Partial<Draft>): void {
    this.model.update((m) => ({ ...m, ...changes }));
  }

  protected setType(t: EquipmentType): void {
    this.patch({ equipmentType: t });
    // Al elegir Cardio se marca el grupo "Cardio" si existe.
    const cardio = t === 'cardio' && this.catalog.muscleGroups().find((g) => g.nameNorm === 'cardio');
    if (cardio && !this.model().groupIds.includes(cardio.id)) this.toggleGroup(cardio.id);
  }

  protected toggleGroup(id: string): void {
    const ids = this.model().groupIds;
    this.patch({ groupIds: ids.includes(id) ? ids.filter((g) => g !== id) : [...ids, id] });
  }

  protected async addGroup(): Promise<void> {
    const name = await this.ui.prompt({ title: 'Nuevo grupo muscular' });
    if (!name || !cleanDisplayName(name)) return;
    const g = this.catalog.findOrCreateMuscleGroup(name);
    if (!this.model().groupIds.includes(g.id)) this.toggleGroup(g.id);
  }

  protected async pickRest(): Promise<void> {
    const s = await this.ui.seconds(this.model().defaultRestSec ?? this.settings.defaultRestSec());
    if (s) this.patch({ defaultRestSec: s });
  }

  protected async pickPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.patch({ photo: await shrinkPhoto(file) });
    } catch {
      this.ui.toast('No se pudo leer la imagen');
    }
  }

  protected useExisting(e: Row<'exercises'>): void {
    if (e.archived) this.repo.setArchived(e.id, false);
    this.ui.toast(`Usando "${e.name}" de tu biblioteca`);
    this.saved.emit(e.id);
  }

  private save(): undefined {
    const d = this.model();
    const draft = { ...d, name: cleanDisplayName(d.name), groupIds: new Set(d.groupIds) };
    try {
      const id = this.exerciseId();
      if (id) this.repo.update(id, draft, d.archived);
      this.saved.emit(id ?? this.repo.create(draft));
    } catch (e) {
      if (!(e instanceof ExerciseExistsError)) throw e;
      this.ui.toast(e.message);
    }
    return undefined;
  }
}
