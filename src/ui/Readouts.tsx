/** Lecturas numéricas en vivo + aviso de pérdida de contacto. */

import { useCoasterStore } from '../state/useCoasterStore';
import { fmt, kmh, energy } from './format';
import { Card, Icon } from './kit';

function Cell({ icon, k, v, u, tone }: { icon: string; k: string; v: string; u?: string; tone?: string }) {
  return (
    <div className="readout">
      <div className="k">
        <Icon name={icon} className={tone} />
        {k}
      </div>
      <div className="v">
        {v}
        {u && <span className="u">{u}</span>}
      </div>
    </div>
  );
}

export function Readouts() {
  const live = useCoasterStore((s) => s.live);
  const time = useCoasterStore((s) => s.sim.time);
  const enclosed = useCoasterStore((s) => s.params.enclosed);
  const ke = energy(live.keTotal);
  const pe = energy(live.pe);

  return (
    <Card icon="broadcast" title="Lecturas en vivo">
      <div className="readouts">
        <Cell icon="speedometer2" k="Rapidez" v={fmt(live.speed, 2)} u="m/s" />
        <Cell icon="speedometer" k="Rapidez" v={fmt(kmh(live.speed), 1)} u="km/h" />
        {Math.abs(live.height) >= 10 ? (
          <Cell icon="arrows-vertical" k="Altura" v={fmt(live.height, 1)} u="m" />
        ) : (
          <Cell icon="arrows-vertical" k="Altura" v={fmt(live.height * 100, 1)} u="cm" />
        )}
        <Cell
          icon="bullseye"
          k={enclosed ? 'Fuerza de paredes' : 'Fuerza normal'}
          v={fmt(live.force.gForce, 2)}
          u="g"
        />
        <Cell icon="lightning-charge-fill" tone="tone-ke" k="E. cinética" v={ke.value} u={ke.unit} />
        <Cell icon="battery-half" tone="tone-pe" k="E. potencial" v={pe.value} u={pe.unit} />
        <Cell icon="stopwatch" k="Tiempo" v={fmt(time, 2)} u="s" />
        <Cell icon="signpost-split" k="Recorrido" v={fmt(live.s, 2)} u="m" />
      </div>

      {live.force.losesContact && (
        <div className="alert" style={{ marginTop: 12 }}>
          <Icon name="exclamation-triangle-fill" />
          <span>
            Velocidad insuficiente: la canica <b>pierde contacto</b> con la pista aquí.
          </span>
        </div>
      )}
    </Card>
  );
}
