/**
 * Montaña rusa REAL del proyecto (imagenes/montaña-real-*.jpg y el video).
 *
 * Todo en metros. Sistema de coordenadas (igual que la vista del video):
 *   origen = centro de la base de la torre grande, sobre la tabla
 *   +x = hacia la torre mediana (derecha en el video)
 *   +y = arriba
 *   +z = hacia la cámara del video (frente)
 *
 * Medidas dadas: torres de 92 cm, 61 cm y 40.5 cm de alto, sección 8×8 cm;
 * balín de 1 cm de diámetro y 5 g. Lo demás (posiciones de las torres, alturas
 * de los brazos, trazo de la manguera) se estimó de las fotos y del video usando
 * las torres como escala. Si mides algo distinto, cámbialo aquí: la escena 3D,
 * la física y los cálculos salen de estos números.
 */

import { GRAVITY } from './constants';
import type { EnergyParams } from './energy';
import { computeEnergyProfile, computeTimeProfile } from './energy';
import { forceAt } from './forces';
import type { Track, Vec3 } from './track';
import { vec } from './track';

// --- Estructura física -----------------------------------------------------------

export interface Box {
  /** Centro (m). */
  center: Vec3;
  /** Tamaño x, y, z (m). */
  size: Vec3;
}

export interface Tower {
  id: 'grande' | 'mediana' | 'pequena';
  label: string;
  /** Centro de la base (m). */
  base: Vec3;
  height: number;
  /** Lado de la sección cuadrada (m). */
  side: number;
}

const SIDE = 0.08;

export const TOWERS: Tower[] = [
  { id: 'grande', label: 'Torre grande · 92 cm', base: vec(0, 0, 0), height: 0.92, side: SIDE },
  { id: 'mediana', label: 'Torre mediana · 61 cm', base: vec(0.5, 0, -0.08), height: 0.61, side: SIDE },
  { id: 'pequena', label: 'Torre pequeña · 40.5 cm', base: vec(0.6, 0, 0.3), height: 0.405, side: SIDE },
];

/** Brazos / cajas de soporte (foamboard blanco). */
export const ARMS: { id: string; label: string; box: Box }[] = [
  // Brazo alto de la torre grande: atraviesa la torre y sale hacia la mediana.
  { id: 'brazo-alto', label: 'Brazo alto (torre grande)', box: { center: vec(0.08, 0.6, 0), size: vec(0.26, 0.05, 0.06) } },
  // Brazo bajo de la torre grande (lado izquierdo): sostiene la vuelta final.
  { id: 'brazo-bajo', label: 'Brazo bajo (torre grande)', box: { center: vec(-0.115, 0.108, 0.02), size: vec(0.15, 0.03, 0.08) } },
  // Caja sobre la torre pequeña: la manguera la rodea con cinchos.
  { id: 'caja-pequena', label: 'Caja de la torre pequeña', box: { center: vec(0.7, 0.44, 0.3), size: vec(0.28, 0.07, 0.08) } },
];

/** Palitos de madera (abatelenguas) usados como refuerzo. Segmentos a→b. */
export const STICKS: { a: Vec3; b: Vec3 }[] = [
  { a: vec(0.54, 0.4, -0.04), b: vec(0.6, 0.49, -0.1) }, // mediana → vuelta
  { a: vec(0.64, 0.33, 0.3), b: vec(0.72, 0.405, 0.35) }, // pequeña → caja
  { a: vec(0.04, 0.5, 0.0), b: vec(0.14, 0.575, 0.0) }, // grande → brazo alto
];

/** Tabla de cartón (base). */
export const BOARD: Box = { center: vec(0.33, -0.003, 0.09), size: vec(1.3, 0.006, 0.82) };

/** Aro de cartón que recibe el balín al final (abierto al frente). */
export const CATCHER = {
  center: vec(0.08, 0, 0.07),
  radius: 0.18,
  height: 0.05,
  /** Medio ángulo de la abertura frontal (rad). */
  openingHalfAngle: 0.38,
};

/** Manguera transparente: radio exterior e interior (m). */
export const HOSE = { outerRadius: 0.011, innerRadius: 0.0075 };

/** Balín: 1 cm de diámetro, 5 g. */
export const BALL = { diameter: 0.01, radius: 0.005, mass: 0.005 };

// --- Trazo de la manguera ---------------------------------------------------------

export type CheckpointId =
  | 'inicio'
  | 'brazo'
  | 'vuelta_t'
  | 'entre'
  | 'm_entrada'
  | 'm_atras'
  | 'm_salida'
  | 's_punta'
  | 's_fin'
  | 't_atras'
  | 'brazo_bajo'
  | 'final';

export const CHECKPOINT_LABELS: Record<CheckpointId, string> = {
  inicio: 'Inicio (boca, torre grande)',
  brazo: 'Brazo alto (torre grande)',
  vuelta_t: 'Vuelta a la torre grande',
  entre: 'Entre torre grande y mediana',
  m_entrada: 'Entrada a la espiral (mediana)',
  m_atras: 'Detrás de la torre mediana',
  m_salida: 'Salida de la espiral (mediana)',
  s_punta: 'Punta de la caja (pequeña)',
  s_fin: 'Fin de los cinchos (pequeña)',
  t_atras: 'Detrás de la torre grande (bajo)',
  brazo_bajo: 'Brazo bajo (torre grande)',
  final: 'Final (entrada al aro)',
};

/** Nombres cortos para tablas. */
export const CHECKPOINT_SHORT: Record<CheckpointId, string> = {
  inicio: 'Inicio',
  brazo: 'Brazo alto',
  vuelta_t: 'Vuelta T. grande',
  entre: 'Entre torres',
  m_entrada: 'Entra espiral',
  m_atras: 'Tras T. mediana',
  m_salida: 'Sale espiral',
  s_punta: 'Punta caja',
  s_fin: 'Fin cinchos',
  t_atras: 'Tras T. grande',
  brazo_bajo: 'Brazo bajo',
  final: 'Final (aro)',
};

interface PathPoint {
  p: Vec3;
  id?: CheckpointId;
}

/** Punto en la vuelta alrededor de la torre mediana (radio 10 cm). */
function aroundMedium(deg: number, y: number): Vec3 {
  const c = TOWERS[1].base;
  const r = 0.1;
  const a = (deg * Math.PI) / 180;
  return vec(c.x + r * Math.cos(a), y, c.z + r * Math.sin(a));
}

const PATH: PathPoint[] = [
  // A · Arco desde la boca (sobre la torre grande) hasta la punta del brazo alto.
  { p: vec(-0.07, 0.945, 0.02), id: 'inicio' },
  { p: vec(0.0, 0.94, 0.025) },
  { p: vec(0.09, 0.917, 0.03) },
  { p: vec(0.165, 0.845, 0.025) },
  { p: vec(0.215, 0.73, 0.015) },
  { p: vec(0.195, 0.65, -0.005), id: 'brazo' },
  // B · Vuelta completa a la torre grande: por detrás, lado izquierdo, al frente.
  { p: vec(0.13, 0.632, -0.085) },
  { p: vec(0.02, 0.616, -0.125) },
  { p: vec(-0.1, 0.601, -0.085) },
  { p: vec(-0.13, 0.589, 0.03) },
  { p: vec(-0.06, 0.572, 0.11), id: 'vuelta_t' },
  // C · Curva en S hacia la torre mediana.
  { p: vec(0.07, 0.556, 0.135) },
  { p: vec(0.21, 0.538, 0.115), id: 'entre' },
  { p: vec(0.34, 0.522, 0.05) },
  // M · Espiral alrededor de la torre mediana (izq → atrás → der). En el video
  //     el tubo sube unos centímetros aquí (el balín se frena visiblemente).
  { p: aroundMedium(180, 0.53), id: 'm_entrada' },
  { p: aroundMedium(225, 0.545) },
  { p: aroundMedium(270, 0.553), id: 'm_atras' },
  { p: aroundMedium(315, 0.55) },
  { p: aroundMedium(360, 0.54), id: 'm_salida' },
  // D · Bajada hacia la punta de la caja de la torre pequeña.
  { p: vec(0.64, 0.522, 0.03) },
  { p: vec(0.74, 0.495, 0.16) },
  { p: vec(0.845, 0.47, 0.215) },
  // S · Rodea la punta de la caja y regresa pegada al frente (cinchos).
  { p: vec(0.885, 0.455, 0.3), id: 's_punta' },
  { p: vec(0.845, 0.449, 0.358) },
  { p: vec(0.76, 0.443, 0.36) },
  { p: vec(0.67, 0.437, 0.36) },
  { p: vec(0.57, 0.43, 0.358), id: 's_fin' },
  // E · Baja por detrás de la torre grande, pasa sobre el brazo bajo y la
  //     rodea por la izquierda hasta el aro de cartón.
  { p: vec(0.46, 0.405, 0.33) },
  { p: vec(0.34, 0.35, 0.22) },
  { p: vec(0.22, 0.29, 0.08) },
  { p: vec(0.1, 0.24, -0.06) },
  { p: vec(-0.01, 0.2, -0.115), id: 't_atras' },
  { p: vec(-0.12, 0.165, -0.06) },
  { p: vec(-0.155, 0.142, 0.03), id: 'brazo_bajo' },
  { p: vec(-0.15, 0.105, 0.14) },
  { p: vec(-0.08, 0.065, 0.24) },
  { p: vec(0.02, 0.035, 0.28) },
  { p: vec(0.09, 0.018, 0.27), id: 'final' },
];

/** Puntos de control de la manguera (para buildTrack). */
export function realCoasterPoints(): Vec3[] {
  return PATH.map((q) => vec(q.p.x, q.p.y, q.p.z));
}

/** Puntos de control con nombre (puntos de referencia del recorrido). */
export const CHECKPOINTS: { id: CheckpointId; index: number }[] = PATH.flatMap((q, index) =>
  q.id ? [{ id: q.id, index }] : [],
);

/** Longitud de arco de cada punto de referencia en una pista ya construida. */
export function checkpointArcLengths(track: Track): Record<CheckpointId, number> {
  const out = {} as Record<CheckpointId, number>;
  for (const cp of CHECKPOINTS) {
    const target = track.controlPoints[cp.index];
    if (!target) continue;
    let best = 0;
    let bestD = Infinity;
    for (const smp of track.samples) {
      const dx = smp.pos.x - target.x;
      const dy = smp.pos.y - target.y;
      const dz = smp.pos.z - target.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = smp.s;
      }
    }
    out[cp.id] = best;
  }
  return out;
}

// --- Mediciones del video -----------------------------------------------------------

/**
 * Tiempos medidos en imagenes/video-montaña-rsua.mp4 (29.65 fps), rastreando el
 * balín con diferencia de cuadros sobre el video estabilizado. El soltado se ve
 * en el cuadro ≈5, así que t = (cuadro − 5) / 29.65.
 * `weight` refleja qué tan seguro es cada dato (1 = se ve claro).
 */
export const VIDEO_FPS = 29.65;
export const VIDEO_RELEASE_FRAME = 5;

export const VIDEO_CHECKPOINTS: { id: CheckpointId; frame: number; weight: number; note: string }[] = [
  { id: 'entre', frame: 43, weight: 1, note: 'cruza la curva en S' },
  { id: 'm_entrada', frame: 52, weight: 0.5, note: 'llega a la torre mediana' },
  { id: 'm_atras', frame: 61, weight: 0.7, note: 'detrás de la mediana' },
  { id: 'm_salida', frame: 69, weight: 1, note: 'sale de la espiral' },
  { id: 's_punta', frame: 84, weight: 1, note: 'punta de la caja (pequeña)' },
  { id: 's_fin', frame: 95, weight: 1, note: 'termina los cinchos' },
  { id: 'final', frame: 140, weight: 0.3, note: 'entra al aro (se ve rodando a los 160)' },
];

export const videoTime = (frame: number): number => (frame - VIDEO_RELEASE_FRAME) / VIDEO_FPS;

// --- Parámetros físicos -------------------------------------------------------------

/** Parámetros base del balín real (μ se calibra con el video). */
export const REAL_BASE_PARAMS: EnergyParams = {
  mass: BALL.mass,
  gravity: GRAVITY.earth,
  friction: 0,
  rolling: true,
  initialSpeed: 0,
  frictionModel: 'normal',
  enclosed: true,
};

/** Tiempos simulados (s) a cada punto de referencia. */
export function simulatedCheckpointTimes(track: Track, params: EnergyParams): Record<CheckpointId, number> {
  const profile = computeEnergyProfile(track, params);
  const times = computeTimeProfile(profile);
  const sOf = checkpointArcLengths(track);
  const out = {} as Record<CheckpointId, number>;
  for (const cp of CHECKPOINTS) {
    const s = sOf[cp.id];
    // Muestra más cercana a esa longitud de arco.
    let i = 0;
    while (i < track.samples.length - 1 && track.samples[i].s < s) i++;
    out[cp.id] = times[i];
  }
  return out;
}

/** Error cuadrático ponderado entre tiempos simulados y medidos (s²). */
export function videoFitError(track: Track, params: EnergyParams): number {
  const sim = simulatedCheckpointTimes(track, params);
  let err = 0;
  let wSum = 0;
  for (const c of VIDEO_CHECKPOINTS) {
    const t = sim[c.id];
    const d = Number.isFinite(t) ? t - videoTime(c.frame) : 10;
    err += c.weight * d * d;
    wSum += c.weight;
  }
  return err / wSum;
}

/**
 * Calibra las pérdidas para que los tiempos simulados se parezcan lo más
 * posible a los del video: μ (rodadura, proporcional a la fuerza de las
 * paredes) y k (arrastre cuadrático). Malla gruesa + búsqueda por patrones.
 */
export function calibrateLosses(
  track: Track,
  base: EnergyParams = REAL_BASE_PARAMS,
): { mu: number; drag: number; rmsError: number } {
  const f = (mu: number, drag: number) =>
    mu < 0 || drag < 0 ? Infinity : videoFitError(track, { ...base, friction: mu, drag });
  let mu = 0;
  let drag = 0;
  let best = Infinity;
  for (let m = 0; m <= 0.3 + 1e-9; m += 0.02) {
    for (let k = 0; k <= 3 + 1e-9; k += 0.1) {
      const e = f(m, k);
      if (e < best) {
        best = e;
        mu = m;
        drag = k;
      }
    }
  }
  let dm = 0.01;
  let dk = 0.05;
  for (let it = 0; it < 60 && dm > 1e-4; it++) {
    let improved = false;
    for (const [a, b] of [[dm, 0], [-dm, 0], [0, dk], [0, -dk]]) {
      const e = f(mu + a, drag + b);
      if (e < best) {
        best = e;
        mu += a;
        drag += b;
        improved = true;
      }
    }
    if (!improved) {
      dm /= 2;
      dk /= 2;
    }
  }
  return { mu, drag, rmsError: Math.sqrt(best) };
}

// --- Cálculos para el reporte ---------------------------------------------------------

export interface CheckpointRow {
  id: CheckpointId;
  label: string;
  s: number;
  height: number;
  /** Rapidez con fricción calibrada (m/s). */
  speed: number;
  /** Rapidez ideal: sin fricción, rodando (m/s). */
  speedIdeal: number;
  keTotal: number;
  pe: number;
  mechanical: number;
  frictionLoss: number;
  /** Fuerza de las paredes en g's. */
  gForce: number;
  /** Tiempo simulado desde el soltado (s). */
  time: number;
  /** Tiempo medido en el video (s), si existe. */
  videoTime?: number;
}

export interface RealReport {
  rows: CheckpointRow[];
  length: number;
  h0: number;
  hEnd: number;
  drop: number;
  e0: number;
  eEnd: number;
  lostFraction: number;
  totalTime: number;
  avgSpeed: number;
  maxSpeed: number;
  maxSpeedIdeal: number;
  maxG: number;
  /** v final ideal resbalando (sin rodar): √(2 g Δh). */
  vEndSliding: number;
  /** v final ideal rodando: √(10/7 g Δh). */
  vEndRolling: number;
  /** Momento de inercia del balín (kg·m²). */
  inertia: number;
}

export function realCoasterReport(track: Track, params: EnergyParams): RealReport {
  const profile = computeEnergyProfile(track, params);
  const ideal = computeEnergyProfile(track, { ...params, friction: 0, drag: 0 });
  const times = computeTimeProfile(profile);
  const sOf = checkpointArcLengths(track);
  const idx = (s: number) => {
    let i = 0;
    while (i < track.samples.length - 1 && track.samples[i].s < s) i++;
    return i;
  };
  const videoById = new Map(VIDEO_CHECKPOINTS.map((c) => [c.id, videoTime(c.frame)]));
  const rows: CheckpointRow[] = CHECKPOINTS.map(({ id }) => {
    const i = idx(sOf[id]);
    const p = profile[i];
    return {
      id,
      label: CHECKPOINT_LABELS[id],
      s: p.s,
      height: p.height,
      speed: p.speed,
      speedIdeal: ideal[i].speed,
      keTotal: p.keTotal,
      pe: p.pe,
      mechanical: p.mechanical,
      frictionLoss: p.frictionLoss,
      gForce: forceAt(track.samples[i], p.speed, params).gForce,
      time: times[i],
      videoTime: id === 'inicio' ? 0 : videoById.get(id),
    };
  });

  let maxSpeed = 0;
  let maxSpeedIdeal = 0;
  let maxG = 0;
  profile.forEach((p, i) => {
    maxSpeed = Math.max(maxSpeed, p.speed);
    maxSpeedIdeal = Math.max(maxSpeedIdeal, ideal[i].speed);
    if (p.reachable) maxG = Math.max(maxG, forceAt(track.samples[i], p.speed, params).gForce);
  });

  const first = profile[0];
  const last = profile[profile.length - 1];
  const g = params.gravity;
  const drop = first.height - last.height;
  const totalTime = times[times.length - 1];
  return {
    rows,
    length: track.length,
    h0: first.height,
    hEnd: last.height,
    drop,
    e0: first.mechanical,
    eEnd: last.mechanical,
    lostFraction: first.mechanical > 0 ? 1 - last.mechanical / first.mechanical : 0,
    totalTime,
    avgSpeed: Number.isFinite(totalTime) && totalTime > 0 ? track.length / totalTime : 0,
    maxSpeed,
    maxSpeedIdeal,
    maxG,
    vEndSliding: Math.sqrt(2 * g * drop),
    vEndRolling: Math.sqrt((10 / 7) * g * drop),
    inertia: (2 / 5) * params.mass * BALL.radius * BALL.radius,
  };
}
