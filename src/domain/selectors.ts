import type { AppData, Exercise, Routine, Workout } from './types';

/** Active (non-soft-deleted) exercises for pickers, in stored order. */
export function listExercises(
  data: AppData,
  options?: { includeDeleted?: boolean },
): Exercise[] {
  return data.exercises.filter(
    (exercise) => options?.includeDeleted || !exercise.deletedAt,
  );
}

/** Resolves an exercise by ID, including soft-deleted ones. */
export function getExercise(
  data: AppData,
  exerciseId: string,
): Exercise | undefined {
  return data.exercises.find((e) => e.exerciseId === exerciseId);
}

export function listRoutines(data: AppData): Routine[] {
  return data.routines;
}

/** The single in-progress workout, if one exists. */
export function getActiveWorkout(data: AppData): Workout | undefined {
  return data.workouts.find((w) => w.status === 'active');
}

/** Elapsed workout time in whole seconds (uses completedAt when finished). */
export function workoutDurationSeconds(
  workout: Workout,
  now: Date = new Date(),
): number {
  const end = workout.completedAt ? new Date(workout.completedAt) : now;
  const seconds = Math.floor(
    (end.getTime() - new Date(workout.startedAt).getTime()) / 1000,
  );
  return Math.max(0, seconds);
}
