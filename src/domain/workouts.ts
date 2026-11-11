import {
  ActiveWorkoutExistsError,
  ExerciseAlreadyInWorkoutError,
  ExerciseNotFoundError,
  ExerciseNotSelectableError,
  RoutineNotFoundError,
  WorkoutNotActiveError,
  WorkoutNotFoundError,
} from './errors';
import { newId } from './id';
import type {
  AppData,
  SetType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';

export const DEFAULT_WORKOUT_NAME = 'Workout';

function findWorkout(draft: AppData, workoutId: string): Workout {
  const workout = draft.workouts.find((w) => w.workoutId === workoutId);
  if (!workout) {
    throw new WorkoutNotFoundError(workoutId);
  }
  return workout;
}

function requireActiveWorkout(draft: AppData, workoutId: string): Workout {
  const workout = findWorkout(draft, workoutId);
  if (workout.status !== 'active') {
    throw new WorkoutNotActiveError(workoutId);
  }
  return workout;
}

function assertNoActiveWorkout(draft: AppData): void {
  if (draft.workouts.some((w) => w.status === 'active')) {
    throw new ActiveWorkoutExistsError();
  }
}

function emptySet(reps?: number): WorkoutSet {
  return {
    setId: newId(),
    type: 'normal',
    completed: false,
    ...(reps !== undefined ? { reps } : {}),
  };
}

function snapshotName(draft: AppData, exerciseId: string): string {
  return (
    draft.exercises.find((e) => e.exerciseId === exerciseId)?.name ??
    'Unknown exercise'
  );
}

/** Formats a Date as YYYY-MM-DD in the device's local timezone. */
export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Starts a blank active workout. */
export function startBlankWorkout(
  draft: AppData,
  name: string | undefined,
  now: string,
): Workout {
  assertNoActiveWorkout(draft);
  const workout: Workout = {
    workoutId: newId(),
    name: name?.trim() || DEFAULT_WORKOUT_NAME,
    startedAt: now,
    status: 'active',
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
  draft.workouts.push(workout);
  return workout;
}

/** Converts a routine into a new active workout, snapshotting names. */
export function startWorkoutFromRoutine(
  draft: AppData,
  routineId: string,
  now: string,
): Workout {
  assertNoActiveWorkout(draft);
  const routine = draft.routines.find((r) => r.routineId === routineId);
  if (!routine) {
    throw new RoutineNotFoundError(routineId);
  }

  const exercises: WorkoutExercise[] = [...routine.exercises]
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => ({
      exerciseId: entry.exerciseId,
      name: snapshotName(draft, entry.exerciseId),
      order: index,
      sets: entry.sets.map((target) => {
        const set = emptySet(target.reps);
        if (target.weightKg !== undefined) {
          set.weightKg = target.weightKg;
        }
        return set;
      }),
    }));

  const workout: Workout = {
    workoutId: newId(),
    routineId: routine.routineId,
    name: routine.name,
    startedAt: now,
    status: 'active',
    exercises,
    createdAt: now,
    updatedAt: now,
  };
  draft.workouts.push(workout);
  return workout;
}

/** Adds an exercise (with one empty set) to an active workout. */
export function addExerciseToWorkout(
  draft: AppData,
  workoutId: string,
  exerciseId: string,
  now: string,
): WorkoutExercise {
  const workout = requireActiveWorkout(draft, workoutId);
  const exercise = draft.exercises.find((e) => e.exerciseId === exerciseId);
  if (!exercise) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  if (exercise.deletedAt) {
    throw new ExerciseNotSelectableError(exerciseId);
  }
  if (workout.exercises.some((e) => e.exerciseId === exerciseId)) {
    throw new ExerciseAlreadyInWorkoutError(exerciseId);
  }

  const entry: WorkoutExercise = {
    exerciseId,
    name: exercise.name,
    order: workout.exercises.length,
    sets: [emptySet()],
  };
  workout.exercises.push(entry);
  workout.updatedAt = now;
  return entry;
}

export function removeExerciseFromWorkout(
  draft: AppData,
  workoutId: string,
  exerciseId: string,
  now: string,
): void {
  const workout = requireActiveWorkout(draft, workoutId);
  const index = workout.exercises.findIndex((e) => e.exerciseId === exerciseId);
  if (index === -1) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  workout.exercises.splice(index, 1);
  workout.exercises.forEach((entry, i) => {
    entry.order = i;
  });
  workout.updatedAt = now;
}

export function addSetToWorkout(
  draft: AppData,
  workoutId: string,
  exerciseId: string,
  now: string,
): WorkoutSet {
  const workout = requireActiveWorkout(draft, workoutId);
  const entry = workout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!entry) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  const set = emptySet();
  entry.sets.push(set);
  workout.updatedAt = now;
  return set;
}

export function removeSetFromWorkout(
  draft: AppData,
  workoutId: string,
  exerciseId: string,
  setId: string,
  now: string,
): void {
  const workout = requireActiveWorkout(draft, workoutId);
  const entry = workout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!entry) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  const index = entry.sets.findIndex((s) => s.setId === setId);
  if (index === -1) {
    throw new WorkoutNotFoundError(setId);
  }
  entry.sets.splice(index, 1);
  workout.updatedAt = now;
}

export interface WorkoutSetPatch {
  type?: SetType;
  reps?: number | null;
  weightKg?: number | null;
  rpe?: number | null;
  notes?: string | null;
  completed?: boolean;
}

function applyNullable<T>(
  target: object,
  key: string,
  value: T | null | undefined,
  present: boolean,
): void {
  if (!present) {
    return;
  }
  if (value === null) {
    delete (target as Record<string, unknown>)[key];
  } else {
    (target as Record<string, unknown>)[key] = value;
  }
}

/** Edits a single set. `null` clears an optional field; `undefined`/absent leaves it. */
export function updateWorkoutSet(
  draft: AppData,
  workoutId: string,
  exerciseId: string,
  setId: string,
  patch: WorkoutSetPatch,
  now: string,
): WorkoutSet {
  const workout = requireActiveWorkout(draft, workoutId);
  const entry = workout.exercises.find((e) => e.exerciseId === exerciseId);
  if (!entry) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  const set = entry.sets.find((s) => s.setId === setId);
  if (!set) {
    throw new WorkoutNotFoundError(setId);
  }

  if (patch.type !== undefined) {
    set.type = patch.type;
  }
  if (patch.completed !== undefined) {
    set.completed = patch.completed;
  }
  applyNullable(set, 'reps', patch.reps, 'reps' in patch);
  applyNullable(set, 'weightKg', patch.weightKg, 'weightKg' in patch);
  applyNullable(set, 'rpe', patch.rpe, 'rpe' in patch);
  applyNullable(set, 'notes', patch.notes, 'notes' in patch);

  workout.updatedAt = now;
  return set;
}

/** Moves an exercise up (-1) or down (+1) within the workout. */
export function moveWorkoutExercise(
  draft: AppData,
  workoutId: string,
  exerciseId: string,
  direction: -1 | 1,
  now: string,
): void {
  const workout = requireActiveWorkout(draft, workoutId);
  const index = workout.exercises.findIndex((e) => e.exerciseId === exerciseId);
  if (index === -1) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  const target = index + direction;
  if (target < 0 || target >= workout.exercises.length) {
    return;
  }
  [workout.exercises[index], workout.exercises[target]] = [
    workout.exercises[target],
    workout.exercises[index],
  ];
  workout.exercises.forEach((entry, i) => {
    entry.order = i;
  });
  workout.updatedAt = now;
}

/** Marks an active workout completed, recording completion timestamps. */
export function completeWorkout(
  draft: AppData,
  workoutId: string,
  now: string,
): Workout {
  const workout = requireActiveWorkout(draft, workoutId);
  const completedAt = new Date(now);
  workout.status = 'completed';
  workout.completedAt = completedAt.toISOString();
  workout.completedLocalDate = localDateString(completedAt);
  workout.updatedAt = completedAt.toISOString();
  return workout;
}

/** Deletes a workout record. Active workouts should use discardWorkout. */
export function deleteWorkout(draft: AppData, workoutId: string): void {
  const workout = findWorkout(draft, workoutId);
  if (workout.status === 'active') {
    throw new WorkoutNotActiveError(workoutId);
  }
  draft.workouts = draft.workouts.filter((w) => w.workoutId !== workoutId);
}

/** Discards (deletes) an active workout. */
export function discardWorkout(draft: AppData, workoutId: string): void {
  const workout = findWorkout(draft, workoutId);
  if (workout.status !== 'active') {
    throw new WorkoutNotActiveError(workoutId);
  }
  draft.workouts = draft.workouts.filter((w) => w.workoutId !== workoutId);
}
