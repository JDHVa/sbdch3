/**
 * Pista por defecto y utilidades para construir tramos (loops).
 * Las coordenadas están en metros. `x` avanza horizontalmente, `y` es la altura,
 * `z` se deja en 0 (la física solo depende de la altura).
 */

import type { EnergyParams } from './energy';
import { GRAVITY } from './constants';
import { MARBLE_PRESETS } from './constants';
import type { Vec3 } from './track';
import { vec } from './track';

/**
 * Genera los puntos de un loop vertical (circunferencia en el plano x-y) que
 * entra por abajo moviéndose en +x y sale por abajo, con un pequeño avance
 * horizontal (`drift`) para que la pista no se solape exactamente consigo misma.
 *
 * @param entry punto de entrada (parte baja del loop).
 * @param radius radio del loop (m).
 * @param count número de puntos generados alrededor del círculo.
 * @param drift avance horizontal total a lo largo del loop (m).
 */
export function makeVerticalLoop(entry: Vec3, radius: number, count = 16, drift = 0.12): Vec3[] {
  const center = vec(entry.x, entry.y + radius, entry.z);
  const points: Vec3[] = [];
  const start = -Math.PI / 2; // parte baja
  for (let k = 1; k <= count; k++) {
    const theta = start + (2 * Math.PI * k) / count;
    const frac = k / count;
    points.push(
      vec(
        center.x + radius * Math.cos(theta) + drift * frac,
        center.y + radius * Math.sin(theta),
        center.z,
      ),
    );
  }
  return points;
}

export interface CoasterShape {
  /** Altura de soltado (m): altura del primer punto. */
  releaseHeight: number;
  /** Radio del loop (m). */
  loopRadius: number;
}

export const DEFAULT_SHAPE: CoasterShape = {
  releaseHeight: 1.2,
  loopRadius: 0.28,
};

/**
 * Puntos de control de la montaña rusa por defecto: rampa alta de bajada,
 * un valle, un loop vertical y colinas suaves hasta el final.
 */
export function defaultCoasterPoints(shape: CoasterShape = DEFAULT_SHAPE): Vec3[] {
  const { releaseHeight, loopRadius } = shape;
  const loopEntry = vec(1.8, 0.2, 0);
  const points: Vec3[] = [
    vec(0.0, releaseHeight, 0), // soltado (arriba a la izquierda)
    vec(0.6, releaseHeight * 0.75, 0),
    vec(1.2, 0.35, 0), // primera bajada
    loopEntry, // entrada al loop
    ...makeVerticalLoop(loopEntry, loopRadius),
    vec(2.6, 0.28, 0), // colina suave
    vec(3.3, 0.15, 0),
    vec(4.0, 0.1, 0), // llegada
  ];
  return points;
}

/** Parámetros físicos por defecto (canica de vidrio, gravedad terrestre). */
export const DEFAULT_ENERGY_PARAMS: EnergyParams = {
  mass: MARBLE_PRESETS[0].mass,
  gravity: GRAVITY.earth,
  friction: 0.02,
  rolling: true,
  initialSpeed: 0,
};
