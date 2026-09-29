/**
 * La canica. Su posición se actualiza imperativamente cada frame desde el
 * estado físico (sin re-render de React) para que la animación sea fluida.
 * Cambia de color si pierde contacto con la pista (rojo) o según su rapidez.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCoasterStore } from '../state/useCoasterStore';

const VISUAL_RADIUS = 0.045;

export function Marble() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const { live } = useCoasterStore.getState();
    const mesh = meshRef.current;
    if (!mesh) return;
    // La canica descansa sobre el tubo: la elevamos un poco sobre la línea central.
    mesh.position.set(live.position.x, live.position.y + VISUAL_RADIUS, live.position.z);

    if (matRef.current) {
      if (live.force.losesContact) {
        matRef.current.color.set('#ff3b30');
        matRef.current.emissive.set('#5c0000');
      } else {
        matRef.current.color.set('#e8e8ea');
        matRef.current.emissive.set('#000000');
      }
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[VISUAL_RADIUS, 24, 24]} />
      <meshStandardMaterial ref={matRef} color="#e8e8ea" metalness={0.6} roughness={0.25} />
    </mesh>
  );
}
