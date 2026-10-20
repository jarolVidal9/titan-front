import { TestBed } from '@angular/core/testing';
import { LocalDb } from '../db/local-db';
import { CARDIO_REP_TYPE_ID, repTypeUid } from '../db/seed';
import { ExerciseRepo } from './exercise.repo';
import { sessionBlocks } from './models';
import { WorkoutRepo } from './workout.repo';

/** LocalDb sin IndexedDB (en jsdom no existe): todo vive en memoria y se puede probar igual. */
async function setup() {
  const db = TestBed.inject(LocalDb);
  await db.init(); // siembra los catÃ¡logos base
  const exercises = TestBed.inject(ExerciseRepo);
  const workout = TestBed.inject(WorkoutRepo);
  const ex = (name: string) => exercises.create({ name, equipmentType: 'libre', groupIds: new Set(), photo: null, defaultRestSec: null });
  return { db, workout, exercises, ex };
}

const values = { repTypeId: repTypeUid('Normal'), reps: 10, durationSec: null, weightKg: 50, distanceKm: null, intensity: null, note: null };

describe('WorkoutRepo', () => {
  it('no duplica ejercicios en la biblioteca', async () => {
    const { ex } = await setup();
    ex('Press banca');
    expect(() => ex('press  BANCA')).toThrowError(/Ya existe/);
  });

  it('registra series numeradas y renumera al borrar', async () => {
    const { workout, ex } = await setup();
    const press = ex('Press');
    const session = workout.startSession({ groupIds: [], exerciseIds: [press] });
    const se = workout.session(session)!.exercises[0].sessionExercise.id;
    workout.addSet(se, press, values);
    workout.addSet(se, press, { ...values, weightKg: 60 });
    workout.addSet(se, press, { ...values, weightKg: 70 });
    const sets = () => workout.session(session)!.exercises[0].sets;
    expect(sets().map((r) => r.set.setNumber)).toEqual([1, 2, 3]);
    workout.deleteSet(sets()[0].set);
    expect(sets().map((r) => [r.set.setNumber, r.set.weightKg])).toEqual([
      [1, 60],
      [2, 70],
    ]);
  });

  it('arma biseries desde la plantilla, suma ejercicios y las deshace si quedan solas', async () => {
    const { workout, ex } = await setup();
    const [a, b, c] = [ex('A'), ex('B'), ex('C')];
    const id = workout.startSession({ groupIds: [], exerciseIds: [a, b, c], supersetGroups: ['1', '1', null] });
    const view = () => workout.session(id)!;
    const blocks = () => sessionBlocks(view()).map((bl) => bl.length);
    const se = (i: number) => view().exercises[i].sessionExercise.id;
    expect(blocks()).toEqual([2, 1]);
    // Unir C con A lo suma a la biserie que A ya tenÃ­a: triserie.
    workout.linkSuperset(id, [se(0), se(2)]);
    expect(blocks()).toEqual([3]);
    workout.unlinkSuperset(se(2));
    expect(blocks()).toEqual([2, 1]);
    // Si queda un solo ejercicio, la biserie se deshace.
    workout.unlinkSuperset(se(1));
    expect(view().exercises.every((e) => e.sessionExercise.supersetGroup === null)).toBe(true);
  });

  it('una sesiÃ³n registrada despuÃ©s pone las series dentro de la sesiÃ³n', async () => {
    const { workout, ex } = await setup();
    const press = ex('Press');
    const start = Date.now() - 3 * 24 * 3600_000;
    const id = workout.startSession({ groupIds: [], exerciseIds: [press], startedAt: start, retroactive: true });
    const se = workout.session(id)!.exercises[0].sessionExercise.id;
    workout.addSet(se, press, values);
    workout.addSet(se, press, values);
    const times = workout.session(id)!.exercises[0].sets.map((r) => r.set.createdAt - start);
    expect(times).toEqual([2 * 60_000, 4 * 60_000]);
    workout.finishSession(id);
    expect(workout.session(id)!.session.finishedAt! - start).toBe(6 * 60_000);
  });

  it('al borrar la sesiÃ³n borra en cascada (y deja borrados para sincronizar)', async () => {
    const { db, workout, ex } = await setup();
    const press = ex('Press');
    const id = workout.startSession({ groupIds: ['mg-pecho'], exerciseIds: [press] });
    const se = workout.session(id)!.exercises[0].sessionExercise.id;
    workout.addSet(se, press, values);
    db.ackPushed(db.pendingChanges(1000));
    workout.deleteSession(id);
    expect(workout.session(id)).toBeNull();
    expect(db.list('workout_sets')()).toHaveLength(0);
    const deleted = db.pendingChanges(1000).filter((c) => c.deleted).map((c) => c.table).sort();
    expect(deleted).toEqual(['session_exercises', 'session_muscle_groups', 'workout_sessions', 'workout_sets']);
  });

  it('el tipo de cardio existe desde la siembra', async () => {
    const { db } = await setup();
    expect(db.get('rep_types', CARDIO_REP_TYPE_ID)?.measure).toBe('cardio');
  });
});

describe('LocalDb Â· sincronizaciÃ³n', () => {
  it('aplica lo remoto solo si es mÃ¡s nuevo (last-write-wins)', async () => {
    const { db } = await setup();
    db.patch('muscle_groups', 'mg-pecho', { name: 'Pecho local' });
    const local = db.pendingChanges(1000).find((c) => c.uid === 'mg-pecho')!;
    const older = { ...local, data: { ...(local.data as object), name: 'Viejo' }, updatedAt: local.updatedAt - 1 };
    expect(db.applyRemote([older])).toBe(0);
    expect(db.get('muscle_groups', 'mg-pecho')?.name).toBe('Pecho local');

    const newer = { ...local, data: { ...(local.data as object), name: 'Pecho remoto' }, updatedAt: local.updatedAt + 1 };
    expect(db.applyRemote([newer])).toBe(1);
    expect(db.get('muscle_groups', 'mg-pecho')?.name).toBe('Pecho remoto');
    // Lo remoto ganÃ³: ya no queda pendiente de subir.
    expect(db.pendingChanges(1000).some((c) => c.uid === 'mg-pecho')).toBe(false);
  });

  it('los catÃ¡logos base no pisan ediciones reales de otro dispositivo', async () => {
    const { db } = await setup();
    const seed = db.pendingChanges(1000).find((c) => c.uid === 'mg-espalda')!;
    expect(seed.updatedAt).toBe(1);
    db.applyRemote([{ ...seed, data: { ...(seed.data as object), name: 'Dorsal' }, updatedAt: 5000 }]);
    expect(db.get('muscle_groups', 'mg-espalda')?.name).toBe('Dorsal');
  });

  it('no marca como subido lo que se volviÃ³ a editar durante la llamada', async () => {
    const { db } = await setup();
    db.patch('muscle_groups', 'mg-pecho', { name: 'Uno' });
    const pushed = db.pendingChanges(1000);
    db.patch('muscle_groups', 'mg-pecho', { name: 'Dos' });
    db.ackPushed(pushed);
    expect(db.pendingChanges(1000).map((c) => c.uid)).toEqual(['mg-pecho']);
  });
});
