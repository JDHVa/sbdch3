/**
 * Barras de energía en vivo: se ve el trueque entre potencial y cinética,
 * y que la total (mecánica) se mantiene salvo por la fricción.
 */

import { useCoasterStore } from '../state/useCoasterStore';
import { energy } from './format';
import { Card } from './kit';

export function EnergyBars() {
  const live = useCoasterStore((s) => s.live);
  const profile = useCoasterStore((s) => s.energyProfile);

  // Escala: la energía mecánica inicial (máxima disponible).
  const e0 = profile.length ? profile[0].mechanical : 1;
  const scale = e0 > 1e-9 ? e0 : 1;
  const lost = Math.max(0, e0 - live.mechanical);

  const bars = [
    { label: 'Cinética', value: live.keTotal, color: 'var(--ke)' },
    { label: 'Potencial', value: live.pe, color: 'var(--pe)' },
    { label: 'Mecánica total', value: live.mechanical, color: 'var(--total)' },
    { label: 'Perdida por fricción', value: lost, color: 'var(--lost)' },
  ];

  return (
    <Card icon="lightning-charge" title="Energía">
      {bars.map((b) => {
        const e = energy(b.value);
        const pct = Math.max(0, Math.min(100, (b.value / scale) * 100));
        return (
          <div className="energy-bar" key={b.label}>
            <div className="head">
              <span>
                <span className="dot" style={{ background: b.color }} />
                {b.label}
              </span>
              <span className="num">
                {e.value} {e.unit}
              </span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${pct}%`, background: b.color }} />
            </div>
          </div>
        );
      })}
      <div className="hint" style={{ marginTop: 8 }}>
        Sin pérdidas, cinética + potencial se mantiene constante: solo se intercambian.
      </div>
    </Card>
  );
}
