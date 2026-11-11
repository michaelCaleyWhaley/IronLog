import type { Equipment, MuscleGroup, SetType } from './types';

/** 'full_body' -> 'Full Body', 'barbell' -> 'Barbell' */
export function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function muscleGroupLabel(value: MuscleGroup): string {
  return humanizeEnum(value);
}

export function equipmentLabel(value: Equipment): string {
  return humanizeEnum(value);
}

export function setTypeLabel(value: SetType): string {
  return humanizeEnum(value);
}
