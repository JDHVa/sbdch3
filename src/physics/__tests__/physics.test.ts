import { describe, it, expect } from 'vitest';
import {
  buildTrack,
  computeEnergyProfile,
  speedAt,
  effectiveMass,
  forceAt,
  createSimState,
  step,
  defaultCoasterPoints,
  vec,
  sampleAt,
  type EnergyParams,
  type SampledPoint,
} from '../index';

const base: EnergyParams = {
  mass: 0.005,
  gravity: 9.81,
  friction: 0,
  rolling: false,
  initialSpeed: 0,
};

/** Rampa recta de altura 1 m y 4 m de largo horizontal. */
function ramp() {
  return buildTrack([vec(0, 1, 0), vec(4, 0, 0)], 40);
}

describe('buildTrack', () => {
  it('produce longitud, alturas y muestras coherentes', () => {
    const track = ramp();
    expect(track.samples.length).toBeGreaterThan(10);
    expect(track.length).toBeGreaterThan(4); // hipotenusa > 4
    expect(track.minHeight).toBeCloseTo(0, 5);
    expect(track.maxHeight).toBeCloseTo(1, 5);
    expect(track.samples[0].s).toBe(0);
  });

  it('un tramo recto tiene curvatura ~0', () => {
    const track = ramp();
    const mid = track.samples[Math.floor(track.samples.length / 2)];
    expect(mid.curvature).toBeLessThan(1e-2);
  });
});

describe('energía y velocidad', () => {
  it('la rapidez al pie de la rampa es √(2·g·h)', () => {
    const track = ramp();
    const end = track.samples[track.samples.length - 1];
    const v = speedAt(track, end.s, end.height, base);
    expect(v).toBeCloseTo(Math.sqrt(2 * base.gravity * 1), 3);
  });

  it('sin fricción la energía mecánica se conserva', () => {
    const track = buildTrack(defaultCoasterPoints(), 24);
    const profile = computeEnergyProfile(track, base).filter((p) => p.reachable);
    const e0 = profile[0].mechanical;
    for (const p of profile) {
      expect(p.mechanical).toBeCloseTo(e0, 6);
    }
  });

  it('la rodadura reduce la rapidez por el factor √(5/7)', () => {
    const track = ramp();
    const end = track.samples[track.samples.length - 1];
    const vNoRoll = speedAt(track, end.s, end.height, base);
    const vRoll = speedAt(track, end.s, end.height, { ...base, rolling: true });
    expect(vRoll / vNoRoll).toBeCloseTo(Math.sqrt(5 / 7), 4);
  });

  it('la masa efectiva es 7/5·m al rodar', () => {
    expect(effectiveMass(1, true)).toBeCloseTo(1.4, 6);
    expect(effectiveMass(1, false)).toBe(1);
  });

  it('con fricción, puntos lejanos y altos pueden no alcanzarse', () => {
    const track = buildTrack(defaultCoasterPoints(), 24);
    const withFriction = computeEnergyProfile(track, { ...base, friction: 0.5 });
    // Con mucha fricción, la energía disponible cae a lo largo de la pista.
    const reachableCount = withFriction.filter((p) => p.reachable).length;
    expect(reachableCount).toBeLessThan(withFriction.length);
  });
});

describe('fuerza normal y contacto en el loop', () => {
  const topOfLoop: SampledPoint = {
    s: 0,
    pos: vec(0, 1, 0),
    tangent: vec(-1, 0, 0), // en la cima del rizo se avanza hacia −x
    supportNormal: vec(0, -1, 0), // la canica se apoya hacia el interior (abajo)
    curvature: 1 / 0.28, // curvatura con signo respecto al soporte (positiva)
    curvatureVec: vec(0, -1 / 0.28, 0),
    height: 1,
  };

  it('pierde contacto cuando v² < g·R', () => {
    const slow = forceAt(topOfLoop, 1.0, { mass: 0.005, gravity: 9.81 });
    expect(slow.losesContact).toBe(true);
    expect(slow.normalForce).toBeLessThan(0);
  });

  it('mantiene contacto cuando v² > g·R', () => {
    const fast = forceAt(topOfLoop, 3.0, { mass: 0.005, gravity: 9.81 });
    expect(fast.losesContact).toBe(false);
    expect(fast.normalForce).toBeGreaterThan(0);
    expect(fast.gForce).toBeGreaterThan(0);
  });

  // Cima de colina (convexa): criterio OPUESTO al del rizo.
  const crest: SampledPoint = {
    s: 0,
    pos: vec(0, 1, 0),
    tangent: vec(1, 0, 0),
    supportNormal: vec(0, 1, 0), // la canica se apoya por encima
    curvature: -1 / 0.3, // curva en contra del soporte (negativa)
    curvatureVec: vec(0, -1 / 0.3, 0),
    height: 1,
  };

  it('en una colina, lento MANTIENE contacto', () => {
    const slow = forceAt(crest, 1.0, { mass: 0.005, gravity: 9.81 });
    expect(slow.losesContact).toBe(false);
  });

  it('en una colina, demasiado rápido se despega (airtime)', () => {
    const fast = forceAt(crest, 2.0, { mass: 0.005, gravity: 9.81 });
    expect(fast.losesContact).toBe(true);
  });
});

describe('simulación temporal', () => {
  it('la canica avanza al soltarse desde arriba', () => {
    const track = buildTrack(defaultCoasterPoints(), 24);
    let state = createSimState();
    const params = { ...base, rolling: true, friction: 0.02 };
    for (let i = 0; i < 60; i++) {
      state = step(track, params, state, 1 / 60);
    }
    expect(state.s).toBeGreaterThan(0);
    expect(state.time).toBeCloseTo(1, 5);
  });

  it('interpola posición y altura sin salirse de la pista', () => {
    const track = ramp();
    const mid = sampleAt(track, track.length / 2);
    expect(mid.height).toBeGreaterThan(0);
    expect(mid.height).toBeLessThan(1);
  });
});
