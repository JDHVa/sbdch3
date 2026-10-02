/**
 * Modelo geométrico de la pista.
 * Módulo puro (sin Three.js): la pista es una curva paramétrica 3D construida
 * con un spline Catmull-Rom a partir de puntos de control. Se muestrea densamente
 * para obtener, en cada punto, la longitud de arco `s`, la altura, la tangente,
 * la curvatura κ y la normal principal (dirección hacia el centro de curvatura).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// --- Álgebra vectorial mínima -------------------------------------------------

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const normalize = (a: Vec3): Vec3 => {
  const len = length(a);
  return len > 1e-12 ? scale(a, 1 / len) : vec(0, 0, 0);
};

// --- Muestras y pista ---------------------------------------------------------

export interface SampledPoint {
  /** Longitud de arco acumulada desde el inicio (m). */
  s: number;
  /** Posición 3D (m). */
  pos: Vec3;
  /** Tangente unitaria (sentido de avance). */
  tangent: Vec3;
  /**
   * Normal de soporte unitaria: el lado de la pista donde se apoya la canica.
   * Se calcula por continuidad a lo largo de la pista partiendo de "hacia
   * arriba", de modo que dentro de un rizo gira automáticamente hacia el
   * interior (la canica va por dentro del loop).
   */
  supportNormal: Vec3;
  /**
   * Curvatura con signo respecto a la normal de soporte (1/m):
   *   > 0  la pista se curva hacia el lado del soporte (valle, fondo/costados
   *        de un rizo) → la normal empuja "sumando" al peso.
   *   < 0  la pista se curva en contra (cima de colina o cima de rizo).
   *   ≈ 0  tramo recto.
   */
  curvature: number;
  /**
   * Vector de curvatura dT/ds (1/m): apunta al centro de curvatura y su
   * magnitud es κ = 1/R. Sirve para la fuerza de las paredes en un tubo 3D.
   */
  curvatureVec: Vec3;
  /** Altura = componente Y (m). */
  height: number;
}

export interface Track {
  samples: SampledPoint[];
  length: number;
  minHeight: number;
  maxHeight: number;
  controlPoints: Vec3[];
}

/**
 * Punto de un spline Catmull-Rom uniforme para el segmento p1→p2,
 * usando los vecinos p0 y p3. `t` ∈ [0, 1].
 */
function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const comp = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return {
    x: comp(p0.x, p1.x, p2.x, p3.x),
    y: comp(p0.y, p1.y, p2.y, p3.y),
    z: comp(p0.z, p1.z, p2.z, p3.z),
  };
}

/**
 * Vector unitario perpendicular a la tangente, obtenido proyectando `hint`
 * (por defecto "hacia arriba") sobre el plano perpendicular a la tangente.
 * Si `hint` es casi paralelo a la tangente (tramo vertical), usa un eje alterno.
 */
function perpToTangent(t: Vec3, hint: Vec3): Vec3 {
  let s = sub(hint, scale(t, dot(hint, t)));
  if (length(s) < 1e-6) {
    // hint ~ paralelo a t: usar otro eje de referencia.
    const alt = Math.abs(t.x) < 0.9 ? vec(1, 0, 0) : vec(0, 0, 1);
    s = sub(alt, scale(t, dot(alt, t)));
  }
  s = normalize(s);
  return s.y < 0 ? scale(s, -1) : s; // preferir el lado "hacia arriba"
}

/**
 * Construye la pista muestreada a partir de los puntos de control.
 * @param controlPoints al menos 2 puntos.
 * @param samplesPerSegment cuántas muestras generar por segmento (resolución).
 */
export function buildTrack(controlPoints: Vec3[], samplesPerSegment = 24): Track {
  if (controlPoints.length < 2) {
    throw new Error('La pista necesita al menos 2 puntos de control.');
  }

  const cp = controlPoints;
  const n = cp.length;
  // Puntos fantasma en los extremos (duplicados) para cerrar el spline.
  const at = (i: number): Vec3 => cp[Math.max(0, Math.min(n - 1, i))];

  const positions: Vec3[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const steps = samplesPerSegment;
    // No repetir el primer punto del siguiente segmento (se añade al final).
    const last = i === n - 2 ? steps : steps - 1;
    for (let j = 0; j <= last; j++) {
      positions.push(catmullRom(p0, p1, p2, p3, j / steps));
    }
  }

  // Longitud de arco acumulada.
  const s: number[] = new Array(positions.length);
  s[0] = 0;
  for (let i = 1; i < positions.length; i++) {
    s[i] = s[i - 1] + length(sub(positions[i], positions[i - 1]));
  }

  // Tangentes por diferencias centradas.
  const tangents: Vec3[] = positions.map((_, i) => {
    const prev = positions[Math.max(0, i - 1)];
    const next = positions[Math.min(positions.length - 1, i + 1)];
    return normalize(sub(next, prev));
  });

  // Normal de soporte por transporte paralelo (válido en 3D completo): arranca
  // "hacia arriba" perpendicular a la tangente y se transporta a lo largo de la
  // curva proyectándola perpendicular a cada nueva tangente. Así gira de forma
  // continua dentro de un rizo (en cualquier orientación) sin degenerar. La
  // curvatura con signo respecto al soporte es κ_s = (dT/ds)·ŝ. Para una pista
  // en el plano xy esto coincide con la perpendicular en xy de antes.
  const samples: SampledPoint[] = [];
  let support = perpToTangent(tangents[0], vec(0, 1, 0));
  for (let i = 0; i < positions.length; i++) {
    const iPrev = Math.max(0, i - 1);
    const iNext = Math.min(positions.length - 1, i + 1);
    const ds = s[iNext] - s[iPrev];
    const dTds = ds > 1e-9 ? scale(sub(tangents[iNext], tangents[iPrev]), 1 / ds) : vec();

    // Transporte paralelo: quitar la componente tangente y renormalizar.
    const t = tangents[i];
    support = normalize(sub(support, scale(t, dot(support, t))));
    if (length(support) < 1e-6) support = perpToTangent(t, vec(0, 1, 0));

    const curvature = dot(dTds, support); // κ con signo
    samples.push({
      s: s[i],
      pos: positions[i],
      tangent: t,
      supportNormal: support,
      curvature,
      curvatureVec: dTds,
      height: positions[i].y,
    });
  }

  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (const p of samples) {
    if (p.height < minHeight) minHeight = p.height;
    if (p.height > maxHeight) maxHeight = p.height;
  }

  return {
    samples,
    length: s[s.length - 1],
    minHeight,
    maxHeight,
    controlPoints: cp,
  };
}

/** Índice de la última muestra con `s <= target` (búsqueda binaria). */
function lowerIndex(track: Track, sTarget: number): number {
  const arr = track.samples;
  let lo = 0;
  let hi = arr.length - 1;
  if (sTarget <= arr[0].s) return 0;
  if (sTarget >= arr[hi].s) return hi - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (arr[mid].s <= sTarget) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Interpola una muestra a la longitud de arco `s` (con clamp a los extremos). */
export function sampleAt(track: Track, sTarget: number): SampledPoint {
  const arr = track.samples;
  const s = Math.max(0, Math.min(track.length, sTarget));
  const i = lowerIndex(track, s);
  const a = arr[i];
  const b = arr[Math.min(arr.length - 1, i + 1)];
  const span = b.s - a.s;
  const f = span > 1e-9 ? (s - a.s) / span : 0;
  return {
    s,
    pos: add(a.pos, scale(sub(b.pos, a.pos), f)),
    tangent: normalize(add(a.tangent, scale(sub(b.tangent, a.tangent), f))),
    supportNormal: normalize(add(a.supportNormal, scale(sub(b.supportNormal, a.supportNormal), f))),
    curvature: a.curvature + (b.curvature - a.curvature) * f,
    curvatureVec: add(a.curvatureVec, scale(sub(b.curvatureVec, a.curvatureVec), f)),
    height: a.height + (b.height - a.height) * f,
  };
}

/** Altura de la pista a la longitud de arco `s`. */
export function heightAt(track: Track, s: number): number {
  return sampleAt(track, s).height;
}
