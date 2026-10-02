/**
 * Fuerza normal y "g's" a lo largo de la pista.
 *
 * Usamos la normal de soporte ŝ (el lado donde la canica se apoya) y la
 * curvatura con signo κ_s respecto a ese lado. Del balance de fuerzas
 * perpendiculares a la pista (la aceleración centrípeta es v²·κ hacia el centro):
 *
 *   N = m·(v²·κ_s + g·ŝ_y)
 *
 * donde N es la fuerza que la pista ejerce sobre la canica. Como una pista
 * abierta solo puede **empujar** (no jalar), la canica **pierde contacto**
 * cuando N < 0. Este único criterio da lo correcto en los tres casos:
 *
 *   • Cima de un rizo (ball por dentro): κ_s > 0, ŝ apunta hacia abajo (ŝ_y=−1)
 *     ⇒ N = m·(v²/R − g); se cae si v² < g·R  (criterio clásico del rizo).
 *   • Cima de una colina (ball por encima): κ_s < 0, ŝ_y ≈ +1
 *     ⇒ N = m·(g − v²·κ); se despega ("airtime") si va demasiado rápido.
 *   • Valle o tramo recto: N ≈ m·g·(componente de apoyo), siempre positiva.
 *
 * Pista **cerrada** (tubo / manguera, `enclosed`): las paredes empujan en
 * cualquier dirección perpendicular, así que la canica nunca pierde contacto.
 * La fuerza de las paredes es el vector
 *
 *   N⃗ = m·(v²·κ⃗ + g·(ŷ − (ŷ·t̂)·t̂))
 *
 * (centrípeta en 3D + la parte del peso que la pared sostiene) y se reporta su
 * magnitud |N⃗|.
 *
 * Los "g's" son N / (m·g): cuántas veces su peso siente la canica.
 */

import { CURVATURE_EPSILON } from './constants';
import type { SampledPoint } from './track';

export interface ForceResult {
  /** Fuerza normal que la pista ejerce sobre la canica (N). */
  normalForce: number;
  /** Aceleración en g's: N / (m·g). */
  gForce: number;
  /** Aceleración centrípeta |v²·κ| (m/s²). */
  centripetal: number;
  /** ¿La canica perdería contacto con la pista aquí? */
  losesContact: boolean;
}

export interface ForceParams {
  mass: number;
  gravity: number;
  /** Pista cerrada (tubo): las paredes sostienen en cualquier dirección. */
  enclosed?: boolean;
}

/**
 * Magnitud de la fuerza de las paredes por unidad de masa (m/s²) en un tubo:
 * |v²·κ⃗ + g·(ŷ − (ŷ·t̂)·t̂)|.
 */
export function wallAccel(sample: SampledPoint, speedSq: number, gravity: number): number {
  const t = sample.tangent;
  const k = sample.curvatureVec;
  const ty = t.y;
  const x = speedSq * k.x + gravity * (0 - ty * t.x);
  const y = speedSq * k.y + gravity * (1 - ty * t.y);
  const z = speedSq * k.z + gravity * (0 - ty * t.z);
  return Math.sqrt(x * x + y * y + z * z);
}

/** Fuerza normal y g's en una muestra de la pista, dada la rapidez. */
export function forceAt(sample: SampledPoint, speed: number, p: ForceParams): ForceResult {
  const { mass, gravity } = p;

  if (p.enclosed) {
    const k = sample.curvatureVec;
    const kappa = Math.sqrt(k.x * k.x + k.y * k.y + k.z * k.z);
    const normalForce = mass * wallAccel(sample, speed * speed, gravity);
    return {
      normalForce,
      gForce: gravity > 0 ? normalForce / (mass * gravity) : 0,
      centripetal: speed * speed * kappa,
      losesContact: false,
    };
  }

  const kappaS = sample.curvature; // curvatura con signo respecto al soporte
  const centripetal = speed * speed * Math.abs(kappaS);

  // N = m·(v²·κ_s + g·ŝ_y)
  const normalForce = mass * (speed * speed * kappaS + gravity * sample.supportNormal.y);

  const gForce = gravity > 0 ? normalForce / (mass * gravity) : 0;
  // Solo tiene sentido "perder contacto" donde hay curvatura apreciable.
  const losesContact = Math.abs(kappaS) > CURVATURE_EPSILON && normalForce < 0;

  return { normalForce, gForce, centripetal, losesContact };
}
