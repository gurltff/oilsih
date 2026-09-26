# NWIS — National Well Information System (prototype)

A tool that keeps a record of past well-drilling events and warns about risks seen at the same depth in nearby offset wells. The frontend uses React 18.2 and Leaflet. A FastAPI backend serves mock JSON. Edits are kept in memory only.

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gurltff/oilsih)

One Docker service (see `Dockerfile` and `render.yaml`) builds the React app and serves it with the FastAPI API from the same URL. The same image runs on Railway, Fly.io or any Docker host: `docker build -t nwis . && docker run -p 8000:8000 nwis`.

## Run locally

```bash
# backend (terminal 1)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# frontend (terminal 2)
cd frontend
npm install
npm start            # http://localhost:3000
```

The frontend calls `REACT_APP_API_URL` (default `http://localhost:8000`, set in `frontend/.env`).

## Demo script

1. **Map**: Well-A and Well-B are red because they have risk events. Well-C is green because it has info events only. The shaded circles are the distance-weighted risk overlay. Click a well to open its timeline.
2. **Depth alerts**: with Well-A active, type `3420`. Well-B's stuck pipe (3450 m) and mud loss (3380 m) show up as alerts, along with the tagged mitigation note. You can change the depth window and the same-formation requirement under *Alert & analysis settings*.
3. **Depth Correlation**: all wells share one depth ruler. Dashed red links join matching risk events across wells (kick at about 1900 m).
4. **Severity**: bars show the risk score for each depth band, per formation.
5. **Search**: for example, Assam Sandstone + mud_loss.
6. **Lessons Learned**: tagged events appear as "do differently" cards. You can tag any raw risk event.
7. **Similar Wells**: offset wells are ranked by formation match and distance. Each one lists the risks still below the current bit depth.
8. **Log Event**: type "pipe stuck, jarring" and the event type is suggested automatically.
9. **Field / Office toggle**: Field shows only the map and alerts, and it works on a phone-width screen. If the backend can't be reached, it shows the last API responses cached in localStorage.

## Layout

| Feature | Backend | Frontend |
|---|---|---|
| Map + overlay | `/api/wells`, `/api/overlay` | `components/MapView.js` |
| Timeline | `/api/events` | `components/WellTimeline.js` |
| Search | `/api/search` | `components/SearchPanel.js` |
| Depth alerts + settings | `/api/alerts` | `components/DepthAlerts.js`, `SettingsPanel.js` |
| Depth correlation | — | `components/DepthCorrelation.js` |
| Severity scoring | `/api/severity` (`analytics.severity_scores`) | `components/SeverityHeatmap.js` |
| Lessons learned | `PATCH /api/events/{id}/lesson` | `components/LessonsLearned.js` |
| Similar wells | `/api/similar` | `components/SimilarWells.js` |
| Auto-tagging | `POST /api/classify` (`classifier.py`, keyword rules, not ML) | `components/EventEntry.js` |
| Offline cache | — | `api.js` |

### Severity formula

```
score(band, formation) = Σ_type severity_weight(type) × N_wells(type in band) ÷ (1 + mean_distance_km / 50)
```

`severity_weight` comes from `data/risks.json`. Distance is measured from the active well. When there is no reference well, the distance factor is 1. This is a rule of thumb, not a predictive model.
