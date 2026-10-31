# Fallback Atlas Android Companion

This native Android companion has two separate capabilities: an opt-in connectivity monitor and a user-confirmed nearby Wi-Fi scanner. The browser site cannot monitor Android network callbacks or scan surrounding Wi-Fi radio networks.

## What it does

- **Automatic connectivity monitoring (opt-in):** observes Wi-Fi and mobile-data network capabilities while the app is visible, including Android's validated-internet signal.
- **Local offline queue:** keeps only the latest unsent status per connection type and uploads it when a validated connection is available again.
- **Nearby Wi-Fi scan:** requests explicit Android permission and scans visible Wi-Fi networks on the device.
- Displays SSID, RSSI in dBm, frequency band, security label and age of the observation.
- Does not connect to networks, request passwords, collect BSSIDs/MAC addresses or add a device identifier.
- Lets the user explicitly share a Wi-Fi scan snapshot with the Fallback Atlas API. Sharing includes SSID, signal level, frequency, security label, scan time, an editable area label and approximate coordinates rounded server-side.
- Connectivity monitoring shares only area label, `wifi` or `mobile-data`, status, validated-internet boolean and timestamp. It does not send GPS, SSIDs, passwords, BSSIDs/MAC addresses, phone numbers or device IDs.
- The website can display observations within 1–5 km if the Azure Storage connection string has been configured.
- Observations older than 15 minutes are not returned by the shared nearby feed.

Important: RSSI describes how strongly the phone hears an access point. It does not prove the AP has internet connectivity, and it does not measure real-world download speed. Android can throttle scans; the app refuses to share stale results as fresh. Connectivity status uses Android's validated-internet capability, which is a system probe signal and not a guarantee of uninterrupted access.

The monitor is foreground-only in this version: it pauses when the app is hidden or closed. It is not an always-on background service, does not run scheduled scans, and does not ask for location permission for connectivity monitoring. Manual Wi-Fi scanning still uses Android's Wi-Fi/location permissions.

## Build

The project commits the Gradle 8.9 wrapper so local builds and CI use the same Gradle distribution. Use JDK 17 and Android SDK Platform 35.

From the repository root, run scanner unit tests and build the debug APK:

```bash
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

On Windows PowerShell:

```powershell
cd android
.\gradlew.bat --no-daemon testDebugUnitTest assembleDebug
```

Open the android directory in Android Studio and sync using the committed wrapper. Connect an Android 11+ phone or use an emulator with Wi-Fi scan support to try an actual scan. JVM tests cover the existing SSID filtering, age/freshness, deduplication, security, band and signal-label rules without requiring a device or emulator.

The GitHub Actions workflow runs the JVM unit tests first, then builds a debug APK and uploads it as a 14-day artifact for testing.

## Permissions

Wi-Fi scans require Android's Wi-Fi/location permissions and Location services enabled. The app asks only when the user initiates a scan. It asks for location a second time at share time so observations can be shown in a radius on the map. If a fresh location isn't available, the scan stays on the phone.

Connectivity ingestion is disabled by default on the server. It remains disabled until `CONNECTIVITY_INGEST_ENABLED=true` and `CONNECTIVITY_ALLOWED_AREAS` is configured in the Azure Static Web App's server-side settings. The allowlist is not authentication; use only with known pilot testers. Wi-Fi scan observations are shared only after explicit confirmation and are visible to website users. Don't submit private SSIDs or scan locations you don't have permission to share.
