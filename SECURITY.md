# Security Policy

Fallback Atlas is a prototype community-reporting application. It includes anonymous HTTP endpoints hosted by Azure Static Web Apps managed Functions and optional Azure Table Storage. The public endpoints are intended for a small pilot, not an unrestricted high-traffic production service.

## Reporting a vulnerability

Please do not publish secrets, access tokens, personal information, private network names, precise location data, or a working exploit in a public issue.

Use GitHub's private vulnerability reporting feature for this repository when it is enabled. Otherwise, contact the repository maintainer through their GitHub profile and request a private disclosure channel. Do not include live credentials in the initial report.

A useful report includes:
- The affected component, file, endpoint, and commit or branch.
- The impact and realistic attack prerequisites.
- Concise reproduction steps using an environment and data you own or are authorised to test.
- Relevant sanitised logs or screenshots, with secrets and identifying data removed.

The maintainer will review reports and coordinate a fix or mitigation. No response-time or remediation-time guarantee is currently offered.

## Security scope

Security-relevant areas include:
- Exposure or misuse of `REPORTS_STORAGE_CONNECTION_STRING` or other deployment credentials.
- Abuse of anonymous `/api/reports` and `/api/wifi-scans` endpoints, including rate-limit bypass and resource exhaustion.
- Unsafe handling or rendering of community notes, SSIDs, area labels, and geocoding responses.
- Unintended disclosure of SSIDs, approximate coordinates, observation timestamps, or other submitted information.
- Dependency, build workflow, Android companion, and Windows scanner vulnerabilities.
- Accidental collection or publication of device identifiers, access-point MAC addresses, passwords, or precise home locations.

## Data and testing precautions

Community outage reports are public community observations, not official utility telemetry. Shared Wi-Fi observations include network names (SSIDs), signal metadata, timestamps, and approximate coordinates and may be visible in the nearby feed for up to 15 minutes. The API uses anonymous access and its current abuse controls are limited; changing area labels may bypass per-area thresholds.

Do not submit private hotspot names, confidential network information, exact home coordinates, or information about networks you do not have permission to disclose. Do not probe third-party services, overload the public pilot, access another person's data, or test destructive scenarios without prior authorisation.

If a credential may have been exposed, notify the maintainer privately and rotate or revoke the credential immediately. Do not commit replacement credentials to the repository.

## Supported versions

Only the current default branch is actively maintained. This may change as the project moves beyond its pilot phase.
