# Fallback Atlas

**Know what still works.** Fallback Atlas is an open-source, mobile-friendly project exploring how communities can share local information about power, mobile data and fixed broadband availability during disruptions.

> **Current stage: UI prototype.** Statuses on the page are example data, not live network measurements. Reports created in the form are saved only in the current browser using local storage. They are not uploaded or shared.

## What this prototype includes

- A responsive dashboard for mobile data, fixed broadband and power.
- Clearly labelled sample status summaries and an illustrative, non-geographic map placeholder.
- Local report-form interactions and service filters.
- Local-only persistence for reports created in the browser.
- Privacy reminders that discourage entering personal information.

## Roadmap

1. Replace the illustrative map with a properly attributed map provider and approximate-area search.
2. Add a backend API and durable storage for community reports.
3. Add freshness and confidence indicators that are based on evidence and report age.
4. Consider an offline queue and safe synchronization after connectivity returns.
5. Document moderation, abuse prevention, data retention and privacy decisions.

## Run locally

Requirements: Node.js and npm.

\`\`\`bash
npm install
npm start
\`\`\`

Create a production build:

\`\`\`bash
npm run build
\`\`\`

## Technology

- React with Create React App
- Azure Static Web Apps for the current static hosting deployment
- Future backend and map-provider choices are intentionally deferred until their costs, privacy implications and terms are reviewed

## Privacy and accuracy

The prototype does not collect precise device location, does not call a live network-status API and does not send report-form entries to a server. Do not use the sample content to make real safety or emergency decisions.

## Contributing

Issues and pull requests are welcome. Keep reports privacy-preserving and make the source, age and uncertainty of status information visible.

## License

MIT. See [LICENSE](LICENSE).
