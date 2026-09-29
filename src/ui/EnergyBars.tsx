/**
 * Barras de energía en vivo: se ve el trueque entre potencial y cinética,
 * y que la total (mecánica) se mantiene salvo por la fricción.
 */

import { useCoasterStore } from '../state/useCoasterStore';
import { energy } from './format';

export function EnergyBars() {
  const live = useCoasterStore((s) => s.live);
  const profile = useCoasterStore((s) => s.energyProfile);

  // Escala: la energía mecánica inicial (máxima disponible).
  const e0 = profile.length ? profile[0].mechanical : 1;
  const scale = e0 > 1e-9 ? e0 : 1;

  const bars = [
    { label: 'Cinética (KE)', value: live.keTotal, color: 'var(--ke)' },
    { label: 'Potencial (PE)', value: live.pe, color: 'var(--pe)' },
    { label: 'Mecánica total', value: live.mechanical, color: 'var(--total)' },
  ];

  return (
    <div className="card">
      <h2>Energía</h2>
      {bars.map((b) => {
        const e = energy(b.value);
        const pct = Math.max(0, Math.min(100, (b.value / scale) * 100));
        return (
          <div className="energy-bar" key={b.label}>
            <div className="head">
              <span>{b.label}</span>
              <span>
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
        Sin fricción, KE + PE se mantiene constante: solo se intercambian.
      </div>
    </div>
  );
}
