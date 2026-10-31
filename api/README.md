# Fallback Atlas HTTP API

This directory contains the Node.js 22 Azure Functions v4 HTTP API deployed as the managed API for the Azure Static Web App. Routes are anonymous because this prototype is designed for a small pilot. Do not treat the current controls as sufficient for an unrestricted public launch.

## Routes

| Method and route | Purpose | Storage required |
| --- | --- | --- |
| GET /api/health | Reports whether shared storage is configured and reachable | No, for local mode; yes to report shared mode |
| GET /api/reports | Reads recent outage reports by area and/or distance | Yes |
| POST /api/reports | Validates and stores a community outage report | Yes |
| GET /api/wifi-scans | Reads recent nearby Wi-Fi observations | Yes |
| POST /api/wifi-scans | Validates and stores explicitly shared scanner observations | Yes |
| GET /api/connectivity-observations | Reads recent Android connectivity status for an allowlisted area | Yes, once the pilot is enabled |
| POST /api/connectivity-observations | Upserts the latest Wi-Fi/mobile-data internet status | Yes, restricted pilot only |

All routes accept and return JSON. The API does not provide user authentication. Data submitted to shared endpoints is visible to website users according to the corresponding feed filters.

## Environment variables

Configure these values in Azure Static Web Apps application settings for deployment, or in api/local.settings.json for local Functions development.

| Variable | Required | Description |
| --- | --- | --- |
| FUNCTIONS_WORKER_RUNTIME | Yes for local Functions | Set to node. Azure manages the runtime setting in the deployed service. |
| AzureWebJobsStorage | Local Functions host | Azure Functions host storage. Use an Azurite development connection for local host storage, or an authorised Storage account connection string. |
| REPORTS_STORAGE_CONNECTION_STRING | Optional for local-only mode; required for shared data | Server-side Azure Table Storage connection string used for Reports, WifiScans and (only when enabled) ConnectivityStatus. |
| CONNECTIVITY_INGEST_ENABLED | Optional; defaults to disabled | Set to the exact string `true` only when starting a controlled Android connectivity pilot. |
| CONNECTIVITY_ALLOWED_AREAS | Required to enable ingestion | Semicolon-separated exact public area labels. Example: `Udaipur, Rajasthan;Udaipur City`. Only these normalised labels can write connectivity status. |

Never put a storage connection string in frontend configuration, React environment variables, source code, screenshots, or committed files. The repository ignores api/local.settings.json; start from api/local.settings.example.json and keep the populated local file untracked.

### Storage behavior

The API creates the Reports and WifiScans tables when it first connects. The ConnectivityStatus table is not created while the connectivity pilot is disabled; after enabling, it is created on the first allowlisted read or write. If REPORTS_STORAGE_CONNECTION_STRING is missing, GET /api/health returns mode=local and shared storage endpoints return HTTP 503. The frontend can preserve outage reports in its browser-local queue; these reports are not shared with other visitors.

Connectivity ingestion is disabled by default. The feature flag and area allowlist are a pilot boundary, not authentication: a client can still spoof a report for an allowlisted area. Keep the allowlist small, monitor writes and costs, and do not treat the endpoint as ready for unrestricted public traffic.

## Local development

### Prerequisites

- Node.js 22 and npm.
- Azure Static Web Apps CLI (SWA CLI).
- Azure Functions Core Tools v4. The SWA CLI can install the Functions Core Tools when needed.
- Azurite if you want a local AzureWebJobsStorage emulator. Alternatively, use an authorised development storage account. Do not use production credentials for local experiments.

### Install

From the repository root:

```bash
npm ci
cd api
npm ci
cd ..
npm install --global @azure/static-web-apps-cli
```

Create the local Functions settings file:

```bash
cp api/local.settings.example.json api/local.settings.json
```

The example leaves REPORTS_STORAGE_CONNECTION_STRING empty. This is intentional for local-only development: health reports local mode and shared report/Wi-Fi writes are unavailable. To test shared persistence, set this variable to a dedicated development storage account connection string in the ignored local.settings.json file. Do not point tests at production data.

The example uses UseDevelopmentStorage=true for AzureWebJobsStorage. Start Azurite before launching the local Functions host, or replace that value with an authorised development storage connection string.

### Run the integrated website and API

Start the React development server in terminal 1:

```bash
npm start
```

In terminal 2, from the repository root:

```bash
swa start http://localhost:3000 --api-location ./api
```

Open http://localhost:4280. The Static Web Apps CLI provides a same-origin local route for /api requests and starts the Functions API from the api directory. Opening the React dev server directly at port 3000 does not provide that /api routing.

For current CLI behavior, see the [Microsoft local development guide](https://learn.microsoft.com/azure/static-web-apps/local-development) and [SWA CLI reference](https://learn.microsoft.com/azure/static-web-apps/static-web-apps-cli).

### Tests and build

From the repository root:

```bash
npm test -- --watchAll=false --runInBand
npm run build
node --test api/test/*.test.js
```

For the API package's own test script:

```bash
cd api
npm test
```

Install dependencies in the api directory before running the local Functions host. The frontend and API dependencies are managed separately.

## Endpoint reference

### GET /api/health

Returns the current storage mode.

Example local response:

```json
{
  "status": "ok",
  "mode": "local",
  "sharedReportsConfigured": false,
  "message": "The frontend works, but shared report storage has not been configured."
}
```

When storage is configured and reachable, mode is shared. If configured storage cannot be reached, the route returns HTTP 503 with mode=unavailable. Add ?diagnostics=1 to request bounded diagnostic fields; do not publish diagnostic output if it contains environment-specific information.

### GET /api/reports

Required query parameter: area (up to 120 characters).

Optional query parameters:
- latitude and longitude must be supplied together and must be valid geographic coordinates.
- radiusKm defaults to 10 and is clamped to 1–50 km. It is used when coordinates are supplied.
- service can be Mobile data, Fixed broadband, or Power.

Example:

```http
GET /api/reports?area=Udaipur%2C%20Rajasthan&latitude=24.58&longitude=73.68&radiusKm=10&service=Power
```

The response contains mode, radiusKm, retentionDays and a reports array. It returns reports matching the normalized area or the requested radius, optionally filtered by service. The query reads at most 250 recent records from the rolling 30-day window.

### POST /api/reports

Submit a community observation.

Example body:

```json
{
  "area": "Udaipur, Rajasthan",
  "service": "Power",
  "status": "degraded",
  "note": "Intermittent power near the public library.",
  "observedAt": "2026-10-31T14:30:00.000Z",
  "latitude": 24.58,
  "longitude": 73.68
}
```

Fields:
- area: required string, maximum 120 characters.
- service: required; Mobile data, Fixed broadband, or Power.
- status: required; working, degraded, or down.
- note: optional string, maximum 280 characters.
- observedAt: optional parseable timestamp; defaults to server time and cannot be more than five minutes in the future or older than 30 days.
- latitude and longitude: optional pair of numeric coordinates within valid geographic ranges. The web form includes them only after explicit user opt-in and rounds them to three decimal places before sending.

Success returns HTTP 201 with mode=shared and the stored report. The current pilot threshold is 30 reports per normalized area in a rolling 10-minute window. This is not a global abuse limit; area labels are user-controlled and concurrent submissions may race.

### GET /api/wifi-scans

Required query parameters: latitude and longitude.

Optional query parameter:
- radiusKm defaults to 1 and is clamped to 1–5 km.

Example:

```http
GET /api/wifi-scans?latitude=24.58&longitude=73.68&radiusKm=3
```

The response contains mode, radiusKm, freshnessMinutes, observationCount and a networks array. Only observations no older than 15 minutes and within the requested radius are returned. Duplicate network names are grouped by frequency for display.

### POST /api/wifi-scans

Submit a scan snapshot only after the device user has reviewed the selected networks and explicitly consented to upload.

Example body:

```json
{
  "area": "Udaipur, Rajasthan",
  "latitude": 24.58,
  "longitude": 73.68,
  "networks": [
    {
      "networkName": "campus-guest",
      "signalDbm": -61,
      "signalType": "android-rssi",
      "frequencyMhz": 5180,
      "security": "WPA2",
      "observedAt": "2026-10-31T14:30:00.000Z"
    },
    {
      "networkName": "library-wifi",
      "signalDbm": -72,
      "signalPercent": 56,
      "signalType": "windows-percent-estimate",
      "frequencyMhz": 2437,
      "security": "WPA2",
      "observedAt": "2026-10-31T14:30:00.000Z"
    }
  ]
}
```

Fields:
- area: required public area label, maximum 120 characters.
- latitude and longitude: required valid coordinates. The API rounds them to three decimal places before storage.
- networks: required array containing 1–40 observations.
- each networkName: required visible SSID, maximum 32 characters. Empty/hidden names are rejected.
- signalDbm: required integer from -110 to -10.
- signalType: android-rssi by default, or windows-percent-estimate for Windows observations.
- signalPercent: required integer 0–100 for windows-percent-estimate observations.
- frequencyMhz: required integer from 2400 to 7125.
- security: optional label; defaults to Unknown.
- observedAt: required parseable timestamp, no more than two minutes in the future and no older than 15 minutes.

Duplicate SSID/frequency pairs in one request are dropped. Success returns HTTP 201 with the number accepted. The area limit is 250 observation rows per rolling 10-minute window. This is a pilot safeguard, not a robust global rate limiter.

## Privacy and operational limitations

The scanners do not intentionally upload BSSIDs/MAC addresses, passwords, or device identifiers. Wi-Fi submissions still expose SSIDs, signal metadata, timestamps and approximate coordinates to people using the public nearby feed. Do not upload private network names or locations you are not authorised to disclose.

Community reports are not official utility telemetry. Wi-Fi signal does not prove internet availability. Anonymous endpoints, per-area thresholds, and feed time windows are not a substitute for authentication, moderation, global abuse protection, monitoring, or a physical data-retention process. See the repository's SECURITY.md and docs/COST_AND_GOVERNANCE.md before enabling shared storage.


### GET /api/connectivity-observations

Required query parameter: `area` (up to 120 characters).

Example:

```http
GET /api/connectivity-observations?area=SPSU%20campus%2C%20Udaipur
```

When the connectivity pilot is disabled or the area is not allowlisted, the route returns HTTP 200 with `ingestionEnabled=false` and an empty `observations` array. This avoids creating the additional Table while the feature is off.

When the area is enabled, the route returns only statuses observed within the last 15 minutes. Each item is labelled as an Android connectivity-agent observation, not independently verified provider telemetry.

### POST /api/connectivity-observations

This anonymous endpoint is **disabled unless** `CONNECTIVITY_INGEST_ENABLED=true` and the submitted area exactly matches one of the semicolon-separated `CONNECTIVITY_ALLOWED_AREAS` labels after normalisation. Do not enable it for unrestricted public use.

Example body:

```json
{
  "area": "Udaipur, Rajasthan",
  "observation": {
    "service": "wifi",
    "status": "working",
    "internetValidated": true,
    "observedAt": "2026-10-31T14:30:00.000Z"
  }
}
```

Fields:
- area: required public pilot label, maximum 120 characters and must be allowlisted.
- observation.service: `wifi` or `mobile-data`.
- observation.status: `working`, `degraded` or `down`.
- observation.internetValidated: boolean from Android's network capability state. A `working` state requires true.
- observation.observedAt: timestamp no more than two minutes in the future and no older than 15 minutes.

The API accepts at most 8 KB. Each allowlisted area has one replaceable row for Wi-Fi and one for mobile data. Repeated identical updates within five minutes do not cause another write; rapid state changes are throttled. The API does not store a device identifier, SSID, GPS coordinate or event history for this endpoint. Old statuses are hidden after 15 minutes but their two fixed Table rows remain until overwritten; this is bounded pilot storage, not physical deletion.

The endpoint remains anonymous. An allowlist constrains the number of rows and write scope but does not prove that an observation really came from the Android app. A malicious client could spoof a status for an allowlisted area. Use only with known testers until stronger authentication and abuse controls are deployed.
