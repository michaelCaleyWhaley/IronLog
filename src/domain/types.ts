export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
  'cardio',
  'other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const;

export type Equipment = (typeof EQUIPMENT_TYPES)[number];

export const WEIGHT_UNITS = ['kg', 'lb'] as const;

export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;

export type SetType = (typeof SET_TYPES)[number];

export const WORKOUT_STATUSES = ['active', 'completed'] as const;

export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const CURRENT_SCHEMA_VERSION = 2;

export interface Preferences {
  weightUnit: WeightUnit;
  autoStartRestTimer: boolean;
  defaultRestDuration: number;
}

export interface Exercise {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** A prescribed set in a routine: optional target reps and weight (kg). */
export interface RoutineSetTarget {
  reps?: number;
  weightKg?: number;
}

export interface RoutineExercise {
  exerciseId: string;
  order: number;
  sets: RoutineSetTarget[];
}

export interface Routine {
  routineId: string;
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSet {
  setId: string;
  type: SetType;
  reps?: number;
  weightKg?: number;
  completed: boolean;
  rpe?: number;
  notes?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  order: number;
  sets: WorkoutSet[];
}

export interface Workout {
  workoutId: string;
  routineId?: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  completedLocalDate?: string;
  status: WorkoutStatus;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  preferences: Preferences;
}
