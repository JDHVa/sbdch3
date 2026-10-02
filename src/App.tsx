/**
 * Layout principal: barra superior (marca + modo), escena 3D a la izquierda y
 * panel a la derecha. Tres modos: "Montaña real" (réplica de la maqueta del
 * proyecto + cálculos y comparación con el video), "Demostración física"
 * (canica + gráficas) y "Constructor 3D" (arma tu propia montaña rusa).
 */

import { useState } from 'react';
import { useCoasterStore, type AppMode } from './state/useCoasterStore';
import { Coaster3D } from './scene/Coaster3D';
import { BuilderScene } from './scene/BuilderScene';
import { RealModelScene } from './scene/RealModelScene';
import { Controls } from './ui/Controls';
import { Readouts } from './ui/Readouts';
import { EnergyBars } from './ui/EnergyBars';
import { Charts } from './ui/Charts';
import { TrackEditor } from './ui/TrackEditor';
import { BuilderPanel } from './ui/BuilderPanel';
import { RealCalcs, RealCheckpointTable, RealData, VideoValidation } from './ui/RealCalcs';
import { RealHud } from './ui/RealHud';
import { Icon, Segmented } from './ui/kit';

const MODES: { value: AppMode; label: string; icon: string; title: string }[] = [
  { value: 'real', label: 'Montaña real', icon: 'box-seam', title: 'Réplica de la maqueta del proyecto' },
  { value: 'demo', label: 'Demostración', icon: 'bezier2', title: 'Pista didáctica con rizo' },
  { value: 'builder', label: 'Constructor', icon: 'bricks', title: 'Arma tu propia montaña rusa' },
];

const SUBTITLES: Record<AppMode, string> = {
  real: 'Torres de 92, 61 y 40.5 cm · balín de 1 cm y 5 g',
  demo: 'Energía, velocidad y fuerza normal a lo largo del recorrido',
  builder: 'Arma tu propia montaña rusa con piezas y súbete a ella',
};

type RealTab = 'vivo' | 'calculos' | 'video' | 'maqueta';

const REAL_TABS: { value: RealTab; label: string; icon: string }[] = [
  { value: 'vivo', label: 'En vivo', icon: 'broadcast' },
  { value: 'calculos', label: 'Cálculos', icon: 'calculator' },
  { value: 'video', label: 'Video', icon: 'camera-reels' },
  { value: 'maqueta', label: 'Maqueta', icon: 'rulers' },
];

function RealPanel() {
  const [tab, setTab] = useState<RealTab>('vivo');
  return (
    <>
      <div className="panel-tabs">
        <Segmented stretch value={tab} options={REAL_TABS} onChange={setTab} />
      </div>
      {tab === 'vivo' && (
        <>
          <Controls />
          <Readouts />
          <EnergyBars />
          <Charts />
        </>
      )}
      {tab === 'calculos' && (
        <>
          <RealCalcs />
          <RealCheckpointTable />
        </>
      )}
      {tab === 'video' && <VideoValidation />}
      {tab === 'maqueta' && <RealData />}
    </>
  );
}

export default function App() {
  const mode = useCoasterStore((s) => s.mode);
  const setMode = useCoasterStore((s) => s.setMode);

  return (
    <div className={mode === 'real' ? 'app wide' : 'app'}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="activity" />
          </span>
          <div>
            <h1>Montaña Rusa · Física en vivo</h1>
            <p>{SUBTITLES[mode]}</p>
          </div>
        </div>
        <Segmented className="mode-switch" value={mode} options={MODES} onChange={setMode} />
      </header>

      <main className="stage">
        {mode === 'real' ? (
          <>
            <RealModelScene />
            <RealHud />
          </>
        ) : mode === 'demo' ? (
          <Coaster3D />
        ) : (
          <BuilderScene />
        )}
      </main>

      <aside className="panel">
        {mode === 'real' && <RealPanel />}
        {mode === 'demo' && (
          <>
            <Controls />
            <Readouts />
            <EnergyBars />
            <Charts />
            <TrackEditor />
          </>
        )}
        {mode === 'builder' && <BuilderPanel />}
      </aside>
    </div>
  );
}
