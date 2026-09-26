// Thin API client. Every successful GET is cached in localStorage so the
// Field view can still render the last-known data if the network drops.
const CACHE_PREFIX = 'nwis-cache:';
// Empty in production builds: the API is served from the same origin.
const API = process.env.REACT_APP_API_URL || '';

export async function get(path) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    try {
      localStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ data, at: Date.now() }));
    } catch (e) { /* storage unavailable – ignore */ }
    return { data, stale: false };
  } catch (err) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_PREFIX + path)); } catch (e) { /* ignore */ }
    if (cached) return { data: cached.data, stale: true, cachedAt: cached.at };
    throw err;
  }
}

export async function send(path, method, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();

export const EVENT_TYPES = ['info', 'mud_loss', 'stuck_pipe', 'kick', 'tight_hole', 'twist_off'];

export const label = (t) => t.replace(/_/g, ' ');

// Risk-status colour for a severity weight (0 = info).
export const severityClass = (s) => (s >= 4 ? 'risk-high' : s >= 2 ? 'risk-med' : s > 0 ? 'risk-low' : 'risk-none');
