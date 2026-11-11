import {
  BuiltInExerciseImmutableError,
  ExerciseLimitError,
  ExerciseNotFoundError,
} from './errors';
import { newId } from './id';
import { LIMITS } from './limits';
import type { AppData, Equipment, Exercise, MuscleGroup } from './types';

export interface ExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
}

export interface ExercisePatch {
  name?: string;
  muscleGroup?: MuscleGroup;
  equipment?: Equipment;
}

function findExercise(draft: AppData, exerciseId: string): Exercise {
  const exercise = draft.exercises.find((e) => e.exerciseId === exerciseId);
  if (!exercise) {
    throw new ExerciseNotFoundError(exerciseId);
  }
  return exercise;
}

/** Adds a custom exercise to the document. */
export function addCustomExercise(
  draft: AppData,
  input: ExerciseInput,
  now: string,
): Exercise {
  const activeCustom = draft.exercises.filter(
    (e) => e.isCustom && !e.deletedAt,
  ).length;
  if (activeCustom >= LIMITS.maxCustomExercises) {
    throw new ExerciseLimitError(LIMITS.maxCustomExercises);
  }

  const exercise: Exercise = {
    exerciseId: newId(),
    name: input.name,
    muscleGroup: input.muscleGroup,
    equipment: input.equipment,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };
  draft.exercises.push(exercise);
  return exercise;
}

/** Edits a custom exercise. Built-in exercises are immutable. */
export function updateCustomExercise(
  draft: AppData,
  exerciseId: string,
  patch: ExercisePatch,
  now: string,
): Exercise {
  const exercise = findExercise(draft, exerciseId);
  if (!exercise.isCustom) {
    throw new BuiltInExerciseImmutableError(exerciseId);
  }
  if (patch.name !== undefined) {
    exercise.name = patch.name;
  }
  if (patch.muscleGroup !== undefined) {
    exercise.muscleGroup = patch.muscleGroup;
  }
  if (patch.equipment !== undefined) {
    exercise.equipment = patch.equipment;
  }
  exercise.updatedAt = now;
  return exercise;
}

/** Soft-deletes a custom exercise. Built-in exercises cannot be deleted. */
export function softDeleteExercise(
  draft: AppData,
  exerciseId: string,
  now: string,
): void {
  const exercise = findExercise(draft, exerciseId);
  if (!exercise.isCustom) {
    throw new BuiltInExerciseImmutableError(exerciseId);
  }
  exercise.deletedAt = now;
  exercise.updatedAt = now;
}
