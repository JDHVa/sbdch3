/**
 * Barra flotante sobre la escena de la montaña real: reproducción, lecturas
 * rápidas y progreso del balín con los 12 puntos de referencia del recorrido.
 */

import { useMemo } from 'react';
import { REAL_TRACK, useCoasterStore } from '../state/useCoasterStore';
import { CHECKPOINTS, CHECKPOINT_SHORT, checkpointArcLengths } from '../physics';
import { Transport } from './Controls';
import { fmt } from './format';
import { Icon } from './kit';

function Stat({ icon, v, u, title }: { icon: string; v: string; u: string; title: string }) {
  return (
    <div className="hud-stat" title={title}>
      <Icon name={icon} />
      <b>{v}</b>
      <span>{u}</span>
    </div>
  );
}

export function RealHud() {
  const live = useCoasterStore((s) => s.live);
  const time = useCoasterStore((s) => s.sim.time);
  const length = REAL_TRACK.length;

  const ticks = useMemo(() => {
    const sOf = checkpointArcLengths(REAL_TRACK);
    return CHECKPOINTS.map((c, i) => ({ n: i + 1, s: sOf[c.id], label: CHECKPOINT_SHORT[c.id] }));
  }, []);

  const pct = Math.min(100, (live.s / length) * 100);

  return (
    <div className="hud">
      <div className="hud-row">
        <Transport compact />
        <div className="hud-stats">
          <Stat icon="speedometer2" v={fmt(live.speed, 2)} u="m/s" title="Rapidez" />
          <Stat icon="arrows-vertical" v={fmt(live.height * 100, 1)} u="cm" title="Altura" />
          <Stat icon="bullseye" v={fmt(live.force.gForce, 1)} u="g" title="Fuerza de las paredes" />
          <Stat icon="stopwatch" v={fmt(time, 2)} u="s" title="Tiempo desde el soltado" />
        </div>
      </div>
      <div className="progress" title={`${fmt(live.s, 2)} de ${fmt(length, 2)} m`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
        {ticks.map((t) => (
          <div
            key={t.n}
            className={`progress-tick ${live.s >= t.s - 1e-3 ? 'passed' : ''}`}
            style={{ left: `${(t.s / length) * 100}%` }}
            title={`${t.n}. ${t.label}`}
          >
            {t.n}
          </div>
        ))}
      </div>
    </div>
  );
}
