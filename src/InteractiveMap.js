import React, { useEffect, useRef, useState } from 'react';

const UDAIPUR_CENTER = [73.685806, 24.582285];

const sampleMarkers = [
  { position: [73.685575, 24.614134], area: 'Fatehpura', service: 'Mobile data', status: 'degraded', symbol: '≈' },
  { position: [73.685806, 24.582285], area: 'Udaipur City', service: 'Fixed broadband', status: 'working', symbol: '✓' },
  { position: [73.655799, 24.536711], area: 'Hiran Magri', service: 'Power', status: 'down', symbol: '!' }
];

const statusLabels = { working: 'Working', degraded: 'Degraded', down: 'Down' };

function createPopupContent(point, demo = true) {
  const content = document.createElement('div');
  content.className = 'atlas-map-popup';

  const title = document.createElement('strong');
  title.textContent = point.service + ' · ' + statusLabels[point.status];

  const area = document.createElement('p');
  area.textContent = point.area;

  if (point.note && !demo) {
    const note = document.createElement('p');
    note.textContent = point.note;
    content.append(title, area, note);
  } else {
    content.append(title, area);
  }

  const disclaimer = document.createElement('small');
  if (demo) {
    disclaimer.textContent = 'DEMO ONLY — illustrative marker, not a verified live report.';
  } else {
    const observed = point.observedAt || point.createdAt;
    disclaimer.textContent = 'COMMUNITY REPORT — not official utility data.' +
      (observed ? ' Observed: ' + new Date(observed).toLocaleString() : '');
  }
  content.append(disclaimer);
  return content;
}

function addSampleMarkers(map, maplibre, markerRefs) {
  sampleMarkers.forEach((point) => {
    const markerElement = document.createElement('button');
    markerElement.type = 'button';
    markerElement.className = 'atlas-marker-pin atlas-pin-' + point.status;
    markerElement.textContent = point.symbol;
    markerElement.setAttribute(
      'aria-label',
      point.service + ': ' + statusLabels[point.status] + ' example for ' + point.area
    );

    const popup = new maplibre.Popup({ offset: 24, closeButton: true })
      .setDOMContent(createPopupContent(point));
    const marker = new maplibre.Marker({ element: markerElement, anchor: 'bottom' })
      .setLngLat(point.position)
      .setPopup(popup)
      .addTo(map);
    markerRefs.current.push(marker);
  });
}
function addCommunityMarkers(map, maplibre, markerRefs, reports) {
  (Array.isArray(reports) ? reports : []).forEach((report) => {
    if (report.latitude === undefined || report.longitude === undefined) return;
    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;
    if (!statusLabels[report.status] ||
        !['Mobile data', 'Fixed broadband', 'Power'].includes(report.service)) return;

    const symbol = report.status === 'working' ? '✓' : report.status === 'degraded' ? '≈' : '!';
    const markerElement = document.createElement('button');
    markerElement.type = 'button';
    markerElement.className = 'atlas-marker-pin atlas-pin-' + report.status + ' atlas-community-marker';
    markerElement.textContent = symbol;
    markerElement.setAttribute(
      'aria-label',
      report.service + ': ' + statusLabels[report.status] + ' community report for ' + report.area
    );

    const popup = new maplibre.Popup({ offset: 24, closeButton: true })
      .setDOMContent(createPopupContent(report, false));
    const marker = new maplibre.Marker({ element: markerElement, anchor: 'bottom' })
      .setLngLat([longitude, latitude])
      .setPopup(popup)
      .addTo(map);
    markerRefs.current.push(marker);
  });
}


function InteractiveMap({
  center = UDAIPUR_CENTER,
  zoom = 12,
  areaLabel = 'Udaipur, Rajasthan',
  showDemoMarkers = true,
  reports = []
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const markerRefs = useRef([]);
  const mapLoadedRef = useRef(false);
  const showDemoMarkersRef = useRef(showDemoMarkers);
  const reportsRef = useRef(reports);
  const [mapStatus, setMapStatus] = useState('loading');
  initialCenterRef.current = center;
  initialZoomRef.current = zoom;
  showDemoMarkersRef.current = showDemoMarkers;
  reportsRef.current = reports;

  useEffect(() => {
    const container = containerRef.current;
    let map;
    let cancelled = false;

    const handleMapFailure = () => {
      if (!cancelled) setMapStatus('unavailable');
    };

    const initializeMap = () => {
      const maplibre = window.maplibregl;
      if (cancelled || map || !container) return;
      if (!maplibre) {
        if (window.__MAPLIBRE_LOAD_STATE === 'error') setMapStatus('unavailable');
        return;
      }

      try {
        map = new maplibre.Map({
          container,
          style: 'https://tiles.openfreemap.org/styles/liberty',
          center: initialCenterRef.current,
          zoom: initialZoomRef.current,
          minZoom: 2,
          maxZoom: 18,
          scrollZoom: false,
          cooperativeGestures: true,
          attributionControl: true,
          pitchWithRotate: false,
          dragRotate: false
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibre.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

        map.on('load', () => {
          mapLoadedRef.current = true;
          if (!cancelled) setMapStatus('ready');
          markerRefs.current.forEach((marker) => marker.remove());
          markerRefs.current = [];
          if (showDemoMarkersRef.current) addSampleMarkers(map, maplibre, markerRefs);
          addCommunityMarkers(map, maplibre, markerRefs, reportsRef.current);
        });

        map.on('error', () => {
          if (!cancelled && !mapLoadedRef.current) setMapStatus('unavailable');
        });
      } catch (error) {
        if (!cancelled) setMapStatus('unavailable');
      }
    };

    window.addEventListener('maplibre-ready', initializeMap);
    window.addEventListener('maplibre-failed', handleMapFailure);
    if (window.maplibregl) initializeMap();
    else if (window.__MAPLIBRE_LOAD_STATE === 'error') setMapStatus('unavailable');

    return () => {
      cancelled = true;
      window.removeEventListener('maplibre-ready', initializeMap);
      window.removeEventListener('maplibre-failed', handleMapFailure);
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapLoadedRef.current = false;
      if (map) map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && Array.isArray(center) && center.length === 2) {
      map.flyTo({ center, zoom, duration: 550 });
    }
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !window.maplibregl) return;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];
    if (showDemoMarkers) addSampleMarkers(map, window.maplibregl, markerRefs);
    addCommunityMarkers(map, window.maplibregl, markerRefs, reports);
  }, [showDemoMarkers, reports]);

  return (
    <div className="live-map-shell" data-show-demo-markers={showDemoMarkers ? 'true' : 'false'}>
      <div
        ref={containerRef}
        className="live-map"
        role="application"
        aria-label={'Interactive map centered on ' + areaLabel +
          (showDemoMarkers ? ' with illustrative demo markers' : ' without sample markers')}
      />
      {mapStatus !== 'ready' && (
        <div className="map-status-overlay" role="status">
          {mapStatus === 'loading' ? (
            <span>Loading the map…</span>
          ) : (
            <span>
              The map could not load. Check your connection or{' '}
              <a
                href={'https://www.openstreetmap.org/#map=12/' + center[1] + '/' + center[0]}
                target="_blank"
                rel="noreferrer"
              >
                open this location in OpenStreetMap
              </a>.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default InteractiveMap;
