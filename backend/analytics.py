"""Risk analytics for NWIS: alerts, severity scoring, similar wells, overlay.

All functions are pure and operate on plain lists of dicts loaded from the
mock JSON files.
"""
from math import asin, cos, radians, sin, sqrt

# Distance (km) at which an offset well's contribution is halved.
DISTANCE_SCALE_KM = 50.0


def haversine_km(a, b):
    lat1, lon1, lat2, lon2 = map(radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


def severity_weight(risks, formation, event_type):
    """Severity from the risk table: formation-specific, then wildcard, else 1."""
    fallback = 1
    for r in risks:
        if r["risk_type"] != event_type:
            continue
        if r["formation_zone"] == formation:
            return r["severity_level"]
        if r["formation_zone"] == "*":
            fallback = r["severity_level"]
    return 0 if event_type == "info" else fallback


def depth_alerts(wells, events, risks, active_id, depth, window=50, match_formation=True):
    """Risk events on offset wells within +/- window metres of `depth`."""
    by_id = {w["id"]: w for w in wells}
    active = by_id[active_id]
    alerts = []
    for e in events:
        w = by_id[e["well_id"]]
        if w["id"] == active_id or e["type"] == "info":
            continue
        if match_formation and w["formation_name"] != active["formation_name"]:
            continue
        delta = e["depth"] - depth
        if abs(delta) <= window:
            sev = severity_weight(risks, w["formation_name"], e["type"])
            alerts.append({**e, "well_name": w["name"], "delta_m": delta, "severity": sev,
                           "distance_km": round(haversine_km(active, w), 1)})
    return sorted(alerts, key=lambda a: (-a["severity"], abs(a["delta_m"])))


def severity_scores(wells, events, risks, band=100, reference_id=None):
    """Naive risk score per depth band per formation.

    score(band, formation) = sum over event types T seen in the band of
        severity_weight(T) * N_wells(T) / distance_factor

    where N_wells(T) = number of distinct wells in the formation with a T
    event in the band, and distance_factor = 1 + mean_distance_km / 50,
    mean distance being from the reference well to those wells (factor = 1
    when no reference well is given).
    """
    by_id = {w["id"]: w for w in wells}
    ref = by_id.get(reference_id)
    grid = {}  # (formation, band_start) -> {type: set(well_ids)}
    for e in events:
        if e["type"] == "info":
            continue
        f = by_id[e["well_id"]]["formation_name"]
        key = (f, int(e["depth"] // band) * band)
        grid.setdefault(key, {}).setdefault(e["type"], set()).add(e["well_id"])

    out = {}
    max_depth = max(w["depth_current"] for w in wells)
    for f in sorted({w["formation_name"] for w in wells}):
        rows = []
        for start in range(0, int(max_depth // band + 1) * band, band):
            score, contributors = 0.0, []
            for etype, wids in grid.get((f, start), {}).items():
                dist = [haversine_km(ref, by_id[i]) for i in wids] if ref else [0]
                factor = 1 + (sum(dist) / len(dist)) / DISTANCE_SCALE_KM
                part = severity_weight(risks, f, etype) * len(wids) / factor
                score += part
                contributors.append({"type": etype, "wells": len(wids), "score": round(part, 2)})
            rows.append({"depth_from": start, "depth_to": start + band,
                         "score": round(score, 2), "contributors": contributors})
        out[f] = rows
    return out


def similar_wells(wells, events, risks, active_id):
    """Rank offset wells: formation match first, then proximity."""
    by_id = {w["id"]: w for w in wells}
    active = by_id[active_id]
    ranked = []
    for w in wells:
        if w["id"] == active_id:
            continue
        dist = haversine_km(active, w)
        match = w["formation_name"] == active["formation_name"]
        # Similarity 0..100: 60 pts for formation match, up to 40 for proximity.
        score = (60 if match else 0) + 40 / (1 + dist / DISTANCE_SCALE_KM)
        risk_events = [
            {**e, "severity": severity_weight(risks, w["formation_name"], e["type"]),
             "ahead_by_m": e["depth"] - active["depth_current"]}
            for e in events if e["well_id"] == w["id"] and e["type"] != "info"
        ]
        ranked.append({
            "well": w, "distance_km": round(dist, 1), "formation_match": match,
            "similarity": round(score, 1),
            "upcoming_risks": sorted([e for e in risk_events if e["ahead_by_m"] > 0], key=lambda e: e["depth"]),
            "past_risks": [e for e in risk_events if e["ahead_by_m"] <= 0],
        })
    return sorted(ranked, key=lambda r: -r["similarity"])


def risk_overlay(wells, events, radius_km=40):
    """Per well: count of risk events on all wells within radius_km (inclusive)."""
    counts = {}
    for e in events:
        if e["type"] != "info":
            counts[e["well_id"]] = counts.get(e["well_id"], 0) + 1
    return [{"well_id": w["id"], "radius_km": radius_km,
             "event_count": sum(counts.get(o["id"], 0) for o in wells if haversine_km(w, o) <= radius_km)}
            for w in wells]
