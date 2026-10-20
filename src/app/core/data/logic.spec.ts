import type { Row } from '../db/schema';
import { formatDuration, formatKg, supersetLabel } from '../utils/format';
import { normalizeName } from '../utils/normalize';
import type { SetRecord } from './models';
import { computeExerciseStats, describeSet, detectPrs, estimateOneRm } from './stats';
import { weekStart, weeklyProgress } from './weekly';
import { computeXp, levelForXp, xpForLevel, xpForSet } from './xp';

const repType = (measure: 'reps' | 'seconds' | 'cardio' = 'reps', countsForStats = true, name = 'Normal'): Row<'rep_types'> => ({
  id: `rt-${name}`,
  name,
  nameNorm: normalizeName(name),
  measure,
  countsForStats,
  isDefault: true,
  archived: false,
  position: 0,
});

let n = 0;
function rec(o: { session: string; start: number; weight?: number; reps?: number | null; secs?: number | null; type?: Row<'rep_types'>; ex?: string }): SetRecord {
  n++;
  return {
    set: {
      id: `s${n}`,
      sessionExerciseId: `se-${o.session}`,
      exerciseId: o.ex ?? 'ex',
      setNumber: n,
      repTypeId: (o.type ?? repType()).id,
      reps: o.reps === undefined ? 10 : o.reps,
      durationSec: o.secs ?? null,
      weightKg: o.weight ?? 0,
      createdAt: o.start + n,
      distanceKm: null,
      intensity: null,
      note: null,
    },
    repType: o.type ?? repType(),
    sessionId: o.session,
    sessionStart: o.start,
  };
}

describe('utilidades', () => {
  it('normaliza nombres sin tildes ni espacios de más', () => {
    expect(normalizeName('  Prensa  Pierná ')).toBe('prensa pierna');
    expect(normalizeName('Cuádriceps')).toBe('cuadriceps');
  });

  it('formatea pesos y duraciones como la app', () => {
    expect(formatKg(80)).toBe('80');
    expect(formatKg(82.5)).toBe('82.5');
    expect(formatKg(82.25)).toBe('82.25');
    expect(formatDuration(95)).toBe('1:35');
    expect(supersetLabel(2)).toBe('Biserie');
    expect(supersetLabel(4)).toBe('Circuito (4)');
  });
});

describe('estadísticas y récords', () => {
  it('estima el 1RM con Epley', () => {
    expect(estimateOneRm(100, 1)).toBe(100);
    expect(estimateOneRm(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimateOneRm(0, 10)).toBe(0);
  });

  it('describe la serie con su tipo', () => {
    expect(describeSet(rec({ session: 'a', start: 1, weight: 80, reps: 10 }))).toBe('80 kg × 10 reps');
    expect(describeSet(rec({ session: 'a', start: 1, weight: 0, secs: 45, reps: null, type: repType('seconds', true, 'Isométrica') }))).toBe(
      '45 s · Isométrica',
    );
  });

  it('solo hay récord si hay historial previo', () => {
    const first = rec({ session: 'a', start: 1, weight: 80 });
    expect(detectPrs(first, []).size).toBe(0);
    const next = rec({ session: 'b', start: 2, weight: 85 });
    expect([...detectPrs(next, [first])]).toEqual(['weight', 'oneRm']);
  });

  it('el calentamiento no cuenta para las métricas', () => {
    const warm = repType('reps', false, 'Calentamiento');
    const stats = computeExerciseStats([
      rec({ session: 'a', start: 1, weight: 200, type: warm }),
      rec({ session: 'a', start: 1, weight: 100, reps: 5 }),
    ]);
    expect(stats.maxWeight?.value).toBe(100);
    expect(stats.totalSets).toBe(2);
    expect(stats.points).toHaveLength(1);
  });
});

describe('XP', () => {
  it('calcula niveles con la misma curva', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
  });

  it('da XP por series, sesiones y un récord por ejercicio y sesión', () => {
    const sets = [
      rec({ session: 'a', start: 1, weight: 100, reps: 10 }), // 10 + 10
      rec({ session: 'b', start: 2, weight: 110, reps: 10 }), // 10 + 11 + récord
      rec({ session: 'b', start: 2, weight: 120, reps: 10 }), // 10 + 12 (mismo ejercicio y sesión: sin XP extra)
    ];
    expect(xpForSet(sets[0])).toBe(20);
    const sessions = [{ id: 'a' }, { id: 'b' }] as Row<'workout_sessions'>[];
    const xp = computeXp(sets, sessions, new Map([['ex', 'Press']]));
    expect(xp.prs).toHaveLength(2);
    expect(xp.totalXp).toBe(20 + 21 + 22 + 100 + 2 * 50);
  });
});

describe('avance semanal', () => {
  it('agrupa por semana empezando el lunes', () => {
    const wed = new Date(2026, 9, 21, 18).getTime(); // miércoles
    expect(new Date(weekStart(wed)).getDay()).toBe(1);
    const session = { id: 'a', startedAt: wed, finishedAt: wed + 45 * 60_000 } as Row<'workout_sessions'>;
    const weeks = weeklyProgress([rec({ session: 'a', start: wed })], [session], wed);
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)).toMatchObject({ sessions: 1, sets: 1, trainingMinutes: 45 });
  });
});
