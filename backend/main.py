"""NWIS prototype API. Serves mock JSON data; edits are held in memory only.

Run:  uvicorn main:app --reload --port 8000   (from the backend/ directory)
"""
import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import analytics
from classifier import classify

DATA = Path(__file__).parent / "data"
WELLS = json.loads((DATA / "wells.json").read_text())
EVENTS = json.loads((DATA / "events.json").read_text())
RISKS = json.loads((DATA / "risks.json").read_text())

app = FastAPI(title="NWIS – National Well Information System")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _well(well_id):
    for w in WELLS:
        if w["id"] == well_id:
            return w
    raise HTTPException(404, f"Unknown well {well_id}")


@app.get("/api/wells")
def list_wells():
    return [{**w, "has_risk": any(e["well_id"] == w["id"] and e["type"] != "info" for e in EVENTS)}
            for w in WELLS]


@app.get("/api/events")
def list_events(well_id: Optional[str] = None):
    return sorted([e for e in EVENTS if not well_id or e["well_id"] == well_id], key=lambda e: e["depth"])


@app.get("/api/risks")
def list_risks():
    return RISKS


@app.get("/api/search")
def search(formation: Optional[str] = None, type: Optional[str] = None, q: Optional[str] = None):
    by_id = {w["id"]: w for w in WELLS}
    out = []
    for e in EVENTS:
        w = by_id[e["well_id"]]
        if formation and formation.lower() not in w["formation_name"].lower():
            continue
        if type and e["type"] != type:
            continue
        if q and q.lower() not in e["description"].lower():
            continue
        out.append({**e, "well_name": w["name"], "formation_name": w["formation_name"]})
    return sorted(out, key=lambda e: (e["formation_name"], e["depth"]))


@app.get("/api/alerts")
def alerts(well_id: str, depth: float, window: float = 50, match_formation: bool = True):
    _well(well_id)
    return analytics.depth_alerts(WELLS, EVENTS, RISKS, well_id, depth, window, match_formation)


@app.get("/api/severity")
def severity(band: int = 100, reference_well: Optional[str] = None):
    return analytics.severity_scores(WELLS, EVENTS, RISKS, band, reference_well)


@app.get("/api/similar")
def similar(well_id: str):
    _well(well_id)
    return analytics.similar_wells(WELLS, EVENTS, RISKS, well_id)


@app.get("/api/overlay")
def overlay(radius_km: float = 40):
    return analytics.risk_overlay(WELLS, EVENTS, radius_km)


class ClassifyIn(BaseModel):
    text: str


@app.post("/api/classify")
def classify_text(body: ClassifyIn):
    t, conf, matches = classify(body.text)
    return {"type": t, "confidence": conf, "matched": matches}


class EventIn(BaseModel):
    well_id: str
    depth: float
    type: Optional[str] = None
    date: str
    description: str
    is_lesson_learned: bool = False
    mitigation_note: str = ""


@app.post("/api/events")
def add_event(body: EventIn):
    _well(body.well_id)
    ev = body.model_dump()
    if not ev["type"]:
        ev["type"] = classify(ev["description"])[0]
    ev["id"] = max(e["id"] for e in EVENTS) + 1
    EVENTS.append(ev)
    return ev


class LessonIn(BaseModel):
    is_lesson_learned: bool
    mitigation_note: str = ""


@app.patch("/api/events/{event_id}/lesson")
def tag_lesson(event_id: int, body: LessonIn):
    for e in EVENTS:
        if e["id"] == event_id:
            e["is_lesson_learned"] = body.is_lesson_learned
            e["mitigation_note"] = body.mitigation_note
            return e
    raise HTTPException(404, "Unknown event")
