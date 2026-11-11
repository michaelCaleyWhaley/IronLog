import { CURRENT_SCHEMA_VERSION, type AppData } from './types';
import { buildSeedExercises } from './exercises.seed';

export function createInitialDocument(now: Date = new Date()): AppData {
  const timestamp = now.toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    exercises: buildSeedExercises(),
    routines: [],
    workouts: [],
    preferences: {
      weightUnit: 'kg',
      autoStartRestTimer: false,
      defaultRestDuration: 120,
    },
  };
}
