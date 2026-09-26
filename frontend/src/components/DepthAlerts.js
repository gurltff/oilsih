import React, { useEffect, useState } from 'react';
import { get, qs, label, severityClass } from '../api';

// Offset-well risk events within ±window m of the entered drilling depth.
export default function DepthAlerts({ well, settings, compact }) {
  const [depth, setDepth] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [stale, setStale] = useState(false);

  useEffect(() => { if (well) setDepth(String(well.depth_current)); }, [well]);

  useEffect(() => {
    if (!well || depth === '') return;
    const params = qs({ well_id: well.id, depth, window: settings.window, match_formation: settings.matchFormation });
    get(`/api/alerts?${params}`)
      .then(({ data, stale: s }) => { setAlerts(data); setStale(s); })
      .catch(() => setAlerts([]));
  }, [well, depth, settings.window, settings.matchFormation]);

  if (!well) return null;

  return (
    <div className={`panel alerts ${compact ? 'compact' : ''}`}>
      <div className="panel-head">
        <h2>Depth alerts · {well.name}</h2>
        <span className={`status-pill ${alerts.length ? 'risk-high' : 'risk-ok'}`}>
          {alerts.length ? `${alerts.length} ACTIVE` : 'CLEAR'}
        </span>
      </div>
      <label className="depth-input">
        Current drilling depth (m)
        <input type="number" inputMode="numeric" value={depth} onChange={(e) => setDepth(e.target.value)} />
      </label>
      <p className="muted small">
        Window ±{settings.window} m · {settings.matchFormation ? `offset wells in ${well.formation_name}` : 'all offset wells'}
        {stale && ' · cached'}
      </p>
      {alerts.length === 0 ? (
        <p className="empty">No offset-well risk events near this depth.</p>
      ) : (
        <ul className="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className={severityClass(a.severity)}>
              <div className="alert-top">
                <strong>{label(a.type).toUpperCase()}</strong>
                <span className="mono">{a.well_name} @ {a.depth} m ({a.delta_m > 0 ? '+' : ''}{a.delta_m} m)</span>
              </div>
              <div className="small">{a.description}</div>
              {a.mitigation_note && <div className="mitigation">Mitigation: {a.mitigation_note}</div>}
              <div className="muted small">Severity {a.severity} · {a.distance_km} km away · {a.date}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
