import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import InteractiveMap from './InteractiveMap';
import { geocodeLocation } from './geocoding';

const demoReports = [
  { id: 'demo-1', area: 'Fatehpura, Udaipur', service: 'Mobile data', status: 'degraded', note: 'Illustrative sample only; not a verified local report.', time: 'Demo example', demo: true },
  { id: 'demo-2', area: 'Udaipur City', service: 'Fixed broadband', status: 'working', note: 'Illustrative sample only; not a verified local report.', time: 'Demo example', demo: true },
  { id: 'demo-3', area: 'Hiran Magri, Udaipur', service: 'Power', status: 'down', note: 'Illustrative sample only; not a verified local report.', time: 'Demo example', demo: true },
  { id: 'demo-4', area: 'Pratap Nagar, Udaipur', service: 'Mobile data', status: 'working', note: 'Illustrative sample only; not a verified local report.', time: 'Demo example', demo: true }
];

const UDAIPUR_AREAS = [
  {
    id: 'fatehpura',
    label: 'Fatehpura, Udaipur',
    aliases: ['fatehpura'],
    matchTerms: ['fatehpura'],
    center: [73.685575, 24.614134],
    zoom: 13.4
  },
  {
    id: 'hiran-magri',
    label: 'Hiran Magri, Udaipur',
    aliases: ['hiran magri', 'hiranmagri'],
    matchTerms: ['hiran magri', 'hiranmagri'],
    center: [73.655799, 24.536711],
    zoom: 13.2
  },
  {
    id: 'pratap-nagar',
    label: 'Pratap Nagar, Udaipur',
    aliases: ['pratap nagar'],
    matchTerms: ['pratap nagar'],
    center: [73.75327, 24.59262],
    zoom: 13.2
  },
  {
    id: 'udaipur-city',
    label: 'Udaipur City',
    aliases: ['udaipur city', 'old city', 'city centre', 'city center', 'city palace'],
    matchTerms: ['udaipur city', 'old city', 'city palace', 'sukhadia circle', 'surajpole', 'hathipole'],
    center: [73.685806, 24.582285],
    zoom: 13
  },
  {
    id: 'udaipur',
    label: 'Udaipur, Rajasthan',
    aliases: ['udaipur'],
    matchTerms: ['udaipur', 'fatehpura', 'hiran magri', 'hiranmagri', 'pratap nagar', 'surajpole', 'hathipole'],
    center: [73.685806, 24.582285],
    zoom: 12
  }
];

function findLocalArea(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return UDAIPUR_AREAS.find((preset) =>
    preset.aliases.some((alias) =>
      normalized === alias ||
      normalized.startsWith(alias + ',') ||
      normalized.includes(alias)
    )
  ) || null;
}

const serviceOptions = ['Mobile data', 'Fixed broadband', 'Power'];
const statusOptions = [
  { value: 'working', label: 'Working', hint: 'Available as expected' },
  { value: 'degraded', label: 'Degraded', hint: 'Slow or unreliable' },
  { value: 'down', label: 'Down', hint: 'Not working' }
];


function observedAtOf(report) {
  return report.observedAt || report.createdAt || null;
}

function ageMinutes(report, now = Date.now()) {
  if (report.demo) return null;
  const timestamp = Date.parse(observedAtOf(report) || '');
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (now - timestamp) / 60000);
}

function timeAgo(report) {
  if (report.demo) return 'Demo example';
  const minutes = ageMinutes(report);
  if (minutes === null) return 'Time unknown';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return Math.floor(minutes) + ' min ago';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' hr ago';
  return Math.floor(minutes / 1440) + ' day(s) ago';
}

function freshnessLabel(report) {
  if (report.demo) return 'Sample data';
  const minutes = ageMinutes(report);
  if (minutes === null) return 'Time unknown';
  if (minutes < 15) return 'Fresh';
  if (minutes < 60) return 'Recent';
  if (minutes < 360) return 'Aging';
  return 'Stale';
}

function freshnessClass(report) {
  return 'freshness-' + freshnessLabel(report).toLowerCase().replace(/\s+/g, '-');
}

function SignalMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="signal-dot" />
      <span className="signal-arc signal-arc-one" />
      <span className="signal-arc signal-arc-two" />
    </div>
  );
}

function StatusPill({ status }) {
  const labels = { working: 'Working', degraded: 'Degraded', down: 'Down' };
  return <span className={'status-pill status-' + status}><span className="status-dot" />{labels[status] || status}</span>;
}

function ServiceIcon({ service }) {
  const icon = service === 'Power' ? 'ϟ' : service === 'Fixed broadband' ? '⌁' : '⌁';
  return <span className={'service-icon service-' + service.toLowerCase().replace(/\s+/g, '-')} aria-hidden="true">{icon}</span>;
}

function App() {
  const [area, setArea] = useState('Udaipur, Rajasthan');
  const [mapLocationLabel, setMapLocationLabel] = useState('Udaipur, Rajasthan');
  const [mapCenter, setMapCenter] = useState([73.685806, 24.582285]);
  const [mapZoom, setMapZoom] = useState(12);
  const [showDemoMarkers, setShowDemoMarkers] = useState(true);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [searchValue, setSearchValue] = useState('');
  const [sharedReports, setSharedReports] = useState([]);
  const [apiMode, setApiMode] = useState('checking');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [syncingPending, setSyncingPending] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [activeFilter, setActiveFilter] = useState('All updates');
  const [reportOpen, setReportOpen] = useState(false);
  const [reports, setReports] = useState(() => {
    try {
      const saved = window.localStorage.getItem('fallback-atlas-local-reports');
      if (!saved) return demoReports;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((report) => (
        report &&
        typeof report.id === 'string' &&
        typeof report.area === 'string' &&
        serviceOptions.includes(report.service) &&
        ['working', 'degraded', 'down'].includes(report.status)
      )) : demoReports;
    } catch (error) {
      return demoReports;
    }
  });
  const [formArea, setFormArea] = useState('Udaipur, Rajasthan');
  const [formService, setFormService] = useState('Mobile data');
  const [formStatus, setFormStatus] = useState('degraded');
  const [formNote, setFormNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem('fallback-atlas-local-reports', JSON.stringify(reports));
    } catch (error) {
      // Local persistence is optional; the app remains usable without it.
    }
  }, [reports]);

  useEffect(() => {
    let cancelled = false;
    async function checkApi() {
      try {
        const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
        const health = await response.json();
        if (cancelled) return;
        if (response.ok && health.mode === 'shared') setApiMode('shared');
        else if (health.mode === 'local') setApiMode('local');
        else setApiMode('unavailable');
      } catch (error) {
        if (!cancelled) setApiMode('unavailable');
      }
    }
    checkApi();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSharedReports() {
      const params = new URLSearchParams();
      params.set('area', area);
      params.set('latitude', String(mapCenter[1]));
      params.set('longitude', String(mapCenter[0]));
      params.set('radiusKm', '10');

      try {
        const response = await fetch('/api/reports?' + params.toString(), {
          headers: { Accept: 'application/json' }
        });
        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setSharedReports([]);
          if (payload.error === 'storage_not_configured') setApiMode('local');
          else if (response.status === 503) setApiMode('unavailable');
          return;
        }

        const loaded = Array.isArray(payload.reports)
          ? payload.reports.map((report) => ({
              ...report,
              shared: true,
              demo: false,
              time: report.observedAt || report.createdAt
            }))
          : [];
        setSharedReports(loaded);
        setApiMode('shared');
      } catch (error) {
        if (!cancelled) {
          setSharedReports([]);
          setApiMode((current) => current === 'checking' ? 'unavailable' : current);
        }
      }
    }
    loadSharedReports();
    return () => { cancelled = true; };
  }, [area, mapCenter]);

  const selectedArea = area.trim().toLowerCase();
  const selectedAreaPreset = findLocalArea(area);
  const areaReports = useMemo(() => {
    const localAndDemoReports = reports.filter((report) => {
      const reportArea = String(report.area || '').trim().toLowerCase();
      if (!showDemoMarkers) return reportArea === selectedArea;
      if (selectedAreaPreset && selectedAreaPreset.id === 'udaipur') {
        return report.demo || selectedAreaPreset.matchTerms.some((term) => reportArea.includes(term));
      }
      if (selectedAreaPreset) {
        return selectedAreaPreset.matchTerms.some((term) => reportArea.includes(term));
      }
      return reportArea === selectedArea;
    });
    const combined = [...localAndDemoReports, ...sharedReports];
    const seen = new Set();
    return combined.filter((report) => {
      if (!report.id || seen.has(report.id)) return false;
      seen.add(report.id);
      return true;
    });
  }, [reports, sharedReports, selectedArea, selectedAreaPreset, showDemoMarkers]);

  const visibleReports = useMemo(() => (
    activeFilter === 'All updates'
      ? areaReports
      : areaReports.filter((report) => report.service === activeFilter)
  ), [areaReports, activeFilter]);
  const localReports = areaReports.filter((report) => !report.demo && !report.shared);
  const pendingReports = reports.filter((report) => !report.demo && !report.shared && report.syncStatus === 'pending');
  const counts = areaReports.reduce((total, report) => {
    if (Object.prototype.hasOwnProperty.call(total, report.status)) total[report.status] += 1;
    return total;
  }, { working: 0, degraded: 0, down: 0 });
  const hasSampleReports = areaReports.some((report) => report.demo);
  const sharedReportCount = areaReports.filter((report) => report.shared).length;
  const recentRealReports = areaReports.filter((report) => {
    const minutes = ageMinutes(report);
    return !report.demo && minutes !== null && minutes <= 30;
  });
  const evidenceSummary = hasSampleReports
    ? 'Sample data is illustrative; it must not be treated as live service status.'
    : recentRealReports.length === 0
      ? 'No reports observed in the last 30 minutes.'
      : recentRealReports.length < 3
        ? recentRealReports.length + ' recent community report(s); not enough evidence to corroborate status.'
        : recentRealReports.length + ' recent community reports. Community evidence is not official utility verification.';

  async function searchArea(event) {
    event.preventDefault();
    const value = searchValue.trim();
    if (!value || searchStatus === 'loading') return;

    if (value.length > 160) {
      setMessage('Please enter a shorter place name or address (160 characters maximum).');
      return;
    }

    const preset = findLocalArea(value);
    if (preset) {
      setArea(preset.label);
      setFormArea(preset.label);
      setMapLocationLabel(preset.label);
      setMapCenter(preset.center);
      setMapZoom(preset.zoom);
      setShowDemoMarkers(true);
      setMessage('Map moved to ' + preset.label + '. The sample markers are illustrative, not verified live service reports.');
      setSearchValue('');
      return;
    }

    setSearchStatus('loading');
    setMessage('Searching for "' + value + '"…');
    try {
      const result = await geocodeLocation(value);
      if (!result) {
        setMessage('No matching location found for "' + value + '". Try adding a city, state, or country.');
        return;
      }

      setArea(result.label);
      setFormArea(result.label);
      setMapLocationLabel(result.label);
      setMapCenter(result.center);
      setMapZoom(result.zoom);
      setShowDemoMarkers(false);
      setMessage('Map centered on ' + result.label + '. No verified outage reports are available here yet; Udaipur demo markers are hidden.');
    } catch (error) {
      setMessage(error && error.message
        ? error.message
        : 'Location search is temporarily unavailable. Please try again later.');
    } finally {
      setSearchStatus('idle');
      setSearchValue('');
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    if (reportSubmitting) return;

    const reportArea = formArea.trim() || area;
    const preset = findLocalArea(reportArea);
    let reportCenter = null;
    if (preset) reportCenter = preset.center;
    else if (reportArea.toLowerCase() === mapLocationLabel.trim().toLowerCase()) reportCenter = mapCenter;

    const payload = {
      area: reportArea,
      service: formService,
      status: formStatus,
      note: formNote.trim() || 'Community status report.',
      observedAt: new Date().toISOString(),
      ...(reportCenter ? { latitude: reportCenter[1], longitude: reportCenter[0] } : {})
    };

    setReportSubmitting(true);
    let fallbackMessage = 'Shared reporting is unavailable. Your report was saved on this device only and has not been shared.';
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      let result = {};
      try { result = await response.json(); } catch (error) { result = {}; }

      if (!response.ok || !result.report) {
        if (result.error === 'storage_not_configured') {
          setApiMode('local');
          fallbackMessage = 'Shared storage is not configured yet. Your report is saved locally and is pending sync; other visitors cannot see it yet.';
        } else if (response.status === 429) {
          fallbackMessage = 'The area has received many reports recently. Your report is saved locally and is pending sync; it has not been shared.';
        } else {
          setApiMode('unavailable');
          fallbackMessage = 'The shared API is temporarily unavailable. Your report is saved locally and is pending sync; it has not been shared.';
        }
        throw new Error(fallbackMessage);
      }

      const sharedReport = {
        ...result.report,
        shared: true,
        demo: false,
        time: result.report.observedAt || result.report.createdAt
      };
      setSharedReports((current) => [sharedReport, ...current.filter((item) => item.id !== sharedReport.id)]);
      setApiMode('shared');
      setMessage('Report shared with other visitors. It is community-reported and has not been independently verified.');
    } catch (error) {
      const localReport = {
        ...payload,
        id: 'local-' + Date.now(),
        createdAt: new Date().toISOString(),
        time: 'Just now · saved on this device',
        demo: false,
        shared: false,
        syncStatus: 'pending'
      };
      setReports((current) => [localReport, ...current]);
      setMessage(fallbackMessage);
    } finally {
      setReportSubmitting(false);
      setArea(reportArea);
      if (preset) {
        setMapLocationLabel(preset.label);
        setMapCenter(preset.center);
        setMapZoom(preset.zoom);
        setShowDemoMarkers(true);
      } else if (reportArea.toLowerCase() !== mapLocationLabel.trim().toLowerCase()) {
        setShowDemoMarkers(false);
      }
      setActiveView('feed');
      setActiveFilter('All updates');
      setReportOpen(false);
      setFormNote('');
    }
  }

  async function syncPendingReports() {
    if (syncingPending || pendingReports.length === 0 || apiMode !== 'shared') return;
    setSyncingPending(true);
    let synced = 0;

    try {
      for (const pending of pendingReports) {
        const payload = {
          area: pending.area,
          service: pending.service,
          status: pending.status,
          note: pending.note || '',
          observedAt: pending.observedAt || pending.createdAt || new Date().toISOString(),
          ...(Number.isFinite(Number(pending.latitude)) && Number.isFinite(Number(pending.longitude))
            ? { latitude: Number(pending.latitude), longitude: Number(pending.longitude) }
            : {})
        };
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.report) break;

        const sharedReport = {
          ...result.report,
          shared: true,
          demo: false,
          time: result.report.observedAt || result.report.createdAt
        };
        setSharedReports((current) => [sharedReport, ...current.filter((item) => item.id !== sharedReport.id)]);
        setReports((current) => current.filter((item) => item.id !== pending.id));
        synced += 1;
      }
      setMessage(
        synced > 0
          ? synced + ' pending report(s) shared successfully. These remain community reports, not official verification.'
          : 'No pending reports were synchronized. Check the connection and shared storage status.'
      );
    } catch (error) {
      setMessage('Sync interrupted. Remaining reports are still stored on this device and have not been shared.');
    } finally {
      setSyncingPending(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Fallback Atlas home">
          <SignalMark />
          <span className="brand-copy"><strong>fallback atlas</strong><small>Community resilience map</small></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#status">Explore status</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <button className="button button-dark top-report" onClick={() => { setFormArea(area); setReportOpen(true); }}>
          <span aria-hidden="true">＋</span> Report status
        </button>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> COMMUNITY-POWERED RESILIENCE</div>
            <h1>Know what still <span>works.</span></h1>
            <p>When a connection drops, local knowledge matters. Check reports about mobile data, broadband and power in one place.</p>
            <form className="search-form" onSubmit={searchArea}>
              <span className="search-icon" aria-hidden="true">⌕</span>
              <label className="visually-hidden" htmlFor="area-search">Search area or PIN code</label>
              <input id="area-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Any city, neighbourhood, postcode or address…" maxLength={160} />
              <button className="button button-teal" type="submit" disabled={searchStatus === 'loading'}>{searchStatus === 'loading' ? 'Searching…' : 'Find location'}</button>
            </form>
            <div className="hero-footnote"><span aria-hidden="true">⌖</span> Search locations worldwide. Searches run only when submitted and are cached in this browser. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Search data © OpenStreetMap contributors</a>.</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-center"><SignalMark /><span>local signals<br />collectively</span></div>
            <div className="art-node art-node-one"><span>Power</span><b>✓</b></div>
            <div className="art-node art-node-two"><span>Mobile</span><b>~</b></div>
            <div className="art-node art-node-three"><span>Broadband</span><b>✓</b></div>
            <div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✳</div>
          </div>
          <div className="demo-ribbon"><span className="demo-ribbon-dot" /> Prototype preview <span className="ribbon-divider">/</span> Example data, not live service status</div>
        </section>

        {message && <div className="notice" role="status"><span>ⓘ</span><p>{message}</p><button aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></div>}

        <section className="status-overview" id="status">
          <div className="section-heading">
            <div><span className="section-kicker">AREA SNAPSHOT · SAMPLE + LOCAL REPORTS</span><h2>{area}</h2></div>
            <span className="sample-tag"><span /> {hasSampleReports ? 'SAMPLE + LOCAL' : 'LOCAL REPORTS'}</span>
          </div>
          <div className="summary-grid">
            <article className="summary-card summary-working"><div className="summary-icon">✓</div><div><span>Working reports</span><strong>{counts.working}</strong></div><span className="summary-arrow">↗</span></article>
            <article className="summary-card summary-degraded"><div className="summary-icon">≈</div><div><span>Degraded reports</span><strong>{counts.degraded}</strong></div><span className="summary-arrow">↗</span></article>
            <article className="summary-card summary-down"><div className="summary-icon">!</div><div><span>Down reports</span><strong>{counts.down}</strong></div><span className="summary-arrow">↗</span></article>
          </div>
        </section>

        <section className="workspace">
          <div className="panel map-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">LOCAL OVERVIEW</span><h3>Interactive map · {mapLocationLabel}</h3></div>
              <span className="preview-label">{showDemoMarkers ? 'DEMO MARKERS' : 'LOCATION VIEW'}</span>
            </div>
            <InteractiveMap center={mapCenter} zoom={mapZoom} areaLabel={mapLocationLabel} showDemoMarkers={showDemoMarkers} />
            <div className="map-footer"><span className="map-footer-icon">ⓘ</span><span>{showDemoMarkers ? 'Sample markers are shown only for the Udaipur prototype. They are not verified live reports.' : 'No sample markers are shown for this searched location. Reports appear only when matching reports exist.'} Map by <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · data © OpenStreetMap contributors.</span></div>
          </div>

          <aside className="panel updates-panel">
            <div className="panel-heading updates-heading">
              <div><span className="section-kicker">COMMUNITY PULSE</span><h3>Recent reports</h3></div>
              <span className="count-bubble">{areaReports.length}</span>
            </div>
            <div className="filter-row" aria-label="Filter reports">
              {['All updates', ...serviceOptions].map((filter) => <button key={filter} className={'filter-chip' + (activeFilter === filter ? ' active' : '')} onClick={() => setActiveFilter(filter)}>{filter}</button>)}
            </div>
            <div className="view-toggle" role="tablist" aria-label="Updates view">
              <button role="tab" aria-selected={activeView === 'map'} className={activeView === 'map' ? 'selected' : ''} onClick={() => setActiveView('map')}>Overview</button>
              <button role="tab" aria-selected={activeView === 'feed'} className={activeView === 'feed' ? 'selected' : ''} onClick={() => setActiveView('feed')}>Report feed <span>{localReports.length > 0 ? localReports.length : ''}</span></button>
            </div>
            {activeView === 'map' && <div className="service-status-list">
              {areaReports.length === 0 ? (
                <div className="empty-state"><span>⌁</span><strong>No reports for this location yet</strong><p>Try another area or add a local test report. Reports are not shared with other visitors in this prototype.</p></div>
              ) : areaReports.slice(0, 5).map((report) => (
                <div className="service-status-item" key={report.id}>
                  <ServiceIcon service={report.service} />
                  <div className="service-status-main"><strong>{report.service}</strong><small>{report.area} · {report.demo ? 'Demo only' : 'Local browser report'}</small></div>
                  <StatusPill status={report.status} />
                </div>
              ))}
              <div className="confidence-note"><span>↗</span><div><strong>Confidence & freshness</strong><small>{hasSampleReports ? 'Sample data is illustrative, not verified.' : 'Freshness and confidence need a shared reporting API.'}</small></div></div>
            </div>}
            {activeView === 'feed' && <div className="report-feed">
              {visibleReports.length === 0 ? <div className="empty-state"><span>⌁</span><strong>No reports in this filter</strong><p>Try a different service or submit a local example.</p></div> : visibleReports.map((report) => <article className="feed-item" key={report.id}><div className="feed-item-top"><strong>{report.service}</strong><StatusPill status={report.status} /></div><span className="feed-area">⌖ {report.area}</span><p>{report.note}</p><small>{report.time}{report.demo ? ' · demo' : ' · local only'}</small></article>)}
            </div>}
            <button className="button button-outline full-button" onClick={() => { setFormArea(area); setReportOpen(true); }}><span>＋</span> Add a community report</button>
            <p className="panel-disclaimer">{hasSampleReports ? 'Demo data is illustrative. ' : ''}Local prototype only · reports are saved in this browser and are not shared.</p>
          </aside>
        </section>

        <section className="how-section" id="how-it-works">
          <div><span className="section-kicker">DESIGNED FOR OUTAGES</span><h2>Useful when networks are not.</h2><p>Fallback Atlas is being built to make local infrastructure status easier to understand, even when connectivity is unreliable.</p></div>
          <div className="how-steps">
            <article><span>01</span><strong>Check the area</strong><p>Compare power, mobile data and broadband reports side by side.</p></article>
            <article><span>02</span><strong>Share what works</strong><p>Community updates can help others make informed decisions.</p></article>
            <article><span>03</span><strong>See the evidence</strong><p>Future reports will show freshness and confidence, not just a colour.</p></article>
          </div>
        </section>
      </main>

      <footer className="footer"><a className="footer-brand" href="#home"><SignalMark /> fallback atlas</a><span>Open-source prototype · Built for community resilience</span><span className="footer-status"><i /> Demo mode</span></footer>

      {reportOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}>
        <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <div className="modal-heading"><div><span className="section-kicker">COMMUNITY UPDATE</span><h2 id="report-title">Report local status</h2></div><button className="modal-close" aria-label="Close report form" onClick={() => setReportOpen(false)}>×</button></div>
          <div className="modal-demo-note"><strong>Prototype notice</strong><span>This report is saved in this browser only. It is not uploaded or visible to others.</span></div>
          <form onSubmit={submitReport} className="report-form">
            <label>Area or neighbourhood<input required value={formArea} onChange={(event) => setFormArea(event.target.value)} placeholder="e.g. Fatehpura, Udaipur" /></label>
            <label>Infrastructure<select value={formService} onChange={(event) => setFormService(event.target.value)}>{serviceOptions.map((service) => <option key={service}>{service}</option>)}</select></label>
            <fieldset><legend>What's the current status?</legend><div className="status-choice-list">{statusOptions.map((option) => <label key={option.value} className={'status-choice choice-' + option.value}><input type="radio" name="status" value={option.value} checked={formStatus === option.value} onChange={(event) => setFormStatus(event.target.value)} /><span className="choice-dot" /><span><strong>{option.label}</strong><small>{option.hint}</small></span></label>)}</div></fieldset>
            <label>What did you observe? <span className="optional-label">Optional</span><textarea rows="3" maxLength="280" value={formNote} onChange={(event) => setFormNote(event.target.value)} placeholder="Share a brief, non-personal observation." /></label>
            <div className="privacy-note"><span>⌑</span><p>Don't include phone numbers, names, exact home addresses or other personal details.</p></div>
            <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setReportOpen(false)}>Cancel</button><button type="submit" className="button button-teal">Save local report <span>→</span></button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

export default App;
