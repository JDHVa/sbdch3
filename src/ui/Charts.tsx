/**
 * Gráficas vs distancia recorrida (Recharts):
 *  - Energías: cinética, potencial y mecánica total.
 *  - Rapidez.
 *  - Fuerza normal en g's (con línea en 0 = pérdida de contacto).
 * Un marcador vertical señala la posición actual de la canica.
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useCoasterStore } from '../state/useCoasterStore';
import { forceAt } from '../physics';
import { Card } from './kit';

interface Row {
  s: number;
  keTotal: number;
  pe: number;
  mechanical: number;
  speed: number;
  gForce: number;
}

const MAX_POINTS = 140;

export function Charts() {
  const track = useCoasterStore((s) => s.track);
  const profile = useCoasterStore((s) => s.energyProfile);
  const params = useCoasterStore((s) => s.params);
  const liveS = useCoasterStore((s) => s.live.s);
  const enclosed = !!params.enclosed;

  const data = useMemo<Row[]>(() => {
    const stepN = Math.max(1, Math.floor(track.samples.length / MAX_POINTS));
    const rows: Row[] = [];
    for (let i = 0; i < track.samples.length; i += stepN) {
      const sample = track.samples[i];
      const p = profile[i];
      const f = forceAt(sample, p.speed, params);
      rows.push({
        s: +sample.s.toFixed(3),
        keTotal: +(p.keTotal * 1000).toFixed(3), // mJ
        pe: +(p.pe * 1000).toFixed(3),
        mechanical: +(p.mechanical * 1000).toFixed(3),
        speed: +p.speed.toFixed(3),
        gForce: +f.gForce.toFixed(3),
      });
    }
    return rows;
  }, [track, profile, params]);

  const axis = { stroke: '#6f7a8a', fontSize: 10 };
  const grid = '#222936';

  return (
    <Card icon="graph-up" title="Gráficas vs distancia">

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Energía (mJ)</div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={grid} />
          <XAxis dataKey="s" {...axis} tickFormatter={(v) => v.toFixed(1)} />
          <YAxis {...axis} />
          <Tooltip
            contentStyle={{ background: '#11151b', border: '1px solid #2a313c', fontSize: 12 }}
            labelFormatter={(v) => `s = ${v} m`}
          />
          <ReferenceLine x={+liveS.toFixed(3)} stroke="#ffffff" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="keTotal" name="Cinética" stroke="#ff8c42" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="pe" name="Potencial" stroke="#4da3ff" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="monotone" dataKey="mechanical" name="Total" stroke="#5ad19b" dot={false} strokeWidth={2} strokeDasharray="4 2" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 4px' }}>Rapidez (m/s)</div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={grid} />
          <XAxis dataKey="s" {...axis} tickFormatter={(v) => v.toFixed(1)} />
          <YAxis {...axis} />
          <Tooltip contentStyle={{ background: '#11151b', border: '1px solid #2a313c', fontSize: 12 }} labelFormatter={(v) => `s = ${v} m`} />
          <ReferenceLine x={+liveS.toFixed(3)} stroke="#ffffff" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="speed" name="Rapidez" stroke="#e6e9ef" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 4px' }}>
        {enclosed ? 'Fuerza de las paredes del tubo (g)' : 'Fuerza normal (g)'}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={grid} />
          <XAxis dataKey="s" {...axis} tickFormatter={(v) => v.toFixed(1)} />
          <YAxis {...axis} />
          <Tooltip contentStyle={{ background: '#11151b', border: '1px solid #2a313c', fontSize: 12 }} labelFormatter={(v) => `s = ${v} m`} />
          <ReferenceLine y={0} stroke="#ff453a" />
          <ReferenceLine x={+liveS.toFixed(3)} stroke="#ffffff" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="gForce" name="g" stroke="#c58bff" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="hint" style={{ marginTop: 6 }}>
        {enclosed
          ? 'Picos = curvas cerradas (punta del brazo, caja de la torre pequeña, vuelta final).'
          : 'Debajo de la línea roja (g < 0), la canica perdería contacto en el rizo.'}
      </div>
    </Card>
  );
}
