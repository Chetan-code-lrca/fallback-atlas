# Android connectivity agent — restricted pilot

## Purpose

The Android companion can collect lightweight Wi-Fi and mobile-data internet status without asking testers to manually submit outage reports. The first version is deliberately foreground-only and opt-in.

The agent uses Android \`ConnectivityManager.NetworkCallback\` and the \`NET_CAPABILITY_VALIDATED\` capability. It does not perform speed tests, read traffic, inspect SSIDs, or infer an electricity outage.

## What is observed

| Field | Example | Shared? |
| --- | --- | --- |
| Public area label | Udaipur, Rajasthan | Yes |
| Transport | wifi / mobile-data | Yes |
| Status | working / degraded / down | Yes |
| Android internet validation | true / false | Yes |
| Observation time | ISO timestamp | Yes |
| GPS / latitude / longitude | — | No |
| SSID / BSSID / MAC | — | No |
| Device ID / phone number | — | No |
| Traffic contents / passwords | — | No |

A \`working\` observation means Android currently reports that the network has validated internet access. \`degraded\` means the network advertises internet but Android has not validated it. \`down\` means Android observed no internet capability or the last matching network was lost. These are client-side observations, not official ISP or utility measurements.

The monitor runs only while the Android app is visible. It unregisters network callbacks when the activity leaves the foreground. It does not run an always-on service, periodic scans or background tracking in this version. Manual nearby Wi-Fi scans remain a separate action and still use their existing permissions and explicit share confirmation.

## Low-cost design

No new Azure service is needed.

- Reuse the existing Azure Static Web Apps managed Functions API.
- Reuse the existing \`REPORTS_STORAGE_CONNECTION_STRING\` and Storage account.
- Create one small \`ConnectivityStatus\` table only after the restricted pilot is enabled and an allowlisted read/write occurs.
- Store at most one replaceable row per area and transport: two rows per allowlisted area, not an event history.
- The API avoids writes for unchanged status for five minutes and throttles rapid status changes.
- The app keeps at most one pending unsent observation per transport in local preferences.
- No VM, App Service, separate Function App, Logic App, Container App, Cosmos DB, AI model or additional paid service is required.

Stale rows are hidden after 15 minutes. They are not physically deleted by this implementation, but because rows are overwritten by a fixed (area, transport) key their count is bounded by the configured area allowlist. Do not describe feed freshness as physical deletion.

## Server-side activation

**Do not enable this on the unrestricted public site.** The endpoint is anonymous. The area allowlist limits where writes can create rows, but it does not authenticate the app and a malicious client could spoof a report for an allowed area.

After the branch has been merged, tested and reviewed, enable only for known pilot testers:

1. Open the existing Azure Static Web App in the Azure portal.
2. Go to **Configuration** (application settings).
3. Add \`CONNECTIVITY_INGEST_ENABLED\` with value \`true\`.
4. Add \`CONNECTIVITY_ALLOWED_AREAS\` with one or more exact public area labels separated by semicolons. For a first controlled test, use \`Udaipur, Rajasthan\`.
5. Save the settings and verify \`GET /api/connectivity-observations?area=SPSU%20campus%2C%20Udaipur\` returns \`ingestionEnabled: true\`.
6. Do not add areas that you are not actively piloting. Keep the allowlist as short as possible.

If either setting is absent, GET returns an empty pilot-disabled response and POST is rejected. The new table is not created while the feature is disabled. The existing storage connection string remains server-side; never place it in the APK or frontend.

This flag is not an authentication mechanism. Before inviting the general public, add real client/user authentication, global abuse controls, abuse reporting and operational monitoring.

## Android tester workflow

1. Install the debug APK from the Android CI artifact or build it locally.
2. Enter the exact allowlisted area label. This is a manually selected public area, not GPS-tracked; update it whenever the device is used in another area.
3. Read the disclosure and choose **Enable automatic monitoring**.
4. Leave the app open during the first test. The status line should reflect Wi-Fi and/or mobile-data capability changes.
5. Test Wi-Fi and cellular separately where available. Network callbacks may not emit a \`down\` status for a transport that was never observed while monitoring was enabled.
6. When the endpoint is enabled and a validated internet connection is available, the app uploads status changes automatically. If offline, the latest status remains queued locally.
7. Choose **Stop automatic monitoring** to unregister callbacks and clear pending local observations.

Do not use private network names or private home addresses as area labels. Do not ask testers to share exact GPS coordinates for this workflow.

## API contract

- \`GET /api/connectivity-observations?area=<label>\`: returns up to two observations no older than 15 minutes.
- \`POST /api/connectivity-observations\`: submits one observation for an allowlisted area.
- Maximum request body: 8 KB.
- Valid services: \`wifi\`, \`mobile-data\`.
- Valid statuses: \`working\`, \`degraded\`, \`down\`.
- Observations older than 15 minutes or more than two minutes in the future are rejected.
- Identical states received within five minutes avoid an additional Table write.
- State changes received less than 30 seconds apart are throttled (unless the queued observation itself is sufficiently newer than the last stored observation).

See [API route reference](../api/README.md) for the request schema and responses.

## Pilot acceptance criteria

- [ ] Server-side feature flag is off until the restricted test area and tester cohort are agreed.
- [ ] Only the exact configured area label is accepted by POST.
- [ ] Android asks for explicit consent before monitoring.
- [ ] No location permission is requested by connectivity monitoring.
- [ ] No SSID, BSSID/MAC address, device ID, phone number or traffic content is sent by connectivity monitoring.
- [ ] Wi-Fi and mobile-data statuses are tested separately on a real Android phone.
- [ ] Offline queue survives app close/reopen and expires observations older than 15 minutes.
- [ ] Repeated identical updates do not create additional table rows.
- [ ] Stop monitoring removes pending local observations and unregisters callbacks.
- [ ] Website labels these as Android-agent reports, not official or independently verified telemetry.
- [ ] Azure Cost Management is checked after the limited test cohort starts.

## Known limitations

- Foreground-only: monitoring pauses when the app is hidden or closed. Background/always-on monitoring is intentionally deferred because it requires a persistent foreground-service notification and additional Android policy/battery considerations.
- The API is anonymous; area allowlisting and fixed rows reduce cost exposure but do not provide identity or prevent spoofing.
- Android's validated capability is a system internet check, not a speed test or end-to-end guarantee.
- This source cannot prove fixed-broadband service independently from the Wi-Fi router/last-mile connection.
- No electrical/power outage can be inferred from these network signals.
- This is a pilot, not production-grade outage telemetry.
