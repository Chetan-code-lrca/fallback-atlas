import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const serviceOptions = ['Campus Wi-Fi', 'Mobile data', 'Fixed broadband', 'Power'];
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
  const icon = service === 'Power' ? 'ϟ' : service === 'Campus Wi-Fi' ? '⌁' : service === 'Fixed broadband' ? '⌁' : '⌁';
  return <span className={'service-icon service-' + service.toLowerCase().replace(/\s+/g, '-')} aria-hidden="true">{icon}</span>;
}

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem('fallback-atlas-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (error) { return 'light'; }
  });
  const [wifiNetwork, setWifiNetwork] = useState('SPSU');
  const [customWifiNetwork, setCustomWifiNetwork] = useState('');
  const [wifiChecking, setWifiChecking] = useState(false);
  const [wifiCheck, setWifiCheck] = useState(null);
  const [locationPending, setLocationPending] = useState(false);
  const [radiusKm, setRadiusKm] = useState(1);
  const [area, setArea] = useState('Udaipur, Rajasthan');
  const [mapLocationLabel, setMapLocationLabel] = useState('Udaipur, Rajasthan');
  const [mapCenter, setMapCenter] = useState([73.685806, 24.582285]);
  const [mapZoom, setMapZoom] = useState(12);
  const [showDemoMarkers, setShowDemoMarkers] = useState(true);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [searchValue, setSearchValue] = useState('');
  const [sharedReports, setSharedReports] = useState([]);
  const sharedReportsVersion = useRef(0);
  const [reportRefreshToken, setReportRefreshToken] = useState(0);
  const [browserOnline, setBrowserOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
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
  const [formNetworkName, setFormNetworkName] = useState('SPSU');
  const [formStatus, setFormStatus] = useState('degraded');
  const [formNote, setFormNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { window.localStorage.setItem('fallback-atlas-theme', theme); } catch (error) { /* optional preference */ }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('fallback-atlas-local-reports', JSON.stringify(reports));
    } catch (error) {
      // Local persistence is optional; the app remains usable without it.
    }
  }, [reports]);

  useEffect(() => {
    let cancelled = false;
    async function checkApi(refreshReports = false) {
      try {
        const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
        const health = await response.json();
        if (cancelled) return;
        if (response.ok && health.mode === 'shared') {
          setApiMode('shared');
          if (refreshReports) setReportRefreshToken((current) => current + 1);
        } else if (health.mode === 'local') {
          setApiMode('local');
        } else {
          setApiMode('unavailable');
        }
      } catch (error) {
        if (!cancelled) setApiMode('unavailable');
      }
    }
    const handleOnline = () => {
      setBrowserOnline(true);
      checkApi(true);
    };
    const handleOffline = () => {
      setBrowserOnline(false);
      setApiMode('unavailable');
    };
    checkApi();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSharedReports() {
      const requestVersion = sharedReportsVersion.current;
      const params = new URLSearchParams();
      params.set('area', area);
      params.set('latitude', String(mapCenter[1]));
      params.set('longitude', String(mapCenter[0]));
      params.set('radiusKm', String(radiusKm));

      try {
        const response = await fetch('/api/reports?' + params.toString(), {
          headers: { Accept: 'application/json' }
        });
        const payload = await response.json();
        if (cancelled || requestVersion !== sharedReportsVersion.current) return;

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
  }, [area, mapCenter, reportRefreshToken, radiusKm]);

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

  function useMyLocation() {
    if (!navigator.geolocation) { setMessage('This browser does not support location access. Search for your campus area instead.'); return; }
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setMapCenter([position.coords.longitude, position.coords.latitude]);
      setMapZoom(15); setRadiusKm(1); setArea('Within 1 km of you'); setMapLocationLabel('Near you');
      setFormArea('Within 1 km of you'); setShowDemoMarkers(false);
      setMessage('Showing reports within 1 km of your approximate location. Your location stays in this browser unless you submit a report.');
      setLocationPending(false);
    }, (error) => {
      setMessage(error && error.code === 1 ? 'Location permission was not granted.' : 'Your location could not be determined. You can still search an area manually.');
      setLocationPending(false);
    }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 });
  }

  async function runWifiCheck() {
    const selectedNetwork = wifiNetwork === 'Other' ? customWifiNetwork.trim() : wifiNetwork;
    if (!selectedNetwork) { setMessage('Enter the name of the campus Wi-Fi network first.'); return; }
    if (wifiChecking) return;
    setWifiChecking(true); setWifiCheck(null);
    const responseTimes = [];
    for (let index = 0; index < 3; index += 1) {
      const start = window.performance && window.performance.now ? window.performance.now() : Date.now();
      try {
        const response = await fetch('/api/health', { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Endpoint unavailable');
        await response.json();
        const end = window.performance && window.performance.now ? window.performance.now() : Date.now();
        responseTimes.push(Math.max(0, Math.round(end - start)));
      } catch (error) { /* failed probe */ }
    }
    let publicInternetReachable = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    try {
      await fetch('https://connectivitycheck.gstatic.com/generate_204', { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      publicInternetReachable = true;
    } catch (error) {
      publicInternetReachable = false;
    } finally { window.clearTimeout(timeout); }
    const successfulProbes = responseTimes.length;
    const averageLatencyMs = successfulProbes ? Math.round(responseTimes.reduce((sum, n) => sum + n, 0) / successfulProbes) : null;
    let status = 'working';
    if (successfulProbes === 0 && !publicInternetReachable) status = 'down';
    else if (successfulProbes < 3 || !publicInternetReachable || averageLatencyMs > 500) status = 'degraded';
    setWifiCheck({ networkName: selectedNetwork, status, successfulProbes, totalProbes: 3, averageLatencyMs, publicInternetReachable, checkedAt: new Date().toISOString() });
    setWifiChecking(false);
  }

  function shareWifiResult() {
    if (!wifiCheck) return;
    setFormArea(area); setFormService('Campus Wi-Fi'); setFormNetworkName(wifiCheck.networkName); setFormStatus(wifiCheck.status);
    const latency = wifiCheck.averageLatencyMs === null ? 'no successful response-time measurement' : 'average response time ' + wifiCheck.averageLatencyMs + ' ms';
    const note = 'Browser check on ' + wifiCheck.networkName + ': ' + wifiCheck.successfulProbes + '/' + wifiCheck.totalProbes +
      ' Azure endpoint checks succeeded; ' + latency + '; public HTTPS test endpoint ' +
      (wifiCheck.publicInternetReachable ? 'reachable' : 'not reached') + '. This is not a Wi-Fi signal-strength measurement.';
    setFormNote(note.slice(0, 280)); setReportOpen(true);
    setMessage('Review the connection check before submitting it. Shared reports may be seen by other visitors.');
  }

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
    if (formService === 'Campus Wi-Fi' && !formNetworkName.trim()) { setMessage('Enter the Wi-Fi network name before submitting this report.'); return; }
    const preset = findLocalArea(reportArea);
    let reportCenter = null;
    if (preset) reportCenter = preset.center;
    else if (reportArea.toLowerCase() === mapLocationLabel.trim().toLowerCase()) reportCenter = mapCenter;

    const payload = {
      area: reportArea,
      service: formService,
      ...(formService === 'Campus Wi-Fi' ? { networkName: formNetworkName.trim() } : {}),
      status: formStatus,
      note: formNote.trim() || 'Community status report.',
      observedAt: new Date().toISOString(),
      ...(reportCenter ? { latitude: Number(reportCenter[1].toFixed(3)), longitude: Number(reportCenter[0].toFixed(3)) } : {})
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
      sharedReportsVersion.current += 1;
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
        sharedReportsVersion.current += 1;
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
          <span className="brand-copy"><strong>Fallback Atlas</strong><small>Know what still works</small></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#campus-wifi">Campus Wi-Fi</a>
          <a href="#status">Community reports</a>
          <a href="#how-it-works">Our approach</a>
        </nav>
        <div className="topbar-actions">
          <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to day view' : 'Switch to night view'} title={theme === 'dark' ? 'Switch to day view' : 'Switch to night view'}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span>{theme === 'dark' ? 'Day view' : 'Night view'}</span>
          </button>
          <button className="button button-dark top-report" onClick={() => { setFormArea(area); setReportOpen(true); }}>
            <span aria-hidden="true">＋</span> Share a report
          </button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> CAMPUS & COMMUNITY CONNECTIVITY</div>
            <h1>Find a connection that <span>works.</span></h1>
            <p>Wi-Fi problems shouldn't stop your day. Check nearby network reports, test whether the internet is reachable, and help your campus know what's working.</p>
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
          <div className="demo-ribbon"><span className="demo-ribbon-dot" /> Community-powered <span className="ribbon-divider">/</span> Demo reports are clearly labelled</div>
        </section>

        <div className={'api-status-banner api-mode-' + apiMode} role="status" aria-live="polite">
          <span className="api-status-dot" />
          <div className="api-status-copy">
            <strong>
              {!browserOnline ? 'Offline mode — reports stay on this device' :
                apiMode === 'shared' ? 'Community reports are online' :
                  apiMode === 'checking' ? 'Checking community updates…' :
                    apiMode === 'local' ? 'Reports are saved on this device' :
                      'Community updates are temporarily unavailable'}
            </strong>
            <small>
              {!browserOnline
                ? 'The app shell and local report form can work after the first online visit. Map tiles and location search need internet; queued reports have not been shared yet.'
                : apiMode === 'shared'
                  ? 'Your report can help nearby students. Community reports are not official network measurements.'
                  : pendingReports.length
                    ? pendingReports.length + ' report(s) are pending sync and remain on this device only.'
                    : 'Reports are currently saved only on this device, so classmates cannot see them yet.'}
            </small>
          </div>
          {apiMode === 'shared' && pendingReports.length > 0 && (
            <button className="button button-outline sync-button" onClick={syncPendingReports} disabled={syncingPending}>
              {syncingPending ? 'Syncing…' : 'Sync ' + pendingReports.length + ' pending'}
            </button>
          )}
        </div>

        <section className="campus-wifi-panel panel" id="campus-wifi" aria-labelledby="wifi-check-title">
          <div className="campus-wifi-heading">
            <div><span className="section-kicker">CAMPUS CONNECTIVITY</span><h2 id="wifi-check-title">Is your Wi-Fi actually working?</h2><p>Run a quick check on the network you selected. Share the result to help other students.</p></div>
            <span className="campus-badge"><span className="campus-badge-dot" /> SPSU · Udaipur pilot</span>
          </div>
          <div className="campus-wifi-grid">
            <div className="wifi-controls">
              <label>Wi-Fi network you're using<select id="wifi-network" value={wifiNetwork} onChange={(event) => setWifiNetwork(event.target.value)}>
                <option value="SPSU">SPSU</option><option value="SPSU_1">SPSU_1</option><option value="SPSU_MGMT">SPSU_MGMT</option><option value="BYOD">BYOD</option><option value="Other">Another campus Wi-Fi</option>
              </select></label>
              {wifiNetwork === 'Other' && <label>Network name<input value={customWifiNetwork} maxLength={60} onChange={(event) => setCustomWifiNetwork(event.target.value)} placeholder="Enter the network name" /></label>}
              <div className="wifi-control-actions">
                <button type="button" className="button button-teal" onClick={runWifiCheck} disabled={wifiChecking}>{wifiChecking ? 'Checking connection…' : 'Check this connection'} <span aria-hidden="true">→</span></button>
                <button type="button" className="button button-outline" onClick={useMyLocation} disabled={locationPending}>{locationPending ? 'Finding you…' : '⌖ Nearby · 1 km'}</button>
              </div>
              <div className="wifi-radius-row"><label htmlFor="radius-setting">Nearby report range</label><select id="radius-setting" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}><option value={1}>1 km</option><option value={3}>3 km</option><option value={5}>5 km</option></select></div>
              <a className="speedtest-link" href="https://librespeed.org/" target="_blank" rel="noreferrer">Need download / upload speed? Try LibreSpeed ↗</a>
            </div>
            <div className="wifi-results" aria-live="polite">
              {!wifiCheck && !wifiChecking && <div className="wifi-empty-state"><span className="wifi-empty-icon" aria-hidden="true">⌁</span><strong>Your connection, checked in seconds.</strong><p>We test the Fallback Atlas service three times and try one small public HTTPS request. No passwords or Wi-Fi credentials are collected.</p></div>}
              {wifiChecking && <div className="wifi-running" role="status"><span className="wifi-loader" /><strong>Checking {wifiNetwork === 'Other' ? (customWifiNetwork || 'your network') : wifiNetwork}…</strong><p>Testing response time and public internet reachability.</p></div>}
              {wifiCheck && !wifiChecking && <>
                <div className="wifi-result-title"><div><span className="section-kicker">RESULT · {wifiCheck.networkName}</span><h3 className={'wifi-result-status wifi-status-' + wifiCheck.status}>{wifiCheck.status === 'working' ? 'Connection looks healthy' : wifiCheck.status === 'degraded' ? 'Connection may be unstable' : 'No connection detected'}</h3></div><span className={'wifi-status-symbol wifi-status-' + wifiCheck.status}>{wifiCheck.status === 'working' ? '✓' : wifiCheck.status === 'degraded' ? '≈' : '!'}</span></div>
                <div className="wifi-metrics"><article><span>Average response</span><strong>{wifiCheck.averageLatencyMs === null ? '—' : wifiCheck.averageLatencyMs + ' ms'}</strong></article><article><span>App checks</span><strong>{wifiCheck.successfulProbes}/{wifiCheck.totalProbes}</strong></article><article><span>Public test</span><strong>{wifiCheck.publicInternetReachable ? 'Reached' : 'Not reached'}</strong></article></div>
                <p className="wifi-result-note">{wifiCheck.publicInternetReachable ? 'A public internet test endpoint responded. This is a lightweight reachability check, not a full speed test.' : 'The public test endpoint did not respond. It may be blocked by the network, so this alone does not prove all internet access is down.'}</p>
                <button type="button" className="button button-outline share-check-button" onClick={shareWifiResult}>Share this result with nearby students ↗</button>
              </>}
            </div>
          </div>
          <p className="wifi-disclosure"><span aria-hidden="true">ⓘ</span> Your browser cannot read the connected Wi-Fi name or radio signal strength. Select the network manually. Location access is optional; only a report you choose to submit can share an approximate location. This check measures access to this app and one public endpoint, not all websites.</p>
        </section>

        {message && <div className="notice" role="status"><span>ⓘ</span><p>{message}</p><button aria-label="Dismiss message" onClick={() => setMessage('')}>×</button></div>}

        <section className="status-overview" id="status">
          <div className="section-heading">
            <div><span className="section-kicker">LOCAL CONNECTIVITY · COMMUNITY REPORTS</span><h2>{area}</h2></div>
            <span className="sample-tag"><span /> {hasSampleReports ? 'DEMO DATA' : sharedReportCount ? 'SHARED REPORTS' : localReports.length ? 'LOCAL REPORTS' : 'NO REPORTS'}</span>
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
              <div><span className="section-kicker">NEARBY CONNECTIVITY</span><h3>Connectivity around {mapLocationLabel}</h3></div>
              <span className="preview-label">{showDemoMarkers ? 'DEMO MARKERS' : 'LOCATION VIEW'}</span>
            </div>
            <InteractiveMap center={mapCenter} zoom={mapZoom} areaLabel={mapLocationLabel} showDemoMarkers={showDemoMarkers} reports={areaReports.filter((report) => !report.demo)} />
            <div className="map-footer"><span className="map-footer-icon">ⓘ</span><span>{showDemoMarkers ? 'Sample markers are shown only for the Udaipur prototype. They are not verified live reports.' : 'No sample markers are shown for this searched location. Reports appear only when matching reports exist.'} Map by <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · data © OpenStreetMap contributors.</span></div>
          </div>

          <aside className="panel updates-panel">
            <div className="panel-heading updates-heading">
              <div><span className="section-kicker">CAMPUS & COMMUNITY</span><h3>Recent reports</h3></div>
              <div className="updates-heading-actions">
                <button className="refresh-button" type="button" onClick={() => setReportRefreshToken((current) => current + 1)} aria-label="Refresh community reports" title="Fetch the latest reports">↻ Refresh</button>
                <span className="count-bubble" aria-label={areaReports.length + ' visible reports'}>{areaReports.length}</span>
              </div>
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
                <div className="empty-state"><span>⌁</span><strong>No reports for this location yet</strong><p>Try a nearby area or submit the first report. Reports can be shared once the backend is configured.</p></div>
              ) : areaReports.slice(0, 5).map((report) => (
                <div className="service-status-item" key={report.id}>
                  <ServiceIcon service={report.service} />
                  <div className="service-status-main">
                    <strong>{report.service}</strong>
                    <small>{report.area} · {report.demo ? 'Demo only' : report.shared ? 'Shared community report' : 'Saved on this device'}</small>
                    <span className={'freshness-pill ' + freshnessClass(report)}>{freshnessLabel(report)} · {timeAgo(report)}</span>
                  </div>
                  <StatusPill status={report.status} />
                </div>
              ))}
              <div className="confidence-note"><span>↗</span><div><strong>Evidence freshness</strong><small>{evidenceSummary}</small></div></div>
            </div>}
            {activeView === 'feed' && <div className="report-feed">
              {visibleReports.length === 0 ? <div className="empty-state"><span>⌁</span><strong>No reports in this filter</strong><p>Try a different service or submit a local example.</p></div> : visibleReports.map((report) => <article className="feed-item" key={report.id}><div className="feed-item-top"><strong>{report.service}</strong><StatusPill status={report.status} /></div><span className="feed-area">⌖ {report.area}</span><p>{report.note}</p><div className="feed-metadata"><span className={'freshness-pill ' + freshnessClass(report)}>{freshnessLabel(report)} · {timeAgo(report)}</span><small>{report.demo ? 'Demo only' : report.shared ? 'Shared community report' : 'Local only · pending sync'}</small></div></article>)}
            </div>}
            <button className="button button-outline full-button" onClick={() => { setFormArea(area); setReportOpen(true); }}><span>＋</span> Share a report</button>
            <p className="panel-disclaimer">{hasSampleReports ? 'Demo data is illustrative. ' : ''}{apiMode === 'shared' ? 'Shared reports are community-submitted, not official outage confirmations.' : 'Local reports are saved in this browser and are not shared yet.'}</p>
          </aside>
        </section>

        <section className="how-section" id="how-it-works">
          <div><span className="section-kicker">DESIGNED FOR OUTAGES</span><h2>Know what to try next.</h2><p>Fallback Atlas brings campus Wi-Fi checks and community reports together, so students can compare what is working nearby without sharing passwords or personal details.</p></div>
          <div className="how-steps">
            <article><span>01</span><strong>Find nearby options</strong><p>Use an optional 1 km location view to find recent reports around you.</p></article>
            <article><span>02</span><strong>Check your connection</strong><p>Measure response time and check whether a public internet endpoint responds.</p></article>
            <article><span>03</span><strong>Help your campus</strong><p>Share a network result or outage observation for others to compare.</p></article>
          </div>
        </section>
      </main>

      <footer className="footer"><a className="footer-brand" href="#home"><SignalMark /> fallback atlas</a><span>Built for campus and community resilience</span><span className="footer-status"><i /> {!browserOnline ? 'Offline · local queue available' : apiMode === 'shared' ? 'Shared reports online' : apiMode === 'checking' ? 'Checking backend' : 'Local-only mode'}</span></footer>

      {reportOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportOpen(false); }}>
        <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <div className="modal-heading"><div><span className="section-kicker">COMMUNITY UPDATE</span><h2 id="report-title">Report local status</h2></div><button className="modal-close" aria-label="Close report form" onClick={() => setReportOpen(false)}>×</button></div>
          <div className="modal-demo-note"><strong>{apiMode === 'shared' ? 'Community report' : 'Local fallback enabled'}</strong><span>{apiMode === 'shared' ? 'Your report will be shared with visitors near this area. Do not include personal information.' : 'Until storage is configured, this report stays in your browser and will be marked pending sync.'}</span></div>
          <form onSubmit={submitReport} className="report-form">
            <label>Area or neighbourhood<input required value={formArea} onChange={(event) => setFormArea(event.target.value)} placeholder="e.g. Fatehpura, Udaipur" /></label>
            <label>Infrastructure<select value={formService} onChange={(event) => setFormService(event.target.value)}>{serviceOptions.map((service) => <option key={service}>{service}</option>)}</select></label>
            {formService === 'Campus Wi-Fi' && <label>Wi-Fi network name<input required maxLength="60" value={formNetworkName} onChange={(event) => setFormNetworkName(event.target.value)} placeholder="e.g. SPSU_1 or BYOD" /><span className="field-hint">Never enter the Wi-Fi password.</span></label>}
            <fieldset><legend>What's the current status?</legend><div className="status-choice-list">{statusOptions.map((option) => <label key={option.value} className={'status-choice choice-' + option.value}><input type="radio" name="status" value={option.value} checked={formStatus === option.value} onChange={(event) => setFormStatus(event.target.value)} /><span className="choice-dot" /><span><strong>{option.label}</strong><small>{option.hint}</small></span></label>)}</div></fieldset>
            <label>What did you observe? <span className="optional-label">Optional</span><textarea rows="3" maxLength="280" value={formNote} onChange={(event) => setFormNote(event.target.value)} placeholder="Share a brief, non-personal observation." /></label>
            <div className="privacy-note"><span>⌑</span><p>Don't include phone numbers, names, exact home addresses or other personal details.</p></div>
            <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setReportOpen(false)}>Cancel</button><button type="submit" className="button button-teal" disabled={reportSubmitting}>{reportSubmitting ? 'Submitting…' : 'Submit report'} <span>→</span></button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

export default App;
