import React, { useState } from 'react';
import { send, label } from '../api';

// The "what to do differently" layer: tagged lessons shown as cards, and the
// raw event log below where any event can be tagged/untagged.
export default function LessonsLearned({ wells, events, onChange }) {
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');
  const name = (id) => wells.find((w) => w.id === id)?.name;
  const lessons = events.filter((e) => e.is_lesson_learned);
  const raw = events.filter((e) => !e.is_lesson_learned && e.type !== 'info');

  const save = async (e, flag) => {
    await send(`/api/events/${e.id}/lesson`, 'PATCH', { is_lesson_learned: flag, mitigation_note: flag ? note : '' });
    setEditing(null);
    onChange();
  };

  return (
    <div>
      <h3 className="section-title">Lessons learned ({lessons.length})</h3>
      <div className="lesson-cards">
        {lessons.map((e) => (
          <div key={e.id} className="lesson-card">
            <div className="lesson-meta">{name(e.well_id)} · {e.depth} m · {label(e.type)} · {e.date}</div>
            <div className="lesson-what">{e.description}</div>
            <div className="lesson-do"><span>Do differently</span>{e.mitigation_note || '—'}</div>
            <button className="link" onClick={() => save(e, false)}>Remove tag</button>
          </div>
        ))}
      </div>

      <h3 className="section-title">Untagged risk events</h3>
      <table className="data">
        <thead><tr><th>Well</th><th className="num">Depth</th><th>Type</th><th>Description</th><th /></tr></thead>
        <tbody>
          {raw.map((e) => (
            <React.Fragment key={e.id}>
              <tr>
                <td>{name(e.well_id)}</td><td className="num mono">{e.depth}</td><td>{label(e.type)}</td><td>{e.description}</td>
                <td><button className="btn-sm" onClick={() => { setEditing(e.id); setNote(''); }}>Tag lesson</button></td>
              </tr>
              {editing === e.id && (
                <tr className="edit-row"><td colSpan={5}>
                  <textarea rows={2} value={note} onChange={(ev) => setNote(ev.target.value)}
                    placeholder="Mitigation note — what should the next crew do differently?" />
                  <button className="btn" disabled={!note.trim()} onClick={() => save(e, true)}>Save lesson</button>
                  <button className="link" onClick={() => setEditing(null)}>Cancel</button>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
