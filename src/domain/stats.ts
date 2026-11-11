import type { AppData, Workout, WorkoutExercise, WorkoutSet } from './types';

/** Completed workouts sorted by start time, newest first. */
export function completedWorkouts(data: AppData): Workout[] {
  return data.workouts
    .filter((w) => w.status === 'completed')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export interface WorkoutDayGroup {
  /** Local completion date, YYYY-MM-DD. */
  localDate: string;
  workouts: Workout[];
}

/** Groups completed workouts by local completion date, newest first. */
export function groupWorkoutsByDate(data: AppData): WorkoutDayGroup[] {
  const groups = new Map<string, Workout[]>();
  for (const workout of completedWorkouts(data)) {
    const key = workout.completedLocalDate ?? '';
    const list = groups.get(key);
    if (list) {
      list.push(workout);
    } else {
      groups.set(key, [workout]);
    }
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([localDate, workouts]) => ({ localDate, workouts }));
}

/** Completed workouts containing the exercise, newest first. */
export function exerciseHistory(data: AppData, exerciseId: string): Workout[] {
  return completedWorkouts(data).filter((workout) =>
    workout.exercises.some((e) => e.exerciseId === exerciseId),
  );
}

export interface UserStats {
  totalWorkouts: number;
  lastWorkoutLocalDate?: string;
  currentStreakDays: number;
}

function parseLocalDate(localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Headline statistics derived from completed workouts.
 *
 * Streak counts consecutive local calendar days with at least one
 * completed workout, ending at the most recent workout date. The
 * displayed streak is zero when the last workout is older than
 * yesterday (stale-streak rule applied at read time).
 */
export function userStats(data: AppData, today: Date = new Date()): UserStats {
  const completed = completedWorkouts(data);
  const dates = new Set(
    completed
      .map((w) => w.completedLocalDate)
      .filter((d): d is string => d !== undefined),
  );

  let lastWorkoutLocalDate: string | undefined;
  for (const date of dates) {
    if (!lastWorkoutLocalDate || date > lastWorkoutLocalDate) {
      lastWorkoutLocalDate = date;
    }
  }

  let streak = 0;
  if (lastWorkoutLocalDate) {
    const yesterdayKey = toLocalDateKey(addDays(today, -1));
    if (lastWorkoutLocalDate >= yesterdayKey) {
      let cursor = parseLocalDate(lastWorkoutLocalDate);
      while (dates.has(toLocalDateKey(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
      }
    }
  }

  return {
    totalWorkouts: completed.length,
    lastWorkoutLocalDate,
    currentStreakDays: streak,
  };
}

export interface PersonalRecord {
  workoutId: string;
  exerciseId: string;
  setId: string;
  /** Local completion date of the workout the record came from. */
  localDate: string;
  startedAt: string;
  weightKg?: number;
  reps?: number;
  /** kg for weight/1RM records, reps for the bodyweight record. */
  value: number;
}

export interface ExercisePersonalRecords {
  heaviestWeight?: PersonalRecord;
  bestEstimated1RM?: PersonalRecord;
  mostRepsBodyweight?: PersonalRecord;
}

const EPLEY_MAX_REPS = 12;

interface ScoredSet {
  workout: Workout;
  exercise: WorkoutExercise;
  set: WorkoutSet;
}

function scoredSets(data: AppData, exerciseId: string): ScoredSet[] {
  const result: ScoredSet[] = [];
  for (const workout of completedWorkouts(data)) {
    for (const exercise of workout.exercises) {
      if (exercise.exerciseId !== exerciseId) {
        continue;
      }
      for (const set of exercise.sets) {
        if (set.completed && set.type !== 'warmup') {
          result.push({ workout, exercise, set });
        }
      }
    }
  }
  return result;
}

function toRecord(entry: ScoredSet, value: number): PersonalRecord {
  return {
    workoutId: entry.workout.workoutId,
    exerciseId: entry.exercise.exerciseId,
    setId: entry.set.setId,
    localDate: entry.workout.completedLocalDate ?? '',
    startedAt: entry.workout.startedAt,
    ...(entry.set.weightKg !== undefined
      ? { weightKg: entry.set.weightKg }
      : {}),
    ...(entry.set.reps !== undefined ? { reps: entry.set.reps } : {}),
    value,
  };
}

function better(current: PersonalRecord | undefined, next: PersonalRecord) {
  return !current || next.value > current.value ? next : current;
}

/** Epley estimated 1RM: weight * (1 + reps / 30). */
export function epley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/**
 * Personal records for an exercise from completed, non-warm-up sets:
 * heaviest weight, best Epley 1RM (1-12 reps), most bodyweight reps.
 */
export function personalRecords(
  data: AppData,
  exerciseId: string,
): ExercisePersonalRecords {
  const records: ExercisePersonalRecords = {};
  for (const entry of scoredSets(data, exerciseId)) {
    const { set } = entry;
    const hasWeight =
      set.weightKg !== undefined && set.weightKg > 0 && set.reps !== undefined;
    const hasReps = set.reps !== undefined && set.reps >= 1;

    if (hasWeight && hasReps) {
      records.heaviestWeight = better(
        records.heaviestWeight,
        toRecord(entry, set.weightKg as number),
      );
      if (set.reps !== undefined && set.reps <= EPLEY_MAX_REPS) {
        records.bestEstimated1RM = better(
          records.bestEstimated1RM,
          toRecord(entry, epley1RM(set.weightKg as number, set.reps)),
        );
      }
    }

    if (set.weightKg === undefined && set.reps !== undefined) {
      records.mostRepsBodyweight = better(
        records.mostRepsBodyweight,
        toRecord(entry, set.reps),
      );
    }
  }
  return records;
}
