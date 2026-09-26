import React, { useEffect, useState } from 'react';
import { get, qs, label } from '../api';

// Depth band vs naive risk score, per formation. Formula lives in
// backend/analytics.py::severity_scores and is summarised in the footnote.
export default function SeverityHeatmap({ band, referenceWell, version }) {
  const [data, setData] = useState({});
  const [useRef, setUseRef] = useState(true);

  useEffect(() => {
    get(`/api/severity?${qs({ band, reference_well: useRef ? referenceWell : '' })}`)
      .then(({ data: d }) => setData(d)).catch(() => setData({}));
  }, [band, referenceWell, useRef, version]);

  const max = Math.max(1, ...Object.values(data).flat().map((r) => r.score));

  return (
    <div>
      <label className="check small">
        <input type="checkbox" checked={useRef} onChange={(e) => setUseRef(e.target.checked)} />
        Distance-weight relative to active well
      </label>
      <div className="heatmaps">
        {Object.entries(data).map(([formation, rows]) => (
          <div key={formation} className="heatmap">
            <h3 className="section-title">{formation}</h3>
            {rows.map((r) => (
              <div key={r.depth_from} className="hm-row" title={r.contributors.map((c) => `${label(c.type)}: ${c.wells} well(s) → ${c.score}`).join('\n')}>
                <span className="mono hm-depth">{r.depth_from}–{r.depth_to}</span>
                <span className="hm-track">
                  <span className={`hm-bar ${r.score / max > 0.6 ? 'risk-high' : r.score / max > 0.25 ? 'risk-med' : 'risk-low'}`}
                    style={{ width: `${(r.score / max) * 100}%` }} />
                </span>
                <span className="mono hm-score">{r.score ? r.score.toFixed(1) : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="footnote">
        score = Σ<sub>type</sub> severity_weight(type) × N<sub>wells</sub>(type in band) ÷ (1 + mean distance km / 50).
        Weights come from the formation risk table. Heuristic only — not a predictive model.
      </p>
    </div>
  );
}
