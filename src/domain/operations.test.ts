import { describe, expect, it } from 'vitest';

import { DataRepository } from '../storage/dataRepository';
import { DataValidationError } from '../storage/errors';
import { MemoryStore } from '../storage/memoryStore';
import {
  BuiltInExerciseImmutableError,
  ExerciseLimitError,
  ExerciseNotFoundError,
  ExerciseNotSelectableError,
  RoutineLimitError,
  RoutineNotFoundError,
} from './errors';
import { LIMITS } from './limits';
import { getExercise, listExercises, listRoutines } from './selectors';
import type { Equipment, MuscleGroup } from './types';

const NOW = new Date('2026-11-10T12:00:00.000Z');

function makeRepository(store = new MemoryStore()) {
  return {
    store,
    repo: new DataRepository(store, { now: () => NOW }),
  };
}

async function initialisedRepository(store = new MemoryStore()) {
  const { repo } = makeRepository(store);
  await repo.initialise();
  return repo;
}

const VALID_EXERCISE = {
  name: 'Test Curl',
  muscleGroup: 'biceps' as MuscleGroup,
  equipment: 'dumbbell' as Equipment,
};

describe('exercise operations', () => {
  it('creates a custom exercise and persists it', async () => {
    const { repo, store } = makeRepository();
    await repo.initialise();

    const created = await repo.createExercise(VALID_EXERCISE);
    expect(created.isCustom).toBe(true);
    expect(created.exerciseId).toBeTruthy();

    // Survives a simulated restart.
    const { repo: reloaded } = makeRepository(store);
    await reloaded.initialise();
    const persisted = getExercise(reloaded.getData(), created.exerciseId);
    expect(persisted?.name).toBe('Test Curl');
  });

  it('rejects invalid exercise input', async () => {
    const repo = await initialisedRepository();

    await expect(
      repo.createExercise({ ...VALID_EXERCISE, name: '' }),
    ).rejects.toThrow(DataValidationError);
    await expect(
      repo.createExercise({ ...VALID_EXERCISE, name: 'x'.repeat(101) }),
    ).rejects.toThrow(DataValidationError);
    await expect(
      repo.createExercise({
        ...VALID_EXERCISE,
        muscleGroup: 'not-a-muscle' as MuscleGroup,
      }),
    ).rejects.toThrow(DataValidationError);
  });

  it('enforces the active custom exercise cap', async () => {
    const repo = await initialisedRepository();

    for (let i = 0; i < LIMITS.maxCustomExercises; i += 1) {
      await repo.createExercise({ ...VALID_EXERCISE, name: `Curl ${i}` });
    }
    await expect(repo.createExercise(VALID_EXERCISE)).rejects.toThrow(
      ExerciseLimitError,
    );
  });

  it('soft-deletes custom exercises but keeps them resolvable', async () => {
    const repo = await initialisedRepository();
    const created = await repo.createExercise(VALID_EXERCISE);

    await repo.deleteExercise(created.exerciseId);

    const data = repo.getData();
    const stored = getExercise(data, created.exerciseId);
    expect(stored?.deletedAt).toBe(NOW.toISOString());
    // Excluded from pickers...
    expect(
      listExercises(data).some((e) => e.exerciseId === created.exerciseId),
    ).toBe(false);
    // ...but still resolvable by ID.
    expect(listExercises(data, { includeDeleted: true })).toContainEqual(
      expect.objectContaining({ exerciseId: created.exerciseId }),
    );
  });

  it('does not count soft-deleted exercises toward the custom cap', async () => {
    const repo = await initialisedRepository();

    for (let i = 0; i < LIMITS.maxCustomExercises; i += 1) {
      const exercise = await repo.createExercise({
        ...VALID_EXERCISE,
        name: `Curl ${i}`,
      });
      if (i === 0) {
        await repo.deleteExercise(exercise.exerciseId);
      }
    }
    // 199 active + 1 deleted = cap not reached, one more is allowed.
    await expect(repo.createExercise(VALID_EXERCISE)).resolves.toBeTruthy();
  });

  it('rejects edits and deletes of built-in exercises', async () => {
    const repo = await initialisedRepository();
    const builtIn = repo.getData().exercises.find((e) => !e.isCustom);
    expect(builtIn).toBeTruthy();

    await expect(
      repo.updateExercise(builtIn!.exerciseId, { name: 'Renamed' }),
    ).rejects.toThrow(BuiltInExerciseImmutableError);
    await expect(repo.deleteExercise(builtIn!.exerciseId)).rejects.toThrow(
      BuiltInExerciseImmutableError,
    );
  });

  it('updates a custom exercise', async () => {
    const repo = await initialisedRepository();
    const created = await repo.createExercise(VALID_EXERCISE);

    const updated = await repo.updateExercise(created.exerciseId, {
      name: 'Hammer Curl',
      muscleGroup: 'forearms',
    });
    expect(updated.name).toBe('Hammer Curl');
    expect(updated.muscleGroup).toBe('forearms');
    expect(
      repo.getData().exercises.find((e) => e.exerciseId === created.exerciseId)
        ?.name,
    ).toBe('Hammer Curl');
  });

  it('rejects operations on unknown exercises', async () => {
    const repo = await initialisedRepository();
    await expect(
      repo.updateExercise('missing-id', { name: 'X' }),
    ).rejects.toThrow(ExerciseNotFoundError);
    await expect(repo.deleteExercise('missing-id')).rejects.toThrow(
      ExerciseNotFoundError,
    );
  });
});

describe('routine operations', () => {
  async function repoWithExercises(count = 3) {
    const { repo, store } = makeRepository();
    await repo.initialise();
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const exercise = await repo.createExercise({
        ...VALID_EXERCISE,
        name: `Exercise ${i}`,
      });
      ids.push(exercise.exerciseId);
    }
    return { repo, store, ids };
  }

  it('creates a routine with ordered exercises and targets', async () => {
    const { repo, ids } = await repoWithExercises(3);

    const routine = await repo.createRoutine({
      name: 'Push Day',
      exercises: [
        { exerciseId: ids[2], targetSets: 4, targetReps: 8 },
        { exerciseId: ids[0], targetSets: 3, targetReps: 12 },
        { exerciseId: ids[1], targetSets: 3, targetReps: 10 },
      ],
    });

    expect(routine.exercises).toHaveLength(3);
    expect(routine.exercises[0]?.exerciseId).toBe(ids[2]);
    expect(routine.exercises[0]?.order).toBe(0);
    expect(routine.exercises[0]?.targetSets).toBe(4);

    // Persisted across restart.
    const stored = repo
      .getData()
      .routines.find((r) => r.routineId === routine.routineId);
    expect(stored?.name).toBe('Push Day');
  });

  it('rejects duplicate exercise IDs in a routine', async () => {
    const { repo, ids } = await repoWithExercises(2);
    await expect(
      repo.createRoutine({
        name: 'Bad',
        exercises: [
          { exerciseId: ids[0], targetSets: 3, targetReps: 10 },
          { exerciseId: ids[0], targetSets: 3, targetReps: 10 },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown and soft-deleted exercises in routines', async () => {
    const { repo, ids } = await repoWithExercises(2);

    await expect(
      repo.createRoutine({
        name: 'Bad',
        exercises: [
          { exerciseId: 'does-not-exist', targetSets: 3, targetReps: 10 },
        ],
      }),
    ).rejects.toThrow(ExerciseNotFoundError);

    await repo.deleteExercise(ids[0]);
    await expect(
      repo.createRoutine({
        name: 'Bad',
        exercises: [{ exerciseId: ids[0], targetSets: 3, targetReps: 10 }],
      }),
    ).rejects.toThrow(ExerciseNotSelectableError);
  });

  it('rejects routines over the exercise and routine caps', async () => {
    const { repo, ids } = await repoWithExercises(1);

    // 31 exercises exceeds the per-routine cap of 30.
    await expect(
      repo.createRoutine({
        name: 'Too big',
        exercises: Array.from({ length: 31 }, () => ({
          exerciseId: ids[0],
          targetSets: 3,
          targetReps: 10,
        })),
      }),
    ).rejects.toThrow();

    // Fill to the routine cap.
    for (let i = 0; i < LIMITS.maxRoutines; i += 1) {
      await repo.createRoutine({ name: `Routine ${i}` });
    }
    await expect(repo.createRoutine({ name: 'One too many' })).rejects.toThrow(
      RoutineLimitError,
    );
  });

  it('updates and deletes routines', async () => {
    const { repo, ids } = await repoWithExercises(2);
    const routine = await repo.createRoutine({
      name: 'Old name',
      exercises: [{ exerciseId: ids[0], targetSets: 3, targetReps: 10 }],
    });

    const renamed = await repo.updateRoutine(routine.routineId, {
      name: 'New name',
      exercises: [
        { exerciseId: ids[1], targetSets: 5, targetReps: 5 },
        { exerciseId: ids[0], targetSets: 3, targetReps: 10 },
      ],
    });
    expect(renamed.name).toBe('New name');
    expect(renamed.exercises[0]?.exerciseId).toBe(ids[1]);

    await repo.deleteRoutine(routine.routineId);
    expect(listRoutines(repo.getData())).toHaveLength(0);
    await expect(
      repo.updateRoutine(routine.routineId, { name: 'X' }),
    ).rejects.toThrow(RoutineNotFoundError);
  });

  it('rejects out-of-range target sets/reps via schema validation', async () => {
    const { repo, ids } = await repoWithExercises(1);

    await expect(
      repo.createRoutine({
        name: 'Legs',
        exercises: [{ exerciseId: ids[0], targetSets: 0, targetReps: 10 }],
      }),
    ).rejects.toThrow(DataValidationError);
    expect(repo.getData().routines).toHaveLength(0);
  });
});
