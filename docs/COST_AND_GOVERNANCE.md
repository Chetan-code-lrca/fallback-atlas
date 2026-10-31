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
3. If you enable shared reports, create one **Standard / General-purpose v2 / LRS** Storage account and use the Table service only. The API creates the `Reports` table.
4. Avoid premium performance, geo-redundant storage, private networking, custom domains and paid add-ons for this prototype.
5. Keep the demo dataset small; the API reads a maximum of 250 reports from the previous 30 days.
6. Deallocate the workshop VM whenever you're not using it.
7. Set a Cost Management budget/alert for Azure for Students and review actual costs. **A budget alert warns you; it does not automatically stop resources or cap spending.**
8. Never commit storage connection strings, keys or tokens. Configure secrets only in the Static Web App server-side environment settings.

## Official references

- [Static Web Apps plans](https://learn.microsoft.com/azure/static-web-apps/plans)
- [Static Web Apps API support](https://learn.microsoft.com/azure/static-web-apps/apis)
- [Static Web Apps quotas](https://learn.microsoft.com/azure/static-web-apps/quotas)
- [Azure Table Storage pricing](https://azure.microsoft.com/pricing/details/storage/tables/)
- [Cost Management budgets](https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets)
