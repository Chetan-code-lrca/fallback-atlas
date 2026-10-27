import React, { useEffect, useRef, useState } from 'react';

const MAP_CENTER = [73.685806, 24.582285];

const sampleMarkers = [
  {
    position: [73.685575, 24.614134],
    area: 'Fatehpura',
    service: 'Mobile data',
    status: 'degraded',
    symbol: '≈'
  },
  {
    position: [73.685806, 24.582285],
    area: 'Udaipur City',
    service: 'Fixed broadband',
    status: 'working',
    symbol: '✓'
  },
  {
    position: [73.655799, 24.536711],
    area: 'Hiran Magri',
    service: 'Power',
    status: 'down',
    symbol: '!'
  }
];

const statusLabels = {
  working: 'Working',
  degraded: 'Degraded',
  down: 'Down'
};

function createPopupContent(point) {
  const content = document.createElement('div');
  content.className = 'atlas-map-popup';

  const title = document.createElement('strong');
  title.textContent = point.service + ' · ' + statusLabels[point.status];

  const area = document.createElement('p');
  area.textContent = point.area;

  const disclaimer = document.createElement('small');
  disclaimer.textContent = 'DEMO ONLY — illustrative marker, not a verified live report.';

  content.append(title, area, disclaimer);
  return content;
}

function InteractiveMap({ center = MAP_CENTER, zoom = 12, areaLabel = 'Udaipur, Rajasthan' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const [mapStatus, setMapStatus] = useState('loading');

  useEffect(() => {
    const container = containerRef.current;
    let map;
    let mapLoaded = false;
    let cancelled = false;

    const handleMapFailure = () => {
      setMapStatus('unavailable');
    };

    const initializeMap = () => {
      const maplibre = window.maplibregl;
      if (cancelled || map || !container) return;
      if (!maplibre) {
        if (window.__MAPLIBRE_LOAD_STATE === 'error') {
          setMapStatus('unavailable');
        }
        return;
      }

      try {
        map = new maplibre.Map({
          container,
          style: 'https://tiles.openfreemap.org/styles/liberty',
          center: initialCenterRef.current,
          zoom: initialZoomRef.current,
          minZoom: 3,
          maxZoom: 18,
          scrollZoom: false,
          cooperativeGestures: true,
          attributionControl: true,
          pitchWithRotate: false,
          dragRotate: false
        });

        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          'top-right'
        );
        map.addControl(
          new maplibre.ScaleControl({ maxWidth: 100, unit: 'metric' }),
          'bottom-left'
        );

        map.on('load', () => {
          mapLoaded = true;
          if (!cancelled) setMapStatus('ready');

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

            new maplibre.Marker({ element: markerElement, anchor: 'bottom' })
              .setLngLat(point.position)
              .setPopup(popup)
              .addTo(map);
          });
        });

        map.on('error', () => {
          if (!mapLoaded && !cancelled) setMapStatus('unavailable');
        });
      } catch (error) {
        setMapStatus('unavailable');
      }
    };

    window.addEventListener('maplibre-ready', initializeMap);
    window.addEventListener('maplibre-failed', handleMapFailure);

    if (window.maplibregl) {
      initializeMap();
    } else if (window.__MAPLIBRE_LOAD_STATE === 'error') {
      setMapStatus('unavailable');
    }

    return () => {
      cancelled = true;
      window.removeEventListener('maplibre-ready', initializeMap);
      window.removeEventListener('maplibre-failed', handleMapFailure);
      if (map) map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && Array.isArray(center) && center.length === 2) {
      mapRef.current.flyTo({ center, zoom, duration: 550 });
    }
  }, [center, zoom]);

  return (
    <div className="live-map-shell">
      <div
        ref={containerRef}
        className="live-map"
        role="application"
        aria-label={"Interactive map centered on " + areaLabel + " with illustrative demo markers"}
      />
      {mapStatus !== 'ready' && (
        <div className="map-status-overlay" role="status">
          {mapStatus === 'loading' ? (
            <span>Loading the map…</span>
          ) : (
            <span>
              The map could not load. Check your connection or{' '}
              <a
                href="https://www.openstreetmap.org/#map=12/24.5823/73.6858"
                target="_blank"
                rel="noreferrer"
              >
                open Udaipur in OpenStreetMap
              </a>.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default InteractiveMap;
