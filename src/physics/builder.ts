/**
 * Constructor de pistas por piezas (estilo juego).
 * Cada pieza mueve un "cursor" (posición + rumbo) y emite puntos de control 3D.
 * Entre piezas el cursor queda siempre nivelado (las colinas y el rizo vuelven a
 * la horizontal), así se componen limpiamente. Escala de parque real (metros).
 */

import type { Vec3 } from './track';
import { vec } from './track';

export type PieceType = 'straight' | 'up' | 'down' | 'left' | 'right' | 'loop';

export interface PieceDef {
  type: PieceType;
  label: string;
  icon: string;
}

export const PIECES: PieceDef[] = [
  { type: 'straight', label: 'Recto', icon: '→' },
  { type: 'up', label: 'Subida', icon: '↗' },
  { type: 'down', label: 'Bajada', icon: '↘' },
  { type: 'left', label: 'Curva izq.', icon: '↰' },
  { type: 'right', label: 'Curva der.', icon: '↱' },
  { type: 'loop', label: 'Rizo', icon: '◯' },
];

// Escala de las piezas (m).
const STRAIGHT_LEN = 14;
const HILL_LEN = 22;
const HILL_UP = 12;
const HILL_DOWN = 20;
const TURN_RADIUS = 14;
const LOOP_RADIUS = 6;
const STEPS = 10; // subdivisión (puntos de control) por pieza curva

/** Altura de arranque: el punto de salida es el más alto (se suelta desde el reposo). */
export const BUILDER_START: { pos: Vec3; yaw: number } = { pos: vec(0, 40, 0), yaw: 0 };

interface Cursor {
  pos: Vec3;
  yaw: number; // rumbo en el plano xz (rad); 0 = +x
}

const forward = (yaw: number): Vec3 => vec(Math.cos(yaw), 0, Math.sin(yaw));
const smooth = (f: number): number => f * f * (3 - 2 * f); // smoothstep

/** Emite los puntos de una pieza y avanza el cursor (lo muta). */
function emitPiece(type: PieceType, cur: Cursor, out: Vec3[]): void {
  const push = (p: Vec3) => out.push(vec(p.x, p.y, p.z));

  switch (type) {
    case 'straight': {
      const f = forward(cur.yaw);
      cur.pos = vec(cur.pos.x + f.x * STRAIGHT_LEN, cur.pos.y, cur.pos.z + f.z * STRAIGHT_LEN);
      push(cur.pos);
      break;
    }
    case 'up':
    case 'down': {
      const dh = type === 'up' ? HILL_UP : -HILL_DOWN;
      const f = forward(cur.yaw);
      const x0 = cur.pos.x;
      const y0 = cur.pos.y;
      const z0 = cur.pos.z;
      for (let k = 1; k <= STEPS; k++) {
        const t = k / STEPS;
        push(vec(x0 + f.x * HILL_LEN * t, y0 + dh * smooth(t), z0 + f.z * HILL_LEN * t));
      }
      cur.pos = out[out.length - 1];
      break;
    }
    case 'left':
    case 'right': {
      const dir = type === 'left' ? 1 : -1;
      const stepLen = (TURN_RADIUS * (Math.PI / 2)) / STEPS;
      const dYaw = (dir * (Math.PI / 2)) / STEPS;
      for (let k = 0; k < STEPS; k++) {
        cur.yaw += dYaw;
        const f = forward(cur.yaw);
        cur.pos = vec(cur.pos.x + f.x * stepLen, cur.pos.y, cur.pos.z + f.z * stepLen);
        push(cur.pos);
      }
      break;
    }
    case 'loop': {
      const R = LOOP_RADIUS;
      const f = forward(cur.yaw);
      const up = vec(0, 1, 0);
      const center = vec(cur.pos.x + up.x * R, cur.pos.y + R, cur.pos.z + up.z * R);
      const drift = 3; // avance para no solaparse
      const n = 14;
      for (let k = 1; k <= n; k++) {
        const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
        const df = drift * (k / n);
        push(
          vec(
            center.x + R * (f.x * Math.cos(a)) + f.x * df,
            center.y + R * Math.sin(a),
            center.z + R * (f.z * Math.cos(a)) + f.z * df,
          ),
        );
      }
      cur.pos = out[out.length - 1];
      break;
    }
  }
}

/** Construye los puntos de control de una secuencia de piezas. */
export function buildPiecesToPoints(pieces: PieceType[]): Vec3[] {
  const cur: Cursor = { pos: vec(BUILDER_START.pos.x, BUILDER_START.pos.y, BUILDER_START.pos.z), yaw: BUILDER_START.yaw };
  const out: Vec3[] = [vec(cur.pos.x, cur.pos.y, cur.pos.z)];
  // Punto guía justo detrás para que el spline arranque horizontal (sin tramo
  // plano largo: el carrito recibe un pequeño empujón inicial, ver EnergyParams).
  out.unshift(vec(cur.pos.x - 2, cur.pos.y, cur.pos.z));
  for (const p of pieces) emitPiece(p, cur, out);
  return out;
}

/** Secuencia por defecto: baja, rizo, curva, baja, curva, recto. */
export const DEFAULT_PIECES: PieceType[] = ['down', 'straight', 'loop', 'right', 'down', 'left', 'straight'];
