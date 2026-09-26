import React, { useEffect, useState } from 'react';
import { get, qs, label, EVENT_TYPES } from '../api';

export default function SearchPanel({ wells, version }) {
  const formations = [...new Set(wells.map((w) => w.formation_name))];
  const [formation, setFormation] = useState('Assam Sandstone');
  const [type, setType] = useState('mud_loss');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    get(`/api/search?${qs({ formation, type, q })}`).then(({ data }) => setResults(data)).catch(() => setResults([]));
  }, [formation, type, q, version]);

  return (
    <div>
      <div className="form-grid">
        <label>Formation
          <select value={formation} onChange={(e) => setFormation(e.target.value)}>
            <option value="">Any</option>
            {formations.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label>Event type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
        <label className="span2">Description contains
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. LCM" />
        </label>
      </div>
      <p className="muted small">{results.length} matching event{results.length === 1 ? '' : 's'}</p>
      <table className="data">
        <thead><tr><th>Well</th><th>Formation</th><th>Type</th><th className="num">Depth</th><th>Date</th><th>Description</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td>{r.well_name}</td><td>{r.formation_name}</td><td>{label(r.type)}</td>
              <td className="num mono">{r.depth} m</td><td className="mono">{r.date}</td><td>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
