/**
 * Energía y velocidad a lo largo de la pista, por conservación de energía.
 *
 * La canica se suelta desde el reposo en el primer punto (o desde la altura
 * indicada). En cada punto:
 *
 *   Presupuesto de energía cinética:
 *     KE(s) = m·g·(h0 − h(s)) − W_fricción(s)
 *
 *   Dos modelos de fricción:
 *     • 'linear' (didáctico):  W_fricción(s) = μ·m·g·s
 *     • 'normal' (tubo real):  dW = μ·|N(s)|·ds, con N la fuerza de las paredes
 *       (peso sostenido + centrípeta). En curvas cerradas y espirales N crece
 *       con v², así que se pierde más energía justo donde el balín va rápido y
 *       gira. Se integra numéricamente a lo largo de la pista.
 *
 *   Si se considera rodadura (esfera sólida), la energía cinética se reparte
 *   entre traslación y rotación, así que la "masa efectiva" es (7/5)·m:
 *     KE = ½ · m_ef · v²   ⇒   v = √(2·KE / m_ef)
 *
 * Energía potencial de referencia: la altura mínima de la pista (PE ≥ 0).
 */

import { ROLLING_MASS_FACTOR } from './constants';
import { wallAccel } from './forces';
import type { Track } from './track';

export type FrictionModel = 'linear' | 'normal';

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
  /** Modelo de fricción (por defecto 'linear'). */
  frictionModel?: FrictionModel;
  /**
   * Arrastre cuadrático k (1/m), solo en el modelo 'normal': dW = m·k·v²·ds.
   * Representa pérdidas que crecen con la rapidez (golpeteo y roce del balín
   * dentro de la manguera). En una pendiente θ da una rapidez límite
   * v_lím = √(g·sen θ / k).
   */
  drag?: number;
  /** Pista cerrada (tubo): la canica no puede perder contacto. */
  enclosed?: boolean;
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

// --- Modelo 'normal': tabla integrada y cacheada por pista ---------------------

interface NormalTable {
  /** Presupuesto de KE en cada muestra (J); ≤ 0 ⇒ no alcanzable. */
  ke: Float64Array;
  /** Energía disipada acumulada (J). */
  loss: Float64Array;
}

const tableCache = new WeakMap<Track, Map<string, NormalTable>>();

function tableKey(p: EnergyParams): string {
  return `${p.mass}|${p.gravity}|${p.friction}|${p.drag ?? 0}|${p.rolling}|${p.initialSpeed ?? 0}`;
}

/**
 * Integra KE muestra a muestra:  KE_{i+1} = KE_i + m·g·(h_i − h_{i+1}) − μ·|N_i|·Δs.
 * Una vez que el presupuesto se agota, el resto de la pista queda inalcanzable.
 */
function normalTable(track: Track, p: EnergyParams): NormalTable {
  let perTrack = tableCache.get(track);
  if (!perTrack) {
    perTrack = new Map();
    tableCache.set(track, perTrack);
  }
  const key = tableKey(p);
  const cached = perTrack.get(key);
  if (cached) return cached;

  const arr = track.samples;
  const n = arr.length;
  const ke = new Float64Array(n);
  const loss = new Float64Array(n);
  const mEff = effectiveMass(p.mass, p.rolling);
  ke[0] = 0.5 * mEff * (p.initialSpeed ?? 0) ** 2;
  let stalled = false;
  for (let i = 1; i < n; i++) {
    const a = arr[i - 1];
    const b = arr[i];
    const ds = b.s - a.s;
    if (stalled) {
      ke[i] = -1;
      loss[i] = loss[i - 1];
      continue;
    }
    const v2 = Math.max(0, (2 * ke[i - 1]) / mEff);
    // Fuerza de las paredes en el punto medio del paso (más estable).
    const nA = wallAccel(a, v2, p.gravity);
    const nB = wallAccel(b, v2, p.gravity);
    const dLoss = (p.friction * 0.5 * (nA + nB) + (p.drag ?? 0) * v2) * p.mass * ds;
    const next = ke[i - 1] + p.mass * p.gravity * (a.height - b.height) - dLoss;
    loss[i] = loss[i - 1] + dLoss;
    ke[i] = next;
    // Sin energía: la canica se detiene aquí (y regresaría).
    if (next <= 0) stalled = true;
  }
  const table = { ke, loss };
  // Acotar la caché (la calibración prueba muchos parámetros).
  if (perTrack.size > 24) perTrack.clear();
  perTrack.set(key, table);
  return table;
}

/** Índice de la última muestra con s ≤ target y fracción hacia la siguiente. */
function locate(track: Track, s: number): { i: number; f: number } {
  const arr = track.samples;
  if (s <= 0) return { i: 0, f: 0 };
  if (s >= track.length) return { i: arr.length - 2, f: 1 };
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid].s <= s) lo = mid;
    else hi = mid - 1;
  }
  const a = arr[lo];
  const b = arr[Math.min(arr.length - 1, lo + 1)];
  const span = b.s - a.s;
  return { i: lo, f: span > 1e-12 ? (s - a.s) / span : 0 };
}

function interp(values: Float64Array, i: number, f: number): number {
  const j = Math.min(values.length - 1, i + 1);
  return values[i] + (values[j] - values[i]) * f;
}

// --- API -----------------------------------------------------------------------

/**
 * Presupuesto de energía cinética disponible en `s` (J).
 * Puede ser negativo: significa que la canica no alcanza ese punto.
 */
export function kineticBudget(track: Track, s: number, height: number, p: EnergyParams): number {
  if (p.frictionModel === 'normal') {
    const { i, f } = locate(track, s);
    return interp(normalTable(track, p).ke, i, f);
  }
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

/** Energía disipada por fricción hasta `s` (J). */
export function frictionLossAt(track: Track, s: number, p: EnergyParams): number {
  if (p.frictionModel === 'normal') {
    const { i, f } = locate(track, s);
    return interp(normalTable(track, p).loss, i, f);
  }
  return p.friction * p.mass * p.gravity * s;
}

/**
 * Perfil de energía en cada muestra de la pista.
 * Útil para las gráficas (energía/velocidad vs distancia).
 */
export function computeEnergyProfile(track: Track, p: EnergyParams): EnergyPoint[] {
  const mEff = effectiveMass(p.mass, p.rolling);
  const table = p.frictionModel === 'normal' ? normalTable(track, p) : null;
  return track.samples.map((sample, i) => {
    const budget = table ? table.ke[i] : kineticBudget(track, sample.s, sample.height, p);
    const reachable = budget > 0 || i === 0;
    const keTotal = Math.max(0, budget);
    const speed = reachable ? Math.sqrt((2 * keTotal) / mEff) : 0;
    const keTranslational = 0.5 * p.mass * speed * speed;
    const keRotational = keTotal - keTranslational;
    const pe = p.mass * p.gravity * (sample.height - track.minHeight);
    const frictionLoss = table ? table.loss[i] : p.friction * p.mass * p.gravity * sample.s;
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

/**
 * Tiempo acumulado (s) para llegar a cada muestra en el recorrido de ida:
 * t_i = t_{i−1} + Δs / v̄, con v̄ el promedio de rapidez del paso.
 * Infinity donde la canica ya no llega.
 */
export function computeTimeProfile(profile: EnergyPoint[]): number[] {
  const t: number[] = new Array(profile.length);
  t[0] = 0;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (!Number.isFinite(t[i - 1]) || !b.reachable) {
      t[i] = Infinity;
      continue;
    }
    const vAvg = 0.5 * (a.speed + b.speed);
    t[i] = vAvg > 1e-6 ? t[i - 1] + (b.s - a.s) / vAvg : Infinity;
  }
  return t;
}
