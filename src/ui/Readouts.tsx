/** Lecturas numéricas en vivo + aviso de pérdida de contacto. */

import { useCoasterStore } from '../state/useCoasterStore';
import { fmt, kmh, energy } from './format';

function Cell({ k, v, u }: { k: string; v: string; u?: string }) {
  return (
    <div className="readout">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {u && <span className="u">{u}</span>}
      </div>
    </div>
  );
}

export function Readouts() {
  const live = useCoasterStore((s) => s.live);
  const ke = energy(live.keTotal);
  const pe = energy(live.pe);

  return (
    <div className="card">
      <h2>Lecturas en vivo</h2>
      <div className="readouts">
        <Cell k="Rapidez" v={fmt(live.speed, 2)} u="m/s" />
        <Cell k="Rapidez" v={fmt(kmh(live.speed), 1)} u="km/h" />
        <Cell k="Altura" v={fmt(live.height, 2)} u="m" />
        <Cell k="Fuerza normal (g)" v={fmt(live.force.gForce, 2)} u="g" />
        <Cell k="E. cinética" v={ke.value} u={ke.unit} />
        <Cell k="E. potencial" v={pe.value} u={pe.unit} />
      </div>

      {live.force.losesContact && (
        <div className="alert" style={{ marginTop: 12 }}>
          ⚠️ Velocidad insuficiente: la canica <b>&nbsp;pierde contacto&nbsp;</b> con la pista aquí.
        </div>
      )}
    </div>
  );
}
