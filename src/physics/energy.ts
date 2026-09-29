/**
 * Energía y velocidad a lo largo de la pista, por conservación de energía.
 *
 * La canica se suelta desde el reposo en el primer punto (o desde la altura
 * indicada). En cada punto:
 *
 *   Presupuesto de energía cinética:
 *     KE(s) = m·g·(h0 − h(s)) − W_fricción(s)
 *   con  W_fricción(s) = μ·m·g·s   (modelo simple y ajustable).
 *
 *   Si se considera rodadura (esfera sólida), la energía cinética se reparte
 *   entre traslación y rotación, así que la "masa efectiva" es (7/5)·m:
 *     KE = ½ · m_ef · v²   ⇒   v = √(2·KE / m_ef)
 *
 * Energía potencial de referencia: la altura mínima de la pista (PE ≥ 0).
 */

import { ROLLING_MASS_FACTOR } from './constants';
import type { Track } from './track';

export interface EnergyParams {
  /** Masa (kg). */
  mass: number;
  /** Gravedad (m/s²). */
  gravity: number;
  /** Coeficiente de fricción efectivo (0 = sin fricción). */
  friction: number;
  /** Considerar energía de rotación (rodadura sin deslizar). */
  rolling: boolean;
  /** Velocidad inicial en s = 0 (m/s). Por defecto 0 (se suelta desde el reposo). */
  initialSpeed?: number;
}

export interface EnergyPoint {
  s: number;
  height: number;
  /** Rapidez (m/s). 0 si la canica no alcanza este punto. */
  speed: number;
  /** Energía cinética de traslación ½ m v² (J). */
  keTranslational: number;
  /** Energía cinética de rotación (J). 0 si no se considera rodadura. */
  keRotational: number;
  /** KE total = traslación + rotación (J). */
  keTotal: number;
  /** Energía potencial respecto a la altura mínima (J). */
  pe: number;
  /** Energía mecánica = PE + KE total (J). Constante si no hay fricción. */
  mechanical: number;
  /** Energía disipada por fricción hasta este punto (J). */
  frictionLoss: number;
  /** ¿La canica llega a este punto con la energía disponible? */
  reachable: boolean;
}

/** Masa efectiva según se considere o no la rodadura. */
export function effectiveMass(mass: number, rolling: boolean): number {
  return rolling ? ROLLING_MASS_FACTOR * mass : mass;
}

/**
 * Presupuesto de energía cinética disponible en `s` (J).
 * Puede ser negativo: significa que la canica no alcanza ese punto.
 */
export function kineticBudget(track: Track, s: number, height: number, p: EnergyParams): number {
  const h0 = track.samples[0].height;
  const ke0 = 0.5 * effectiveMass(p.mass, p.rolling) * (p.initialSpeed ?? 0) ** 2;
  const potentialDrop = p.mass * p.gravity * (h0 - height);
  const friction = p.friction * p.mass * p.gravity * s;
  return ke0 + potentialDrop - friction;
}

/** Rapidez en `s` a partir del presupuesto de energía cinética. */
export function speedAt(track: Track, s: number, height: number, p: EnergyParams): number {
  const ke = kineticBudget(track, s, height, p);
  if (ke <= 0) return 0;
  return Math.sqrt((2 * ke) / effectiveMass(p.mass, p.rolling));
}

/**
 * Perfil de energía en cada muestra de la pista.
 * Útil para las gráficas (energía/velocidad vs distancia).
 */
export function computeEnergyProfile(track: Track, p: EnergyParams): EnergyPoint[] {
  const mEff = effectiveMass(p.mass, p.rolling);
  return track.samples.map((sample) => {
    const budget = kineticBudget(track, sample.s, sample.height, p);
    const reachable = budget > 0;
    const keTotal = Math.max(0, budget);
    const speed = reachable ? Math.sqrt((2 * keTotal) / mEff) : 0;
    const keTranslational = 0.5 * p.mass * speed * speed;
    const keRotational = keTotal - keTranslational;
    const pe = p.mass * p.gravity * (sample.height - track.minHeight);
    const frictionLoss = p.friction * p.mass * p.gravity * sample.s;
    return {
      s: sample.s,
      height: sample.height,
      speed,
      keTranslational,
      keRotational,
      keTotal,
      pe,
      mechanical: pe + keTotal,
      frictionLoss,
      reachable,
    };
  });
}
