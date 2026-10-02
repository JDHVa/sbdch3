/**
 * Réplica 3D de la montaña rusa real del proyecto (imagenes/montaña-real-*):
 * tabla de cartón, tres torres de foamboard (92 / 61 / 40.5 cm, sección 8×8),
 * brazos y caja de soporte, manguera transparente con cinchos, aro de cartón
 * al final y el balín de 1 cm. Las medidas vienen de `physics/realCoaster.ts`.
 *
 * Incluye vistas de cámara (la del video, frente, lateral, superior y seguir
 * al balín), cotas tipo CAD y marcadores numerados de los puntos del recorrido.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { REAL_TRACK, useCoasterStore } from '../state/useCoasterStore';
import { Icon, Segmented, type SegmentOption } from '../ui/kit';
import {
  ARMS,
  BALL,
  BOARD,
  CATCHER,
  CHECKPOINTS,
  HOSE,
  STICKS,
  TOWERS,
  checkpointArcLengths,
  sampleAt,
  type Vec3,
} from '../physics';

export type ViewPreset = 'video' | 'frente' | 'lateral' | 'superior' | 'seguir';

const FOAM = '#f1ede4';
const TAPE = '#ddd2b6';
const CARDBOARD = '#c4a27a';
const CARDBOARD_DARK = '#a8865e';
const WOOD = '#d9b382';

const v3 = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);


const PRESETS: Record<Exclude<ViewPreset, 'seguir'>, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  // Como la cámara del video: al frente, un poco a la derecha y elevada.
  video: { pos: new THREE.Vector3(0.46, 1.14, 1.8), target: new THREE.Vector3(0.34, 0.3, 0.03) },
  frente: { pos: new THREE.Vector3(0.33, 0.42, 2.1), target: new THREE.Vector3(0.33, 0.36, 0.08) },
  lateral: { pos: new THREE.Vector3(2.25, 0.42, 0.09), target: new THREE.Vector3(0.33, 0.36, 0.09) },
  superior: { pos: new THREE.Vector3(0.33, 2.3, 0.2), target: new THREE.Vector3(0.33, 0, 0.19) },
};

// --- Simulación ---------------------------------------------------------------

function SimDriver() {
  const tick = useCoasterStore((s) => s.tick);
  useFrame((_, delta) => tick(Math.min(delta, 1 / 30)));
  return null;
}

// --- Estructura ---------------------------------------------------------------

function Board() {
  return (
    <group>
      {/* Mesa */}
      <mesh position={[BOARD.center.x, -0.025, BOARD.center.z]} receiveShadow>
        <boxGeometry args={[1.7, 0.04, 1.05]} />
        <meshStandardMaterial color="#2c2f34" roughness={0.8} />
      </mesh>
      {/* Tabla de cartón */}
      <mesh position={v3(BOARD.center)} receiveShadow>
        <boxGeometry args={[BOARD.size.x, BOARD.size.y, BOARD.size.z]} />
        <meshStandardMaterial color={CARDBOARD} roughness={1} />
      </mesh>
    </group>
  );
}

/** Uniones con cinta (las torres están hechas de tramos encimados). */
const TAPE_BANDS: Record<string, number[]> = {
  grande: [0.31, 0.62],
  mediana: [0.3],
  pequena: [],
};

function Towers() {
  return (
    <group>
      {TOWERS.map((t) => (
        <group key={t.id} position={[t.base.x, 0, t.base.z]}>
          <mesh position={[0, t.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[t.side, t.height, t.side]} />
            <meshStandardMaterial color={FOAM} roughness={0.85} />
          </mesh>
          {TAPE_BANDS[t.id].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[t.side + 0.003, 0.014, t.side + 0.003]} />
              <meshStandardMaterial color={TAPE} roughness={0.6} />
            </mesh>
          ))}
          {/* Base de foamboard pegada a la tabla */}
          <mesh position={[0, 0.002, 0]} receiveShadow>
            <boxGeometry args={[0.13, 0.004, 0.13]} />
            <meshStandardMaterial color={FOAM} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Arms() {
  return (
    <group>
      {ARMS.map((a) => (
        <mesh key={a.id} position={v3(a.box.center)} castShadow receiveShadow>
          <boxGeometry args={[a.box.size.x, a.box.size.y, a.box.size.z]} />
          <meshStandardMaterial color={FOAM} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Palitos de madera como refuerzo (segmento a→b). */
function Sticks() {
  const items = useMemo(
    () =>
      STICKS.map(({ a, b }) => {
        const A = v3(a);
        const B = v3(b);
        const dir = B.clone().sub(A);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return { mid: A.clone().add(B).multiplyScalar(0.5), len: dir.length(), q };
      }),
    [],
  );
  return (
    <group>
      {items.map((s, i) => (
        <mesh key={i} position={s.mid} quaternion={s.q} castShadow>
          <boxGeometry args={[0.018, s.len, 0.003]} />
          <meshStandardMaterial color={WOOD} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** Aro de cartón que recibe al balín, con abertura al frente. */
function Catcher() {
  const open = CATCHER.openingHalfAngle;
  return (
    <mesh position={[CATCHER.center.x, CATCHER.height / 2, CATCHER.center.z]} castShadow receiveShadow>
      <cylinderGeometry args={[CATCHER.radius, CATCHER.radius, CATCHER.height, 64, 1, true, open, Math.PI * 2 - 2 * open]} />
      <meshStandardMaterial color={CARDBOARD_DARK} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// --- Manguera, cinchos y balín ----------------------------------------------------

// La escena usa siempre la pista real fija: al cambiar de modo, los componentes
// dentro del Canvas (otro reconciliador) pueden ver la pista nueva un instante
// antes de desmontarse.
const track = REAL_TRACK;

function Hose() {
  const geometry = useMemo(() => {
    const pts = track.samples.filter((_, i) => i % 2 === 0 || i === track.samples.length - 1).map((p) => v3(p.pos));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 900, HOSE.outerRadius, 16, false);
  }, []);
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshPhysicalMaterial
        color="#e9f3f8"
        transparent
        opacity={0.3}
        roughness={0.05}
        metalness={0}
        clearcoat={1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Cinchos blancos: a lo largo de la caja de la torre pequeña y en los apoyos. */
function ZipTies() {
  const ties = useMemo(() => {
    const sOf = checkpointArcLengths(track);
    const at: number[] = [];
    for (let s = sOf.s_punta - 0.02; s <= sOf.s_fin + 0.005; s += 0.03) at.push(s);
    at.push(sOf.brazo, sOf.brazo_bajo, sOf.final - 0.015, sOf.m_atras);
    const z = new THREE.Vector3(0, 0, 1);
    return at.map((s) => {
      const smp = sampleAt(track, s);
      const q = new THREE.Quaternion().setFromUnitVectors(z, v3(smp.tangent).normalize());
      return { pos: v3(smp.pos), q };
    });
  }, []);
  return (
    <group>
      {ties.map((t, i) => (
        <mesh key={i} position={t.pos} quaternion={t.q}>
          <torusGeometry args={[HOSE.outerRadius + 0.0012, 0.0016, 6, 20]} />
          <meshStandardMaterial color="#f7f7f2" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

const _ball = new THREE.Vector3();

function Ball() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const { mode, live } = useCoasterStore.getState();
    if (mode !== 'real') return;
    const p = sampleAt(track, live.s).pos;
    _ball.set(p.x, p.y, p.z);
    ref.current?.position.copy(_ball);
  });
  return (
    <group ref={ref}>
      <mesh castShadow renderOrder={1}>
        <sphereGeometry args={[BALL.radius, 24, 24]} />
        <meshStandardMaterial color="#d9dde2" metalness={0.95} roughness={0.18} />
      </mesh>
      {/* Halo para encontrarlo (el balín real mide 1 cm). */}
      <mesh renderOrder={3}>
        <sphereGeometry args={[0.016, 20, 20]} />
        <meshBasicMaterial color="#ffcf3f" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  );
}

// --- Cotas y marcadores --------------------------------------------------------------

function Dimensions() {
  return (
    <group>
      {TOWERS.map((t) => {
        // Cota vertical al costado izquierdo-frontal de cada torre.
        const x = t.base.x - t.side / 2 - 0.035;
        const z = t.base.z + t.side / 2 + 0.01;
        return (
          <group key={t.id}>
            <Line points={[[x, 0, z], [x, t.height, z]]} color="#4da3ff" lineWidth={1.5} />
            <Line points={[[x - 0.012, t.height, z], [x + 0.03, t.height, z]]} color="#4da3ff" lineWidth={1.5} />
            <Line points={[[x - 0.012, 0, z], [x + 0.03, 0, z]]} color="#4da3ff" lineWidth={1.5} />
            <Html position={[x, t.height / 2, z]} center zIndexRange={[10, 0]}>
              <div className="dim-label">{String(Math.round(t.height * 1000) / 10)} cm</div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function CheckpointMarkers() {
  const marks = useMemo(() => {
    const sOf = checkpointArcLengths(track);
    return CHECKPOINTS.map((c, i) => ({ n: i + 1, pos: v3(sampleAt(track, sOf[c.id]).pos) }));
  }, []);
  return (
    <group>
      {marks.map((m) => (
        <Html key={m.n} position={m.pos} center zIndexRange={[10, 0]}>
          <div className="cp-marker">{m.n}</div>
        </Html>
      ))}
    </group>
  );
}

// --- Cámara -----------------------------------------------------------------------------

function CameraRig({ preset, nonce }: { preset: ViewPreset; nonce: number }) {
  const { camera, controls } = useThree();
  const anim = useRef<{ t: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const ctl = controls as unknown as OrbitControlsImpl | null;
    if (!ctl || preset === 'seguir') return;
    const target = PRESETS[preset];
    anim.current = {
      t: 0,
      fromP: camera.position.clone(),
      toP: target.pos.clone(),
      fromT: ctl.target.clone(),
      toT: target.target.clone(),
    };
  }, [preset, nonce, camera, controls]);

  useFrame((_, delta) => {
    const ctl = controls as unknown as OrbitControlsImpl | null;
    if (!ctl) return;
    if (preset === 'seguir') {
      // Mantiene la distancia actual y desplaza cámara y objetivo con el balín.
      const offset = camera.position.clone().sub(ctl.target);
      if (offset.length() > 0.6) offset.setLength(0.6);
      ctl.target.lerp(_ball, 0.15);
      camera.position.copy(ctl.target).add(offset);
      ctl.update();
      return;
    }
    const a = anim.current;
    if (!a) return;
    a.t = Math.min(1, a.t + delta / 0.7);
    const e = a.t * a.t * (3 - 2 * a.t);
    camera.position.lerpVectors(a.fromP, a.toP, e);
    ctl.target.lerpVectors(a.fromT, a.toT, e);
    ctl.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

// --- Escena -------------------------------------------------------------------------------

const VIEW_OPTIONS: SegmentOption<ViewPreset>[] = [
  { value: 'video', label: 'Video', icon: 'camera-video', title: 'Como la cámara del video' },
  { value: 'frente', label: 'Frente', icon: 'square', title: 'Vista de frente' },
  { value: 'lateral', label: 'Lateral', icon: 'layout-sidebar-inset-reverse', title: 'Vista lateral (derecha)' },
  { value: 'superior', label: 'Superior', icon: 'grid-3x3', title: 'Vista desde arriba' },
  { value: 'seguir', label: 'Seguir', icon: 'crosshair', title: 'La cámara sigue al balín' },
];

function ToggleChip({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button className={`chip-toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function RealModelScene() {
  const [preset, setPreset] = useState<ViewPreset>('video');
  const [nonce, setNonce] = useState(0);
  const [showDims, setShowDims] = useState(true);
  const [showMarks, setShowMarks] = useState(true);

  return (
    <>
      <div className="view-bar">
        <Segmented
          className="glass"
          value={preset}
          options={VIEW_OPTIONS}
          onChange={(v) => {
            setPreset(v);
            setNonce((n) => n + 1);
          }}
        />
        <div className="view-group glass">
          <ToggleChip on={showDims} onClick={() => setShowDims((v) => !v)} icon="rulers" label="Cotas" />
          <ToggleChip on={showMarks} onClick={() => setShowMarks((v) => !v)} icon="123" label="Puntos" />
        </div>
      </div>

      <Canvas
        shadows
        camera={{ position: PRESETS.video.pos.toArray(), fov: 45, near: 0.01, far: 50 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#1c2129']} />
        <hemisphereLight args={['#f4f1ea', '#3a3f47', 0.9]} />
        <directionalLight
          position={[1.2, 2.2, 1.4]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-1.2}
          shadow-camera-right={1.2}
          shadow-camera-top={1.2}
          shadow-camera-bottom={-1.2}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-1.5, 1.2, -0.8]} intensity={0.35} />

        <Board />
        <Towers />
        <Arms />
        <Sticks />
        <Catcher />
        <Ball />
        <ZipTies />
        <Hose />
        {showDims && <Dimensions />}
        {showMarks && <CheckpointMarkers />}

        <OrbitControls makeDefault target={PRESETS.video.target.toArray()} enableDamping minDistance={0.08} maxDistance={6} />
        <CameraRig preset={preset} nonce={nonce} />
        <SimDriver />
      </Canvas>
    </>
  );
}

