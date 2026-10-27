# Udaipur pilot test plan

## Purpose

Evaluate whether students can use Fallback Atlas to understand recent community reports about power, mobile data and fixed broadband. This is a usability test, not a live outage-monitoring trial.

## Important limitations

- The map base is real; demo markers are illustrative.
- Shared-report tests require `/api/health` to return `mode=shared`.
- Reports are not official utility data and are not independently verified.
- Do not collect names, phone numbers, exact home addresses or device locations.

## Automated checks

GitHub Actions runs frontend tests, API utility tests and the production build.

## Manual checks

| ID | Test | Pass condition |
| --- | --- | --- |
| UDA-01 | Default location | Dashboard starts in Udaipur, Rajasthan |
| UDA-02 | Global area search | Search another city; map recenters and Udaipur demo markers disappear |
| UDA-03 | Report form | Service/status/area are validated and shown |
| UDA-04 | Shared report | With storage configured, a report appears from a second browser after refreshing |
| UDA-05 | Local fallback | Without shared storage, report is labelled local/pending sync, never claimed as shared |
| UDA-06 | Freshness | Report shows its observation age; stale reports are not described as fresh |
| UDA-07 | Offline shell | After first online use, app shell opens offline; map tiles are unavailable |
| UDA-08 | Offline report | Submission stays local/pending offline and can be synced when the API returns |
| UDA-09 | Filters | Each service filter shows only matching reports |
| UDA-10 | Privacy | App does not request browser geolocation or require personal identifiers |

## Small campus usability study

Ask 5–8 volunteers to use the prototype in separate sessions:

1. Find a location and explain what the markers mean.
2. Distinguish demo data from shared community reports.
3. Submit a test report and refresh from a second browser if shared mode is enabled.
4. Explain what decision the information might support.
5. Explain what evidence they'd need before trusting the report.

Record task success and anonymous feedback only.

## Proposed success criteria

- At least 4 of 5 testers can find a location without help.
- Every tester understands demo data is not live status.
- At least 4 of 5 can submit a report or correctly explain why it remained local.
- At least 3 of 5 describe a concrete decision the project could support.
- No tester mistakes a community report for an official utility confirmation.
