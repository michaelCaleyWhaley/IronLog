import { describe, expect, it } from 'vitest';

import { DataRepository } from '../storage/dataRepository';
import { DataValidationError } from '../storage/errors';
import { MemoryStore } from '../storage/memoryStore';
import {
  ActiveWorkoutExistsError,
  ExerciseAlreadyInWorkoutError,
  ExerciseNotFoundError,
  ExerciseNotSelectableError,
  RoutineNotFoundError,
  WorkoutNotActiveError,
  WorkoutNotFoundError,
} from './errors';
import { getActiveWorkout, workoutDurationSeconds } from './selectors';
import type { AppData, Equipment, MuscleGroup } from './types';
import { localDateString } from './workouts';

const T0 = new Date('2026-11-10T08:00:00.000Z');
const T1 = new Date('2026-11-10T09:30:00.000Z');

let clock = T0;

function makeRepository(store = new MemoryStore()) {
  return {
    store,
    repo: new DataRepository(store, { now: () => clock }),
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

async function repoWithExercise() {
  const { repo, store } = makeRepository();
  await repo.initialise();
  const exercise = await repo.createExercise(VALID_EXERCISE);
  return { repo, store, exercise };
}

describe('workout creation', () => {
  it('starts a blank workout', async () => {
    const repo = await initialisedRepository();
    const workout = await repo.startBlankWorkout();

    expect(workout.status).toBe('active');
    expect(workout.name).toBe('Workout');
    expect(workout.exercises).toHaveLength(0);
    expect(getActiveWorkout(repo.getData())?.workoutId).toBe(workout.workoutId);
  });

  it('prevents a second active workout', async () => {
    const repo = await initialisedRepository();
    await repo.startBlankWorkout();
    await expect(repo.startBlankWorkout()).rejects.toThrow(
      ActiveWorkoutExistsError,
    );
  });

  it('converts a routine into a workout with snapshot names and target sets', async () => {
    const { repo, exercise } = await repoWithExercise();
    const routine = await repo.createRoutine({
      name: 'Arm Day',
      exercises: [
        { exerciseId: exercise.exerciseId, targetSets: 3, targetReps: 12 },
      ],
    });

    const workout = await repo.startWorkoutFromRoutine(routine.routineId);

    expect(workout.status).toBe('active');
    expect(workout.routineId).toBe(routine.routineId);
    expect(workout.name).toBe('Arm Day');
    const entry = workout.exercises[0];
    expect(entry?.name).toBe('Test Curl'); // snapshot, not a live reference
    expect(entry?.sets).toHaveLength(3);
    expect(entry?.sets.every((s) => s.type === 'normal')).toBe(true);
    expect(entry?.sets[0]?.reps).toBe(12);
    expect(entry?.sets.every((s) => !s.completed)).toBe(true);
  });

  it('rejects starting from an unknown routine', async () => {
    const repo = await initialisedRepository();
    await expect(repo.startWorkoutFromRoutine('nope')).rejects.toThrow(
      RoutineNotFoundError,
    );
  });
});

describe('workout editing', () => {
  it('adds, edits and removes exercises and sets', async () => {
    const { repo, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout();

    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);
    await expect(
      repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId),
    ).rejects.toThrow(ExerciseAlreadyInWorkoutError);

    const active = getActiveWorkout(repo.getData());
    const set = active?.exercises[0]?.sets[0];
    expect(set).toBeTruthy();

    // Edit set fields.
    await repo.updateWorkoutSet(
      workout.workoutId,
      exercise.exerciseId,
      set!.setId,
      { reps: 10, weightKg: 20, rpe: 8.5, notes: 'Felt easy', completed: true },
    );
    let stored = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];
    expect(stored).toMatchObject({
      reps: 10,
      weightKg: 20,
      rpe: 8.5,
      notes: 'Felt easy',
      completed: true,
    });

    // Add another set, then remove the first.
    const added = await repo.addSetToWorkout(
      workout.workoutId,
      exercise.exerciseId,
    );
    await repo.removeSetFromWorkout(
      workout.workoutId,
      exercise.exerciseId,
      set!.setId,
    );
    stored = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];
    expect(stored?.setId).toBe(added.setId);

    // Reorder via move (single exercise -> no-op at bounds).
    await repo.moveWorkoutExercise(workout.workoutId, exercise.exerciseId, -1);

    // Remove the exercise entirely.
    await repo.removeExerciseFromWorkout(
      workout.workoutId,
      exercise.exerciseId,
    );
    expect(getActiveWorkout(repo.getData())?.exercises).toHaveLength(0);
  });

  it('clears optional set fields with null', async () => {
    const { repo, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout();
    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);
    const set = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];

    await repo.updateWorkoutSet(
      workout.workoutId,
      exercise.exerciseId,
      set!.setId,
      { reps: 10, weightKg: 20, notes: 'hi' },
    );
    await repo.updateWorkoutSet(
      workout.workoutId,
      exercise.exerciseId,
      set!.setId,
      { reps: null, weightKg: null, notes: null },
    );

    const stored = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];
    expect(stored).not.toHaveProperty('reps');
    expect(stored).not.toHaveProperty('weightKg');
    expect(stored).not.toHaveProperty('notes');
  });

  it('rejects invalid set values via schema validation', async () => {
    const { repo, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout();
    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);
    const set = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];

    await expect(
      repo.updateWorkoutSet(
        workout.workoutId,
        exercise.exerciseId,
        set!.setId,
        {
          reps: 1001,
        },
      ),
    ).rejects.toThrow(DataValidationError);
    await expect(
      repo.updateWorkoutSet(
        workout.workoutId,
        exercise.exerciseId,
        set!.setId,
        {
          rpe: 10.3,
        },
      ),
    ).rejects.toThrow(DataValidationError);
  });

  it('enforces per-exercise set and per-workout exercise limits', async () => {
    const { repo, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout();
    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);

    // 1 initial set + 19 more reaches the cap of 20; the next fails.
    for (let i = 0; i < 19; i += 1) {
      await repo.addSetToWorkout(workout.workoutId, exercise.exerciseId);
    }
    await expect(
      repo.addSetToWorkout(workout.workoutId, exercise.exerciseId),
    ).rejects.toThrow(DataValidationError);

    // Fill the workout to 30 exercises; the 31st is rejected.
    for (let i = 0; i < 29; i += 1) {
      const extra = await repo.createExercise({
        ...VALID_EXERCISE,
        name: `Extra ${i}`,
      });
      await repo.addExerciseToWorkout(workout.workoutId, extra.exerciseId);
    }
    const oneMore = await repo.createExercise({
      ...VALID_EXERCISE,
      name: 'One too many',
    });
    await expect(
      repo.addExerciseToWorkout(workout.workoutId, oneMore.exerciseId),
    ).rejects.toThrow(DataValidationError);
    expect(getActiveWorkout(repo.getData())?.exercises).toHaveLength(30);
  });

  it('rejects adding soft-deleted exercises to a workout', async () => {
    const { repo, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout();
    await repo.deleteExercise(exercise.exerciseId);

    await expect(
      repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId),
    ).rejects.toThrow(ExerciseNotSelectableError);
    await expect(
      repo.addExerciseToWorkout(workout.workoutId, 'missing'),
    ).rejects.toThrow(ExerciseNotFoundError);
  });
});

describe('completion, discard and persistence', () => {
  it('completes a workout with timestamps and local date', async () => {
    const { repo, exercise } = await repoWithExercise();
    clock = T0;
    const workout = await repo.startBlankWorkout();
    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);

    clock = T1;
    const completed = await repo.completeWorkout(workout.workoutId);

    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(T1.toISOString());
    expect(completed.completedLocalDate).toBe(localDateString(T1));
    expect(getActiveWorkout(repo.getData())).toBeUndefined();

    // Completed workouts are immutable.
    await expect(
      repo.updateWorkoutSet(
        workout.workoutId,
        exercise.exerciseId,
        completed.exercises[0]!.sets[0]!.setId,
        { reps: 5 },
      ),
    ).rejects.toThrow(WorkoutNotActiveError);
    await expect(repo.discardWorkout(workout.workoutId)).rejects.toThrow(
      WorkoutNotActiveError,
    );
  });

  it('persists an active workout and resumes after simulated restart', async () => {
    clock = T0;
    const { repo, store, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout('Leg Day');
    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);
    const set = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];
    await repo.updateWorkoutSet(
      workout.workoutId,
      exercise.exerciseId,
      set!.setId,
      { reps: 8, weightKg: 60, completed: true },
    );

    // New repository instance over the same store = app restart.
    clock = T1;
    const { repo: restarted } = makeRepository(store);
    await restarted.initialise();

    const active = getActiveWorkout(restarted.getData());
    expect(active?.workoutId).toBe(workout.workoutId);
    expect(active?.name).toBe('Leg Day');
    expect(active?.exercises[0]?.sets[0]).toMatchObject({
      reps: 8,
      weightKg: 60,
      completed: true,
    });
    expect(workoutDurationSeconds(active!, T1)).toBe(5400);
  });

  it('does not lose workout state when a write fails', async () => {
    const { repo, store, exercise } = await repoWithExercise();
    const workout = await repo.startBlankWorkout();
    await repo.addExerciseToWorkout(workout.workoutId, exercise.exerciseId);
    const set = getActiveWorkout(repo.getData())?.exercises[0]?.sets[0];

    let fail = true;
    store.onWrite = (key) => {
      if (fail && key !== 'ironlog-data.backup.json') {
        throw new Error('disk full');
      }
    };

    await expect(
      repo.updateWorkoutSet(
        workout.workoutId,
        exercise.exerciseId,
        set!.setId,
        { reps: 12 },
      ),
    ).rejects.toThrow('disk full');

    // In-memory state retained the edit.
    expect(getActiveWorkout(repo.getData())?.exercises[0]?.sets[0]?.reps).toBe(
      12,
    );

    fail = false;
    await repo.updateWorkoutSet(
      workout.workoutId,
      exercise.exerciseId,
      set!.setId,
      { weightKg: 30 },
    );

    const stored = JSON.parse(
      store.contents('ironlog-data.json') ?? '{}',
    ) as AppData;
    const storedSet = stored.workouts.find(
      (w) => w.workoutId === workout.workoutId,
    )?.exercises[0]?.sets[0];
    expect(storedSet).toMatchObject({ reps: 12, weightKg: 30 });
  });

  it('discards an active workout', async () => {
    const repo = await initialisedRepository();
    const workout = await repo.startBlankWorkout();
    await repo.discardWorkout(workout.workoutId);
    expect(getActiveWorkout(repo.getData())).toBeUndefined();
    await expect(
      repo.updateWorkoutSet(workout.workoutId, 'x', 'y', { reps: 1 }),
    ).rejects.toThrow(WorkoutNotFoundError);
  });
});
