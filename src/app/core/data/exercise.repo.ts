import { Injectable, computed, inject } from '@angular/core';
import { LocalDb } from '../db/local-db';
import type { EquipmentType, Row } from '../db/schema';
import { cleanDisplayName, normalizeName } from '../utils/normalize';
import type { ExerciseItem } from './models';

/** Se lanza al crear o renombrar con un nombre que ya existe en la biblioteca. */
export class ExerciseExistsError extends Error {
  constructor(readonly existing: Row<'exercises'>) {
    super(`Ya existe "${existing.name}" en tu biblioteca`);
  }
}

export interface ExerciseDraft {
  name: string;
  equipmentType: EquipmentType;
  groupIds: ReadonlySet<string>;
  photo: string | null;
  defaultRestSec: number | null;
}

export const EQUIPMENT_TYPES: EquipmentType[] = ['maquina', 'libre', 'corporal', 'cardio'];

export const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  maquina: 'Máquina',
  libre: 'Peso libre',
  corporal: 'Peso corporal',
  cardio: 'Cardio',
};

export const EQUIPMENT_ICON: Record<EquipmentType, string> = {
  maquina: 'precision_manufacturing',
  libre: 'fitness_center',
  corporal: 'accessibility_new',
  cardio: 'directions_run',
};

const linkId = (exerciseId: string, groupId: string) => `${exerciseId}:${groupId}`;

@Injectable({ providedIn: 'root' })
export class ExerciseRepo {
  private readonly db = inject(LocalDb);

  /** Todos, incluidos los archivados, por nombre. */
  readonly allItems = computed<ExerciseItem[]>(() => {
    const groups = new Map<string, Set<string>>();
    for (const l of this.db.list('exercise_muscle_groups')()) {
      const set = groups.get(l.exerciseId) ?? new Set();
      set.add(l.muscleGroupId);
      groups.set(l.exerciseId, set);
    }
    return this.db
      .list('exercises')()
      .sort((a, b) => a.nameNorm.localeCompare(b.nameNorm))
      .map((exercise) => ({ exercise, groupIds: groups.get(exercise.id) ?? new Set() }));
  });

  readonly items = computed(() => this.allItems().filter((e) => !e.exercise.archived));
  readonly byId = computed(() => new Map(this.allItems().map((e) => [e.exercise.id, e])));
  readonly names = computed(() => new Map(this.allItems().map((e) => [e.exercise.id, e.exercise.name])));

  findByName(name: string): Row<'exercises'> | undefined {
    const norm = normalizeName(name);
    return this.db.list('exercises')().find((e) => e.nameNorm === norm);
  }

  /** Ejercicios cuyo nombre normalizado contiene el texto (para sugerir mientras se escribe). */
  suggestions(query: string, limit = 6): Row<'exercises'>[] {
    const norm = normalizeName(query);
    if (!norm) return [];
    return this.allItems()
      .map((e) => e.exercise)
      .filter((e) => e.nameNorm.includes(norm))
      .slice(0, limit);
  }

  /** Crea el ejercicio. Si el nombre ya existe lanza [ExerciseExistsError]: nunca se duplica. */
  create(d: ExerciseDraft): string {
    const existing = this.findByName(d.name);
    if (existing) throw new ExerciseExistsError(existing);
    const id = crypto.randomUUID();
    this.db.put('exercises', id, {
      name: cleanDisplayName(d.name),
      nameNorm: normalizeName(d.name),
      equipmentType: d.equipmentType,
      photo: d.photo,
      defaultRestSec: d.defaultRestSec,
      archived: false,
      createdAt: Date.now(),
    });
    this.setGroups(id, d.groupIds);
    return id;
  }

  update(id: string, d: ExerciseDraft, archived: boolean): void {
    const existing = this.findByName(d.name);
    if (existing && existing.id !== id) throw new ExerciseExistsError(existing);
    this.db.patch('exercises', id, {
      name: cleanDisplayName(d.name),
      nameNorm: normalizeName(d.name),
      equipmentType: d.equipmentType,
      photo: d.photo,
      defaultRestSec: d.defaultRestSec,
      archived,
    });
    this.setGroups(id, d.groupIds);
  }

  setArchived(id: string, archived: boolean): void {
    this.db.patch('exercises', id, { archived });
  }

  private setGroups(exerciseId: string, groupIds: ReadonlySet<string>): void {
    for (const l of this.db.list('exercise_muscle_groups')()) {
      if (l.exerciseId === exerciseId && !groupIds.has(l.muscleGroupId)) this.db.delete('exercise_muscle_groups', l.id);
    }
    for (const g of groupIds) {
      if (!this.db.get('exercise_muscle_groups', linkId(exerciseId, g))) {
        this.db.put('exercise_muscle_groups', linkId(exerciseId, g), { exerciseId, muscleGroupId: g });
      }
    }
  }
}

/** Reduce la imagen a un JPEG pequeño (data URL) para guardarla y sincronizarla con el ejercicio. */
export async function shrinkPhoto(file: File, max = 320, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}
