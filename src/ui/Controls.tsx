/** Controles: reproducción, parámetros físicos, toggles y fuente de datos. */

import { useCoasterStore } from '../state/useCoasterStore';
import { GRAVITY, MARBLE_PRESETS, type GravityKey } from '../physics';
import { futureSources } from '../data/stubs';
import { fmt } from './format';
import { Card, Icon, Segmented, Switch } from './kit';

export const SPEED_OPTIONS = [
  { value: 0.25, label: '¼×', title: 'Cámara lenta ×0.25' },
  { value: 0.5, label: '½×', title: 'Cámara lenta ×0.5' },
  { value: 1, label: '1×', title: 'Tiempo real' },
];

/** Botones de reproducción (también se usan en la barra flotante de la escena). */
export function Transport({ compact = false }: { compact?: boolean }) {
  const running = useCoasterStore((s) => s.running);
  const play = useCoasterStore((s) => s.play);
  const pause = useCoasterStore((s) => s.pause);
  const reset = useCoasterStore((s) => s.reset);
  const mode = useCoasterStore((s) => s.mode);
  const speedMultiplier = useCoasterStore((s) => s.speedMultiplier);
  const setSpeedMultiplier = useCoasterStore((s) => s.setSpeedMultiplier);
  const what = mode === 'real' ? 'balín' : mode === 'builder' ? 'carrito' : 'canica';

  return (
    <div className="transport">
      <button className="primary" onClick={() => (running ? pause() : play())}>
        <Icon name={running ? 'pause-fill' : 'play-fill'} />
        {!compact && <span>{running ? 'Pausa' : `Soltar ${what}`}</span>}
      </button>
      <button className="icon-btn" onClick={reset} title="Reiniciar">
        <Icon name="arrow-counterclockwise" />
      </button>
      <Segmented value={speedMultiplier} options={SPEED_OPTIONS} onChange={setSpeedMultiplier} />
    </div>
  );
}

export function Controls() {
  const params = useCoasterStore((s) => s.params);
  const setParams = useCoasterStore((s) => s.setParams);
  const dataSource = useCoasterStore((s) => s.dataSource);
  const setDataSource = useCoasterStore((s) => s.setDataSource);
  const mode = useCoasterStore((s) => s.mode);
  const calibration = useCoasterStore((s) => s.calibration);
  const isReal = mode === 'real';
  const lossless = params.friction === 0 && (params.drag ?? 0) === 0;
  const calibrated = isReal && params.friction === calibration.mu && params.drag === calibration.drag;

  const gravityKey: GravityKey | 'custom' =
    (Object.keys(GRAVITY) as GravityKey[]).find((k) => GRAVITY[k] === params.gravity) ?? 'custom';

  return (
    <Card icon="sliders" title="Controles">
      <Transport />

      <div className="divider" />

      {isReal ? (
        <div className="kv">
          <span>Balín</span>
          <b>
            Ø 1 cm · {(params.mass * 1000).toFixed(0)} g
          </b>
        </div>
      ) : (
        <div className="control">
          <label>Canica</label>
          <select value={params.mass} onChange={(e) => setParams({ mass: +e.target.value })}>
            {MARBLE_PRESETS.map((m) => (
              <option key={m.id} value={m.mass}>
                {m.label} ({(m.mass * 1000).toFixed(0)} g)
              </option>
            ))}
          </select>
        </div>
      )}

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
          {isReal ? 'Rodadura μ (∝ fuerza de paredes)' : 'Fricción (μ)'} <b>{fmt(params.friction, 3)}</b>
        </label>
        <input
          type="range"
          min={0}
          max={isReal ? 0.2 : 0.1}
          step={isReal ? 0.002 : 0.005}
          value={params.friction}
          onChange={(e) => setParams({ friction: +e.target.value })}
        />
      </div>

      {isReal && (
        <div className="control">
          <label>
            Arrastre en el tubo k (m⁻¹) <b>{fmt(params.drag ?? 0, 2)}</b>
          </label>
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={params.drag ?? 0}
            onChange={(e) => setParams({ drag: +e.target.value })}
          />
        </div>
      )}

      {isReal && (
        <button
          className={`block ${calibrated ? 'is-on' : ''}`}
          onClick={() => setParams({ friction: calibration.mu, drag: calibration.drag })}
          title="Valores que mejor reproducen los tiempos del video"
        >
          <Icon name={calibrated ? 'check2-circle' : 'bullseye'} />
          <span>{calibrated ? 'Calibrado con el video' : 'Usar calibración del video'}</span>
        </button>
      )}

      <div className="switch-row">
        <Switch
          checked={lossless}
          onChange={(on) =>
            setParams(
              on
                ? { friction: 0, drag: 0 }
                : isReal
                  ? { friction: calibration.mu, drag: calibration.drag }
                  : { friction: 0.02 },
            )
          }
          label={isReal ? 'Sin pérdidas (ideal)' : 'Sin fricción (ideal)'}
        />
        <Switch checked={params.rolling} onChange={(on) => setParams({ rolling: on })} label="Rodadura (7/5)" />
      </div>

      {!isReal && (
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
      )}
    </Card>
  );
}
