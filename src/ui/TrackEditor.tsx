/**
 * Editor de la pista: vista de perfil lateral (distancia x vs altura y) con
 * puntos de control arrastrables. Botones para reiniciar e insertar un loop.
 * Al mover un punto, la curva 3D y toda la física se recalculan en vivo.
 */

import { useRef, useState } from 'react';
import { useCoasterStore } from '../state/useCoasterStore';
import { makeVerticalLoop, vec, type Vec3 } from '../physics';
import { Card, Icon } from './kit';

const VIEW_W = 340;
const VIEW_H = 150;
const PAD = 16;

export function TrackEditor() {
  const controlPoints = useCoasterStore((s) => s.controlPoints);
  const moveControlPoint = useCoasterStore((s) => s.moveControlPoint);
  const setControlPoints = useCoasterStore((s) => s.setControlPoints);
  const resetTrack = useCoasterStore((s) => s.resetTrack);

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [loopRadius, setLoopRadius] = useState(0.28);

  // Límites del mundo para mapear a la vista.
  const xs = controlPoints.map((p) => p.x);
  const ys = controlPoints.map((p) => p.y);
  const minX = Math.min(...xs, 0) - 0.2;
  const maxX = Math.max(...xs, 4) + 0.2;
  const minY = Math.min(...ys, 0) - 0.1;
  const maxY = Math.max(...ys, 1.4) + 0.1;

  const toSvgX = (x: number) => PAD + ((x - minX) / (maxX - minX)) * (VIEW_W - 2 * PAD);
  const toSvgY = (y: number) => VIEW_H - PAD - ((y - minY) / (maxY - minY)) * (VIEW_H - 2 * PAD);
  const toWorldX = (sx: number) => minX + ((sx - PAD) / (VIEW_W - 2 * PAD)) * (maxX - minX);
  const toWorldY = (sy: number) =>
    minY + ((VIEW_H - PAD - sy) / (VIEW_H - 2 * PAD)) * (maxY - minY);

  const polyline = controlPoints.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');

  function pointerToWorld(e: React.PointerEvent): Vec3 {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return vec(toWorldX(sx), Math.max(0, toWorldY(sy)), 0);
  }

  function onMove(e: React.PointerEvent) {
    if (dragging === null) return;
    moveControlPoint(dragging, pointerToWorld(e));
  }

  function insertLoop() {
    // Inserta un loop en el punto más bajo (el valle) de la pista.
    let idx = 0;
    let lowest = Infinity;
    controlPoints.forEach((p, i) => {
      if (p.y < lowest) {
        lowest = p.y;
        idx = i;
      }
    });
    const entry = controlPoints[idx];
    const loop = makeVerticalLoop(entry, loopRadius);
    const next = [
      ...controlPoints.slice(0, idx + 1),
      ...loop,
      ...controlPoints.slice(idx + 1),
    ];
    setControlPoints(next);
  }

  return (
    <Card icon="bezier2" title="Editor de pista">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{ width: '100%', background: 'var(--panel)', borderRadius: 8, touchAction: 'none' }}
        onPointerMove={onMove}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        {/* suelo */}
        <line x1={PAD} y1={toSvgY(0)} x2={VIEW_W - PAD} y2={toSvgY(0)} stroke="#2a313c" strokeDasharray="3 3" />
        {/* pista */}
        <polyline points={polyline} fill="none" stroke="#c9a26a" strokeWidth={2.5} />
        {/* puntos */}
        {controlPoints.map((p, i) => (
          <circle
            key={i}
            cx={toSvgX(p.x)}
            cy={toSvgY(p.y)}
            r={dragging === i ? 7 : 5}
            fill={dragging === i ? '#4da3ff' : '#e6e9ef'}
            stroke="#0e1116"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              setDragging(i);
            }}
          />
        ))}
      </svg>

      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <button onClick={resetTrack}>
          <Icon name="arrow-counterclockwise" />
          <span>Pista por defecto</span>
        </button>
        <button onClick={insertLoop}>
          <Icon name="arrow-repeat" />
          <span>Insertar loop</span>
        </button>
      </div>

      <div className="control" style={{ marginTop: 12 }}>
        <label>
          Radio del loop a insertar <b>{loopRadius.toFixed(2)} m</b>
        </label>
        <input
          type="range"
          min={0.12}
          max={0.45}
          step={0.01}
          value={loopRadius}
          onChange={(e) => setLoopRadius(+e.target.value)}
        />
      </div>

      <div className="hint">Arrastra los puntos para esculpir la pista. La física se recalcula al instante.</div>
    </Card>
  );
}
