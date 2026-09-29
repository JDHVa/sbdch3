/**
 * Pista 3D "real": rieles dobles con traviesas y peralte + postes de soporte,
 * generados con el módulo oficial de three.js `RollerCoaster` (licencia MIT).
 * Toma la misma curva Catmull-Rom que usa la física.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  RollerCoasterGeometry,
  RollerCoasterLiftersGeometry,
} from 'three/examples/jsm/misc/RollerCoaster.js';
import { useCoasterStore } from '../state/useCoasterStore';

export function buildCurve(points: { x: number; y: number; z: number }[]): THREE.CatmullRomCurve3 {
  const pts = points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  curve.arcLengthDivisions = 2000;
  return curve;
}

export function RealCoaster() {
  const track = useCoasterStore((s) => s.track);

  const { railGeo, liftersGeo } = useMemo(() => {
    const curve = buildCurve(track.controlPoints);
    const divisions = Math.max(200, Math.min(3000, Math.round(track.length * 8)));
    return {
      railGeo: new RollerCoasterGeometry(curve, divisions),
      liftersGeo: new RollerCoasterLiftersGeometry(curve, Math.round(divisions / 6)),
    };
  }, [track]);

  return (
    <group>
      <mesh geometry={railGeo}>
        <meshPhongMaterial vertexColors flatShading />
      </mesh>
      <mesh geometry={liftersGeo}>
        <meshPhongMaterial color="#7a7f88" />
      </mesh>
    </group>
  );
}
