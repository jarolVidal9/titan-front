import { Injectable, computed, inject } from '@angular/core';
import { LocalDb } from '../db/local-db';
import type { RepMeasure, Row } from '../db/schema';
import { BASE_MUSCLE_GROUPS, CARDIO_REP_TYPE_ID, muscleGroupUid } from '../db/seed';
import { cleanDisplayName, normalizeName } from '../utils/normalize';

export class DuplicateNameError extends Error {
  constructor(readonly existingName: string) {
    super(`Ya existe "${existingName}"`);
  }
}

/** Por UID: un grupo base renombrado conserva su lugar. */
const baseOrder = new Map(BASE_MUSCLE_GROUPS.map((n, i) => [muscleGroupUid(n), i]));

/** Grupos musculares y tipos de repetición: listas base + propias, sin duplicados. */
@Injectable({ providedIn: 'root' })
export class CatalogRepo {
  private readonly db = inject(LocalDb);

  /** Los base primero (en su orden), luego los propios por nombre. */
  readonly allMuscleGroups = computed(() =>
    [...this.db.list('muscle_groups')()].sort((a, b) => {
      const ia = baseOrder.get(a.id) ?? 999;
      const ib = baseOrder.get(b.id) ?? 999;
      return ia - ib || a.nameNorm.localeCompare(b.nameNorm);
    }),
  );
  readonly muscleGroups = computed(() => this.allMuscleGroups().filter((g) => !g.archived));
  readonly groupNames = computed(() => new Map(this.allMuscleGroups().map((g) => [g.id, g.name])));

  /** El tipo interno de cardio no es un tipo de repetición elegible. */
  readonly allRepTypes = computed(() =>
    this.db
      .list('rep_types')()
      .filter((t) => t.measure !== 'cardio')
      .sort((a, b) => a.position - b.position || a.nameNorm.localeCompare(b.nameNorm)),
  );
  readonly repTypes = computed(() => this.allRepTypes().filter((t) => !t.archived));

  // ---------- Grupos musculares ----------

  /** Devuelve el grupo existente si el nombre normalizado ya existe (y lo desarchiva). */
  findOrCreateMuscleGroup(name: string): Row<'muscle_groups'> {
    const nameNorm = normalizeName(name);
    const existing = this.db.list('muscle_groups')().find((g) => g.nameNorm === nameNorm);
    if (existing) {
      if (existing.archived) this.db.patch('muscle_groups', existing.id, { archived: false });
      return { ...existing, archived: false };
    }
    return this.db.put('muscle_groups', crypto.randomUUID(), {
      name: cleanDisplayName(name),
      nameNorm,
      isDefault: false,
      archived: false,
    });
  }

  renameMuscleGroup(id: string, name: string): void {
    const nameNorm = normalizeName(name);
    const clash = this.db.list('muscle_groups')().find((g) => g.nameNorm === nameNorm && g.id !== id);
    if (clash) throw new DuplicateNameError(clash.name);
    this.db.patch('muscle_groups', id, { name: cleanDisplayName(name), nameNorm });
  }

  setMuscleGroupArchived(id: string, archived: boolean): void {
    this.db.patch('muscle_groups', id, { archived });
  }

  // ---------- Tipos de repetición ----------

  cardioRepType(): Row<'rep_types'> {
    return (
      this.db.get('rep_types', CARDIO_REP_TYPE_ID) ??
      this.db.list('rep_types')().find((t) => t.measure === 'cardio') ??
      this.findOrCreateRepType('Cardio', 'cardio')
    );
  }

  findOrCreateRepType(name: string, measure: RepMeasure, countsForStats = true): Row<'rep_types'> {
    const nameNorm = normalizeName(name);
    const all = this.db.list('rep_types')();
    const existing = all.find((t) => t.nameNorm === nameNorm);
    if (existing) {
      if (existing.archived) this.db.patch('rep_types', existing.id, { archived: false });
      return { ...existing, archived: false };
    }
    const maxPos = Math.max(0, ...all.filter((t) => t.measure !== 'cardio').map((t) => t.position));
    return this.db.put('rep_types', crypto.randomUUID(), {
      name: cleanDisplayName(name),
      nameNorm,
      measure,
      countsForStats,
      isDefault: false,
      archived: false,
      position: maxPos + 1,
    });
  }

  updateRepType(id: string, name: string, countsForStats: boolean): void {
    const nameNorm = normalizeName(name);
    const clash = this.db.list('rep_types')().find((t) => t.nameNorm === nameNorm && t.id !== id);
    if (clash) throw new DuplicateNameError(clash.name);
    this.db.patch('rep_types', id, { name: cleanDisplayName(name), nameNorm, countsForStats });
  }

  setRepTypeArchived(id: string, archived: boolean): void {
    this.db.patch('rep_types', id, { archived });
  }
}
