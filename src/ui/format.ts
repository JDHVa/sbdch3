/** Formateo numérico consistente para la UI. */

export const fmt = (n: number, digits = 2): string =>
  Number.isFinite(n) ? n.toFixed(digits) : '—';

/** Julios → milijulios si el valor es pequeño (energías de una canica). */
export function energy(joules: number): { value: string; unit: string } {
  if (Math.abs(joules) < 0.1) {
    return { value: fmt(joules * 1000, 2), unit: 'mJ' };
  }
  return { value: fmt(joules, 3), unit: 'J' };
}

export const kmh = (ms: number): number => ms * 3.6;
