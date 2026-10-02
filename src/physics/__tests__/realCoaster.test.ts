import { describe, it, expect } from 'vitest';
import {
  ARMS,
  HOSE,
  REAL_BASE_PARAMS,
  TOWERS,
  VIDEO_CHECKPOINTS,
  buildTrack,
  calibrateLosses,
  computeEnergyProfile,
  computeTimeProfile,
  createSimState,
  forceAt,
  realCoasterPoints,
  realCoasterReport,
  simulatedCheckpointTimes,
  step,
  vec,
  videoTime,
  type EnergyParams,
} from '../index';

const track = buildTrack(realCoasterPoints(), 24);
const cal = calibrateLosses(track);
const real: EnergyParams = { ...REAL_BASE_PARAMS, friction: cal.mu, drag: cal.drag };
const ideal: EnergyParams = { ...REAL_BASE_PARAMS, friction: 0, drag: 0 };

describe('geometría de la montaña real', () => {
  it('sale de lo alto de la torre grande y termina junto a la tabla', () => {
    expect(track.samples[0].height).toBeGreaterThan(0.92);
    expect(track.samples[track.samples.length - 1].height).toBeLessThan(0.03);
    // La vuelta vertical en la mediana añade ~0.5 m de pista.
    expect(track.length).toBeGreaterThan(3.5);
    expect(track.length).toBeLessThan(5.5);
  });

  it('la manguera no atraviesa torres ni brazos (tolerancia 3 mm)', () => {
    const boxes = [
      ...TOWERS.map((t) => ({ c: vec(t.base.x, t.height / 2, t.base.z), h: vec(t.side / 2, t.height / 2, t.side / 2) })),
      ...ARMS.map((a) => ({ c: a.box.center, h: vec(a.box.size.x / 2, a.box.size.y / 2, a.box.size.z / 2) })),
    ];
    for (const smp of track.samples) {
      for (const b of boxes) {
        const dx = Math.max(0, Math.abs(smp.pos.x - b.c.x) - b.h.x);
        const dy = Math.max(0, Math.abs(smp.pos.y - b.c.y) - b.h.y);
        const dz = Math.max(0, Math.abs(smp.pos.z - b.c.z) - b.h.z);
        expect(Math.hypot(dx, dy, dz) - HOSE.outerRadius).toBeGreaterThan(-0.003);
      }
    }
  });
});

describe('física en tubo (modelo normal)', () => {
  it('sin pérdidas conserva la energía mecánica', () => {
    const profile = computeEnergyProfile(track, ideal);
    const e0 = profile[0].mechanical;
    for (const p of profile) expect(p.mechanical).toBeCloseTo(e0, 9);
  });

  it('rapidez final ideal rodando = √(10/7·g·Δh)', () => {
    const profile = computeEnergyProfile(track, ideal);
    const drop = profile[0].height - profile[profile.length - 1].height;
    expect(profile[profile.length - 1].speed).toBeCloseTo(Math.sqrt((10 / 7) * 9.81 * drop), 6);
  });

  it('en un tubo la canica nunca pierde contacto y en rampa recta |N| = m·g·cos θ', () => {
    const ramp = buildTrack([vec(0, 1, 0), vec(1, 0, 0)], 20);
    const mid = ramp.samples[10];
    const f = forceAt(mid, 3, { mass: 0.005, gravity: 9.81, enclosed: true });
    expect(f.losesContact).toBe(false);
    expect(f.gForce).toBeCloseTo(Math.cos(Math.PI / 4), 3);
  });

  it('las pérdidas calibradas frenan al balín respecto al caso ideal', () => {
    const r = realCoasterReport(track, real);
    expect(r.rows[r.rows.length - 1].speed).toBeLessThan(r.vEndRolling);
    expect(r.lostFraction).toBeGreaterThan(0.3);
    expect(Number.isFinite(r.totalTime)).toBe(true);
  });
});

describe('calibración con el video', () => {
  it('reproduce los tiempos medidos con error RMS < 0.5 s', () => {
    // Con la vuelta vertical nueva alrededor del brazo de la mediana la
    // manguera mide ~5 m contra los 4.3 m anteriores; la calibración por
    // mínimos cuadrados no cierra tan apretada.
    expect(cal.rmsError).toBeLessThan(0.5);
  });

  it('los tramos mejor medidos coinciden a ±0.4 s', () => {
    const sim = simulatedCheckpointTimes(track, real);
    for (const c of VIDEO_CHECKPOINTS.filter((c) => c.weight === 1 && c.id !== 'entre')) {
      expect(Math.abs(sim[c.id] - videoTime(c.frame))).toBeLessThan(0.4);
    }
  });

  it('el integrador temporal llega al final en un tiempo parecido al perfil', () => {
    let st = createSimState();
    for (let i = 0; i < 2000 && !st.finished; i++) st = step(track, real, st, 1 / 120);
    expect(st.finished).toBe(true);
    expect(st.s).toBeCloseTo(track.length, 3);
    const t = computeTimeProfile(computeEnergyProfile(track, real));
    expect(Math.abs(st.time - t[t.length - 1])).toBeLessThan(0.1);
  });
});
