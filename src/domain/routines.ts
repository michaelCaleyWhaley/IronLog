import {
  DomainError,
  ExerciseNotFoundError,
  ExerciseNotSelectableError,
  RoutineLimitError,
  RoutineNotFoundError,
} from './errors';
import { newId } from './id';
import { LIMITS } from './limits';
import type { AppData, Routine, RoutineExercise } from './types';

export interface RoutineExerciseInput {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
}

export interface RoutineInput {
  name: string;
  exercises?: RoutineExerciseInput[];
}

export interface RoutinePatch {
  name?: string;
  exercises?: RoutineExerciseInput[];
}

function findRoutine(draft: AppData, routineId: string): Routine {
  const routine = draft.routines.find((r) => r.routineId === routineId);
  if (!routine) {
    throw new RoutineNotFoundError(routineId);
  }
  return routine;
}

function assertRoutineLimits(draft: AppData, count: number): void {
  if (
    draft.routines.length >= LIMITS.maxRoutines &&
    count > draft.routines.length
  ) {
    throw new RoutineLimitError(
      `At most ${LIMITS.maxRoutines} routines are allowed`,
    );
  }
}

function assertExerciseList(
  draft: AppData,
  inputs: RoutineExerciseInput[],
): void {
  if (inputs.length > LIMITS.maxExercisesPerWorkoutOrRoutine) {
    throw new RoutineLimitError(
      `A routine can contain at most ${LIMITS.maxExercisesPerWorkoutOrRoutine} exercises`,
    );
  }
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.exerciseId)) {
      throw new DomainError(
        `Duplicate exerciseId "${input.exerciseId}" in routine`,
      );
    }
    seen.add(input.exerciseId);
    const exercise = draft.exercises.find(
      (e) => e.exerciseId === input.exerciseId,
    );
    if (!exercise) {
      throw new ExerciseNotFoundError(input.exerciseId);
    }
    if (exercise.deletedAt) {
      throw new ExerciseNotSelectableError(input.exerciseId);
    }
  }
}

function toRoutineExercises(inputs: RoutineExerciseInput[]): RoutineExercise[] {
  return inputs.map((input, index) => ({
    exerciseId: input.exerciseId,
    order: index,
    targetSets: input.targetSets,
    targetReps: input.targetReps,
  }));
}

/** Creates a routine. Exercise order follows the input array order. */
export function addRoutine(
  draft: AppData,
  input: RoutineInput,
  now: string,
): Routine {
  assertRoutineLimits(draft, draft.routines.length + 1);
  const inputs = input.exercises ?? [];
  assertExerciseList(draft, inputs);

  const routine: Routine = {
    routineId: newId(),
    name: input.name,
    exercises: toRoutineExercises(inputs),
    createdAt: now,
    updatedAt: now,
  };
  draft.routines.push(routine);
  return routine;
}

/** Updates a routine's name and/or full exercise list. */
export function updateRoutine(
  draft: AppData,
  routineId: string,
  patch: RoutinePatch,
  now: string,
): Routine {
  const routine = findRoutine(draft, routineId);
  if (patch.name !== undefined) {
    routine.name = patch.name;
  }
  if (patch.exercises !== undefined) {
    assertExerciseList(draft, patch.exercises);
    routine.exercises = toRoutineExercises(patch.exercises);
  }
  routine.updatedAt = now;
  return routine;
}

export function deleteRoutine(draft: AppData, routineId: string): void {
  const index = draft.routines.findIndex((r) => r.routineId === routineId);
  if (index === -1) {
    throw new RoutineNotFoundError(routineId);
  }
  draft.routines.splice(index, 1);
}
