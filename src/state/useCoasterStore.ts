/**
 * Estado global de la aplicación (Zustand).
 * Reúne: puntos de control de la pista, parámetros físicos, estado de la
 * simulación en vivo, y la fuente de datos activa (por ahora "simulado").
 */

import { create } from 'zustand';
import {
  buildTrack,
  computeEnergyProfile,
  createSimState,
  defaultCoasterPoints,
  buildPiecesToPoints,
  DEFAULT_PIECES,
  step,
  readout,
  DEFAULT_ENERGY_PARAMS,
  DEFAULT_SHAPE,
  type EnergyParams,
  type EnergyPoint,
  type PieceType,
  type Readout,
  type SimState,
  type Track,
  type Vec3,
} from '../physics';

export type DataSourceKind = 'simulated' | 'serial' | 'websocket' | 'video';
export type AppMode = 'demo' | 'builder';
export type CameraMode = 'orbit' | 'ride';

interface CoasterState {
  // --- Modo de la app ---
  mode: AppMode;
  cameraMode: CameraMode;

  // --- Pista (modo demo: puntos editables; modo constructor: piezas) ---
  controlPoints: Vec3[];
  pieces: PieceType[];
  track: Track;
  energyProfile: EnergyPoint[];

  // --- Parámetros físicos ---
  params: EnergyParams;

  // --- Simulación ---
  sim: SimState;
  running: boolean;
  live: Readout;
  speedMultiplier: number;

  // --- Fuente de datos ---
  dataSource: DataSourceKind;

  // --- Acciones ---
  setMode: (mode: AppMode) => void;
  setCameraMode: (mode: CameraMode) => void;
  addPiece: (type: PieceType) => void;
  removeLastPiece: () => void;
  clearPieces: () => void;
  setParams: (patch: Partial<EnergyParams>) => void;
  setControlPoints: (points: Vec3[]) => void;
  moveControlPoint: (index: number, pos: Vec3) => void;
  resetTrack: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  tick: (dt: number) => void;
  setSpeedMultiplier: (m: number) => void;
  setDataSource: (k: DataSourceKind) => void;
}

function rebuild(controlPoints: Vec3[], params: EnergyParams) {
  const track = buildTrack(controlPoints, 24);
  const energyProfile = computeEnergyProfile(track, params);
  return { track, energyProfile };
}

const initialPoints = defaultCoasterPoints(DEFAULT_SHAPE);
const initial = rebuild(initialPoints, DEFAULT_ENERGY_PARAMS);
const initialSim = createSimState();

export const useCoasterStore = create<CoasterState>((set) => ({
  mode: 'demo',
  cameraMode: 'orbit',
  controlPoints: initialPoints,
  pieces: DEFAULT_PIECES,
  track: initial.track,
  energyProfile: initial.energyProfile,
  params: DEFAULT_ENERGY_PARAMS,
  sim: initialSim,
  running: false,
  live: readout(initial.track, DEFAULT_ENERGY_PARAMS, 0),
  speedMultiplier: 1,
  dataSource: 'simulated',

  setMode: (mode) =>
    set((s) => {
      // En el constructor el carrito recibe un pequeño empujón inicial (como la
      // cadena del lift) para que no se quede en la cima plana. En demo se suelta
      // desde el reposo.
      const params = { ...s.params, initialSpeed: mode === 'builder' ? 3 : 0 };
      const points = mode === 'builder' ? buildPiecesToPoints(s.pieces) : s.controlPoints;
      const { track, energyProfile } = rebuild(points, params);
      return {
        mode,
        cameraMode: 'orbit',
        params,
        track,
        energyProfile,
        sim: createSimState(),
        running: false,
        live: readout(track, params, 0),
      };
    }),

  setCameraMode: (cameraMode) => set({ cameraMode }),

  addPiece: (type) =>
    set((s) => {
      const pieces = [...s.pieces, type];
      const { track, energyProfile } = rebuild(buildPiecesToPoints(pieces), s.params);
      return { pieces, track, energyProfile, live: readout(track, s.params, s.sim.s) };
    }),

  removeLastPiece: () =>
    set((s) => {
      if (s.pieces.length === 0) return {};
      const pieces = s.pieces.slice(0, -1);
      const { track, energyProfile } = rebuild(buildPiecesToPoints(pieces), s.params);
      const sim = createSimState();
      return { pieces, track, energyProfile, sim, running: false, live: readout(track, s.params, 0) };
    }),

  clearPieces: () =>
    set((s) => {
      const pieces: PieceType[] = [];
      const { track, energyProfile } = rebuild(buildPiecesToPoints(pieces), s.params);
      const sim = createSimState();
      return { pieces, track, energyProfile, sim, running: false, live: readout(track, s.params, 0) };
    }),

  setParams: (patch) =>
    set((s) => {
      const params = { ...s.params, ...patch };
      const points = s.mode === 'builder' ? buildPiecesToPoints(s.pieces) : s.controlPoints;
      const { track, energyProfile } = rebuild(points, params);
      return { params, track, energyProfile, live: readout(track, params, s.sim.s) };
    }),

  setControlPoints: (points) =>
    set((s) => {
      const { track, energyProfile } = rebuild(points, s.params);
      return {
        controlPoints: points,
        track,
        energyProfile,
        live: readout(track, s.params, s.sim.s),
      };
    }),

  moveControlPoint: (index, pos) =>
    set((s) => {
      const points = s.controlPoints.map((p, i) => (i === index ? pos : p));
      const { track, energyProfile } = rebuild(points, s.params);
      return {
        controlPoints: points,
        track,
        energyProfile,
        live: readout(track, s.params, s.sim.s),
      };
    }),

  resetTrack: () =>
    set((s) => {
      const points = defaultCoasterPoints(DEFAULT_SHAPE);
      const { track, energyProfile } = rebuild(points, s.params);
      const sim = createSimState();
      return {
        controlPoints: points,
        track,
        energyProfile,
        sim,
        running: false,
        live: readout(track, s.params, 0),
      };
    }),

  play: () =>
    set((s) => {
      // Si ya terminó, reinicia antes de reproducir.
      const sim = s.sim.finished ? createSimState() : s.sim;
      return { running: true, sim };
    }),

  pause: () => set({ running: false }),

  reset: () =>
    set((s) => {
      const sim = createSimState();
      return { sim, running: false, live: readout(s.track, s.params, 0) };
    }),

  tick: (dt) =>
    set((s) => {
      if (!s.running) return {};
      const sim = step(s.track, s.params, s.sim, dt * s.speedMultiplier);
      const live = readout(s.track, s.params, sim.s);
      return { sim, live, running: !sim.finished };
    }),

  setSpeedMultiplier: (m) => set({ speedMultiplier: m }),
  setDataSource: (k) => set({ dataSource: k }),
}));
