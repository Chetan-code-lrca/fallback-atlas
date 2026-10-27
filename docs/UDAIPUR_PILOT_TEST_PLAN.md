# Udaipur Pilot Test Plan

## Purpose

Test whether the prototype is understandable and useful for students who need to make decisions during a power or connectivity disruption. This is a usability test, not a live outage-monitoring trial.

## Important limitation

Reports are saved only in the submitter's browser. They are not shared with other students, so the current release cannot yet test whether community reports help a different person. Every map marker/status is demo data; never use it to make a real safety decision.

## Automated checks

The `Prototype tests` GitHub Actions workflow runs the frontend tests on pushes and pull requests.

## Manual test checklist

| ID | Test | Steps | Pass condition |
| --- | --- | --- |
| UDA-01 | Default location | Open the live site in a fresh/private browser tab | Snapshot and map label show Udaipur, Rajasthan |
| UDA-02 | Area presets | Search for Udaipur, Fatehpura, Hiran Magri, Pratap Nagar and Udaipur City | Each supported name updates the title and recenters the map |
| UDA-03 | Unsupported search | Search a PIN code or unrelated place | App explains that arbitrary geocoding is not connected; it does not pretend the map moved |
| UDA-04 | Demo disclosure | Click each map marker | Popup clearly identifies the status as demo/example data |
| UDA-05 | Report form | Submit a test report for mobile data, fixed broadband and power | Status, service and area appear in the local feed |
| UDA-06 | Browser persistence | Refresh the same browser after submitting a local report | That browser still shows the report; another browser is not expected to see it |
| UDA-07 | Service filters | Select each service filter in the report feed | Only reports for the chosen service are listed |
| UDA-08 | Privacy | Use the app without granting location permissions | App remains usable and does not request device GPS |
| UDA-09 | Mobile layout | Test at a narrow mobile viewport | Search, map, report dialog and filters remain usable without horizontal overflow |

## Small campus usability study

Ask 5–8 volunteers from the college/hostel community to try the prototype individually. Do not collect names, phone numbers, exact home addresses or device location.

1. Ask each person to find a Udaipur area on the map.
2. Ask them to explain what a demo status means and whether it is verified.
3. Ask them to submit a clearly labelled test report and find it again.
4. Ask: 'During an outage, what decision would this help you make?'
5. Ask: 'Would you trust a report more if it showed age, number of independent reports and verification status?'
6. Record only task success, confusion points and anonymous feedback.

## Proposed initial success criteria

- At least 4 of 5 testers can find a supported area without help.
- All testers understand that current markers/statuses are not live or verified.
- At least 3 of 5 can describe a concrete outage decision this tool might support.
- No tester believes a report submitted in this build was shared with other users.

If users do not see a clear use case, revise the idea before paying for or deploying a backend. If they do, the next milestone is a shared, moderated report API with expiry/freshness metadata.
