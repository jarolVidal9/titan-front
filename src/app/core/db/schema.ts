/**
 * Formato de los registros que se guardan localmente y viajan por `POST /sync`.
 * Es el contrato compartido con la app Flutter: las tablas son las mismas (en snake_case),
 * los ids son UIDs (texto) y las fechas, ms epoch.
 */

export type EquipmentType = 'maquina' | 'libre' | 'corporal' | 'cardio';

/** `cardio`: tiempo + distancia/velocidad opcionales, sin descanso ni récords de fuerza. */
export type RepMeasure = 'reps' | 'seconds' | 'cardio';

export interface MuscleGroup {
  name: string;
  nameNorm: string;
  isDefault: boolean;
  archived: boolean;
}

export interface Exercise {
  name: string;
  nameNorm: string;
  equipmentType: EquipmentType;
  /** Foto reducida como data URL (JPEG), para que se sincronice con el registro. */
  photo: string | null;
  defaultRestSec: number | null;
  archived: boolean;
  createdAt: number;
}

export interface ExerciseMuscleGroup {
  exerciseId: string;
  muscleGroupId: string;
}

export interface RepType {
  name: string;
  nameNorm: string;
  measure: RepMeasure;
  countsForStats: boolean;
  isDefault: boolean;
  archived: boolean;
  position: number;
}

export interface RoutineDay {
  weekday: number; // 1 = lunes ... 7 = domingo
  name: string | null;
}

export interface RoutineDayMuscleGroup {
  routineDayId: string;
  muscleGroupId: string;
}

export interface RoutineDayExercise {
  routineDayId: string;
  exerciseId: string;
  position: number;
  /** Ejercicios con el mismo grupo forman una biserie/triserie/circuito. */
  supersetGroup: string | null;
}

export interface WorkoutSession {
  startedAt: number;
  finishedAt: number | null;
  routineDayId: string | null;
  notes: string | null;
  /** Registrada después (no en vivo): sin temporizador y con horas dentro de la sesión. */
  retroactive: boolean;
}

export interface SessionMuscleGroup {
  sessionId: string;
  muscleGroupId: string;
}

export interface SessionExercise {
  sessionId: string;
  exerciseId: string;
  position: number;
  supersetGroup: string | null;
}

export interface WorkoutSet {
  sessionExerciseId: string;
  exerciseId: string;
  setNumber: number;
  repTypeId: string;
  reps: number | null;
  durationSec: number | null;
  weightKg: number;
  createdAt: number;
  distanceKm: number | null;
  intensity: number | null; // velocidad (km/h) o nivel de la máquina
  note: string | null;
}

export interface Setting {
  value: string;
}

export interface Tables {
  muscle_groups: MuscleGroup;
  exercises: Exercise;
  exercise_muscle_groups: ExerciseMuscleGroup;
  rep_types: RepType;
  routine_days: RoutineDay;
  routine_day_muscle_groups: RoutineDayMuscleGroup;
  routine_day_exercises: RoutineDayExercise;
  workout_sessions: WorkoutSession;
  session_muscle_groups: SessionMuscleGroup;
  session_exercises: SessionExercise;
  workout_sets: WorkoutSet;
  settings: Setting;
}

export type TableName = keyof Tables;

export const TABLES: readonly TableName[] = [
  'muscle_groups',
  'exercises',
  'exercise_muscle_groups',
  'rep_types',
  'routine_days',
  'routine_day_muscle_groups',
  'routine_day_exercises',
  'workout_sessions',
  'session_muscle_groups',
  'session_exercises',
  'workout_sets',
  'settings',
];

/** Una fila con su UID. */
export type Row<T extends TableName> = Tables[T] & { readonly id: string };

/** Lo que viaja por `/sync` y se guarda en IndexedDB. */
export interface SyncRecord {
  table: TableName;
  uid: string;
  data: unknown;
  updatedAt: number;
  deleted: boolean;
}
