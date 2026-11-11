import type { Exercise, MuscleGroup, Equipment } from './types';

interface SeedExercise {
  slug: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
}

const SEED_LIST: SeedExercise[] = [
  // Chest
  {
    slug: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscleGroup: 'chest',
    equipment: 'barbell',
  },
  {
    slug: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
  },
  {
    slug: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
  },
  {
    slug: 'incline-barbell-press',
    name: 'Incline Barbell Press',
    muscleGroup: 'chest',
    equipment: 'barbell',
  },
  {
    slug: 'decline-barbell-press',
    name: 'Decline Barbell Press',
    muscleGroup: 'chest',
    equipment: 'barbell',
  },
  {
    slug: 'push-up',
    name: 'Push-Up',
    muscleGroup: 'chest',
    equipment: 'bodyweight',
  },
  { slug: 'dips', name: 'Dips', muscleGroup: 'chest', equipment: 'bodyweight' },
  {
    slug: 'cable-fly',
    name: 'Cable Fly',
    muscleGroup: 'chest',
    equipment: 'cable',
  },
  {
    slug: 'dumbbell-fly',
    name: 'Dumbbell Fly',
    muscleGroup: 'chest',
    equipment: 'dumbbell',
  },
  {
    slug: 'machine-chest-press',
    name: 'Machine Chest Press',
    muscleGroup: 'chest',
    equipment: 'machine',
  },
  {
    slug: 'pec-deck',
    name: 'Pec Deck',
    muscleGroup: 'chest',
    equipment: 'machine',
  },

  // Back
  {
    slug: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'back',
    equipment: 'barbell',
  },
  {
    slug: 'barbell-row',
    name: 'Barbell Row',
    muscleGroup: 'back',
    equipment: 'barbell',
  },
  {
    slug: 'dumbbell-row',
    name: 'One-Arm Dumbbell Row',
    muscleGroup: 'back',
    equipment: 'dumbbell',
  },
  {
    slug: 'seated-cable-row',
    name: 'Seated Cable Row',
    muscleGroup: 'back',
    equipment: 'cable',
  },
  {
    slug: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'back',
    equipment: 'cable',
  },
  {
    slug: 'pull-up',
    name: 'Pull-Up',
    muscleGroup: 'back',
    equipment: 'bodyweight',
  },
  {
    slug: 'chin-up',
    name: 'Chin-Up',
    muscleGroup: 'back',
    equipment: 'bodyweight',
  },
  {
    slug: 't-bar-row',
    name: 'T-Bar Row',
    muscleGroup: 'back',
    equipment: 'barbell',
  },
  {
    slug: 'face-pull',
    name: 'Face Pull',
    muscleGroup: 'back',
    equipment: 'cable',
  },
  {
    slug: 'straight-arm-pulldown',
    name: 'Straight-Arm Pulldown',
    muscleGroup: 'back',
    equipment: 'cable',
  },

  // Shoulders
  {
    slug: 'overhead-press',
    name: 'Overhead Press',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
  },
  {
    slug: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
  },
  {
    slug: 'lateral-raise',
    name: 'Lateral Raise',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
  },
  {
    slug: 'cable-lateral-raise',
    name: 'Cable Lateral Raise',
    muscleGroup: 'shoulders',
    equipment: 'cable',
  },
  {
    slug: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
  },
  {
    slug: 'arnold-press',
    name: 'Arnold Press',
    muscleGroup: 'shoulders',
    equipment: 'dumbbell',
  },
  {
    slug: 'shrug',
    name: 'Barbell Shrug',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
  },

  // Biceps
  {
    slug: 'barbell-curl',
    name: 'Barbell Curl',
    muscleGroup: 'biceps',
    equipment: 'barbell',
  },
  {
    slug: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscleGroup: 'biceps',
    equipment: 'dumbbell',
  },
  {
    slug: 'hammer-curl',
    name: 'Hammer Curl',
    muscleGroup: 'biceps',
    equipment: 'dumbbell',
  },
  {
    slug: 'preacher-curl',
    name: 'Preacher Curl',
    muscleGroup: 'biceps',
    equipment: 'barbell',
  },
  {
    slug: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    muscleGroup: 'biceps',
    equipment: 'dumbbell',
  },
  {
    slug: 'cable-curl',
    name: 'Cable Curl',
    muscleGroup: 'biceps',
    equipment: 'cable',
  },

  // Triceps
  {
    slug: 'tricep-pushdown',
    name: 'Tricep Pushdown',
    muscleGroup: 'triceps',
    equipment: 'cable',
  },
  {
    slug: 'overhead-tricep-extension',
    name: 'Overhead Tricep Extension',
    muscleGroup: 'triceps',
    equipment: 'dumbbell',
  },
  {
    slug: 'skull-crusher',
    name: 'Skull Crusher',
    muscleGroup: 'triceps',
    equipment: 'barbell',
  },
  {
    slug: 'close-grip-bench-press',
    name: 'Close-Grip Bench Press',
    muscleGroup: 'triceps',
    equipment: 'barbell',
  },
  {
    slug: 'diamond-push-up',
    name: 'Diamond Push-Up',
    muscleGroup: 'triceps',
    equipment: 'bodyweight',
  },
  {
    slug: 'bench-dips',
    name: 'Bench Dips',
    muscleGroup: 'triceps',
    equipment: 'bodyweight',
  },

  // Forearms
  {
    slug: 'wrist-curl',
    name: 'Wrist Curl',
    muscleGroup: 'forearms',
    equipment: 'dumbbell',
  },
  {
    slug: 'reverse-wrist-curl',
    name: 'Reverse Wrist Curl',
    muscleGroup: 'forearms',
    equipment: 'dumbbell',
  },
  {
    slug: 'farmer-carry',
    name: 'Farmer Carry',
    muscleGroup: 'forearms',
    equipment: 'dumbbell',
  },

  // Quads
  {
    slug: 'back-squat',
    name: 'Back Squat',
    muscleGroup: 'quads',
    equipment: 'barbell',
  },
  {
    slug: 'front-squat',
    name: 'Front Squat',
    muscleGroup: 'quads',
    equipment: 'barbell',
  },
  {
    slug: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'quads',
    equipment: 'machine',
  },
  {
    slug: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    muscleGroup: 'quads',
    equipment: 'dumbbell',
  },
  {
    slug: 'walking-lunge',
    name: 'Walking Lunge',
    muscleGroup: 'quads',
    equipment: 'dumbbell',
  },
  {
    slug: 'leg-extension',
    name: 'Leg Extension',
    muscleGroup: 'quads',
    equipment: 'machine',
  },
  {
    slug: 'sissy-squat',
    name: 'Sissy Squat',
    muscleGroup: 'quads',
    equipment: 'bodyweight',
  },

  // Hamstrings
  {
    slug: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroup: 'hamstrings',
    equipment: 'barbell',
  },
  {
    slug: 'lying-leg-curl',
    name: 'Lying Leg Curl',
    muscleGroup: 'hamstrings',
    equipment: 'machine',
  },
  {
    slug: 'seated-leg-curl',
    name: 'Seated Leg Curl',
    muscleGroup: 'hamstrings',
    equipment: 'machine',
  },
  {
    slug: 'nordic-curl',
    name: 'Nordic Curl',
    muscleGroup: 'hamstrings',
    equipment: 'bodyweight',
  },
  {
    slug: 'good-morning',
    name: 'Good Morning',
    muscleGroup: 'hamstrings',
    equipment: 'barbell',
  },

  // Glutes
  {
    slug: 'hip-thrust',
    name: 'Hip Thrust',
    muscleGroup: 'glutes',
    equipment: 'barbell',
  },
  {
    slug: 'glute-bridge',
    name: 'Glute Bridge',
    muscleGroup: 'glutes',
    equipment: 'bodyweight',
  },
  {
    slug: 'cable-kickback',
    name: 'Cable Kickback',
    muscleGroup: 'glutes',
    equipment: 'cable',
  },
  {
    slug: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    muscleGroup: 'glutes',
    equipment: 'barbell',
  },

  // Calves
  {
    slug: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    muscleGroup: 'calves',
    equipment: 'machine',
  },
  {
    slug: 'seated-calf-raise',
    name: 'Seated Calf Raise',
    muscleGroup: 'calves',
    equipment: 'machine',
  },
  {
    slug: 'donkey-calf-raise',
    name: 'Donkey Calf Raise',
    muscleGroup: 'calves',
    equipment: 'machine',
  },

  // Core
  {
    slug: 'plank',
    name: 'Plank',
    muscleGroup: 'core',
    equipment: 'bodyweight',
  },
  {
    slug: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    muscleGroup: 'core',
    equipment: 'bodyweight',
  },
  {
    slug: 'cable-crunch',
    name: 'Cable Crunch',
    muscleGroup: 'core',
    equipment: 'cable',
  },
  {
    slug: 'russian-twist',
    name: 'Russian Twist',
    muscleGroup: 'core',
    equipment: 'bodyweight',
  },
  {
    slug: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    muscleGroup: 'core',
    equipment: 'other',
  },

  // Full body
  {
    slug: 'clean-and-press',
    name: 'Clean and Press',
    muscleGroup: 'full_body',
    equipment: 'barbell',
  },
  {
    slug: 'burpee',
    name: 'Burpee',
    muscleGroup: 'full_body',
    equipment: 'bodyweight',
  },
  {
    slug: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    muscleGroup: 'full_body',
    equipment: 'kettlebell',
  },
  {
    slug: 'thruster',
    name: 'Thruster',
    muscleGroup: 'full_body',
    equipment: 'barbell',
  },

  // Cardio
  {
    slug: 'running',
    name: 'Running',
    muscleGroup: 'cardio',
    equipment: 'bodyweight',
  },
  {
    slug: 'rowing-machine',
    name: 'Rowing Machine',
    muscleGroup: 'cardio',
    equipment: 'machine',
  },
  {
    slug: 'cycling',
    name: 'Cycling',
    muscleGroup: 'cardio',
    equipment: 'other',
  },
  {
    slug: 'jump-rope',
    name: 'Jump Rope',
    muscleGroup: 'cardio',
    equipment: 'other',
  },
  {
    slug: 'stair-climber',
    name: 'Stair Climber',
    muscleGroup: 'cardio',
    equipment: 'machine',
  },
];

/** Fixed timestamp so seeded data is deterministic and test-friendly. */
export const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function buildSeedExercises(): Exercise[] {
  return SEED_LIST.map((seed) => ({
    exerciseId: seed.slug,
    name: seed.name,
    muscleGroup: seed.muscleGroup,
    equipment: seed.equipment,
    isCustom: false,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }));
}
