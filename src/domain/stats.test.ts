import { describe, expect, it } from 'vitest';

import { createInitialDocument } from './initialDocument';
import {
  completedWorkouts,
  epley1RM,
  exerciseHistory,
  groupWorkoutsByDate,
  personalRecords,
  userStats,
} from './stats';
import type { AppData, Workout, WorkoutSet } from './types';
import { deleteWorkout } from './workouts';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    setId: nextId('set'),
    type: 'normal',
    completed: true,
    ...overrides,
  };
}

interface WorkoutOptions {
  workoutId?: string;
  name?: string;
  startedAt?: string;
  completedLocalDate?: string;
  status?: 'active' | 'completed';
  exerciseId?: string;
  sets?: WorkoutSet[];
}

function makeWorkout(options: WorkoutOptions = {}): Workout {
  const startedAt = options.startedAt ?? '2026-01-01T10:00:00.000Z';
  const status = options.status ?? 'completed';
  const completed = status === 'completed';
  return {
    workoutId: options.workoutId ?? nextId('wo'),
    name: options.name ?? 'Workout',
    startedAt,
    status,
    exercises: [
      {
        exerciseId: options.exerciseId ?? 'bench-press',
        name: 'Bench Press',
        order: 0,
        sets: options.sets ?? [makeSet({ reps: 5, weightKg: 100 })],
      },
    ],
    createdAt: startedAt,
    updatedAt: startedAt,
    ...(completed
      ? {
          completedAt: '2026-01-01T11:00:00.000Z',
          completedLocalDate: options.completedLocalDate ?? '2026-01-01',
        }
      : {}),
  };
}

function docWith(workouts: Workout[]): AppData {
  const doc = createInitialDocument();
  doc.workouts = workouts;
  return doc;
}

describe('history selection and ordering', () => {
  it('returns only completed workouts, newest start first', () => {
    const older = makeWorkout({ startedAt: '2026-01-01T08:00:00.000Z' });
    const newer = makeWorkout({ startedAt: '2026-01-03T08:00:00.000Z' });
    const active = makeWorkout({
      startedAt: '2026-01-05T08:00:00.000Z',
      status: 'active',
    });
    const doc = docWith([older, active, newer]);

    const result = completedWorkouts(doc);
    expect(result.map((w) => w.workoutId)).toEqual([
      newer.workoutId,
      older.workoutId,
    ]);
  });

  it('groups by local completion date, newest first', () => {
    const w1 = makeWorkout({ completedLocalDate: '2026-01-02' });
    const w2 = makeWorkout({ completedLocalDate: '2026-01-02' });
    const w3 = makeWorkout({ completedLocalDate: '2026-01-05' });
    const groups = groupWorkoutsByDate(docWith([w1, w2, w3]));

    expect(groups.map((g) => g.localDate)).toEqual([
      '2026-01-05',
      '2026-01-02',
    ]);
    expect(groups[1]?.workouts).toHaveLength(2);
  });

  it('exercise history contains only workouts with that exercise', () => {
    const withExercise = makeWorkout({ exerciseId: 'bench-press' });
    const other = makeWorkout({ exerciseId: 'squat' });
    const doc = docWith([withExercise, other]);

    expect(exerciseHistory(doc, 'bench-press').map((w) => w.workoutId)).toEqual(
      [withExercise.workoutId],
    );
    expect(exerciseHistory(doc, 'squat')).toHaveLength(1);
    expect(exerciseHistory(doc, 'deadlift')).toHaveLength(0);
  });
});

describe('personal records', () => {
  it('heaviest weight picks the greatest qualifying set', () => {
    const light = makeWorkout({
      sets: [makeSet({ reps: 5, weightKg: 80 })],
    });
    const heavy = makeWorkout({
      startedAt: '2026-01-02T10:00:00.000Z',
      sets: [makeSet({ reps: 3, weightKg: 120 })],
    });
    const doc = docWith([light, heavy]);
    const records = personalRecords(doc, 'bench-press');

    expect(records.heaviestWeight?.value).toBe(120);
    expect(records.heaviestWeight?.workoutId).toBe(heavy.workoutId);
  });

  it('excludes warm-up sets and incomplete sets', () => {
    const workout = makeWorkout({
      sets: [
        makeSet({ type: 'warmup', reps: 10, weightKg: 200 }),
        makeSet({ completed: false, reps: 10, weightKg: 200 }),
        makeSet({ reps: 5, weightKg: 100 }),
      ],
    });
    const records = personalRecords(docWith([workout]), 'bench-press');
    expect(records.heaviestWeight?.value).toBe(100);
  });

  it('Epley 1RM applies only to sets of 1-12 reps', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 2);
    expect(epley1RM(100, 1)).toBeCloseTo(103.333, 2);

    const twelve = makeWorkout({
      sets: [makeSet({ reps: 12, weightKg: 100 })], // 1RM = 140
    });
    const thirteen = makeWorkout({
      startedAt: '2026-01-02T10:00:00.000Z',
      sets: [makeSet({ reps: 13, weightKg: 200 })], // excluded from 1RM
    });
    const doc = docWith([twelve, thirteen]);
    const records = personalRecords(doc, 'bench-press');

    // 200kg x 13 is heaviest but must not win estimated 1RM.
    expect(records.heaviestWeight?.value).toBe(200);
    expect(records.bestEstimated1RM?.value).toBeCloseTo(140, 5);
    expect(records.bestEstimated1RM?.reps).toBe(12);
  });

  it('bodyweight record uses sets with no weight', () => {
    const workout = makeWorkout({
      exerciseId: 'pull-up',
      sets: [
        makeSet({ reps: 8 }),
        makeSet({ reps: 12 }),
        makeSet({ reps: 5, weightKg: 20 }), // weighted: not bodyweight
      ],
    });
    const records = personalRecords(docWith([workout]), 'pull-up');
    expect(records.mostRepsBodyweight?.value).toBe(12);
    expect(records.mostRepsBodyweight?.reps).toBe(12);
  });
});

describe('userStats', () => {
  // "Today" is Jan 9 so a last workout on Jan 8 counts as yesterday.
  const today = new Date(2026, 0, 9); // Jan 9 2026 local

  it('returns zeros for an empty history', () => {
    const stats = userStats(docWith([]), today);
    expect(stats).toEqual({
      totalWorkouts: 0,
      lastWorkoutLocalDate: undefined,
      currentStreakDays: 0,
    });
  });

  it('counts total workouts and last date', () => {
    const doc = docWith([
      makeWorkout({ completedLocalDate: '2026-01-05' }),
      makeWorkout({ completedLocalDate: '2026-01-08' }),
      makeWorkout({ completedLocalDate: '2026-01-08' }), // same day
    ]);
    const stats = userStats(doc, today);
    expect(stats.totalWorkouts).toBe(3);
    expect(stats.lastWorkoutLocalDate).toBe('2026-01-08');
    expect(stats.currentStreakDays).toBe(1); // Jan 8 only; Jan 7 missing
  });

  it('counts consecutive-day streaks', () => {
    const doc = docWith([
      makeWorkout({ completedLocalDate: '2026-01-06' }),
      makeWorkout({ completedLocalDate: '2026-01-07' }),
      makeWorkout({ completedLocalDate: '2026-01-08' }),
      makeWorkout({ completedLocalDate: '2026-01-08' }), // same day again
    ]);
    const stats = userStats(doc, today);
    expect(stats.currentStreakDays).toBe(3);
  });

  it('same-day and backdated workouts do not extend the streak', () => {
    const doc = docWith([
      makeWorkout({ completedLocalDate: '2026-01-08' }),
      makeWorkout({ completedLocalDate: '2026-01-03' }), // backdated gap
    ]);
    const stats = userStats(doc, today);
    expect(stats.lastWorkoutLocalDate).toBe('2026-01-08');
    expect(stats.currentStreakDays).toBe(1);
  });

  it('stale streak displays as zero when last workout is older than yesterday', () => {
    const doc = docWith([
      makeWorkout({ completedLocalDate: '2026-01-05' }),
      makeWorkout({ completedLocalDate: '2026-01-06' }),
    ]);
    const stats = userStats(doc, today); // today Jan 10 -> last Jan 6 is stale
    expect(stats.lastWorkoutLocalDate).toBe('2026-01-06');
    expect(stats.currentStreakDays).toBe(0);
  });

  it('streak of 1 counts when last workout is today or yesterday', () => {
    const doc = docWith([makeWorkout({ completedLocalDate: '2026-01-09' })]);
    const stats = userStats(doc, today);
    expect(stats.currentStreakDays).toBe(1);
  });
});

describe('workout deletion', () => {
  it('removes the workout and derived stats/history update', () => {
    const keep = makeWorkout({
      workoutId: 'keep',
      completedLocalDate: '2026-01-08',
    });
    const remove = makeWorkout({
      workoutId: 'remove',
      exerciseId: 'squat',
      completedLocalDate: '2026-01-09',
    });
    const doc = docWith([keep, remove]);

    expect(userStats(doc, new Date(2026, 0, 10)).lastWorkoutLocalDate).toBe(
      '2026-01-09',
    );
    expect(exerciseHistory(doc, 'squat')).toHaveLength(1);

    deleteWorkout(doc, 'remove');

    const stats = userStats(doc, new Date(2026, 0, 10));
    expect(stats.totalWorkouts).toBe(1);
    expect(stats.lastWorkoutLocalDate).toBe('2026-01-08');
    expect(exerciseHistory(doc, 'squat')).toHaveLength(0);
    expect(completedWorkouts(doc).map((w) => w.workoutId)).toEqual(['keep']);
  });

  it('refuses to delete an active workout via deleteWorkout', () => {
    const active = makeWorkout({ status: 'active' });
    const doc = docWith([active]);
    expect(() => deleteWorkout(doc, active.workoutId)).toThrow('is not active');
  });
});
