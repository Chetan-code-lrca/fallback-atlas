# Fallback Atlas Wi-Fi Scanner (Android)

This is the native Android companion for discovering real Wi-Fi access points near a phone. The browser site cannot scan surrounding radio networks, so this small app uses Android's WifiManager API instead.

## What it does

- Requests an explicit Android permission and scans visible Wi-Fi networks on the device.
- Displays SSID, RSSI in dBm, frequency band, security label and age of the observation.
- Does not connect to networks, request passwords, collect BSSIDs/MAC addresses or add a device identifier.
- Lets the user explicitly share a scan snapshot with the Fallback Atlas Azure API. Sharing includes SSID, signal level, frequency, security label, scan time, an editable area label and approximate coordinates rounded server-side.
- The website can display observations within 1–5 km if the Azure Storage connection string has been configured.
- Observations older than 15 minutes are not returned by the shared nearby feed.

Important: RSSI describes how strongly the phone hears an access point. It does not prove the AP has internet connectivity, and it does not measure real-world download speed. Android can throttle scans; the app refuses to share stale results as fresh.

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

The API endpoint is public for this classroom pilot. Scan observations are shareable with anyone using the website, so the app requires a confirmation before upload. Don't submit private SSIDs or scan locations you don't have permission to share.
