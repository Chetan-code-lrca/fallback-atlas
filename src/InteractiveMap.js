import React, { useEffect, useRef, useState } from 'react';

const MAP_CENTER = [75.7873, 26.9124];

const sampleMarkers = [
  {
    position: [75.7878, 26.9055],
    area: 'Civil Lines',
    service: 'Fixed broadband',
    status: 'working',
    symbol: '✓'
  },
  {
    position: [75.7421, 26.9123],
    area: 'Vaishali Nagar',
    service: 'Mobile data',
    status: 'degraded',
    symbol: '≈'
  },
  {
    position: [75.8042, 26.8545],
    area: 'Malviya Nagar',
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

function InteractiveMap() {
  const containerRef = useRef(null);
  const [mapStatus, setMapStatus] = useState('loading');

  useEffect(() => {
    const maplibre = window.maplibregl;
    const container = containerRef.current;

    if (!maplibre || !container) {
      setMapStatus('unavailable');
      return undefined;
    }

    let map;
    let mapLoaded = false;

    try {
      map = new maplibre.Map({
        container,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: MAP_CENTER,
        zoom: 11.5,
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
        setMapStatus('ready');

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
        if (!mapLoaded) setMapStatus('unavailable');
      });
    } catch (error) {
      setMapStatus('unavailable');
    }

    return () => {
      if (map) map.remove();
    };
  }, []);

  return (
    <div className="live-map-shell">
      <div
        ref={containerRef}
        className="live-map"
        role="application"
        aria-label="Interactive map centered on Jaipur with illustrative demo markers"
      />
      {mapStatus !== 'ready' && (
        <div className="map-status-overlay" role="status">
          {mapStatus === 'loading' ? (
            <span>Loading the map…</span>
          ) : (
            <span>
              The map could not load. Check your connection or{' '}
              <a
                href="https://www.openstreetmap.org/#map=12/26.9124/75.7873"
                target="_blank"
                rel="noreferrer"
              >
                open Jaipur in OpenStreetMap
              </a>.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default InteractiveMap;
