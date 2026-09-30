# UI annotations and Today recovery — 30 September 2026

## Reported “Before your plan” error

The local preview server was not listening on port 3000 when investigated. A fresh browser opened the offline shell. Restarting the local server restored the saved journal.

Tested the reported boundary: September 14, before the September 15 plan start. The actual browser successfully opened the daily guide, switched guide tabs, closed with Close and Escape, returned to Today, and navigated to Plan. A second check after a full reload also succeeded. No button-specific exception was reproduced. The user could not recall the error wording, so the original error cause remains unconfirmed; no speculative training or dialog change was made.

## Completed annotations

- Weather appears as a compact current-conditions note beside today's workout on desktop and underneath it on mobile. Setup is in Settings. Missing/stale readings and readings for other selected dates are hidden.
- Heat, cold, rain, wind and storm advice links to its sources; this does not change saved training or prescribe pace adjustments. See `docs/weather-integration.md` for the source mapping and limitations.
- Removed the duplicate header sync badge. Save announcements and actionable connection, offline and pending-save notices remain.
- Plan leads with the saved race name and race date; an unnamed race retains the event-type fallback. There is no supplied logo field/asset, so no logo was fabricated.
- Replaced the separate key-run strip with small stars on long/quality prescriptions. Expanded details use the saved workout purpose.
- Removed the redundant weekly explanation, duplicate routine/chart block and bottom construction prose. Optional activity details remain accessible from the daily guide, warnings remain in shared notices, and export actions remain in the existing menu. No new footnote system was introduced.
- Progress leads with the existing blue weekly-volume/purple long-run chart, followed by all-time recorded stats. Recorded weekly activity remains separate and expandable. Missing estimates remain distinguishable from zero and race distance remains separate.

## Verification

- 95 focused tests passed across Plan/Progress, mobile navigation, Today summaries, workout details, daily guidance, deferred dialogs and weather.
- TypeScript check, application lint, production build and whitespace checks passed.
- Browser reviewed desktop and 390px mobile layouts, keyboard navigation and light/dark display. The mobile page width remained 390px; the graph scrolls within its own container.
- Used London only as a public city example for a live weather lookup. Cleared that test location afterward. No device location permission was requested. Restored the original Follow device theme and normal viewport.
- Saved plan and recorded runs were not changed. No commit, push or deployment performed.

Screenshots: `progress-desktop.png`, `progress-mobile.png`, `progress-mobile-light.png`, `plan-mobile.png`, `weather-desktop.png`, `weather-mobile.png`, `before-plan-dialog.png`.
