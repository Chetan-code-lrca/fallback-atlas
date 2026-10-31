# Public-launch readiness: Fallback Atlas

## Current release position

Fallback Atlas is a prototype suitable for local demonstrations and a carefully controlled pilot. It is **not ready for unrestricted public shared reporting**.

The HTTP routes for reports and Wi-Fi scans are anonymous. When REPORTS_STORAGE_CONNECTION_STRING is configured on the Static Web App, anyone who can reach the public site can attempt to submit shared data. The current per-area thresholds are pilot safeguards, not access control.

For a public demo that does not need shared records, leave REPORTS_STORAGE_CONNECTION_STRING unset. The health route reports local mode and shared writes return storage_not_configured; outage reports can remain in each browser's local queue. Do not describe local queue entries as shared reports.

A separate staging URL is not private by itself. Before putting shared storage behind a staging site, add and verify an access-control layer that the API actually enforces.

## What the code currently does

### Report visibility and storage

- GET /api/reports applies a rolling 30-day createdAt query window and reads at most 250 recent report rows before filtering by area/radius and optional service.
- No scheduled report cleanup, automatic table deletion, or report deletion endpoint is implemented.
- A report outside the feed window is not returned by that query, but its entity may still exist in Azure Table Storage.

### Wi-Fi visibility and storage

- GET /api/wifi-scans reads at most 1,000 rows from a rolling 15-minute createdAt window, then filters by observedAt and the requested 1–5 km radius.
- Old observations disappear from the nearby feed but are not physically deleted from the WifiScans table by the current application.
- SSIDs, signal metadata, timestamps, and approximate coordinates are stored. They can identify nearby networks even though the scanners omit BSSIDs/MAC addresses, passwords, and device IDs.

### Abuse protection

- All API routes use anonymous access.
- Reports are limited to 30 submissions per normalized area per rolling 10-minute window.
- Wi-Fi scan submissions are limited to 250 observation rows per area per rolling 10-minute window; each request can contain up to 40 observations.
- Area labels are user-controlled, so changing an area label can bypass area-specific counters.
- Each limit uses a read/count followed by a write. Concurrent requests can race and exceed the intended threshold.
- There is no account-based quota, reliable global per-IP limit, reputation model, CAPTCHA, moderation queue, or report takedown process.

## Recommended rollout phases

### Phase 0 — Local/demo mode

- Keep shared storage unconfigured on a public demonstration deployment unless shared data is genuinely required.
- Label local records and sample map markers accurately; never call them verified or shared.
- Do not invite public submissions to a configured anonymous shared API.

### Phase 1 — Restricted staging

- Create a separate staging environment and use a dedicated non-production Storage account.
- Add authentication or an access gate, and enforce authorization on the API routes themselves rather than only hiding frontend controls.
- Restrict the pilot to named testers; obtain explicit consent before publishing SSIDs and approximate coordinates.
- Monitor report and Wi-Fi table growth, request volume, Azure costs, and failures during the trial.

### Phase 2 — Public-service hardening

Complete and verify the following before any public write access:
- Implement a documented retention policy and an automated, observable physical deletion process for expired report and Wi-Fi entities.
- Replace per-area-only counters with global and per-client abuse controls. Make counters safe under concurrent requests and set request/body-size limits.
- Add moderation, abuse reporting, and a way to quarantine or remove misleading, harmful, or privacy-invasive submissions.
- Define how duplicate, stale, suspicious, and conflicting reports are labelled; do not imply independent verification where none exists.
- Review storage permissions, credential rotation, backup/recovery, error handling, and privacy-safe operational logs.
- Add alerts for traffic spikes, storage growth, failures, and Azure cost thresholds. Remember that budget alerts warn; they do not stop resources.

### Phase 3 — Limited public beta

- Publish a clear privacy notice explaining the exact data collected, why it is collected, who can see it, and when it is deleted.
- Explain that reports are community observations and Wi-Fi signal does not prove internet availability.
- Provide a visible way to report abuse or request removal of sensitive network information.
- Start with a limited region and monitored user cohort. Review moderation load, false reports, and cost before expanding.

### Phase 4 — Wider release

Proceed only after a security review, retention verification, abuse/rate-limit testing under concurrent load, backup recovery exercise, accessibility/mobile testing, and a documented support/incident process.

## Go/no-go checklist

Do not enable unrestricted shared writes until all required items are checked:

- [ ] API authorization or a verified global abuse-control design is deployed and tested.
- [ ] Rate limits cannot be bypassed by changing area labels and remain effective under concurrent requests.
- [ ] Request size and observation-count limits are enforced at the API boundary.
- [ ] Physical deletion is implemented, monitored, tested, and matches the published retention policy.
- [ ] Moderation, abuse reporting, and data takedown procedures are operational.
- [ ] Privacy notice and consent disclosures explain SSID, approximate location, notes, visibility, and deletion.
- [ ] Monitoring, storage-growth alerts, cost alerts, backup, and recovery have been tested.
- [ ] A security review and limited-beta exercise have been completed.

## Operational decision

Until the go/no-go items are satisfied, keep the service in local/demo mode or use a properly restricted staging environment. Do not present the current anonymous shared API as production-ready.
