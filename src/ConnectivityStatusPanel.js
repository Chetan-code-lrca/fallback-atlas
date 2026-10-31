import React, { useEffect, useState } from 'react';

function timeLabel(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'Time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Observed just now';
  if (minutes === 1) return 'Observed 1 minute ago';
  return 'Observed ' + minutes + ' minutes ago';
}

const serviceLabels = {
  wifi: 'Wi-Fi internet',
  'mobile-data': 'Mobile data internet'
};

const statusLabels = {
  working: 'Internet validated',
  degraded: 'Network found · internet not validated',
  down: 'Network unavailable'
};

export default function ConnectivityStatusPanel({ area, refreshToken }) {
  const [observations, setObservations] = useState([]);
  const [ingestionEnabled, setIngestionEnabled] = useState(false);
  const [viewState, setViewState] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ area: String(area || '') });
    setViewState('loading');

    fetch('/api/connectivity-observations?' + params.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(async (response) => {
      let payload = {};
      try { payload = await response.json(); } catch (error) { payload = {}; }
      if (cancelled) return;
      if (!response.ok) {
        setObservations([]);
        setViewState('unavailable');
        setMessage(payload.message || 'Automated observations are temporarily unavailable.');
        return;
      }
      setObservations(Array.isArray(payload.observations) ? payload.observations : []);
      setIngestionEnabled(payload.ingestionEnabled === true);
      setViewState('ready');
      setMessage('');
    }).catch(() => {
      if (cancelled) return;
      setObservations([]);
      setViewState('unavailable');
      setMessage('Automated observations could not be loaded. Manual community reports remain available.');
    });

    return () => { cancelled = true; };
  }, [area, refreshToken]);

  return (
    <section className="connectivity-status-panel panel" aria-labelledby="connectivity-status-title">
      <div className="connectivity-status-heading">
        <div>
          <span className="section-kicker">OPT-IN DEVICE TELEMETRY</span>
          <h2 id="connectivity-status-title">Automatic connectivity observations</h2>
          <p>Android volunteers can share whether Wi-Fi or mobile data has validated internet access. These are device observations, not official provider measurements.</p>
        </div>
        <span className="connectivity-status-badge">15-minute freshness</span>
      </div>

      {viewState === 'loading' && <p className="connectivity-status-empty">Checking for recent device observations…</p>}
      {viewState === 'unavailable' && <p className="connectivity-status-empty" role="status">{message}</p>}
      {viewState === 'ready' && observations.length === 0 && (
        <p className="connectivity-status-empty">
          {ingestionEnabled
            ? 'No recent Android connectivity observations for this area. A volunteer can enable automatic monitoring in the companion app.'
            : 'Automated ingestion is not enabled for this pilot area yet. Manual community reporting remains available.'}
        </p>
      )}
      {viewState === 'ready' && observations.length > 0 && (
        <div className="connectivity-status-list">
          {observations.map((item) => (
            <article className="connectivity-status-item" key={item.service}>
              <div>
                <strong>{serviceLabels[item.service] || item.service}</strong>
                <span>{statusLabels[item.status] || 'Status unavailable'}</span>
                <small>{item.area} · {timeLabel(item.observedAt)}</small>
              </div>
              <span className={'connectivity-status-pill connectivity-' + item.status}>
                {item.status === 'working' ? 'Working' : item.status === 'degraded' ? 'Degraded' : 'Down'}
              </span>
            </article>
          ))}
        </div>
      )}
      <p className="connectivity-status-disclaimer">
        Only area, connection type, status and timestamp are shared by this agent. It does not send GPS, SSIDs, passwords, device IDs or access-point MAC addresses. Stale statuses are hidden after 15 minutes; the storage keeps only one replaceable row per area and connection type.
      </p>
    </section>
  );
}
