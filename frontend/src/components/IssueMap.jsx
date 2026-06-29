/**
 * CivicLens AI – IssueMap Component  (Phase 2)
 *
 * Renders a full Google Map with:
 *  • Severity-coloured SVG pin markers (Red=High, Amber=Medium, Green=Low)
 *  • InfoWindow mini-card on marker click showing image thumb, category,
 *    severity badge, and a truncated description
 *  • Auto-centres on the user's browser geolocation (fallback: New Delhi)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api';

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // New Delhi fallback
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

/** Dark "Night" map style so it integrates with the dark dashboard theme */
const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#172033' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4b5563' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1825' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
];

const MAP_OPTIONS = {
  styles: MAP_STYLES,
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: false,
};

// ── Severity helpers ───────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  High:   { fill: '#ef4444', stroke: '#fca5a5', label: 'High',   emoji: '🔴' },
  Medium: { fill: '#f59e0b', stroke: '#fcd34d', label: 'Medium', emoji: '🟡' },
  Low:    { fill: '#22c55e', stroke: '#86efac', label: 'Low',    emoji: '🟢' },
};

function severityConfig(level) {
  return SEVERITY_CONFIG[level] ?? SEVERITY_CONFIG.Low;
}

/** Build a data-URI SVG pin icon sized for Google Maps */
function makePinIcon(level) {
  const { fill, stroke } = severityConfig(level);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
      </defs>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24S32 26 32 16C32 7.163 24.837 0 16 0z"
            fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#shadow)"/>
      <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
      <circle cx="16" cy="16" r="4" fill="${fill}"/>
    </svg>`.trim();
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 32, height: 40 },
    anchor: { x: 16, y: 40 },
  };
}

// ── InfoWindow Card ────────────────────────────────────────────────────────────

function InfoCard({ issue, onClose }) {
  const { fill, label, emoji } = severityConfig(issue.severity_level);
  const desc = issue.description || issue.clean_description || '';
  const truncated = desc.length > 120 ? desc.slice(0, 117) + '…' : desc;
  const formattedDate = issue.created_at
    ? new Date(issue.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minWidth: '240px', maxWidth: '280px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {issue.category || 'Civic Issue'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
            {emoji} {issue.category}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '16px', lineHeight: 1, padding: '0 0 0 8px' }}
          aria-label="Close info window"
        >
          ✕
        </button>
      </div>

      {/* Severity badge */}
      <span style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'white',
        background: fill,
        marginBottom: '8px',
      }}>
        {label} Severity
      </span>

      {/* Description */}
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
        {truncated}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '6px', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: '#475569' }}>{formattedDate}</span>
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '4px',
          background: issue.status === 'Resolved' ? '#14532d' : '#1e3a5f',
          color: issue.status === 'Resolved' ? '#86efac' : '#7dd3fc',
        }}>
          {issue.status || 'Reported'}
        </span>
      </div>
    </div>
  );
}

// ── IssueMap ───────────────────────────────────────────────────────────────────

export default function IssueMap({ issues = [] }) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const mapRef = useRef(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'civicle ns-map',
    googleMapsApiKey: apiKey,
  });

  // Try to get the user's geolocation for dynamic centering
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* fallback to DEFAULT_CENTER – already set */ },
      { timeout: 5000, maximumAge: 60_000 }
    );
  }, []);

  // Auto-fit bounds when issues load (if we have at least 2 points)
  useEffect(() => {
    if (!mapRef.current || issues.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    issues.forEach((issue) => {
      if (issue.latitude != null && issue.longitude != null) {
        bounds.extend({ lat: issue.latitude, lng: issue.longitude });
      }
    });
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 80);
  }, [issues, isLoaded]);

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);
  const onUnmount = useCallback(() => { mapRef.current = null; }, []);

  // ── Render states ────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-xl">
        <div className="text-center">
          <span className="text-4xl">🗺️</span>
          <p className="mt-3 text-slate-400 text-sm">Failed to load Google Maps.</p>
          <p className="text-slate-600 text-xs mt-1">Check your API key in <code>.env</code></p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-xl">
        <div className="text-center animate-pulse">
          <span className="text-4xl">🌐</span>
          <p className="mt-3 text-slate-400 text-sm">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden ring-1 ring-teal-500/20">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={12}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={() => setSelectedIssue(null)}
      >
        {issues.map((issue) => {
          if (issue.latitude == null || issue.longitude == null) return null;
          return (
            <Marker
              key={issue.id}
              position={{ lat: issue.latitude, lng: issue.longitude }}
              icon={makePinIcon(issue.severity_level)}
              title={issue.category || 'Civic Issue'}
              onClick={() => setSelectedIssue(issue)}
            />
          );
        })}

        {selectedIssue && (
          <InfoWindow
            position={{ lat: selectedIssue.latitude, lng: selectedIssue.longitude }}
            onCloseClick={() => setSelectedIssue(null)}
            options={{ pixelOffset: { width: 0, height: -42 } }}
          >
            <InfoCard issue={selectedIssue} onClose={() => setSelectedIssue(null)} />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
