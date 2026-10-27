# Classroom demo guide: Fallback Atlas

## One-sentence pitch

Fallback Atlas helps a community compare recent reports about power, mobile data and fixed broadband in one place when usual connectivity is unreliable.

## State the actual status honestly

- The geographic basemap is real geographic data.
- Markers labelled **Demo only** are fictional examples.
- Shared reports appear only when `/api/health` returns `"mode":"shared"`.
- A community report is not an official utility reading or independently verified fact.
- The app shell and report form can work offline after first load. Map tiles, geocoding and shared reports require internet.

## Five-minute presentation

1. **Problem (30 sec):** when power/internet fails, people need to know which service might still work nearby.
2. **Find a place (45 sec):** search Udaipur or another city. The query is sent to OpenStreetMap's Nominatim service.
3. **Compare services (45 sec):** show Mobile data, Fixed broadband and Power with working/degraded/down states; call out freshness labels.
4. **Submit a test report (60 sec):** use a place you can honestly describe. Add a short, non-personal observation. Explain the API validates the report and records observation/submission time.
5. **Show cross-device sharing (60 sec):** when `/api/health` says shared, open the site on a second device/browser, search the same area and click **Refresh**. The new report should appear. If mode is local, don't claim it was shared.
6. **Offline fallback (60 sec):** after the service worker installs, switch DevTools to offline. The app shell can reopen and a report can be queued locally; map tiles won't load. Restore connectivity to recheck the API and sync pending reports.
7. **Trade-off (30 sec):** reports are anonymous and low friction but cannot be proven independent. Freshness is not truth; a public launch needs moderation and abuse controls.

## Pre-class checklist

- [ ] Latest GitHub Actions tests and deployment are green.
- [ ] `/api/health` returns `mode=shared` if you plan to demonstrate shared data.
- [ ] Submit one test report and verify it from a second browser/device.
- [ ] Keep demo markers clearly labelled; never present them as live outage status.
- [ ] Keep a second browser/profile ready for the sharing demo.
- [ ] For offline demo, open the site online first and allow the service worker to install.
- [ ] Don't show access keys, connection strings, emails, phone numbers or exact home addresses.

## Open-source projects to credit

- React — https://github.com/facebook/react
- MapLibre GL JS — https://github.com/maplibre/maplibre-gl-js
- OpenFreeMap — https://github.com/hyperknot/openfreemap
- OpenStreetMap/Nominatim — https://www.openstreetmap.org/copyright
- Azure Functions JavaScript SDK — https://github.com/Azure/azure-functions-nodejs-library
- Azure Data Tables SDK — https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/tables/data-tables
- Testing Library — https://github.com/testing-library/react-testing-library
- Ushahidi Platform — crowdsourced incident-mapping inspiration, not bundled: https://github.com/ushahidi/platform

See [architecture](ARCHITECTURE.md) and [cost/governance](COST_AND_GOVERNANCE.md).
