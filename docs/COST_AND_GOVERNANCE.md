# Cost and governance notes

## Current Azure footprint

- **Azure Static Web Apps Free:** keep the current frontend and managed HTTP Functions API on the existing free plan, within quotas.
- **Managed Functions API:** included in Static Web Apps API support; do not create a separate Function App for this HTTP-only API.
- **Azure Storage / Table Storage:** **not guaranteed to be free**. Storage capacity and transactions are billed separately; the pilot should use a small footprint, but check Azure Portal's pricing/estimate before proceeding.
- **Ubuntu VM `vm-fallback-atlas-dev`:** workshop resource only. Keep it deallocated except when actively needed. Disks/public IP and associated resources can still incur charges when the VM is deallocated.
- **GitHub Actions:** tests and deployment run on commits. Review GitHub included minutes/storage if usage grows.
- **Map/geocoder services:** current public endpoints do not require a project API key, but availability and usage policies apply.

## Recommended low-credit setup

1. Keep the current Static Web App on **Free**.
2. Don't create a separate Functions App, App Service, Application Insights workspace or paid monitoring service for this pilot.
3. If you enable shared reports, create one **Standard / General-purpose v2 / LRS** Storage account and use the Table service only. The API creates the `Reports` and `WifiScans` tables.
4. Avoid premium performance, geo-redundant storage, private networking, custom domains and paid add-ons for this prototype.
5. Keep the demo dataset small. Report reads examine at most 250 recent rows from a rolling 30-day window; Wi-Fi reads examine at most 1,000 rows from a rolling 15-minute window.
6. Deallocate the workshop VM whenever you're not using it.
7. Set a Cost Management budget/alert for Azure for Students and review actual costs. **A budget alert warns you; it does not automatically stop resources or cap spending.**
8. Never commit storage connection strings, keys or tokens. Configure secrets only in the Static Web App server-side environment settings.

## Official references

- [Static Web Apps plans](https://learn.microsoft.com/azure/static-web-apps/plans)
- [Static Web Apps API support](https://learn.microsoft.com/azure/static-web-apps/apis)
- [Static Web Apps quotas](https://learn.microsoft.com/azure/static-web-apps/quotas)
- [Azure Table Storage pricing](https://azure.microsoft.com/pricing/details/storage/tables/)
- [Cost Management budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

## Data retention: implemented behavior

The API feed windows are visibility/query filters, not physical deletion policies.

- Community report reads use a rolling 30-day `createdAt` filter and stop after at most 250 report rows. Reports outside the query window are not returned, but the application does not delete those entities from the `Reports` table.
- Wi-Fi feed reads use a rolling 15-minute `createdAt` filter and stop after at most 1,000 rows. Older observations are excluded from the feed, but the application does not delete those entities from the `WifiScans` table.
- No scheduled retention cleanup, Storage lifecycle policy, or application deletion endpoint is implemented for these records.

Do not describe the 30-day or 15-minute windows as physical retention or guaranteed erasure. Before public rollout, agree and publish a retention period for each data type, implement and test deletion, and explain the policy to contributors.

## Anonymous API abuse limitations

The report and Wi-Fi endpoints use anonymous access. Current code-level pilot thresholds are:
- 30 report submissions per normalized area in a rolling 10-minute window.
- 250 Wi-Fi observation rows per area in a rolling 10-minute window, with a maximum of 40 observations in one request.

These are not global rate limits. Area labels are user-controlled; an uploader can change the label to create a different counter key. The count-then-write sequence is not atomic, so concurrent submissions can race and exceed the intended threshold. There is no account-based quota, reliable global per-IP limit, reputation model, CAPTCHA, moderation queue, or report takedown workflow.

Treat these controls as guardrails for a small pilot, not protection for an unrestricted public service. Do not enable public shared writes until the items in [Public-launch readiness](PUBLIC_LAUNCH_CHECKLIST.md) are addressed.

## Retention and launch governance

Before enabling a wider shared-data pilot:
1. Define the retention period for outage reports and Wi-Fi observations separately.
2. Implement a scheduled cleanup process and test that it physically deletes expired rows from the correct tables.
3. Add abuse controls that cannot be bypassed by changing area labels and remain effective under concurrent writes.
4. Add moderation, abuse reporting, and a removal workflow for sensitive or misleading submissions.
5. Monitor Storage growth, API failures, request spikes, and Azure costs.

A Cost Management budget/alert is a notification mechanism, not a hard spending cap.
