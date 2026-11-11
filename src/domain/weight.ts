/** Weight is stored canonically in kilograms; convert only at the UI edge. */
export const LB_PER_KG = 2.2046226218;

export function kgToUnit(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

export function unitToKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}
