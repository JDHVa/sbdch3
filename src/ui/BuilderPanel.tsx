/** Panel del modo Constructor 3D: recorrido, cámara, piezas y física. */

import { useCoasterStore } from '../state/useCoasterStore';
import { PIECES, GRAVITY, type GravityKey, type PieceType } from '../physics';
import { Readouts } from './Readouts';
import { fmt } from './format';

const PIECE_LABEL: Record<PieceType, { label: string; icon: string }> = Object.fromEntries(
  PIECES.map((p) => [p.type, { label: p.label, icon: p.icon }]),
) as Record<PieceType, { label: string; icon: string }>;

function Transport() {
  const running = useCoasterStore((s) => s.running);
  const play = useCoasterStore((s) => s.play);
  const pause = useCoasterStore((s) => s.pause);
  const reset = useCoasterStore((s) => s.reset);
  const cameraMode = useCoasterStore((s) => s.cameraMode);
  const setCameraMode = useCoasterStore((s) => s.setCameraMode);
  const speedMultiplier = useCoasterStore((s) => s.speedMultiplier);
  const setSpeedMultiplier = useCoasterStore((s) => s.setSpeedMultiplier);

  return (
    <div className="card">
      <h2>Recorrido</h2>
      <div className="transport">
        <button className="primary" onClick={() => (running ? pause() : play())}>
          {running ? '⏸ Pausa' : '▶ Arrancar'}
        </button>
        <button onClick={reset}>↺ Reiniciar</button>
        <select value={speedMultiplier} onChange={(e) => setSpeedMultiplier(+e.target.value)} style={{ width: 'auto' }}>
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
        </select>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className={cameraMode === 'orbit' ? 'primary' : ''}
          style={{ flex: 1 }}
          onClick={() => setCameraMode('orbit')}
        >
          🛰 Vista libre
        </button>
        <button
          className={cameraMode === 'ride' ? 'primary' : ''}
          style={{ flex: 1 }}
          onClick={() => setCameraMode('ride')}
        >
          🎢 Subirse
        </button>
      </div>
    </div>
  );
}

function PieceBuilder() {
  const pieces = useCoasterStore((s) => s.pieces);
  const addPiece = useCoasterStore((s) => s.addPiece);
  const removeLastPiece = useCoasterStore((s) => s.removeLastPiece);
  const clearPieces = useCoasterStore((s) => s.clearPieces);

  return (
    <div className="card">
      <h2>Piezas ({pieces.length})</h2>
      <div className="pieces-grid">
        {PIECES.map((p) => (
          <button key={p.type} onClick={() => addPiece(p.type)} title={`Agregar ${p.label}`}>
            <span style={{ fontSize: 18 }}>{p.icon}</span>
            <span style={{ fontSize: 11 }}>{p.label}</span>
          </button>
        ))}
      </div>

      <div className="chips">
        <span className="chip start">Salida ▲</span>
        {pieces.map((p, i) => (
          <span className="chip" key={i}>
            {PIECE_LABEL[p].icon} {PIECE_LABEL[p].label}
          </span>
        ))}
        {pieces.length === 0 && <span className="hint">Agrega piezas para armar tu pista…</span>}
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <button onClick={removeLastPiece} disabled={pieces.length === 0}>
          ⌫ Quitar última
        </button>
        <button onClick={clearPieces} disabled={pieces.length === 0}>
          🗑 Vaciar
        </button>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        La salida es el punto más alto: empieza con una <b>bajada</b> para tomar velocidad. En un
        rizo, si el carrito va lento se cae (se pone rojo).
      </div>
    </div>
  );
}

function BuilderPhysics() {
  const params = useCoasterStore((s) => s.params);
  const setParams = useCoasterStore((s) => s.setParams);
  const gravityKey: GravityKey | 'custom' =
    (Object.keys(GRAVITY) as GravityKey[]).find((k) => GRAVITY[k] === params.gravity) ?? 'custom';

  return (
    <div className="card">
      <h2>Física</h2>
      <div className="control">
        <label>Gravedad</label>
        <select value={gravityKey} onChange={(e) => setParams({ gravity: GRAVITY[e.target.value as GravityKey] })}>
          <option value="earth">Tierra (9.81 m/s²)</option>
          <option value="moon">Luna (1.62 m/s²)</option>
          <option value="mars">Marte (3.72 m/s²)</option>
          {gravityKey === 'custom' && <option value="custom">Personalizada</option>}
        </select>
      </div>
      <div className="control">
        <label>
          Fricción (μ) <b>{fmt(params.friction, 3)}</b>
        </label>
        <input
          type="range"
          min={0}
          max={0.05}
          step={0.002}
          value={params.friction}
          onChange={(e) => setParams({ friction: +e.target.value })}
        />
      </div>
      <label className="toggle">
        <input type="checkbox" checked={params.friction === 0} onChange={(e) => setParams({ friction: e.target.checked ? 0 : 0.01 })} />
        Sin fricción (ideal)
      </label>
    </div>
  );
}

export function BuilderPanel() {
  return (
    <>
      <Transport />
      <PieceBuilder />
      <Readouts />
      <BuilderPhysics />
    </>
  );
}
