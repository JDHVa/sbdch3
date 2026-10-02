/**
 * Cálculos de la montaña rusa real: datos medidos, fórmulas con sus valores,
 * tabla por punto del recorrido y comparación de tiempos contra el video.
 * Todo se recalcula con los parámetros actuales (μ, k, gravedad, rodadura).
 */

import { useMemo } from 'react';
import { useCoasterStore } from '../state/useCoasterStore';
import {
  BALL,
  HOSE,
  TOWERS,
  VIDEO_CHECKPOINTS,
  CHECKPOINT_LABELS,
  CHECKPOINT_SHORT,
  realCoasterReport,
  simulatedCheckpointTimes,
  videoTime,
} from '../physics';
import { fmt } from './format';
import { Card } from './kit';

const mJ = (j: number) => fmt(j * 1000, 1);
const cm = (m: number) => fmt(m * 100, 1);
const sec = (t: number) => (Number.isFinite(t) ? fmt(t, 2) : 'no llega');

function Formula({ label, expr, value }: { label: string; expr: string; value: string }) {
  return (
    <div className="formula">
      <div className="f-label">{label}</div>
      <div className="f-expr">{expr}</div>
      <div className="f-value">{value}</div>
    </div>
  );
}

export function RealData() {
  const params = useCoasterStore((s) => s.params);
  const track = useCoasterStore((s) => s.track);
  const r = useMemo(() => realCoasterReport(track, params), [track, params]);
  const mEff = params.rolling ? (7 / 5) * params.mass : params.mass;

  return (
    <Card icon="rulers" title="Datos de la maqueta">
      <table className="data-table">
        <tbody>
          {TOWERS.map((t) => (
            <tr key={t.id}>
              <td>{t.label.split(' · ')[0]}</td>
              <td>
                {cm(t.height)} cm · sección {cm(t.side)}×{cm(t.side)} cm
              </td>
            </tr>
          ))}
          <tr>
            <td>Balín</td>
            <td>
              Ø {cm(BALL.diameter)} cm · m = {fmt(params.mass * 1000, 1)} g
            </td>
          </tr>
          <tr>
            <td>Momento de inercia</td>
            <td>
              I = ⅖·m·r² = {(r.inertia * 1e8).toFixed(2)}×10⁻⁸ kg·m²
            </td>
          </tr>
          <tr>
            <td>Masa efectiva</td>
            <td>
              {params.rolling ? 'm_ef = m + I/r² = 7/5·m' : 'm_ef = m (sin rodar)'} = {fmt(mEff * 1000, 1)} g
            </td>
          </tr>
          <tr>
            <td>Manguera</td>
            <td>
              Ø ext ≈ {cm(HOSE.outerRadius * 2)} cm · largo ≈ {fmt(r.length, 2)} m
            </td>
          </tr>
          <tr>
            <td>Altura inicial / final</td>
            <td>
              h₀ = {cm(r.h0)} cm · h_f = {cm(r.hEnd)} cm (Δh = {cm(r.drop)} cm)
            </td>
          </tr>
        </tbody>
      </table>
      <div className="hint" style={{ marginTop: 8 }}>
        La boca del tubo queda ~2 cm sobre la torre grande. Posiciones y alturas de brazos estimadas de fotos y
        video; se ajustan en <code>src/physics/realCoaster.ts</code>.
      </div>
    </Card>
  );
}

export function RealCalcs() {
  const params = useCoasterStore((s) => s.params);
  const track = useCoasterStore((s) => s.track);
  const r = useMemo(() => realCoasterReport(track, params), [track, params]);
  const g = params.gravity;
  const m = params.mass;
  const k = params.drag ?? 0;
  const vLim10 = k > 0 ? Math.sqrt((g * Math.sin(Math.atan(0.1))) / k) : Infinity;
  const maxRow = r.rows.reduce((a, b) => (b.gForce > a.gForce ? b : a), r.rows[0]);

  return (
    <Card icon="calculator" title="Cálculos">
      <Formula
        label="Energía potencial disponible"
        expr={`Ep = m·g·Δh = ${fmt(m, 3)}·${fmt(g, 2)}·${fmt(r.drop, 3)}`}
        value={`${mJ(r.e0)} mJ`}
      />
      <Formula
        label="Rapidez final ideal (resbalando)"
        expr="v = √(2·g·Δh)"
        value={`${fmt(r.vEndSliding, 2)} m/s`}
      />
      <Formula
        label="Rapidez final ideal (rodando, sin pérdidas)"
        expr="m·g·Δh = ½·(7/5)·m·v²  ⇒  v = √(10/7·g·Δh)"
        value={`${fmt(r.vEndRolling, 2)} m/s`}
      />
      <Formula
        label="Rapidez final con pérdidas (calibrada)"
        expr={`μ = ${fmt(params.friction, 3)},  k = ${fmt(k, 2)} m⁻¹`}
        value={`${fmt(r.rows[r.rows.length - 1].speed, 2)} m/s`}
      />
      <Formula
        label="Energía perdida en el recorrido"
        expr={`W = ∫(μ·|N| + m·k·v²) ds = ${mJ(r.e0)} − ${mJ(r.eEnd)} mJ`}
        value={`${fmt(r.lostFraction * 100, 0)} %`}
      />
      <Formula
        label="Rapidez límite en pendiente de 10 %"
        expr="g·sen θ = k·v²  ⇒  v_lím = √(g·sen θ / k)"
        value={Number.isFinite(vLim10) ? `${fmt(vLim10, 2)} m/s` : '—'}
      />
      <Formula
        label="Tiempo total (simulado)"
        expr={`t = ∫ ds / v(s)  ·  ${fmt(r.length, 2)} m`}
        value={`${sec(r.totalTime)} s`}
      />
      <Formula
        label="Rapidez promedio / máxima"
        expr="v̄ = L / t"
        value={`${fmt(r.avgSpeed, 2)} / ${fmt(r.maxSpeed, 2)} m/s`}
      />
      <Formula
        label="Fuerza máxima de las paredes"
        expr={`|N| = m·|v²/R·n̂ + g⊥|  ·  en «${CHECKPOINT_SHORT[maxRow.id]}»`}
        value={`${fmt(r.maxG, 1)} g`}
      />
      <div className="hint" style={{ marginTop: 8 }}>
        El balín va dentro de la manguera: las paredes lo sostienen en cualquier dirección, así que no puede
        «despegarse» como en una pista abierta. Las pérdidas reales son grandes (roce y golpeteo dentro del tubo);
        por eso llega mucho más lento que el caso ideal.
      </div>
    </Card>
  );
}

export function RealCheckpointTable() {
  const params = useCoasterStore((s) => s.params);
  const track = useCoasterStore((s) => s.track);
  const r = useMemo(() => realCoasterReport(track, params), [track, params]);

  return (
    <Card icon="table" title="Punto por punto">
      <div className="table-scroll">
        <table className="cp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Punto</th>
              <th>h (cm)</th>
              <th title="Distancia recorrida por la manguera">s (m)</th>
              <th title="Sin pérdidas, rodando (m/s)">v₀</th>
              <th title="Con pérdidas calibradas (m/s)">v</th>
              <th title="Energía mecánica (mJ)">E mJ</th>
              <th title="Fuerza de las paredes / peso">g</th>
              <th>t (s)</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row, i) => (
              <tr key={row.id}>
                <td className="num-badge">{i + 1}</td>
                <td title={row.label}>{CHECKPOINT_SHORT[row.id]}</td>
                <td>{cm(row.height)}</td>
                <td>{fmt(row.s, 2)}</td>
                <td>{fmt(row.speedIdeal, 2)}</td>
                <td>
                  <b>{fmt(row.speed, 2)}</b>
                </td>
                <td>{mJ(row.mechanical)}</td>
                <td>{fmt(row.gForce, 1)}</td>
                <td>{sec(row.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint" style={{ marginTop: 6 }}>
        Los números coinciden con los marcadores de la escena 3D. v₀ = ideal (sin pérdidas), v = con pérdidas
        calibradas. E se mide respecto al punto más bajo.
      </div>
    </Card>
  );
}

export function VideoValidation() {
  const params = useCoasterStore((s) => s.params);
  const track = useCoasterStore((s) => s.track);
  const calibration = useCoasterStore((s) => s.calibration);
  const sim = useMemo(() => simulatedCheckpointTimes(track, params), [track, params]);

  return (
    <Card icon="camera-reels" title="Comparación con el video">
      <div className="hint" style={{ marginBottom: 8 }}>
        Se rastreó el balín en <code>video-montaña-rsua.mp4</code> (29.65 fps, cámara estabilizada). Soltado en el
        cuadro 5 ⇒ t = (cuadro − 5)/29.65.
      </div>
      <div className="table-scroll">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Punto</th>
              <th>Cuadro</th>
              <th>t video</th>
              <th>t sim</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {VIDEO_CHECKPOINTS.map((c) => {
              const tv = videoTime(c.frame);
              const ts = sim[c.id];
              const d = ts - tv;
              return (
                <tr key={c.id} style={{ opacity: c.weight < 0.5 ? 0.65 : 1 }}>
                  <td title={`${CHECKPOINT_LABELS[c.id]} · ${c.note}`}>{CHECKPOINT_SHORT[c.id]}</td>
                  <td>{c.frame}</td>
                  <td>{fmt(tv, 2)}</td>
                  <td>{sec(ts)}</td>
                  <td style={{ color: Math.abs(d) > 0.3 ? 'var(--ke)' : 'var(--total)' }}>
                    {Number.isFinite(d) ? `${d > 0 ? '+' : ''}${fmt(d, 2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint" style={{ marginTop: 6 }}>
        Calibración automática (mínimos cuadrados): μ = {fmt(calibration.mu, 3)}, k = {fmt(calibration.drag, 2)} m⁻¹,
        error RMS = {fmt(calibration.rmsError, 2)} s. Las filas tenues son mediciones menos seguras (el final del tubo
        queda tapado por una mano).
      </div>
    </Card>
  );
}
