# Fallback Atlas

**Know what still works.** Fallback Atlas is an open-source prototype for sharing local information about power, mobile data and fixed broadband during disruptions.

> **Current stage: prototype.** The map markers and status summaries are examples, not live network measurements. Reports submitted through the form are stored only in the current browser. They are not uploaded, shared with other visitors, or verified.

[![Azure Static Web Apps](https://img.shields.io/badge/hosting-Azure%20Static%20Web%20Apps-0078D4)](https://azure.microsoft.com/products/app-service/static)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## What works today

- Responsive dashboard for power, mobile data and fixed broadband.
- Interactive Jaipur map using MapLibre GL JS and OpenFreeMap's public map style.
- Visible map attribution provided by the map style.
- Illustrative marker popups labelled as demo-only.
- Area labels, report filters and a local report form.
- Browser-local persistence for test reports.
- Privacy reminders and no device GPS collection.
- Automatic static-site deployment from the \`main\` branch through GitHub Actions.

## Technology

| Layer | Current choice | Notes |
| --- | --- | --- |
| Frontend | React + Create React App | Existing scaffold; plan a migration away from the deprecated scaffold |
| Map renderer | MapLibre GL JS | Loaded as a pinned browser CDN script |
| Map data/style | OpenFreeMap Liberty | Public instance; no API key. Best-effort service without an SLA |
| Hosting | Azure Static Web Apps Free | No additional Azure backend resources currently used |
| CI/CD | GitHub Actions | Push builds and deploys the static site |

## Run locally

Requirements: Node.js and npm.

\`\`\`bash
npm install
npm start
\`\`\`

Create a production build:

\`\`\`bash
npm run build
\`\`\`

## Current limitations

- **No shared backend:** reports are stored in the current browser only.
- **No live outage data:** sample markers are not reports from utility companies or verified users.
- **No geocoding:** area search updates the label and does not move the map. The map remains centered on Jaipur.
- **No offline map:** base map tiles require connectivity.
- **No offline report sync:** reports do not upload after connectivity returns.
- **Map availability:** OpenFreeMap's public instance is free to use without an API key, but it does not provide an SLA. Keep the provider replaceable.

## Roadmap

1. Validate the use case with a small campus or neighbourhood pilot.
2. Add a modest backend API and shared report store using a free tier where practical.
3. Add freshness, confidence and source labels to reports.
4. Add moderation, rate limiting, abuse prevention and data-retention rules before opening submissions broadly.
5. Add opt-in offline report queuing and safe synchronization.
6. Replace the current Create React App scaffold with a maintained build tool and update dependencies after verifying the migration.
7. Add area lookup only after selecting a geocoder whose usage terms, rate limits and privacy implications fit the project.

## Privacy and safety

The current prototype does not request browser geolocation, does not call a live network-status API, and does not upload report-form entries. Do not enter personal information in reports. Do not rely on demo data for emergency, travel or safety decisions.

## Map attribution and usage

The map uses OpenFreeMap's public instance with map data from OpenStreetMap/OpenMapTiles. MapLibre displays the attribution provided in the map style. Read the [OpenFreeMap quick start](https://openfreemap.org/quick_start/), [OpenFreeMap terms](https://openfreemap.org/terms/), and [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

Do not bulk-download map tiles or add prefetch/offline map downloading without checking the provider's current terms.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Bug reports and feature ideas are welcome.

## Security

See [SECURITY.md](SECURITY.md) for reporting security problems.

## License

MIT — see [LICENSE](LICENSE).
