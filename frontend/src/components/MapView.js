import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip } from 'react-leaflet';
import { get, qs } from '../api';

// Wells as markers (red = has any non-info event, green = info only) plus a
// distance-weighted risk overlay: a circle of `overlayRadius` km around each
// well, shaded by the number of risk events on wells inside that radius.
export default function MapView({ wells, activeId, onSelect, overlayRadius, version }) {
  const [overlay, setOverlay] = useState({});

  useEffect(() => {
    get(`/api/overlay?${qs({ radius_km: overlayRadius })}`)
      .then(({ data }) => setOverlay(Object.fromEntries(data.map((o) => [o.well_id, o.event_count]))))
      .catch(() => setOverlay({}));
  }, [overlayRadius, version]);

  const maxCount = Math.max(1, ...Object.values(overlay));

  return (
    <MapContainer center={[23.45, 89.15]} zoom={9} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {wells.map((w) => {
        const count = overlay[w.id] || 0;
        return (
          <Circle
            key={`ov-${w.id}`}
            center={[w.lat, w.lon]}
            radius={overlayRadius * 1000}
            pathOptions={{
              color: count ? '#b3261e' : '#2e7d4f',
              weight: 1,
              fillOpacity: count ? 0.08 + 0.3 * (count / maxCount) : 0.05,
            }}
            interactive={false}
          />
        );
      })}
      {wells.map((w) => (
        <CircleMarker
          key={w.id}
          center={[w.lat, w.lon]}
          radius={w.id === activeId ? 11 : 8}
          pathOptions={{
            color: w.id === activeId ? '#0f2742' : '#ffffff',
            weight: w.id === activeId ? 3 : 2,
            fillColor: w.has_risk ? '#b3261e' : '#2e7d4f',
            fillOpacity: 1,
          }}
          eventHandlers={{ click: () => onSelect(w.id) }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{w.name}</strong><br />
            {w.formation_name} · {w.depth_current} m<br />
            {overlay[w.id] || 0} risk events within {overlayRadius} km
          </Tooltip>
        </CircleMarker>
      ))}
      <div className="map-legend leaflet-bottom leaflet-left">
        <div className="leaflet-control">
          <div><i className="dot risk-high" /> Risk events recorded</div>
          <div><i className="dot risk-low-green" /> Info only</div>
          <div><i className="ring" /> Risk density ({overlayRadius} km)</div>
        </div>
      </div>
    </MapContainer>
  );
}
