/**
 * Constantes físicas y presets del simulador.
 * Módulo puro: sin dependencias de React ni Three.js.
 * Unidades del SI: metros (m), kilogramos (kg), segundos (s), newtons (N).
 */

/** Gravedades disponibles (m/s²). */
export const GRAVITY = {
  earth: 9.81,
  moon: 1.62,
  mars: 3.72,
} as const;

export type GravityKey = keyof typeof GRAVITY;

/**
 * Momento de inercia de una esfera sólida: I = (2/5) m r².
 * Al rodar sin deslizar, la energía cinética total es
 *   KE = ½ m v² (1 + I/(m r²)) = (7/5) · ½ m v².
 * Por eso la "masa efectiva" al considerar rodadura es (7/5) m.
 */
export const SOLID_SPHERE_INERTIA_FACTOR = 2 / 5;
export const ROLLING_MASS_FACTOR = 1 + SOLID_SPHERE_INERTIA_FACTOR; // 7/5

/** Tipos de "canica" con masa (kg) y radio (m) aproximados. */
export interface MarblePreset {
  id: string;
  label: string;
  mass: number;
  radius: number;
}

export const MARBLE_PRESETS: MarblePreset[] = [
  { id: 'glass', label: 'Canica de vidrio', mass: 0.005, radius: 0.008 },
  { id: 'steel', label: 'Balín de acero', mass: 0.028, radius: 0.009 },
  { id: 'wood', label: 'Bolita de madera', mass: 0.002, radius: 0.01 },
];

/**
 * Coeficiente de fricción efectivo (adimensional). En este modelo didáctico
 * representa la fracción del peso que se "pierde" por metro recorrido:
 *   W_fricción(s) ≈ μ · m · g · s
 * Valores típicos de pista de cartón: 0.01 – 0.08.
 */
export const FRICTION_PRESETS = {
  none: 0,
  smooth: 0.01,
  cardboard: 0.04,
  rough: 0.08,
} as const;

/** Umbral de curvatura por debajo del cual tratamos el tramo como recto. */
export const CURVATURE_EPSILON = 1e-3;
