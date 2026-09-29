/**
 * Escena del modo "Constructor 3D": pista real (rieles + traviesas + postes),
 * un carrito que la recorre, entorno de parque (cielo, suelo, árboles) y dos
 * cámaras: orbital libre y primera persona ("subirse").
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useCoasterStore } from '../state/useCoasterStore';
import { sampleAt } from '../physics';
import { RealCoaster } from './RealCoaster';

// --- Motor: avanza la simulación cada frame ---
function SimDriver() {
  const tick = useCoasterStore((s) => s.tick);
  useFrame((_, delta) => tick(Math.min(delta, 1 / 30)));
  return null;
}

// Vectores reutilizables (evitan basura por frame).
const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Toma posición/orientación del carrito desde la física en la posición actual. */
function readCar() {
  const { track, live } = useCoasterStore.getState();
  const sample = sampleAt(track, live.s);
  _pos.set(sample.pos.x, sample.pos.y, sample.pos.z);
  _fwd.set(sample.tangent.x, sample.tangent.y, sample.tangent.z).normalize();
  _up.set(sample.supportNormal.x, sample.supportNormal.y, sample.supportNormal.z).normalize();
  _right.crossVectors(_up, _fwd).normalize();
  return sample;
}

/** Carrito que recorre la pista, orientado con la tangente y la normal de soporte. */
function Car() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    readCar();
    const g = ref.current;
    if (!g) return;
    // Se apoya un poco por encima de la línea de rieles.
    g.position.copy(_pos).addScaledVector(_up, 0.5);
    // Base de orientación: x=derecha, y=arriba, z=-adelante (el frente mira +tangente).
    _m.makeBasis(_right, _up, _fwd.clone().multiplyScalar(-1));
    g.quaternion.setFromRotationMatrix(_m);
  });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[1.4, 0.9, 3]} />
        <meshStandardMaterial color="#e53935" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, -0.2]} castShadow>
        <boxGeometry args={[1.2, 0.4, 1.6]} />
        <meshStandardMaterial color="#263238" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Cámara en primera persona: se sienta en el carrito y mira hacia adelante. */
function RideCamera() {
  const { camera } = useThree();
  useFrame(() => {
    readCar();
    camera.position.copy(_pos).addScaledVector(_up, 1.6).addScaledVector(_fwd, -0.2);
    _look.copy(_pos).addScaledVector(_fwd, 12).addScaledVector(_up, 0.5);
    camera.up.copy(_up);
    camera.lookAt(_look);
  });
  return null;
}

/** Árboles low-poly dispersos alrededor de la pista. */
function Trees({ ground }: { ground: number }) {
  const trees = useMemo(() => {
    const arr: { x: number; z: number; h: number }[] = [];
    let seed = 1234;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 70; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 45 + rand() * 220;
      arr.push({ x: Math.cos(ang) * rad + 40, z: Math.sin(ang) * rad, h: 4 + rand() * 5 });
    }
    return arr;
  }, []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, ground, t.z]}>
          <mesh position={[0, t.h * 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.35, t.h * 0.6, 6]} />
            <meshStandardMaterial color="#6d4c33" />
          </mesh>
          <mesh position={[0, t.h * 0.75, 0]} castShadow>
            <coneGeometry args={[t.h * 0.4, t.h * 0.9, 7]} />
            <meshStandardMaterial color="#2e7d32" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CameraControls({ target }: { target: [number, number, number] }) {
  const cameraMode = useCoasterStore((s) => s.cameraMode);
  return cameraMode === 'ride' ? (
    <RideCamera />
  ) : (
    <OrbitControls target={target} enableDamping maxDistance={600} />
  );
}

export function BuilderScene() {
  const track = useCoasterStore((s) => s.track);

  // Centro y suelo a partir de la pista.
  const { center, ground } = useMemo(() => {
    let minY = Infinity;
    let cx = 0;
    let cz = 0;
    for (const p of track.controlPoints) {
      cx += p.x;
      cz += p.z;
      if (p.y < minY) minY = p.y;
    }
    const n = Math.max(1, track.controlPoints.length);
    return { center: [cx / n, track.minHeight + 8, cz / n] as [number, number, number], ground: minY - 1 };
  }, [track]);

  return (
    <Canvas shadows camera={{ position: [center[0] + 40, center[1] + 40, center[2] + 60], fov: 55, near: 0.5, far: 6000 }} dpr={[1, 2]}>
      <Sky sunPosition={[100, 60, 100]} turbidity={6} rayleigh={1.2} />
      <fog attach="fog" args={['#cfe3f2', 250, 1400]} />

      <hemisphereLight args={['#cfe3f2', '#4a6a3a', 0.9]} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-camera-far={600}
      />

      {/* Suelo tipo césped */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], ground, center[2]]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#5c8a3a" />
      </mesh>

      <Trees ground={ground} />
      <RealCoaster />
      <Car />

      <CameraControls target={center} />
      <SimDriver />
    </Canvas>
  );
}
