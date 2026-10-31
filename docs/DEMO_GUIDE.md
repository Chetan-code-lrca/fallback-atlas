# Fallback Atlas demo guide

**Live prototype:** https://ambitious-smoke-035c3f900.6.azurestaticapps.net/

Fallback Atlas brings together recent community reports about power, mobile data and fixed broadband, with separately collected nearby Wi-Fi observations from consenting Android or Windows scanner users.

## Important demo disclosures

- The Udaipur map markers and initial report counts are illustrative demo data. They are not live operator measurements.
- Community-submitted reports are not official utility telemetry and are not independently verified.
- The nearby Wi-Fi feed is populated only after a scanner user explicitly selects observations and confirms sharing. An empty feed means no recent shared observations were found in the selected radius; it does not mean that no Wi-Fi networks exist.
- Android reports measured Wi-Fi RSSI. Windows exposes signal percentage, so the converted dBm value is only a rough estimate.
- Wi-Fi signal strength does not prove that an access point has internet access or measure internet speed.
- Shared storage is optional. Check `/api/health` before claiming reports are shared. A local browser queue is not visible to other visitors.

## Suggested seven-minute walkthrough

1. **Problem and scope (45 seconds).** Explain the need for local reports about power, mobile data and fixed broadband when usual connectivity is unreliable.
2. **Open the live prototype (45 seconds).** Show the Udaipur landing view and explicitly point out the DEMO DATA label. Do not describe those markers as live.
3. **Search for a place (60 seconds).** Search a different city or neighbourhood to show that the map can move globally. Place search uses OpenStreetMap Nominatim; map tiles and search need an internet connection.
4. **Explain community reporting (60 seconds).** Show the report form and statuses. During a real test, submit only an honest, non-personal observation about a place you are authorised to describe. Do not submit a fabricated outage report to the public pilot.
5. **Show the Wi-Fi feed (60 seconds).** Explain that the website cannot scan the phone's radio. The feed shows only explicitly shared, recent observations. An empty result is an honest state, not a guessed network list.
6. **Demonstrate a companion scanner (90 seconds).** Use the Android app or Windows PowerShell script on networks you are authorised to inspect. Review and select SSIDs, then confirm the upload only when you are comfortable making the selected names and approximate area public. Refresh the website in the same area and show the scanner-source label and timestamp.
7. **Show offline behavior and limitations (60 seconds).** After opening the app once online and allowing the service worker to install, switch the browser to offline mode. The app shell can reopen and a report can be queued locally; map tiles, geocoding and shared APIs still require connectivity.

## Local development

Requirements: Node.js 22, npm, and (for the integrated local API) the Azure Static Web Apps CLI, Azure Functions Core Tools v4 and Azurite or an authorised development Storage connection.

Install the frontend and API dependencies from their lockfiles:

```bash
npm ci
npm ci --prefix api
```

Create local Functions settings from the safe template:

```bash
cp api/local.settings.example.json api/local.settings.json
```

The template deliberately leaves shared storage unconfigured. For the integrated local experience, start the React development server in one terminal:

```bash
npm start
```

In a second terminal, run the Static Web Apps CLI proxy from the repository root:

```bash
swa start http://localhost:3000 --api-location ./api
```

Open http://localhost:4280. See [API local-development instructions](../api/README.md) for Azurite and optional development Table Storage setup.

Run all checks:

```bash
npm test -- --watchAll=false --runInBand
npm run build
npm --prefix api test
```

Build and test the Android companion:

```bash
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

On Windows, run `android\\gradlew.bat --no-daemon testDebugUnitTest assembleDebug` from the repository root, or see [Android scanner instructions](../android/README.md).

For the Windows companion, run `tools/windows-wifi-scanner.ps1` in PowerShell on a Windows laptop with Wi-Fi enabled. Review the selected networks and only continue when you intend to publish those SSIDs and the approximate area.

## Privacy and safety

Do not share private hotspot names, confidential network details, exact home coordinates, credentials, passwords, BSSIDs/MAC addresses, or information about networks you do not have permission to disclose. The scanner workflow is designed to omit BSSIDs/MAC addresses, passwords and device identifiers, but SSIDs combined with approximate location can still reveal nearby networks.

The shared API is anonymous and the current per-area limits are pilot safeguards, not a production-grade abuse-control system. Retention windows currently control feed visibility; they do not physically delete old Table Storage entities. See [security policy](../SECURITY.md), [cost and governance](COST_AND_GOVERNANCE.md), and the [public-launch checklist](PUBLIC_LAUNCH_CHECKLIST.md).

## Screenshot capture checklist

The current hosted prototype has been checked on desktop and a mobile-sized viewport. Durable screenshot files are not yet checked into this repository. Before adding screenshots, capture real screens from the live or local application and remove private network names, exact coordinates, tokens and personal information. See [screenshot guidance](SCREENSHOTS.md).
