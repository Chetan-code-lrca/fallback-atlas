# Fallback Atlas

**Know what still works.** Fallback Atlas is an open-source prototype exploring how communities can share local information about power, mobile data and fixed broadband during disruptions.

> **Current stage: prototype.** Map markers and sample summaries are illustrative only, not live network measurements. Reports from the form are saved only in the current browser. They are not uploaded, shared with other visitors, or verified.

[![Azure Static Web Apps](https://img.shields.io/badge/hosting-Azure%20Static%20Web%20Apps-0078D4)](https://azure.microsoft.com/products/app-service/static)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## What works today

- Responsive dashboard for mobile data, fixed broadband and power.
- Interactive MapLibre map centered on Udaipur, with curated presets for Udaipur City, Fatehpura, Hiran Magri and Pratap Nagar.
- MapLibre GL JS and the OpenFreeMap Liberty style, using OpenStreetMap-derived map data.
- Clickable, clearly labelled illustrative markers.
- Search for supported local presets without a paid geocoding API.
- Local report form, category filters and browser-local persistence.
- No device GPS request; privacy reminders discourage personal details.
- Automatic deployment from the `main` branch through GitHub Actions.

## Technology

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React + Create React App | Existing scaffold; migrate to a maintained build tool later |
| Interactive map | MapLibre GL JS | Loaded as a browser ES module |
| Map style | OpenFreeMap Liberty | Public style; no API key required for the prototype |
| Hosting | Azure Static Web Apps Free | No Azure backend resources currently required |
| CI/CD | GitHub Actions | Deploys static frontend on push |
| Tests | React Testing Library + Jest | Runs in a separate GitHub Actions workflow |

## Run locally

Requirements: Node.js and npm.

```bash
npm ci
npm start
```

Run the frontend tests:

```bash
npm test -- --watchAll=false --runInBand
```

Build for production:

```bash
npm run build
```

## Limitations

- **No shared backend:** reports are stored in the current browser only.
- **No live outage data:** sample markers and statuses are not from utilities or verified users.
- **Curated location search only:** supported Udaipur presets recenter the map. Arbitrary PIN-code/address search is not connected to a geocoder.
- **No offline map or upload queue:** map tiles require connectivity and reports are never synchronized.
- **No freshness/confidence calculation:** these need a trustworthy shared dataset first.
- **Public map service dependency:** OpenFreeMap offers a free public instance, but availability is not guaranteed by this project. Keep the provider replaceable.

## Roadmap

1. Validate the prototype with a small Udaipur campus/hostel usability test.
2. Build a shared reporting API and database using a suitable free tier; avoid extra Azure resources until needed.
3. Add timestamps, expiry, freshness and confidence labels so stale reports are not mistaken for current conditions.
4. Add input validation, rate limiting, moderation, abuse prevention and retention rules before public submissions.
5. Add an offline report queue with safe synchronization.
6. Migrate away from the deprecated Create React App scaffold and update dependencies after testing.
7. Expand location lookup only after choosing a geocoder with acceptable terms, limits and privacy implications.

## Privacy and safety

The prototype does not request browser geolocation, call a live network-status API or upload submitted reports. Do not enter personal information. Do not rely on demo data for emergency, travel or safety decisions.

## Map attribution and usage

The map uses OpenFreeMap's public style and OpenStreetMap-derived data. Keep the attribution displayed by the map style. Review the [OpenFreeMap quick start](https://openfreemap.org/quick_start/), [OpenFreeMap terms](https://openfreemap.org/terms/) and [OpenStreetMap copyright](https://www.openstreetmap.org/copyright). Do not add bulk tile downloads or prefetching without checking the provider's terms.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
