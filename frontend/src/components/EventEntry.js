import React, { useEffect, useState } from 'react';
import { send, label, EVENT_TYPES } from '../api';

// Free-text event entry with auto-suggested type. The suggestion comes from
// a keyword/regex classifier on the backend (backend/classifier.py) — NOT ML.
export default function EventEntry({ wells, activeId, onSaved }) {
  const [form, setForm] = useState({ well_id: activeId, depth: '', date: new Date().toISOString().slice(0, 10), description: '', type: '' });
  const [suggestion, setSuggestion] = useState(null);
  const [touchedType, setTouchedType] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => set('well_id', activeId), [activeId]);

  useEffect(() => {
    if (form.description.trim().length < 4) { setSuggestion(null); return; }
    const t = setTimeout(() => {
      send('/api/classify', 'POST', { text: form.description })
        .then((s) => { setSuggestion(s); if (!touchedType) set('type', s.type); })
        .catch(() => setSuggestion(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.description, touchedType]);

  const submit = async (e) => {
    e.preventDefault();
    const saved = await send('/api/events', 'POST', { ...form, depth: Number(form.depth) });
    setMsg(`Logged ${label(saved.type)} on ${wells.find((w) => w.id === saved.well_id)?.name} at ${saved.depth} m.`);
    setForm((f) => ({ ...f, description: '', depth: '', type: '' }));
    setTouchedType(false);
    onSaved();
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <label>Well
          <select value={form.well_id} onChange={(e) => set('well_id', e.target.value)}>
            {wells.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label>Depth (m)<input type="number" required value={form.depth} onChange={(e) => set('depth', e.target.value)} /></label>
        <label>Date<input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label>Event type
          <select value={form.type} onChange={(e) => { setTouchedType(true); set('type', e.target.value); }}>
            <option value="">(auto)</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
        <label className="span2">Description
          <textarea rows={3} required value={form.description} onChange={(e) => set('description', e.target.value)}
            placeholder="e.g. Lost circulation while drilling ahead, pumped LCM pill" />
        </label>
      </div>
      {suggestion && (
        <div className="suggestion">
          Auto-tag (keyword rules): <strong>{label(suggestion.type)}</strong>
          {suggestion.matched.length > 0 && <> · matched “{suggestion.matched.join('”, “')}”</>}
          {' '}· confidence {Math.round(suggestion.confidence * 100)}%
        </div>
      )}
      <button className="btn" type="submit">Log event</button>
      {msg && <p className="muted small">{msg}</p>}
    </form>
  );
}
