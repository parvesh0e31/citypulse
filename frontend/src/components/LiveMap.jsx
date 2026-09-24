import { CircleMarker, MapContainer, Popup, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const center = [28.6139, 77.209];
const colors = { WEATHER: '#2563eb', TRANSIT: '#f59e0b', COMPLAINT: '#ef4444' };

export default function LiveMap({ events = [], links = [] }) {
  const byId = Object.fromEntries(events.map((event) => [event.id, event]));
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full min-h-[420px]">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {events.map((event) => (
        <CircleMarker
          key={event.id}
          center={[event.coordinates.lat, event.coordinates.lon]}
          radius={event.is_anomaly ? 12 : 8}
          pathOptions={{
            color: colors[event.type] || '#64748b',
            fillColor: colors[event.type] || '#64748b',
            fillOpacity: event.is_anomaly ? 0.75 : 0.45,
            weight: event.is_anomaly ? 3 : 1,
          }}
        >
          <Popup>
            <strong>{event.type}</strong><br />
            {event.value} {event.unit}<br />
            Zone: {event.zone}<br />
            Source: {event.source}<br />
            Time: {new Date(event.timestamp).toLocaleTimeString()}<br />
            Severity: {event.severity}/10
            {event.is_anomaly && <><br /><strong>Rolling anomaly detected</strong></>}
          </Popup>
        </CircleMarker>
      ))}
      {links.map((link) => {
        const first = byId[link.events[0]];
        const second = byId[link.events[1]];
        if (!first || !second) return null;
        return (
          <Polyline
            key={link.events.join('-')}
            positions={[
              [first.coordinates.lat, first.coordinates.lon],
              [second.coordinates.lat, second.coordinates.lon],
            ]}
            pathOptions={{ color: '#a855f7', dashArray: '6 8', weight: 3 }}
          />
        );
      })}
    </MapContainer>
  );
}
