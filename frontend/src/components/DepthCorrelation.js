import React, { useState } from 'react';
import { label } from '../api';

const COL_W = 120;
const TOP = 34;
const AXIS_W = 56;
const PX_PER_M = 0.16;

// Multi-well depth ruler: one shared vertical depth axis, one column per well.
// Risk events at the same depth line up horizontally across columns; a band
// highlights the active well's current depth ± the alert window.
export default function DepthCorrelation({ wells, events, activeId, window: win }) {
  const [hover, setHover] = useState(null);
  const maxDepth = Math.ceil(Math.max(0, ...wells.map((w) => w.depth_current)) / 500) * 500 + 200;
  const height = TOP + maxDepth * PX_PER_M + 20;
  const width = AXIS_W + wells.length * COL_W + 10;
  const y = (d) => TOP + d * PX_PER_M;
  const active = wells.find((w) => w.id === activeId);

  // Depths where 2+ wells had a risk event within the window → correlation lines.
  const risk = events.filter((e) => e.type !== 'info');
  const matches = [];
  risk.forEach((a, i) => risk.slice(i + 1).forEach((b) => {
    if (a.well_id !== b.well_id && Math.abs(a.depth - b.depth) <= win) matches.push([a, b]);
  }));
  const colX = (id) => AXIS_W + wells.findIndex((w) => w.id === id) * COL_W + COL_W / 2;

  return (
    <div className="correlation">
      <p className="muted small">
        Shared depth axis · dashed links join risk events on different wells within ±{win} m.
      </p>
      <div className="corr-scroll">
        <svg width={width} height={height} role="img" aria-label="Multi-well depth correlation">
          {Array.from({ length: maxDepth / 250 + 1 }, (_, i) => i * 250).map((d) => (
            <g key={d}>
              <line x1={AXIS_W - 4} x2={width} y1={y(d)} y2={y(d)} className={d % 1000 ? 'grid-minor' : 'grid-major'} />
              <text x={AXIS_W - 8} y={y(d) + 4} textAnchor="end" className="axis-label">{d}</text>
            </g>
          ))}
          <text x={4} y={14} className="axis-label">Depth (m)</text>

          {active && (
            <rect x={AXIS_W} width={width - AXIS_W} y={y(active.depth_current - win)} height={2 * win * PX_PER_M}
              className="window-band" />
          )}

          {wells.map((w, i) => {
            const cx = AXIS_W + i * COL_W + COL_W / 2;
            return (
              <g key={w.id}>
                <text x={cx} y={20} textAnchor="middle" className={`col-title ${w.id === activeId ? 'active' : ''}`}>{w.name}</text>
                <rect x={cx - 7} y={TOP} width={14} height={w.depth_current * PX_PER_M} className="wellbore" />
                <line x1={cx - 14} x2={cx + 14} y1={y(w.depth_current)} y2={y(w.depth_current)} className="td-mark" />
              </g>
            );
          })}

          {matches.map(([a, b]) => (
            <line key={`${a.id}-${b.id}`} x1={colX(a.well_id)} y1={y(a.depth)} x2={colX(b.well_id)} y2={y(b.depth)} className="corr-link" />
          ))}

          {events.map((e) => {
            const cx = colX(e.well_id);
            const isRisk = e.type !== 'info';
            return (
              <g key={e.id} onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)}>
                {isRisk ? (
                  <rect x={cx - 8} y={y(e.depth) - 5} width={16} height={10} className={`ev-risk ev-${e.type}`} />
                ) : (
                  <circle cx={cx} cy={y(e.depth)} r={3} className="ev-info" />
                )}
                {isRisk && (
                  <text x={cx + 13} y={y(e.depth) + 4} className="ev-label">{label(e.type)} {e.depth}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="corr-detail">
        {hover ? (
          <><strong>{wells.find((w) => w.id === hover.well_id)?.name} · {hover.depth} m · {label(hover.type)}</strong> — {hover.description}</>
        ) : <span className="muted">Hover an event for detail.</span>}
      </div>
    </div>
  );
}
