// In-browser port of the FastAPI backend (backend/main.py, analytics.py,
// classifier.py) for serverless hosting. Enabled with REACT_APP_STANDALONE=true.
// Edits persist in this browser's localStorage.
import WELLS from './data/wells.json';
import SEED_EVENTS from './data/events.json';
import RISKS from './data/risks.json';

const STORE = 'nwis-standalone-events';
const DISTANCE_SCALE_KM = 50;

let EVENTS;
try { EVENTS = JSON.parse(localStorage.getItem(STORE)) || null; } catch (e) { EVENTS = null; }
if (!EVENTS) EVENTS = SEED_EVENTS.map((e) => ({ ...e }));
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(EVENTS)); } catch (e) { /* ignore */ } };

const rad = (d) => (d * Math.PI) / 180;
function haversineKm(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const round = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const byId = () => Object.fromEntries(WELLS.map((w) => [w.id, w]));

function severityWeight(formation, type) {
  let fallback = 1;
  for (const r of RISKS) {
    if (r.risk_type !== type) continue;
    if (r.formation_zone === formation) return r.severity_level;
    if (r.formation_zone === '*') fallback = r.severity_level;
  }
  return type === 'info' ? 0 : fallback;
}

// Keyword/regex classifier — NOT machine learning (mirrors backend/classifier.py).
const KEYWORD_RULES = {
  mud_loss: [/lost circulation/i, /mud loss/i, /\blosses?\b/i, /\bLCM\b/i, /returns? (dropped|lost)/i],
  stuck_pipe: [/\bstuck\b/i, /pipe stuck/i, /differential(ly)? stick/i, /\bjarr(ed|ing)\b/i, /unable to (pull|rotate)/i],
  kick: [/\bkick\b/i, /\binflux\b/i, /gas show/i, /shut[- ]?in/i, /pit gain/i],
  tight_hole: [/tight hole/i, /\boverpull\b/i, /\bream(ed|ing)?\b/i, /\bdrag\b/i],
  twist_off: [/twist[- ]?off/i, /parted string/i, /\bfish(ing)?\b/i],
};
function classify(text = '') {
  let best = 'info'; let matched = [];
  for (const [type, pats] of Object.entries(KEYWORD_RULES)) {
    const m = pats.map((p) => text.match(p)).filter(Boolean).map((x) => x[0]);
    if (m.length > matched.length) { best = type; matched = m; }
  }
  const confidence = matched.length ? Math.min(1, 0.5 + 0.25 * (matched.length - 1)) : 0;
  return { type: best, confidence, matched };
}

const routes = {
  'GET /api/wells': () => WELLS.map((w) => ({ ...w, has_risk: EVENTS.some((e) => e.well_id === w.id && e.type !== 'info') })),
  'GET /api/events': (p) => EVENTS.filter((e) => !p.well_id || e.well_id === p.well_id).sort((a, b) => a.depth - b.depth),
  'GET /api/search': (p) => {
    const w = byId();
    return EVENTS.map((e) => ({ ...e, well_name: w[e.well_id].name, formation_name: w[e.well_id].formation_name }))
      .filter((e) => (!p.formation || e.formation_name.toLowerCase().includes(p.formation.toLowerCase())) &&
        (!p.type || e.type === p.type) && (!p.q || e.description.toLowerCase().includes(p.q.toLowerCase())))
      .sort((a, b) => a.formation_name.localeCompare(b.formation_name) || a.depth - b.depth);
  },
  'GET /api/alerts': (p) => {
    const w = byId(); const active = w[p.well_id]; const depth = Number(p.depth);
    const win = Number(p.window ?? 50); const match = p.match_formation !== 'false';
    return EVENTS.filter((e) => e.well_id !== active.id && e.type !== 'info' &&
      (!match || w[e.well_id].formation_name === active.formation_name) && Math.abs(e.depth - depth) <= win)
      .map((e) => ({ ...e, well_name: w[e.well_id].name, delta_m: e.depth - depth,
        severity: severityWeight(w[e.well_id].formation_name, e.type), distance_km: round(haversineKm(active, w[e.well_id])) }))
      .sort((a, b) => b.severity - a.severity || Math.abs(a.delta_m) - Math.abs(b.delta_m));
  },
  'GET /api/severity': (p) => {
    const w = byId(); const band = Number(p.band || 100); const ref = w[p.reference_well];
    const grid = {};
    EVENTS.filter((e) => e.type !== 'info').forEach((e) => {
      const key = `${w[e.well_id].formation_name}|${Math.floor(e.depth / band) * band}`;
      ((grid[key] ||= {})[e.type] ||= new Set()).add(e.well_id);
    });
    const maxDepth = Math.max(...WELLS.map((x) => x.depth_current));
    const out = {};
    [...new Set(WELLS.map((x) => x.formation_name))].sort().forEach((f) => {
      out[f] = [];
      for (let s = 0; s < (Math.floor(maxDepth / band) + 1) * band; s += band) {
        let score = 0; const contributors = [];
        Object.entries(grid[`${f}|${s}`] || {}).forEach(([type, ids]) => {
          const d = ref ? [...ids].map((i) => haversineKm(ref, w[i])) : [0];
          const part = (severityWeight(f, type) * ids.size) / (1 + d.reduce((a, b) => a + b, 0) / d.length / DISTANCE_SCALE_KM);
          score += part; contributors.push({ type, wells: ids.size, score: round(part, 2) });
        });
        out[f].push({ depth_from: s, depth_to: s + band, score: round(score, 2), contributors });
      }
    });
    return out;
  },
  'GET /api/similar': (p) => {
    const active = byId()[p.well_id];
    return WELLS.filter((w) => w.id !== active.id).map((w) => {
      const dist = haversineKm(active, w); const match = w.formation_name === active.formation_name;
      const risks = EVENTS.filter((e) => e.well_id === w.id && e.type !== 'info')
        .map((e) => ({ ...e, severity: severityWeight(w.formation_name, e.type), ahead_by_m: e.depth - active.depth_current }));
      return { well: w, distance_km: round(dist), formation_match: match,
        similarity: round((match ? 60 : 0) + 40 / (1 + dist / DISTANCE_SCALE_KM)),
        upcoming_risks: risks.filter((e) => e.ahead_by_m > 0).sort((a, b) => a.depth - b.depth),
        past_risks: risks.filter((e) => e.ahead_by_m <= 0) };
    }).sort((a, b) => b.similarity - a.similarity);
  },
  'GET /api/overlay': (p) => {
    const r = Number(p.radius_km || 40); const counts = {};
    EVENTS.forEach((e) => { if (e.type !== 'info') counts[e.well_id] = (counts[e.well_id] || 0) + 1; });
    return WELLS.map((w) => ({ well_id: w.id, radius_km: r,
      event_count: WELLS.filter((o) => haversineKm(w, o) <= r).reduce((s, o) => s + (counts[o.id] || 0), 0) }));
  },
  'POST /api/classify': (p, body) => classify(body.text),
  'POST /api/events': (p, body) => {
    const ev = { ...body, type: body.type || classify(body.description).type,
      id: Math.max(...EVENTS.map((e) => e.id)) + 1, is_lesson_learned: !!body.is_lesson_learned, mitigation_note: body.mitigation_note || '' };
    EVENTS.push(ev); persist(); return ev;
  },
};

export function mockRequest(path, method = 'GET', body) {
  const [pathname, query = ''] = path.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const lesson = pathname.match(/^\/api\/events\/(\d+)\/lesson$/);
  if (method === 'PATCH' && lesson) {
    const e = EVENTS.find((x) => x.id === Number(lesson[1]));
    Object.assign(e, { is_lesson_learned: body.is_lesson_learned, mitigation_note: body.mitigation_note });
    persist(); return e;
  }
  const handler = routes[`${method} ${pathname}`];
  if (!handler) throw new Error(`No mock route for ${method} ${pathname}`);
  return JSON.parse(JSON.stringify(handler(params, body)));
}
