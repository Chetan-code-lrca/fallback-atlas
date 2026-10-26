import React, { useEffect, useRef, useState } from 'react';

const sampleMarkers = [
  {
    position: [26.9055, 75.7878],
    area: 'Civil Lines',
    service: 'Fixed broadband',
    status: 'working',
    symbol: '✓'
  },
  {
    position: [26.9123, 75.7421],
    area: 'Vaishali Nagar',
    service: 'Mobile data',
    status: 'degraded',
    symbol: '≈'
  },
  {
    position: [26.8545, 75.8042],
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

function InteractiveMap() {
  const containerRef = useRef(null);
  const [mapStatus, setMapStatus] = useState('loading');

  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current) {
      setMapStatus('unavailable');
      return undefined;
    }

    let map;
    try {
      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true
      }).setView([26.9124, 75.7873], 12);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
      }).addTo(map);

      sampleMarkers.forEach((point) => {
        const markerIcon = L.divIcon({
          className: 'atlas-marker-icon',
          html: '<span class="atlas-marker-pin atlas-pin-' + point.status + '"><b>' + point.symbol + '</b></span>',
          iconSize: [34, 40],
          iconAnchor: [17, 36],
          popupAnchor: [0, -32]
        });

        const popupContent =
          '<div class="atlas-map-popup">' +
          '<strong>' + point.service + ' · ' + statusLabels[point.status] + '</strong>' +
          '<p>' + point.area + '</p>' +
          '<small>DEMO ONLY — illustrative marker, not a verified live report.</small>' +
          '</div>';

        L.marker(point.position, { icon: markerIcon })
          .addTo(map)
          .bindPopup(popupContent);
      });

      map.whenReady(() => {
        map.invalidateSize();
        setMapStatus('ready');
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
        aria-label="Interactive OpenStreetMap view centered on Jaipur with illustrative demo markers"
      />
      {mapStatus !== 'ready' && (
        <div className="map-status-overlay" role="status">
          {mapStatus === 'loading' ? (
            <span>Loading interactive map…</span>
          ) : (
            <span>
              The map could not load. Check your connection or{' '}
              <a href="https://www.openstreetmap.org/#map=12/26.9124/75.7873" target="_blank" rel="noreferrer">
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
