# Fallback Atlas architecture

## System overview

Fallback Atlas is a React progressive web application hosted by Azure Static Web Apps. The frontend and HTTP API are deployed together. The API runs as Azure Static Web Apps managed Functions on Node.js 22 and optionally persists data in two Azure Table Storage tables.

~~~mermaid
flowchart TB
  Visitor[Browser user] --> Web[React PWA]
  Web --> Map[MapLibre GL JS]
  Map --> Tiles[OpenFreeMap styles and tiles]
  Web --> Search[OpenStreetMap Nominatim]
  Web -->|GET/POST reports| API[Static Web Apps managed Functions]
  Web -->|GET/POST Wi-Fi scans| API
  Android[Android companion app] -->|consent-confirmed scan| API
  Windows[Windows PowerShell scanner] -->|consent-confirmed scan| API
  API --> Validate[Validate, normalize and apply pilot limits]
  Validate --> Reports[(Azure Table Storage: Reports)]
  Validate --> Wifi[(Azure Table Storage: WifiScans)]
  Web --> Local[Browser local report queue]
  Local -->|retry when online| API
~~~

## Components and responsibilities

| Component | Responsibility | Important boundary |
| --- | --- | --- |
| React PWA (src/App.js) | Search, report form, local queue, filters, theme and status UI | Browser data is untrusted; local-only records must not be described as shared |
| MapLibre (src/InteractiveMap.js) | Interactive map, demo markers, community-report markers and observed Wi-Fi markers | Basemap and map assets are external network dependencies |
| Nominatim (src/geocoding.js) | User-triggered place search and a small browser cache | Public endpoint policy applies; client-side throttling is not a global quota |
| Azure Functions (api/src/index.js) | Health, report and Wi-Fi scan HTTP routes | Anonymous pilot endpoints validate input but are not a production abuse boundary |
| Reports table | Community outage reports | Stores user-supplied area, service, status, note, timestamps and optional approximate coordinates |
| WifiScans table | Recent device-observed Wi-Fi metadata | Stores SSID, signal, frequency, security, timestamps and rounded coordinates |
| Android scanner | Reads Wi-Fi scan results through Android WifiManager | Upload requires explicit confirmation and a fresh scan |
| Windows scanner | Starts a Windows WLAN scan and parses netsh results | Signal percentage is converted to a clearly identified rough dBm estimate |

## Outage report flow

1. The user selects a place and enters a service status.
2. The frontend submits the report to POST /api/reports.
3. The API validates the object, area, service, status, note length, optional coordinates and observation timestamp.
4. The API applies a per-normalized-area submission threshold, assigns a server timestamp and opaque ID, and writes the entity to the Reports table.
5. Shared reports are loaded with GET /api/reports. The query returns up to 250 recent rows from a 30-day window before area/radius and optional service filtering.
6. When shared storage is not configured or unavailable, the frontend retains the report locally and presents it as pending/local rather than shared.

The health route (GET /api/health) reports whether shared storage is configured and reachable. It does not validate the correctness of submitted community observations.

## Wi-Fi observation flow

1. The Android companion obtains results from Android's Wi-Fi scan API. The Windows companion requests a fresh WLAN scan and reads the visible network list.
2. The scanner shows the user the networks that would be shared. The user selects entries and explicitly confirms upload.
3. The scanners submit the area label, approximate coordinates and selected network observations to POST /api/wifi-scans.
4. The API validates SSID length, signal range, frequency range, timestamp freshness and duplicate SSID/frequency pairs. Coordinates are rounded to three decimal places before storage.
5. The API stores observations in the WifiScans table. The nearby feed (GET /api/wifi-scans) returns observations no older than 15 minutes and within the requested 1–5 km radius.

Android provides measured RSSI. Windows provides a signal percentage; the app's conversion to dBm is an estimate, not measured RSSI. Neither scanner verifies internet access. SSIDs and approximate location can identify nearby networks, so users must not upload private network names or locations they are not authorised to share.

## Storage and retention behavior

- REPORTS_STORAGE_CONNECTION_STRING is a server-side Static Web Apps application setting. It must never be embedded in frontend code or committed to the repository.
- The API lazily creates the Reports and WifiScans tables on first connection.
- Report reads use a rolling 30-day filter and cap the query result at 250 rows.
- Wi-Fi reads filter observations to the most recent 15 minutes and cap the in-memory scan query at 1,000 rows.
- These windows govern visibility/query results. They do not physically delete expired entities from Azure Table Storage. A scheduled retention cleanup has not yet been implemented.

The current per-area limits are pilot-level safeguards only. Because area labels are user-controlled, changing labels can evade an area-specific counter; concurrent submissions can also race the read-count-write sequence. They are not a reliable global rate limiter.

## Offline behavior

The service worker caches the same-origin app shell and static assets. It deliberately does not cache /api/ responses or third-party map/geocoder requests. The browser can reopen the app shell after an online visit and queue a report locally, but map tiles, place search and shared report APIs still require connectivity. Local queue entries are not proof of successful server submission.

## Trust boundaries and privacy

- Browser form fields, API request bodies and stored user submissions are untrusted.
- API validation is repeated on the server; frontend checks are only a usability aid.
- Azure storage credentials remain server-side.
- Map tile providers and Nominatim receive the network requests needed to render maps and resolve user-entered search queries.
- Community reports are not official or independently verified outage measurements.
- Wi-Fi signal strength describes radio reception, not internet availability or throughput.
- The scanners are designed not to upload BSSIDs/MAC addresses, passwords or device identifiers. The submitted SSID, approximate coordinates and timestamps can still be sensitive.
- Anonymous public reporting currently lacks identity-based reputation, moderation queues and a strong global anti-abuse layer.

## Deployment

The Azure Static Web Apps workflow builds the root React application, deploys the build/ output, and deploys the api/ directory as managed Functions. The API runtime is configured as Node.js 22 in staticwebapp.config.json. The Android workflow independently builds a debug APK using JDK 17 and Android SDK Platform 35.


## Android connectivity agent (restricted pilot)

The Android companion can opt in to monitor Wi-Fi and cellular network capability changes while its activity is visible. It maps Android's internet/validated capabilities to `working`, `degraded` or `down` observations. It does not request location for this monitor and does not inspect SSIDs, BSSIDs, device IDs or traffic contents.

Each observation contains only a public area label, transport (`wifi` or `mobile-data`), status, validated-internet boolean and timestamp. When offline, the app keeps one pending observation per transport in local preferences and attempts upload after a validated network returns. Monitoring unregisters callbacks when the activity leaves the foreground; this is deliberately not an always-on background service.

The API accepts the observation only when `CONNECTIVITY_INGEST_ENABLED=true` and the area is included in `CONNECTIVITY_ALLOWED_AREAS`. It stores a replaceable row keyed by (normalised area, transport) in the existing Storage account's `ConnectivityStatus` table. Thus each configured pilot area has at most two rows. The website hides observations older than 15 minutes. This visibility window is not a physical deletion guarantee, although overwrite-only storage bounds growth.

The endpoint is anonymous. The allowlist reduces the write surface and cost exposure but does not authenticate the Android binary or prove that a report is genuine. The pilot UI must label these as device observations, not official or independently verified provider measurements.
