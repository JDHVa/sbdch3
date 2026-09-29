/** Controles: reproducción, parámetros físicos, toggles y fuente de datos. */

import { useCoasterStore } from '../state/useCoasterStore';
import { GRAVITY, MARBLE_PRESETS, type GravityKey } from '../physics';
import { futureSources } from '../data/stubs';
import { fmt } from './format';

export function Controls() {
  const params = useCoasterStore((s) => s.params);
  const setParams = useCoasterStore((s) => s.setParams);
  const running = useCoasterStore((s) => s.running);
  const play = useCoasterStore((s) => s.play);
  const pause = useCoasterStore((s) => s.pause);
  const reset = useCoasterStore((s) => s.reset);
  const speedMultiplier = useCoasterStore((s) => s.speedMultiplier);
  const setSpeedMultiplier = useCoasterStore((s) => s.setSpeedMultiplier);
  const dataSource = useCoasterStore((s) => s.dataSource);
  const setDataSource = useCoasterStore((s) => s.setDataSource);

  const gravityKey: GravityKey | 'custom' =
    (Object.keys(GRAVITY) as GravityKey[]).find((k) => GRAVITY[k] === params.gravity) ?? 'custom';

  return (
    <div className="card">
      <h2>Controles</h2>

      <div className="transport">
        <button className="primary" onClick={() => (running ? pause() : play())}>
          {running ? '⏸ Pausa' : '▶ Soltar canica'}
        </button>
        <button onClick={reset}>↺ Reiniciar</button>
        <select
          value={speedMultiplier}
          onChange={(e) => setSpeedMultiplier(+e.target.value)}
          style={{ width: 'auto' }}
          title="Velocidad de reproducción"
        >
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
        </select>
      </div>

      <div style={{ height: 12 }} />

      <div className="control">
        <label>
          Canica
        </label>
        <select
          value={params.mass}
          onChange={(e) => setParams({ mass: +e.target.value })}
        >
          {MARBLE_PRESETS.map((m) => (
            <option key={m.id} value={m.mass}>
              {m.label} ({(m.mass * 1000).toFixed(0)} g)
            </option>
          ))}
        </select>
      </div>

      <div className="control">
        <label>Gravedad</label>
        <select
          value={gravityKey}
          onChange={(e) => {
            const k = e.target.value as GravityKey;
            setParams({ gravity: GRAVITY[k] });
          }}
        >
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
          max={0.1}
          step={0.005}
          value={params.friction}
          onChange={(e) => setParams({ friction: +e.target.value })}
        />
      </div>

      <div className="row" style={{ gap: 16, marginTop: 4 }}>
        <label className="toggle">
          <input
            type="checkbox"
            checked={params.friction === 0}
            onChange={(e) => setParams({ friction: e.target.checked ? 0 : 0.02 })}
          />
          Sin fricción (ideal)
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={params.rolling}
            onChange={(e) => setParams({ rolling: e.target.checked })}
          />
          Rodadura (7/5)
        </label>
      </div>

      <div className="control" style={{ marginTop: 14 }}>
        <label>Fuente de datos</label>
        <select value={dataSource} onChange={(e) => setDataSource(e.target.value as never)}>
          <option value="simulated">Simulado (teórico)</option>
          {futureSources.map((src) => (
            <option key={src.kind} value={src.kind} disabled={!src.available}>
              {src.label} — próximamente
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
