import React, { useEffect, useState } from 'react';
import { get, label, severityClass } from '../api';

// Offset wells ranked by formation match + distance, with the risk events
// they hit deeper than the active well's current depth ("look-ahead").
export default function SimilarWells({ well, version }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (well) get(`/api/similar?well_id=${well.id}`).then(({ data }) => setRows(data)).catch(() => setRows([]));
  }, [well, version]);
  if (!well) return null;

  return (
    <div>
      <p className="muted small">Ranked for {well.name} (at {well.depth_current} m). Similarity = 60 pts formation match + up to 40 pts proximity.</p>
      {rows.map((r, i) => (
        <div key={r.well.id} className="similar-card">
          <div className="similar-head">
            <span className="rank">#{i + 1}</span>
            <strong>{r.well.name}</strong>
            <span className="muted small">{r.well.formation_name} · {r.distance_km} km</span>
            <span className={`tag ${r.formation_match ? 'tag-match' : 'tag-info'}`}>{r.formation_match ? 'Formation match' : 'Different formation'}</span>
            <span className="score mono">{r.similarity}</span>
          </div>
          {r.upcoming_risks.length > 0 ? (
            <ul className="lookahead">
              {r.upcoming_risks.map((e) => (
                <li key={e.id} className={severityClass(e.severity)}>
                  <span className="mono">{e.depth} m</span> {label(e.type)} — {e.ahead_by_m} m ahead of bit
                  {e.mitigation_note && <div className="mitigation">{e.mitigation_note}</div>}
                </li>
              ))}
            </ul>
          ) : <p className="muted small">No recorded risks below current depth.</p>}
          {r.past_risks.length > 0 && (
            <p className="muted small">Already passed: {r.past_risks.map((e) => `${label(e.type)} @ ${e.depth} m`).join(', ')}</p>
          )}
        </div>
      ))}
    </div>
  );
}
