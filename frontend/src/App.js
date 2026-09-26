import React, { useCallback, useEffect, useState } from 'react';
import { get } from './api';
import MapView from './components/MapView';
import WellTimeline from './components/WellTimeline';
import DepthAlerts from './components/DepthAlerts';
import SettingsPanel from './components/SettingsPanel';
import SearchPanel from './components/SearchPanel';
import DepthCorrelation from './components/DepthCorrelation';
import SeverityHeatmap from './components/SeverityHeatmap';
import LessonsLearned from './components/LessonsLearned';
import SimilarWells from './components/SimilarWells';
import EventEntry from './components/EventEntry';

const OFFICE_TABS = [
  ['well', 'Well Timeline'],
  ['correlation', 'Depth Correlation'],
  ['heatmap', 'Severity'],
  ['search', 'Search'],
  ['lessons', 'Lessons Learned'],
  ['similar', 'Similar Wells'],
  ['entry', 'Log Event'],
];

const DEFAULT_SETTINGS = { window: 50, matchFormation: true, overlayRadius: 40, band: 100 };

export default function App() {
  const [mode, setMode] = useState(() => (window.innerWidth < 760 ? 'field' : 'office'));
  const [tab, setTab] = useState('well');
  const [wells, setWells] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeId, setActiveId] = useState('well-a');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stale, setStale] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0); // bump to refetch after edits

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    Promise.all([get('/api/wells'), get('/api/events')])
      .then(([w, e]) => {
        setWells(w.data);
        setEvents(e.data);
        setStale(w.stale || e.stale ? w.cachedAt || e.cachedAt : null);
        setError('');
      })
      .catch((err) => setError(`Backend unreachable and no cached data (${err.message}).`));
  }, [version]);

  const active = wells.find((w) => w.id === activeId);

  return (
    <div className={`app mode-${mode}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">NWIS</span>
          <span className="brand-sub">National Well Information System</span>
        </div>
        <div className="topbar-controls">
          <label className="well-select">
            <span>Active well</span>
            <select value={activeId} onChange={(e) => setActiveId(e.target.value)}>
              {wells.map((w) => (
                <option key={w.id} value={w.id}>{w.name} · {w.formation_name}</option>
              ))}
            </select>
          </label>
          <div className="segmented" role="tablist" aria-label="View mode">
            {['field', 'office'].map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                {m === 'field' ? 'Field' : 'Office'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {stale && (
        <div className="banner warn">
          Offline — showing cached data from {new Date(stale).toLocaleString()}.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}

      <main className="workspace">
        <section className="map-pane">
          <MapView
            wells={wells}
            activeId={activeId}
            onSelect={(id) => { setActiveId(id); setTab('well'); }}
            overlayRadius={settings.overlayRadius}
            version={version}
          />
        </section>

        <aside className="side-pane">
          {mode === 'field' ? (
            <DepthAlerts well={active} settings={settings} compact />
          ) : (
            <>
              <div className="panel-stack">
                <DepthAlerts well={active} settings={settings} />
                <SettingsPanel settings={settings} onChange={setSettings} />
              </div>
              <nav className="tabs">
                {OFFICE_TABS.map(([k, l]) => (
                  <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
                ))}
              </nav>
              <div className="tab-body">
                {tab === 'well' && <WellTimeline well={active} events={events} />}
                {tab === 'correlation' && (
                  <DepthCorrelation wells={wells} events={events} activeId={activeId} window={settings.window} />
                )}
                {tab === 'heatmap' && <SeverityHeatmap band={settings.band} referenceWell={activeId} version={version} />}
                {tab === 'search' && <SearchPanel wells={wells} version={version} />}
                {tab === 'lessons' && <LessonsLearned wells={wells} events={events} onChange={reload} />}
                {tab === 'similar' && <SimilarWells well={active} version={version} />}
                {tab === 'entry' && <EventEntry wells={wells} activeId={activeId} onSaved={reload} />}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
