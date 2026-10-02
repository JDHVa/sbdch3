/** Panel del modo Constructor 3D: recorrido, cámara, piezas y física. */

import { useCoasterStore } from '../state/useCoasterStore';
import { PIECES, GRAVITY, type GravityKey, type PieceType } from '../physics';
import { Readouts } from './Readouts';
import { fmt } from './format';
import { Card, Icon, Segmented, Switch } from './kit';
import { Transport as PlayControls } from './Controls';

const PIECE_LABEL: Record<PieceType, { label: string; icon: string }> = Object.fromEntries(
  PIECES.map((p) => [p.type, { label: p.label, icon: p.icon }]),
) as Record<PieceType, { label: string; icon: string }>;

function Transport() {
  const cameraMode = useCoasterStore((s) => s.cameraMode);
  const setCameraMode = useCoasterStore((s) => s.setCameraMode);

  return (
    <Card icon="signpost" title="Recorrido">
      <PlayControls />
      <Segmented
        stretch
        className="mt"
        value={cameraMode}
        onChange={setCameraMode}
        options={[
          { value: 'orbit', label: 'Vista libre', icon: 'globe2' },
          { value: 'ride', label: 'Subirse', icon: 'person-standing' },
        ]}
      />
    </Card>
  );
}

function PieceBuilder() {
  const pieces = useCoasterStore((s) => s.pieces);
  const addPiece = useCoasterStore((s) => s.addPiece);
  const removeLastPiece = useCoasterStore((s) => s.removeLastPiece);
  const clearPieces = useCoasterStore((s) => s.clearPieces);

  return (
    <Card icon="bricks" title={`Piezas (${pieces.length})`}>
      <div className="pieces-grid">
        {PIECES.map((p) => (
          <button key={p.type} onClick={() => addPiece(p.type)} title={`Agregar ${p.label}`}>
            <Icon name={p.icon} className="piece-icon" />
            <span style={{ fontSize: 11 }}>{p.label}</span>
          </button>
        ))}
      </div>

      <div className="chips">
        <span className="chip start">
          <Icon name="flag-fill" /> Salida
        </span>
        {pieces.map((p, i) => (
          <span className="chip" key={i}>
            <Icon name={PIECE_LABEL[p].icon} /> {PIECE_LABEL[p].label}
          </span>
        ))}
        {pieces.length === 0 && <span className="hint">Agrega piezas para armar tu pista…</span>}
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <button onClick={removeLastPiece} disabled={pieces.length === 0}>
          <Icon name="backspace" />
          <span>Quitar última</span>
        </button>
        <button onClick={clearPieces} disabled={pieces.length === 0}>
          <Icon name="trash3" />
          <span>Vaciar</span>
        </button>
      </div>
      <div className="hint" style={{ marginTop: 8 }}>
        La salida es el punto más alto: empieza con una <b>bajada</b> para tomar velocidad. En un
        rizo, si el carrito va lento se cae (se pone rojo).
      </div>
    </Card>
  );
}

function BuilderPhysics() {
  const params = useCoasterStore((s) => s.params);
  const setParams = useCoasterStore((s) => s.setParams);
  const gravityKey: GravityKey | 'custom' =
    (Object.keys(GRAVITY) as GravityKey[]).find((k) => GRAVITY[k] === params.gravity) ?? 'custom';

  return (
    <Card icon="sliders" title="Física">
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
      <Switch
        checked={params.friction === 0}
        onChange={(on) => setParams({ friction: on ? 0 : 0.01 })}
        label="Sin fricción (ideal)"
      />
    </Card>
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
