import { normalizeName } from '../utils/normalize';
import type { MuscleGroup, RepMeasure, RepType, RoutineDay, TableName } from './schema';

/**
 * Datos base con UIDs fijos: así dos dispositivos que arrancan por separado no duplican
 * los catálogos al sincronizar. Se guardan con `updatedAt = 1` para que cualquier edición real gane.
 */
export const SEED_UPDATED_AT = 1;

export const BASE_MUSCLE_GROUPS = [
  'Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Antebrazo',
  'Cuádriceps', 'Femoral', 'Glúteo', 'Pantorrilla', 'Abdomen', 'Cardio',
];

/** [nombre, medida, cuenta para estadísticas] */
export const BASE_REP_TYPES: [string, RepMeasure, boolean][] = [
  ['Normal', 'reps', true],
  ['Lenta', 'reps', true],
  ['Isométrica', 'seconds', true],
  ['Parcial', 'reps', true],
  ['Negativa', 'reps', true],
  ['Al fallo', 'reps', true],
  ['Dropset', 'reps', true],
  ['Calentamiento', 'reps', false],
  ['Escalera', 'reps', true],
];

/** Tipo interno para las entradas de cardio (no aparece en los selectores de fuerza). */
export const CARDIO_REP_TYPE = 'Cardio';

const slug = (name: string) => normalizeName(name).replace(/ /g, '-');

export const muscleGroupUid = (name: string) => `mg-${slug(name)}`;
export const repTypeUid = (name: string) => `rt-${slug(name)}`;
export const routineDayUid = (weekday: number) => `rd-${weekday}`;
export const CARDIO_REP_TYPE_ID = repTypeUid(CARDIO_REP_TYPE);

export function seedRecords(): { table: TableName; id: string; data: object }[] {
  const out: { table: TableName; id: string; data: object }[] = [];
  for (const name of BASE_MUSCLE_GROUPS) {
    const data: MuscleGroup = { name, nameNorm: normalizeName(name), isDefault: true, archived: false };
    out.push({ table: 'muscle_groups', id: muscleGroupUid(name), data });
  }
  BASE_REP_TYPES.forEach(([name, measure, countsForStats], position) => {
    const data: RepType = { name, nameNorm: normalizeName(name), measure, countsForStats, isDefault: true, archived: false, position };
    out.push({ table: 'rep_types', id: repTypeUid(name), data });
  });
  const cardio: RepType = {
    name: CARDIO_REP_TYPE,
    nameNorm: normalizeName(CARDIO_REP_TYPE),
    measure: 'cardio',
    countsForStats: true,
    isDefault: true,
    archived: false,
    position: 100,
  };
  out.push({ table: 'rep_types', id: CARDIO_REP_TYPE_ID, data: cardio });
  for (let weekday = 1; weekday <= 7; weekday++) {
    const data: RoutineDay = { weekday, name: null };
    out.push({ table: 'routine_days', id: routineDayUid(weekday), data });
  }
  return out;
}
