import React from 'react';

export default function SettingsPanel({ settings, onChange }) {
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <details className="panel settings">
      <summary>Alert &amp; analysis settings</summary>
      <div className="form-grid">
        <label>Depth window (± m)
          <input type="number" min="5" max="500" step="5" value={settings.window}
            onChange={(e) => set('window', Number(e.target.value) || 0)} />
        </label>
        <label>Overlay radius (km)
          <input type="number" min="5" max="150" step="5" value={settings.overlayRadius}
            onChange={(e) => set('overlayRadius', Number(e.target.value) || 1)} />
        </label>
        <label>Severity band (m)
          <select value={settings.band} onChange={(e) => set('band', Number(e.target.value))}>
            {[50, 100, 200, 500].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.matchFormation}
            onChange={(e) => set('matchFormation', e.target.checked)} />
          Require same formation
        </label>
      </div>
    </details>
  );
}
