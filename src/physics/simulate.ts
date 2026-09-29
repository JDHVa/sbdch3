/**
 * Integrador temporal del movimiento de la canica sobre la pista.
 *
 * El estado es la posición `s` (longitud de arco) y el sentido de avance.
 * Se integra ds/dt = v(s), con v obtenida por conservación de energía.
 * Si la canica se queda sin energía cinética (punto de retorno), invierte el
 * sentido; si llega al final o regresa al inicio, termina.
 *
 * Nota didáctica: la fricción se modela como función de `s` (posición), no del
 * camino total recorrido, así que el recorrido "de ida" es el fiel; los rebotes
 * son una aproximación.
 */

import { speedAt, computeEnergyProfile } from './energy';
import { forceAt } from './forces';
import type { EnergyParams } from './energy';
import type { ForceResult } from './forces';
import type { Track, Vec3 } from './track';
import { sampleAt } from './track';

export interface SimState {
  /** Longitud de arco actual (m). */
  s: number;
  /** Sentido de avance: +1 hacia adelante, −1 de regreso. */
  direction: 1 | -1;
  /** Tiempo transcurrido (s). */
  time: number;
  /** El recorrido terminó (llegó al final o quedó detenida). */
  finished: boolean;
}

export function createSimState(): SimState {
  return { s: 0, direction: 1, time: 0, finished: false };
}

const MIN_SPEED = 1e-4;
const SUBSTEPS = 8;

/**
 * Avanza la simulación `dt` segundos. Devuelve un **nuevo** estado (inmutable).
 */
export function step(track: Track, params: EnergyParams, state: SimState, dt: number): SimState {
  if (state.finished) return state;

  let s = state.s;
  let direction = state.direction;
  let finished = false;
  const h = dt / SUBSTEPS;

  for (let i = 0; i < SUBSTEPS; i++) {
    const v = speedAt(track, s, sampleAt(track, s).height, params);

    if (v < MIN_SPEED) {
      // Punto de retorno: intenta moverse; si no puede, invierte; si tampoco, se detiene.
      const probe = s + direction * 1e-3;
      const canGo =
        probe >= 0 &&
        probe <= track.length &&
        speedAt(track, probe, sampleAt(track, probe).height, params) > MIN_SPEED;
      if (canGo) {
        s = probe;
      } else {
        direction = (direction * -1) as 1 | -1;
        const probe2 = s + direction * 1e-3;
        const canReverse =
          probe2 >= 0 &&
          probe2 <= track.length &&
          speedAt(track, probe2, sampleAt(track, probe2).height, params) > MIN_SPEED;
        if (canReverse) {
          s = probe2;
        } else {
          finished = true;
          break;
        }
      }
      continue;
    }

    s += direction * v * h;

    if (s >= track.length) {
      s = track.length;
      if (direction === 1) {
        finished = true;
        break;
      }
    }
    if (s <= 0) {
      s = 0;
      if (direction === -1) {
        finished = true;
        break;
      }
    }
  }

  return { s, direction, time: state.time + dt, finished };
}

// --- Lectura instantánea ------------------------------------------------------

export interface Readout {
  s: number;
  position: Vec3;
  height: number;
  speed: number;
  keTranslational: number;
  keRotational: number;
  keTotal: number;
  pe: number;
  mechanical: number;
  force: ForceResult;
}

/** Estado físico completo en la posición `s` (para los paneles y la canica 3D). */
export function readout(track: Track, params: EnergyParams, s: number): Readout {
  const sample = sampleAt(track, s);
  const speed = speedAt(track, s, sample.height, params);
  const mEff = params.rolling ? (7 / 5) * params.mass : params.mass;
  const keTotal = 0.5 * mEff * speed * speed;
  const keTranslational = 0.5 * params.mass * speed * speed;
  const keRotational = keTotal - keTranslational;
  const pe = params.mass * params.gravity * (sample.height - track.minHeight);
  const force = forceAt(sample, speed, params);
  return {
    s,
    position: sample.pos,
    height: sample.height,
    speed,
    keTranslational,
    keRotational,
    keTotal,
    pe,
    mechanical: pe + keTotal,
    force,
  };
}

export { computeEnergyProfile };
