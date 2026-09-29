/**
 * Layout principal: escena 3D a la izquierda, panel a la derecha.
 * Dos modos: "Demostración física" (canica + gráficas) y "Constructor 3D"
 * (arma tu propia montaña rusa con piezas y súbete a ella).
 */

import { useCoasterStore, type AppMode } from './state/useCoasterStore';
import { Coaster3D } from './scene/Coaster3D';
import { BuilderScene } from './scene/BuilderScene';
import { Controls } from './ui/Controls';
import { Readouts } from './ui/Readouts';
import { EnergyBars } from './ui/EnergyBars';
import { Charts } from './ui/Charts';
import { TrackEditor } from './ui/TrackEditor';
import { BuilderPanel } from './ui/BuilderPanel';

function ModeTabs() {
  const mode = useCoasterStore((s) => s.mode);
  const setMode = useCoasterStore((s) => s.setMode);
  const tab = (m: AppMode, label: string) => (
    <button className={mode === m ? 'primary' : ''} style={{ flex: 1 }} onClick={() => setMode(m)}>
      {label}
    </button>
  );
  return (
    <div className="mode-tabs">
      {tab('demo', '🔬 Demostración')}
      {tab('builder', '🏗 Constructor 3D')}
    </div>
  );
}

export default function App() {
  const mode = useCoasterStore((s) => s.mode);

  return (
    <div className="app">
      <div className="stage">
        <div className="stage-title">
          <h1>🎢 Montaña Rusa · Física en vivo</h1>
          <p>
            {mode === 'demo'
              ? 'Energía, velocidad y fuerza normal a lo largo del recorrido'
              : 'Arma tu propia montaña rusa con piezas y súbete a ella'}
          </p>
        </div>
        {mode === 'demo' ? <Coaster3D /> : <BuilderScene />}
      </div>

      <div className="panel">
        <ModeTabs />
        {mode === 'demo' ? (
          <>
            <Controls />
            <Readouts />
            <EnergyBars />
            <Charts />
            <TrackEditor />
          </>
        ) : (
          <BuilderPanel />
        )}
      </div>
    </div>
  );
}
