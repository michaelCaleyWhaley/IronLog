import { z } from 'zod';

import { LIMITS } from './limits';
import type { AppData } from './types';
import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  SET_TYPES,
  WEIGHT_UNITS,
  WORKOUT_STATUSES,
} from './types';

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Expected an ISO 8601 date-time string',
  });

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const localDate = z
  .string()
  .refine(isValidLocalDate, { message: 'Expected a valid YYYY-MM-DD date' });

const name = z.string().min(1).max(LIMITS.maxNameLength);
const notes = z.string().max(LIMITS.maxNotesLength);

const reps = z
  .number()
  .int()
  .min(LIMITS.minReps)
  .max(LIMITS.maxReps)
  .optional();

const weightKg = z
  .number()
  .min(LIMITS.minWeightKg)
  .max(LIMITS.maxWeightKg)
  .optional();

const rpe = z
  .number()
  .min(LIMITS.minRpe)
  .max(LIMITS.maxRpe)
  .refine((value) => Number.isInteger(value * 2), {
    message: 'RPE must be in increments of 0.5',
  })
  .optional();

const id = z.string().min(1).max(64);

export const preferencesSchema = z.object({
  weightUnit: z.enum(WEIGHT_UNITS),
  autoStartRestTimer: z.boolean(),
  defaultRestDuration: z
    .number()
    .int()
    .min(LIMITS.minRestDurationSeconds)
    .max(LIMITS.maxRestDurationSeconds),
});

export const exerciseSchema = z.object({
  exerciseId: id,
  name,
  muscleGroup: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT_TYPES),
  isCustom: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional(),
});

export const routineExerciseSchema = z.object({
  exerciseId: id,
  order: z.number().int().min(0),
  targetSets: z
    .number()
    .int()
    .min(LIMITS.minTargetSets)
    .max(LIMITS.maxTargetSets),
  targetReps: z
    .number()
    .int()
    .min(LIMITS.minTargetReps)
    .max(LIMITS.maxTargetReps),
});

export const routineSchema = z
  .object({
    routineId: id,
    name,
    exercises: z
      .array(routineExerciseSchema)
      .max(LIMITS.maxExercisesPerWorkoutOrRoutine),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .superRefine((routine, ctx) => {
    const seen = new Set<string>();
    for (const exercise of routine.exercises) {
      if (seen.has(exercise.exerciseId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate exerciseId "${exercise.exerciseId}" in routine`,
        });
      }
      seen.add(exercise.exerciseId);
    }
  });

export const workoutSetSchema = z.object({
  setId: id,
  type: z.enum(SET_TYPES),
  reps,
  weightKg,
  completed: z.boolean(),
  rpe,
  notes: notes.optional(),
});

export const workoutExerciseSchema = z.object({
  exerciseId: id,
  name,
  order: z.number().int().min(0),
  sets: z.array(workoutSetSchema).max(LIMITS.maxSetsPerExercise),
});

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayNumber(dateTime: string): number {
  return Math.floor(Date.parse(dateTime) / DAY_MS);
}

export const workoutSchema = z
  .object({
    workoutId: id,
    routineId: id.optional(),
    name,
    startedAt: isoDateTime,
    completedAt: isoDateTime.optional(),
    completedLocalDate: localDate.optional(),
    status: z.enum(WORKOUT_STATUSES),
    exercises: z
      .array(workoutExerciseSchema)
      .max(LIMITS.maxExercisesPerWorkoutOrRoutine),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .superRefine((workout, ctx) => {
    const seen = new Set<string>();
    for (const exercise of workout.exercises) {
      if (seen.has(exercise.exerciseId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate exerciseId "${exercise.exerciseId}" in workout`,
        });
      }
      seen.add(exercise.exerciseId);
    }

    if (workout.status === 'completed') {
      if (!workout.completedAt || !workout.completedLocalDate) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Completed workouts require completedAt and completedLocalDate',
        });
        return;
      }
      const completedDay = utcDayNumber(workout.completedAt);
      const localDay = Math.floor(
        Date.parse(`${workout.completedLocalDate}T00:00:00.000Z`) / DAY_MS,
      );
      if (Math.abs(completedDay - localDay) > 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'completedLocalDate must be within one day of completedAt',
        });
      }
    } else if (workout.completedAt || workout.completedLocalDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Active workouts must not have completion fields',
      });
    }
  });

export const appDataSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    exercises: z.array(exerciseSchema),
    routines: z.array(routineSchema).max(LIMITS.maxRoutines),
    workouts: z.array(workoutSchema),
    preferences: preferencesSchema,
  })
  .superRefine((data, ctx) => {
    const activeCustom = data.exercises.filter(
      (exercise) => exercise.isCustom && !exercise.deletedAt,
    ).length;
    if (activeCustom > LIMITS.maxCustomExercises) {
      ctx.addIssue({
        code: 'custom',
        message: `At most ${LIMITS.maxCustomExercises} active custom exercises are allowed`,
      });
    }
  });

type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

// Compile-time guard: the schema output must match the hand-written domain
// types exactly. If this errors, the schema and types have drifted apart.
const _schemaMatchesTypes: MutuallyAssignable<
  z.infer<typeof appDataSchema>,
  AppData
> = true;
void _schemaMatchesTypes;

export function parseAppData(input: unknown): AppData {
  return appDataSchema.parse(input) as AppData;
}

export function safeParseAppData(input: unknown) {
  return appDataSchema.safeParse(input);
}
