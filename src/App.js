import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import InteractiveMap from './InteractiveMap';

const demoReports = [
  { id: 'demo-1', area: 'Vaishali Nagar', service: 'Mobile data', status: 'degraded', note: 'Intermittent data connection reported in this sample.', time: 'Example report', demo: true },
  { id: 'demo-2', area: 'Civil Lines', service: 'Fixed broadband', status: 'working', note: 'Broadband shown as available in this sample.', time: 'Example report', demo: true },
  { id: 'demo-3', area: 'Malviya Nagar', service: 'Power', status: 'down', note: 'Power interruption shown for demonstration only.', time: 'Example report', demo: true },
  { id: 'demo-4', area: 'Mansarovar', service: 'Mobile data', status: 'working', note: 'Mobile data shown as available in this sample.', time: 'Example report', demo: true }
];

const serviceOptions = ['Mobile data', 'Fixed broadband', 'Power'];
const statusOptions = [
  { value: 'working', label: 'Working', hint: 'Available as expected' },
  { value: 'degraded', label: 'Degraded', hint: 'Slow or unreliable' },
  { value: 'down', label: 'Down', hint: 'Not working' }
];

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
  const [area, setArea] = useState('Jaipur, Rajasthan');
  const [searchValue, setSearchValue] = useState('');
  const [activeView, setActiveView] = useState('map');
  const [activeFilter, setActiveFilter] = useState('All updates');
  const [reportOpen, setReportOpen] = useState(false);
  const [reports, setReports] = useState(() => {
    try {
      const saved = window.localStorage.getItem('fallback-atlas-local-reports');
      return saved ? JSON.parse(saved) : demoReports;
    } catch (error) {
      return demoReports;
    }
  });
  const [formArea, setFormArea] = useState('Jaipur, Rajasthan');
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

  const visibleReports = useMemo(() => {
    if (activeFilter === 'All updates') return reports;
    return reports.filter((report) => report.service === activeFilter);
  }, [reports, activeFilter]);

  const localReports = reports.filter((report) => !report.demo);
  const counts = {
    working: demoReports.filter((report) => report.status === 'working').length,
    degraded: demoReports.filter((report) => report.status === 'degraded').length,
    down: demoReports.filter((report) => report.status === 'down').length
  };

  function searchArea(event) {
    event.preventDefault();
    const value = searchValue.trim();
    if (!value) return;
    setArea(value);
    setFormArea(value);
    setMessage('Area label updated. The map remains centered on Jaipur until area lookup is connected; sample markers are not verified reports.');
    setSearchValue('');
  }

  function submitReport(event) {
    event.preventDefault();
    const report = {
      id: 'local-' + Date.now(),
      area: formArea.trim() || area,
      service: formService,
      status: formStatus,
      note: formNote.trim() || 'Community status report.',
      time: 'Just now · saved on this device',
      demo: false
    };
    setReports((current) => [report, ...current]);
    setArea(report.area);
    setActiveView('feed');
    setActiveFilter('All updates');
    setReportOpen(false);
    setFormNote('');
    setMessage('Report saved on this device only. It has not been sent to a server.');
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
              <input id="area-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search a neighbourhood or PIN code" />
              <button className="button button-teal" type="submit">Search area</button>
            </form>
            <div className="hero-footnote"><span aria-hidden="true">⌖</span> Searching changes the viewed area label; live geographic search is not connected yet.</div>
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
            <div><span className="section-kicker">AREA SNAPSHOT</span><h2>{area}</h2></div>
            <span className="sample-tag"><span /> SAMPLE DATA</span>
          </div>
          <div className="summary-grid">
            <article className="summary-card summary-working"><div className="summary-icon">✓</div><div><span>Working in examples</span><strong>{counts.working}</strong></div><span className="summary-arrow">↗</span></article>
            <article className="summary-card summary-degraded"><div className="summary-icon">≈</div><div><span>Degraded in examples</span><strong>{counts.degraded}</strong></div><span className="summary-arrow">↗</span></article>
            <article className="summary-card summary-down"><div className="summary-icon">!</div><div><span>Down in examples</span><strong>{counts.down}</strong></div><span className="summary-arrow">↗</span></article>
          </div>
        </section>

        <section className="workspace">
          <div className="panel map-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">LOCAL OVERVIEW</span><h3>Interactive map around Jaipur</h3></div>
              <span className="preview-label">ILLUSTRATIVE VIEW</span>
            </div>
            <InteractiveMap />
            <div className="map-footer"><span className="map-footer-icon">ⓘ</span><span>OpenStreetMap tiles are interactive. Markers are illustrative examples, not verified reports. No device GPS is collected.</span></div>
          </div>

          <aside className="panel updates-panel">
            <div className="panel-heading updates-heading">
              <div><span className="section-kicker">COMMUNITY PULSE</span><h3>Recent reports</h3></div>
              <span className="count-bubble">{reports.length}</span>
            </div>
            <div className="filter-row" aria-label="Filter reports">
              {['All updates', ...serviceOptions].map((filter) => <button key={filter} className={'filter-chip' + (activeFilter === filter ? ' active' : '')} onClick={() => setActiveFilter(filter)}>{filter}</button>)}
            </div>
            <div className="view-toggle" role="tablist" aria-label="Updates view">
              <button role="tab" aria-selected={activeView === 'map'} className={activeView === 'map' ? 'selected' : ''} onClick={() => setActiveView('map')}>Overview</button>
              <button role="tab" aria-selected={activeView === 'feed'} className={activeView === 'feed' ? 'selected' : ''} onClick={() => setActiveView('feed')}>Report feed <span>{localReports.length > 0 ? localReports.length : ''}</span></button>
            </div>
            {activeView === 'map' && <div className="service-status-list">
              <div className="service-status-item"><ServiceIcon service="Mobile data" /><div className="service-status-main"><strong>Mobile data</strong><small>Example · Vaishali Nagar</small></div><StatusPill status="degraded" /></div>
              <div className="service-status-item"><ServiceIcon service="Fixed broadband" /><div className="service-status-main"><strong>Fixed broadband</strong><small>Example · Civil Lines</small></div><StatusPill status="working" /></div>
              <div className="service-status-item"><ServiceIcon service="Power" /><div className="service-status-main"><strong>Power</strong><small>Example · Malviya Nagar</small></div><StatusPill status="down" /></div>
              <div className="confidence-note"><span>↗</span><div><strong>Confidence & freshness</strong><small>Evidence scoring will be added with the reporting API.</small></div></div>
            </div>}
            {activeView === 'feed' && <div className="report-feed">
              {visibleReports.length === 0 ? <div className="empty-state"><span>⌁</span><strong>No reports in this filter</strong><p>Try a different service or submit a local example.</p></div> : visibleReports.map((report) => <article className="feed-item" key={report.id}><div className="feed-item-top"><strong>{report.service}</strong><StatusPill status={report.status} /></div><span className="feed-area">⌖ {report.area}</span><p>{report.note}</p><small>{report.time}{report.demo ? ' · demo' : ' · local only'}</small></article>)}
            </div>}
            <button className="button button-outline full-button" onClick={() => { setFormArea(area); setReportOpen(true); }}><span>＋</span> Add a community report</button>
            <p className="panel-disclaimer">Local prototype only · reports aren't shared with other people yet.</p>
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
            <label>Area or neighbourhood<input required value={formArea} onChange={(event) => setFormArea(event.target.value)} placeholder="e.g. Civil Lines, Jaipur" /></label>
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
