# Plan interface verification

Implemented all eight proposed improvements: Week and Full plan views, weekly
summaries, inline saved workout steps, a clickable weekly/long-run distance chart,
prescription-first workout details, before/after preference comparisons, a complete
printable/offline plan, and a mobile agenda with sticky week controls.

## Data and presentation contracts

- Calendar history uses recorded dates and canonical import deduplication.
- Weekly summaries and charts describe saved prescriptions. Race distance, skipped
  sessions and extra recordings do not inflate planned training totals.
- Distance targets, estimated distance ranges and planning time are distinguished.
  Internal race time allowances are not presented as finish-time predictions.
- Preference comparisons detect pace-only, effort-only, distance, duration and
  session changes. Unit conversions do not masquerade as rewritten workouts.
- Applying a preference preview retains the existing date/version checks.
- Printing includes every date from start through race day, all saved steps and
  recoveries, actual-date history and optional supporting activity. User content
  is escaped; the offline HTML contains no external assets or scripts.

## Verification

- Main suite: 1,494 tests passed, including 35 new presentation/export checks.
- Standalone training engine: 9 tests passed.
- TypeScript and production build passed.
- The 12-week marathon fixture renders all 84 days; Week view renders seven.
- Browser review used an existing 23-week saved plan: Full plan rendered 161
  calendar cells, including the one pre-start boundary day. The print document
  contained the 160 in-block dates from 15 September 2026 to 21 February 2027.
- Week selector, keyboard chart selection, inline repeat details, workout modal,
  preference preview and print-document generation worked in the local app.
- Desktop (1366 × 1000) and mobile (390 × 844) layouts were inspected, including
  light and dark themes. Plan and comparison views had no page-level horizontal
  overflow. The original device-theme preference and viewport were restored.
- Preference previews were reviewed without applying changes to saved training.

The in-app browser exposed the complete print document; an operating-system
printer dialog and physical printing were not verified. The existing build warns
about a large client bundle and missing referenced login/background JPEG assets.
These pre-existing assets were not replaced as part of the plan UI work.

The repository's old Sites hosting reference was previously rejected by the user
as the wrong website. This change is delivered through the GitHub branch and local
preview; no production deployment or hosting-access change was performed.
