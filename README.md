# Fallback Atlas

[![Prototype tests](https://github.com/Chetan-code-lrca/fallback-atlas/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/Chetan-code-lrca/fallback-atlas/actions/workflows/tests.yml)
[![Android scanner](https://github.com/Chetan-code-lrca/fallback-atlas/actions/workflows/android-scanner.yml/badge.svg?branch=main)](https://github.com/Chetan-code-lrca/fallback-atlas/actions/workflows/android-scanner.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Know what still works.**

Fallback Atlas is an open-source, community-powered web application for sharing recent reports about mobile data, fixed broadband and power availability during local disruptions. It combines a map-based React PWA, an optional Azure Functions reporting API, and companion Wi-Fi scanners for Android and Windows.

<text> </text>

**Live prototype:** [ambitious-smoke-035c3f900.6.azurestaticapps.net](https://ambitious-smoke-035c3f900.6.azurestaticapps.net/)

> **Pilot status:** The live site uses clearly labelled Udaipur demo markers. Those markers are illustrative, not live network measurements. Shared reporting is enabled only when Azure Table Storage is configured server-side. Without it, outage reports remain local to the browser and are not shared with other visitors.

## What it does

- **Community outage reports:** mobile data, fixed broadband and power with working, degraded and down statuses, observation times and freshness labels.
- **Interactive map:** MapLibre GL JS with OpenFreeMap tiles and OpenStreetMap attribution.
- **Global place search:** user-triggered Nominatim search with a small browser cache.
- **Real nearby Wi-Fi observations:** Android and Windows companion scanners detect nearby access points. The website itself cannot scan the device's Wi-Fi radio.
- **Automatic Android connectivity observations:** an optional, foreground-only Android monitor reports whether Wi-Fi or mobile data has validated internet. It sends only area, connection type, status and timestamp; the queue is local while offline.
- **Explicit sharing:** scanners show selected SSIDs and require user confirmation before uploading an observation snapshot.
- **Privacy-aware payloads:** scanners are designed not to upload passwords, BSSIDs/MAC addresses or device identifiers. SSIDs and approximate coordinates can still be sensitive.
- **Location and report consent:** using “Use my location” sends browser coordinates to the API for nearby lookups; it does not submit a report. Report coordinates are a separate opt-in, off by default, and rounded to three decimal places when shared.
- **Offline app shell:** after a successful online visit and service-worker installation, the app shell can reopen and outage reports can be queued locally. Map tiles, search and shared APIs still need connectivity.
- **Local fallback:** when the API is not configured or cannot be reached, reports are kept in the browser and shown as local/pending rather than falsely presented as shared.

## Screenshots and demo

The live prototype has been checked at desktop and mobile-sized viewports. Durable screenshot files are not currently committed to the repository; no mockups or expiring screenshot URLs are used as substitutes. Follow [screenshot capture guidance](docs/SCREENSHOTS.md) when adding sanitised, genuine captures.

For a presentation walkthrough, setup steps and privacy disclosures, see the [demo guide](docs/DEMO_GUIDE.md).

## Architecture

The frontend and HTTP API are deployed together on Azure Static Web Apps. The optional backend stores community reports and device-observed Wi-Fi metadata in separate Azure Table Storage tables.

~~~mermaid
flowchart TB
  Visitor[Browser user] --> Web[React PWA]
  Web --> Map[MapLibre map]
  Map --> Tiles[OpenFreeMap tiles]
  Web --> Search[OpenStreetMap Nominatim]
  Web -->|GET/POST reports| API[Static Web Apps managed Functions]
  Web -->|GET status| API
  Web -->|GET/POST Wi-Fi scans| API
  Android[Android Wi-Fi + connectivity companion] -->|opt-in status / explicit Wi-Fi scan| API
  Windows[Windows PowerShell scanner] -->|explicit consent| API
  API --> Validate[Validate and apply pilot limits]
  Validate --> Reports[(Azure Table: Reports)]
  Validate --> Wifi[(Azure Table: WifiScans)]
  Validate --> Status[(Azure Table: ConnectivityStatus · max 2 rows per pilot area)]
  Web --> Local[Browser-local report queue]
~~~

For component responsibilities, trust boundaries, storage behavior and offline behavior, read [the architecture document](docs/ARCHITECTURE.md).

## Technology

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 16, Create React App | PWA interface and local report queue |
| Map | MapLibre GL JS, OpenFreeMap | Interactive map and vector tiles |
| Place search | OpenStreetMap Nominatim | User-submitted location search |
| API | Azure Static Web Apps managed Functions, Node.js 22 | HTTP reports, Wi-Fi scans and restricted connectivity status |
| Storage | Existing Azure Data Tables account | Reports, WifiScans and (when pilot is enabled) bounded ConnectivityStatus rows |
| Android | Java, ConnectivityManager, WifiManager, Gradle 8.9 | Opt-in foreground connectivity monitoring, local queue and consent-based Wi-Fi scan upload |
| Windows | PowerShell, Windows WLAN API, netsh | Nearby Wi-Fi discovery and consent-based upload |
| Testing | Jest, Testing Library, Node.js test runner, JUnit | Frontend, API and Android scanner unit tests |

## Run locally

### Prerequisites

- Node.js 22 and npm.
- For the integrated local API: Azure Static Web Apps CLI, Azure Functions Core Tools v4, and Azurite or an authorised development Storage account.
- For Android builds: JDK 17 and Android SDK Platform 35.

### Install dependencies

From the repository root:

~~~bash
npm ci
npm ci --prefix api
~~~

### Start the frontend

~~~bash
npm start
~~~

The React development server runs at http://localhost:3000. To route `/api/*` requests through the local Functions API, start the Static Web Apps CLI from a second terminal:

~~~bash
swa start http://localhost:3000 --api-location ./api
~~~

Open http://localhost:4280. Create local Functions settings from the safe template:

~~~bash
cp api/local.settings.example.json api/local.settings.json
~~~

The template leaves `REPORTS_STORAGE_CONNECTION_STRING` empty. This supports local-only development; to test shared data, use a dedicated development Storage account and never commit its connection string. See [API local-development instructions](api/README.md) for Azurite and configuration details.

### Test and build

~~~bash
npm test -- --watchAll=false --runInBand
npm run build
npm --prefix api test
~~~

GitHub Actions runs the frontend tests, production build and API test suite using lockfile-enforced `npm ci` installs for both packages.

## API endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Reports whether shared storage is configured and reachable |
| GET / POST | `/api/reports` | Reads or submits community outage reports |
| GET / POST | `/api/wifi-scans` | Reads or submits explicitly shared nearby Wi-Fi observations |
| GET / POST | `/api/connectivity-observations` | Reads or submits allowlisted Android connectivity status (disabled by default) |

The API uses `REPORTS_STORAGE_CONNECTION_STRING` as a server-side Static Web Apps application setting for both Azure Tables. Never expose this value in frontend configuration, screenshots or Git. Complete route schemas, validation rules, examples and setup are in the [API README](api/README.md).

## Companion Wi-Fi scanners

### Android

The Android companion supports two separate workflows:

- **Automatic connectivity monitoring:** opt in to observe Wi-Fi and mobile-data internet validation while the app is visible. It uses Android network callbacks, does not request location, queues the latest status locally while offline and uploads when a validated connection returns. Monitoring pauses when the app leaves the foreground in this first version.
- **Nearby Wi-Fi scan:** Android 11+, user-approved Wi-Fi/location permissions and Location services are required. It shows SSID, signal strength, frequency, security label and scan age. Sharing a scan still requires explicit confirmation and a recent result.

Automatic ingestion is disabled by default on the server. A restricted area allowlist must be configured before the app can publish connectivity status; this is not authentication and is suitable only for a known pilot cohort.

From the repository root:

~~~bash
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
~~~

On Windows PowerShell:

~~~powershell
cd android
.\gradlew.bat --no-daemon testDebugUnitTest assembleDebug
~~~

The Gradle 8.9 wrapper is committed so local builds and CI use the same Gradle version. GitHub Actions runs scanner JVM unit tests before building and publishing a debug APK artifact.

### Windows

Run `tools/windows-wifi-scanner.ps1` in PowerShell on a Windows laptop with Wi-Fi enabled. The script starts a fresh WLAN scan, previews visible SSIDs, lets the user select rows and uploads only after the user types `SHARE`.

Windows reports signal percentage rather than true RSSI. Its derived dBm value is explicitly labelled as a rough estimate; Android reports measured RSSI. Neither scanner proves that a detected access point has working internet.

## Shared storage and Azure deployment

The site can run in local-only mode without creating Azure Storage resources. To enable shared reports and Wi-Fi observations:

1. Use a dedicated Standard / General-purpose v2 / locally redundant Azure Storage account for the pilot.
2. Configure `REPORTS_STORAGE_CONNECTION_STRING` in the Azure Static Web App's server-side application settings.
3. Open `/api/health` and verify it reports `"mode":"shared"`.
4. Only for a known Android pilot, set `CONNECTIVITY_INGEST_ENABLED=true` and `CONNECTIVITY_ALLOWED_AREAS` to semicolon-separated exact area labels in the same Static Web App's server-side settings. Keep the list short; the endpoint is anonymous and is not production abuse protection.
5. Test report submission and Wi-Fi scanning with consenting devices and non-private networks.

Do not create a separate Function App or App Service for this HTTP-only Static Web Apps API. Azure Table Storage is billed separately; it is not guaranteed free. See [cost and governance](docs/COST_AND_GOVERNANCE.md).

## Safety, privacy and release limitations

- Community reports are observations, not official or independently verified utility telemetry.
- Wi-Fi signal strength describes radio reception; it does not prove internet availability or throughput.
- Shared Wi-Fi observations contain SSIDs, signal metadata, timestamps and approximate coordinates. Do not share private network names or locations you are not authorised to disclose.
- The API is anonymous and currently protected only by pilot-level per-area thresholds. Area labels can be changed to evade counters, and concurrent requests can race.
- Report and Wi-Fi feed windows (30 days and 15 minutes respectively) control visibility. They do **not** physically delete expired rows from Azure Table Storage.
- Unrestricted public shared reporting is not ready. Review the [security policy](SECURITY.md) and [public-launch readiness checklist](docs/PUBLIC_LAUNCH_CHECKLIST.md) before enabling wider access.

## Project documentation

| Document | Contents |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Components, request flows, trust boundaries, offline behavior |
| [API setup and reference](api/README.md) | Routes, request examples, validation, environment variables, local development |
| [Demo guide](docs/DEMO_GUIDE.md) | Live walkthrough, local setup, presentation notes and disclosures |
| [Screenshot guidance](docs/SCREENSHOTS.md) | Genuine capture and privacy requirements |
| [Cost and governance](docs/COST_AND_GOVERNANCE.md) | Azure footprint, cost cautions, retention and abuse limits |
| [Public-launch checklist](docs/PUBLIC_LAUNCH_CHECKLIST.md) | Staged rollout and go/no-go conditions |
| [Connectivity agent pilot](docs/CONNECTIVITY_AGENT_PILOT.md) | Android monitoring, endpoint configuration, privacy and low-cost Azure design |
| [Classroom demo guide](docs/CLASS_DEMO_GUIDE.md) | Five-minute presentation and classroom checklist |
| [Udaipur pilot test plan](docs/UDAIPUR_PILOT_TEST_PLAN.md) | Small pilot usability and validation plan |
| [Contributing](CONTRIBUTING.md) | Contribution practices |
| [Security policy](SECURITY.md) | Private vulnerability disclosure and data precautions |

## Attribution and license

Fallback Atlas is licensed under the MIT License; see [LICENSE](LICENSE).

The project uses MapLibre GL JS (BSD-3-Clause), OpenFreeMap, OpenStreetMap data (ODbL), Nominatim, Azure Functions and Azure Data Tables. Follow each upstream project's licensing, attribution and usage policies. OpenStreetMap attribution is shown in the application.
