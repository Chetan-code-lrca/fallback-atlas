import React, { useEffect, useState } from 'react';

function ageLabel(value) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return 'time unknown';
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  return m < 1 ? 'observed just now' : m === 1 ? 'observed 1 minute ago' : 'observed ' + m + ' minutes ago';
}
function bandLabel(mhz) {
  return mhz >= 5925 ? '6 GHz' : mhz >= 4900 ? '5 GHz' : '2.4 GHz';
}
function signalLabel(dbm) {
  return dbm >= -55 ? 'Very strong' : dbm >= -67 ? 'Good' : dbm >= -75 ? 'Fair' : 'Weak';
}

export default function WifiScanPanel({
  center, radiusKm, areaSelected, onRadiusChange, onUseLocation,
  locationPending, refreshToken, onRefresh, onObservationsChange
}) {
  const [viewState, setViewState] = useState('needs-location');
  const [networks, setNetworks] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!areaSelected || !Array.isArray(center) || center.length !== 2) {
      setNetworks([]);
      onObservationsChange([]);
      setViewState('needs-location');
      setMessage('');
      return undefined;
    }
    let cancelled = false;
    setViewState('loading');
    const query = new URLSearchParams({
      latitude: String(center[1]), longitude: String(center[0]), radiusKm: String(radiusKm)
    });
    fetch('/api/wifi-scans?' + query.toString(), {
      headers: { Accept: 'application/json' }, cache: 'no-store'
    }).then(async (response) => {
      let payload = {};
      try { payload = await response.json(); } catch (error) { payload = {}; }
      if (cancelled) return;
      if (!response.ok) {
        setNetworks([]);
        onObservationsChange([]);
        setViewState(payload.error === 'storage_not_configured' ? 'not-configured' : 'unavailable');
        setMessage(payload.message || 'The nearby scan feed is temporarily unavailable.');
        return;
      }
      const safe = Array.isArray(payload.networks) ? payload.networks.filter((n) =>
        n && typeof n.networkName === 'string' &&
        Number.isFinite(Number(n.signalDbm)) &&
        Number.isFinite(Number(n.frequencyMhz)) &&
        Number.isFinite(Number(n.latitude)) &&
        Number.isFinite(Number(n.longitude))
      ) : [];
      setNetworks(safe);
      onObservationsChange(safe);
      setViewState('ready');
      setMessage('');
    }).catch(() => {
      if (cancelled) return;
      setNetworks([]);
      onObservationsChange([]);
      setViewState('unavailable');
      setMessage('The nearby scan service could not be reached. No network names have been inferred.');
    });
    return () => { cancelled = true; };
  }, [areaSelected, center, radiusKm, refreshToken, onObservationsChange]);

  return (
    <section className="campus-wifi-panel panel" id="campus-wifi" aria-labelledby="wifi-scan-title">
      <div className="campus-wifi-heading">
        <div>
          <span className="section-kicker">REAL DEVICE OBSERVATIONS</span>
          <h2 id="wifi-scan-title">Nearby Wi-Fi, actually observed</h2>
          <p>Access points appear here only after an Android device detects them and the user explicitly shares a scan. No guessed SSIDs. No fake “healthy” result.</p>
        </div>
        <span className="campus-badge"><span className="campus-badge-dot" /> Azure scan feed</span>
      </div>
      <div className="wifi-feed-toolbar">
        <div className="wifi-feed-controls">
          <button type="button" className="button button-teal" onClick={onUseLocation} disabled={locationPending}>
            {locationPending ? 'Finding location…' : '⌖ Use my location'}
          </button>
          <label>Search radius
            <select value={radiusKm} onChange={(event) => onRadiusChange(Number(event.target.value))}>
              <option value={1}>1 km</option><option value={3}>3 km</option><option value={5}>5 km</option>
            </select>
          </label>
          <button type="button" className="refresh-button" onClick={onRefresh} disabled={!areaSelected} aria-label="Refresh nearby Wi-Fi scan observations">↻ Refresh</button>
        </div>
        <a className="speedtest-link" href="https://github.com/Chetan-code-lrca/fallback-atlas/tree/main/android" target="_blank" rel="noreferrer">Open the Android scanner source ↗</a>
      </div>
      <div className="wifi-feed-results" aria-live="polite">
        {viewState === 'needs-location' && <div className="wifi-feed-empty"><strong>Select an area to see nearby scan observations.</strong><p>Choose “Use my location” or search a place. This website does not have access to your phone’s Wi-Fi radio scan list.</p></div>}
        {viewState === 'loading' && <div className="wifi-feed-empty"><strong>Loading recent observations…</strong><p>Only real scan timestamps and nearby coordinates are eligible to appear.</p></div>}
        {(viewState === 'not-configured' || viewState === 'unavailable') && <div className="wifi-feed-empty wifi-feed-warning"><strong>{viewState === 'not-configured' ? 'Shared scan storage is not enabled' : 'Scan feed unavailable'}</strong><p>{message}</p></div>}
        {viewState === 'ready' && networks.length === 0 && <div className="wifi-feed-empty"><strong>No recent scans shared within {radiusKm} km.</strong><p>This is an empty result, not a claim that no Wi-Fi exists. Run the Android scanner and explicitly share a recent scan to contribute the first observation.</p></div>}
        {viewState === 'ready' && networks.length > 0 && <>
          <div className="wifi-feed-summary">{networks.length} network/frequency entries · observations from the last 15 minutes</div>
          <div className="wifi-network-list">
            {networks.map((n) => <article className="wifi-network-card" key={n.id || n.networkName + '-' + n.frequencyMhz}>
              <div className="wifi-network-symbol" aria-hidden="true">⌁</div>
              <div className="wifi-network-copy">
                <strong>{n.networkName}</strong>
                <span>{n.signalType === 'windows-percent-estimate'
                  ? 'Windows-reported ' + n.signalPercent + '% signal · rough estimate ' + n.signalDbm + ' dBm · ' + bandLabel(Number(n.frequencyMhz))
                  : signalLabel(Number(n.signalDbm)) + ' signal · ' + n.signalDbm + ' dBm · ' + bandLabel(Number(n.frequencyMhz))}</span>
                <small>{n.security || 'Security unknown'} · {ageLabel(n.observedAt)} · {n.area}</small>
              </div>
              <span className={'wifi-signal-pill ' + (n.signalDbm >= -67 ? 'wifi-signal-good' : n.signalDbm >= -75 ? 'wifi-signal-fair' : 'wifi-signal-weak')}>{n.observations || 1} obs.</span>
            </article>)}
          </div>
          <p className="wifi-feed-note">Signal strength means how strongly a device heard an access point. It does not prove the access point has working internet or measure download speed.</p>
        </>}
      </div>
      <p className="wifi-disclosure"><span aria-hidden="true">ⓘ</span> Android scans need system permission and may be throttled. Windows reports signal percentage, so its dBm value is only a rough estimate; Android reports measured RSSI. Shared observations include SSID, signal level, frequency, security label, scan time and approximate location. Passwords, BSSIDs/MAC addresses and device IDs are excluded. Shared observations appear in the nearby feed for 15 minutes.</p>
    </section>
  );
}
