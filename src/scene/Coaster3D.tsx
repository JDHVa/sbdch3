/**
 * Escena 3D completa: cámara orbital, luces, suelo, la pista y la canica.
 * Un componente interno (SimDriver) corre la simulación física en cada frame.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useCoasterStore } from '../state/useCoasterStore';
import { TrackMesh } from './Track';
import { Marble } from './Marble';

/** Avanza la simulación en cada frame (dt real, con tope para evitar saltos). */
function SimDriver() {
  const tick = useCoasterStore((s) => s.tick);
  useFrame((_, delta) => {
    tick(Math.min(delta, 1 / 30));
  });
  return null;
}

export function Coaster3D() {
  return (
    <Canvas shadows camera={{ position: [2.2, 1.6, 3.8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={['#0e1116']} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3, 4, 2]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-2, 2, -1]} intensity={0.4} />

      <Grid
        position={[2, 0, 0]}
        args={[12, 12]}
        cellSize={0.25}
        cellColor="#2a3140"
        sectionSize={1}
        sectionColor="#3c4658"
        fadeDistance={16}
        infiniteGrid
      />

      <TrackMesh />
      <Marble />

      <OrbitControls target={[2, 0.45, 0]} enableDamping />
      <SimDriver />
    </Canvas>
  );
}
