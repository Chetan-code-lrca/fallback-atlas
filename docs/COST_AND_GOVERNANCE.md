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
5. Keep the demo dataset small. Report reads examine at most 250 records from the previous 30 days; Wi-Fi reads examine at most 1,000 records from the previous 15 minutes.
6. Deallocate the workshop VM whenever you're not using it.
7. Set a Cost Management budget/alert for Azure for Students and review actual costs. **A budget alert warns you; it does not automatically stop resources or cap spending.**
8. Never commit storage connection strings, keys or tokens. Configure secrets only in the Static Web App server-side environment settings.

## Official references

- [Static Web Apps plans](https://learn.microsoft.com/azure/static-web-apps/plans)
- [Static Web Apps API support](https://learn.microsoft.com/azure/static-web-apps/apis)
- [Static Web Apps quotas](https://learn.microsoft.com/azure/static-web-apps/quotas)
- [Azure Table Storage pricing](https://azure.microsoft.com/pricing/details/storage/tables/)
- [Cost Management budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

## Data retention: actual behavior

The API's feed windows are visibility filters, not deletion policies:

- Community reports are queried from the previous 30 days and the API reads at most 250 recent report rows per request. Records older than that window are not returned by this query, but the code does not delete them from the Reports table.
- Wi-Fi observations are queried from the previous 15 minutes, with at most 1,000 rows read for a nearby lookup. Older observations are excluded from the feed, but the code does not delete them from the WifiScans table.
- There is no scheduled cleanup job, storage lifecycle rule, or API deletion endpoint currently implemented for these records.

Do not describe the 30-day or 15-minute feed windows as physical retention or guaranteed erasure. Before public rollout, agree a documented retention period for each data type, implement and test deletion, and explain the policy to contributors.

## Anonymous API abuse limitations

Both report and Wi-Fi endpoints use anonymous access. Current code-level pilot thresholds are 30 report submissions per normalized area per rolling 10-minute window and 250 Wi-Fi observation rows per area per rolling 10-minute window. A Wi-Fi request can contain up to 40 observations.

These are not global rate limits. The client-controlled area label can be changed to create a different counter key, and the count-then-write sequence is not atomic, so concurrent requests can exceed the threshold. The API currently has no account-based quota, reliable per-IP global limiter, reputation system, CAPTCHA, moderation queue, or report takedown workflow. Do not rely on these thresholds to protect an unrestricted public service.

A Cost Management budget is a notification mechanism, not a hard spending cap. Keep the storage dataset small and review actual Azure usage while the service remains a pilot.
