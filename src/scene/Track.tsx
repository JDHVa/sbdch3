/**
 * Malla 3D de la pista: un tubo (TubeGeometry) construido con un spline
 * Catmull-Rom sobre los puntos de control, con aspecto de cartón. Incluye
 * postes de soporte para dar el look de maqueta casera.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useCoasterStore } from '../state/useCoasterStore';
import type { Vec3 } from '../physics';

const CARDBOARD = '#c9a26a';
const CARDBOARD_EDGE = '#a5814f';

function toVector3(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

export function TrackMesh() {
  const controlPoints = useCoasterStore((s) => s.controlPoints);

  const curve = useMemo(() => {
    const pts = controlPoints.map(toVector3);
    const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return c;
  }, [controlPoints]);

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 500, 0.035, 10, false),
    [curve],
  );

  // Postes de soporte: bajan desde algunos puntos del recorrido hasta el suelo.
  const posts = useMemo(() => {
    const pts = curve.getSpacedPoints(28);
    return pts
      .filter((p) => p.y > 0.06)
      .map((p) => ({ x: p.x, y: p.y, z: p.z, h: p.y }));
  }, [curve]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={CARDBOARD} roughness={0.95} metalness={0} />
      </mesh>

      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, p.z]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, p.h, 8]} />
          <meshStandardMaterial color={CARDBOARD_EDGE} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
