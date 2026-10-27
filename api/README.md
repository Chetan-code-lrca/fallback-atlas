# Fallback Atlas API

This is the HTTP-only Azure Functions API managed by Azure Static Web Apps.

## Endpoints

- \`GET /api/health\` — reports whether shared storage is configured.
- \`GET /api/reports?area=Udaipur%2C%20Rajasthan&latitude=24.58&longitude=73.68&radiusKm=10\` — recent reports in the selected area or radius.
- \`POST /api/reports\` — validates and stores a community report.

## Storage configuration

The API uses Azure Table Storage table \`Reports\`. The API creates the table when it first connects.

Add one application setting to the Static Web App:

- **Name:** \`REPORTS_STORAGE_CONNECTION_STRING\`
- **Value:** the storage account connection string from Azure Portal → Storage account → Security + networking → Access keys.

Never put the connection string in GitHub, React environment variables, screenshots, or browser code. If this setting is absent, the API deliberately stays in local-only mode.

## Data and safety rules

- No user account, name, phone number or device GPS is collected.
- Reports include a server submission time and observation time.
- A report can include the map centre only when the reporter selects an area; no browser geolocation is requested.
- The API validates area, service, status, note length and optional coordinates.
- Up to 30 reports per normalized area per 10-minute window are accepted to limit accidental flooding during the pilot.
- Reads return at most the latest 250 reports from the previous 30 days, then apply exact-area or radius matching.
- Reports are community submissions, not official utility status; independent reporter verification is not implemented yet.

This anonymous endpoint is for a small classroom/hostel pilot, not a high-traffic public launch. Before public rollout, add user/report abuse controls, moderation and a clear retention policy.
