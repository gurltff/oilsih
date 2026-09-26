import React from 'react';
import { label } from '../api';

export default function WellTimeline({ well, events }) {
  if (!well) return <p className="muted">Select a well on the map.</p>;
  const rows = events.filter((e) => e.well_id === well.id).sort((a, b) => a.depth - b.depth);

  return (
    <div>
      <div className="kv-grid">
        <div><span>Well</span><strong>{well.name}</strong></div>
        <div><span>Formation</span><strong>{well.formation_name}</strong></div>
        <div><span>Current depth</span><strong>{well.depth_current} m</strong></div>
        <div><span>Location</span><strong>{well.lat.toFixed(2)}°N, {well.lon.toFixed(2)}°E</strong></div>
      </div>
      <h3 className="section-title">Event timeline</h3>
      <ol className="timeline">
        {rows.map((e) => (
          <li key={e.id} className={e.type === 'info' ? 'info' : 'risk'}>
            <div className="tl-head">
              <span className="mono">{e.depth} m</span>
              <span className={`tag ${e.type === 'info' ? 'tag-info' : 'tag-risk'}`}>{label(e.type)}</span>
              <span className="muted small">{e.date}</span>
              {e.is_lesson_learned && <span className="tag tag-lesson">Lesson</span>}
            </div>
            <div>{e.description}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
