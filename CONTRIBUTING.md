# Contributing to Fallback Atlas

Thanks for helping improve Fallback Atlas.

## Before opening an issue

- Check existing issues for duplicates.
- For bugs, include browser, device/screen size, steps to reproduce and what you expected.
- Do not include phone numbers, exact home addresses, private reports or credentials in screenshots.
- Distinguish reproducible bugs from ideas for future features.

## Development

1. Fork the repository and create a focused branch.
2. Install dependencies with \`npm install\`.
3. Run the site with \`npm start\`.
4. Run \`npm run build\` before submitting changes.
5. Keep changes small and document new external services, API keys, costs and usage limits.

## Project principles

- Label demo data clearly; never present it as live or verified.
- Do not request precise device location unless there is a strong, documented need and user consent.
- Keep reports privacy-preserving; avoid collecting names, phone numbers or exact home addresses.
- Respect upstream map/geocoding attribution, caching and rate-limit policies.
- Prefer free or low-cost services with an easy-to-replace integration.
- Add tests for new behavior when practical.
