# Screenshot guidance

The live prototype is available at https://ambitious-smoke-035c3f900.6.azurestaticapps.net/. It has been inspected at desktop and mobile-sized viewports, but this repository does not currently contain durable screenshot image files.

## Recommended assets

Store only genuine captures under `docs/screenshots/`:

| File | Capture |
| --- | --- |
| `desktop-overview.png` | Desktop landing view with the demo-data disclaimer visible |
| `mobile-overview.png` | Responsive mobile landing view |
| `community-report-form.png` | Report form with example values only; no fabricated public submission |
| `nearby-wifi-empty-state.png` | Honest empty state before a scanner observation is shared |
| `wifi-observation-popup.png` | Popup for a consented test scan with the SSID and exact location masked |
| `android-scanner.png` | Android companion app with all sensitive network names hidden or replaced |

## Capture checklist

1. Open the live prototype or a local build at a known viewport size.
2. Capture the actual rendered application; do not create a mockup and label it as a screenshot.
3. Keep the DEMO DATA notice visible whenever illustrative markers are shown.
4. Mask SSIDs, exact coordinates, email addresses, access tokens and any other personal or confidential information.
5. Do not upload screenshots containing private network names or identifiable locations without permission.
6. Add the PNG files to this directory, then update the README and demo guide with their relative paths and short captions.
7. Check the images at desktop and mobile widths before committing.

Suggested capture sizes: 1440 × 1000 for desktop and 390 × 844 for mobile. Use a clean browser profile with no saved credentials or personal notifications visible.

## Current status

No image placeholders or expiring screenshot-service URLs are committed. The screenshots should be added after genuine captures have been saved as durable repository files and privacy-checked.
