# UI annotations, round 3 — 30 September 2026

Implemented the 15 annotated changes across Today, Your plan, Progress and Settings.

- Today leads with Week X, a larger day label, and a full-width animated workout. Week arrows flank the day strip. The month heading, week dropdown and date disclosure are removed. Up next is a smaller panel below the workout.
- Notifications use a top-right bell and unread indicator, with an anchored panel. Critical error notices remain actionable.
- The plan eyebrow and weekly review are removed. Training insights now follow the plan schedule, with recorded volume, consistency, effort, quality execution and measured heart-rate coverage when available.
- The Progress chart uses a clean coloured selection and week-number pill. Settings opens with a prominent profile entry, and the routine browser-save hint is removed.
- Before the plan starts, Today shows a small note. The session-atmosphere import resolves and all day views render after a fresh reload.

## Validation

- Full test suite: 3,357 passed, 0 failed.
- Type checking, app lint, production build and diff whitespace checks passed.
- Desktop and 390 × 844 mobile visual checks completed. Mobile document width equals viewport width.
- Verified week navigation, rest-day guidance, the small before-plan note, notification opening/dismissal, Plan insights placement, Progress selection and profile prominence.
- Browser error log is empty following the fresh reload and final navigation.
- Existing saved plan and run records were not changed during browser checks. Temporary viewport overrides were reset.

## Heart-rate data

Future verified activity imports retain valid measured average and maximum heart rate. Client edits cannot invent imported measurements. Old records without saved heart rate remain unknown; this change does not backfill historical activities or infer zones.

## Screenshots

- `today-desktop.png`
- `today-mobile.png`
- `rest-mobile.png`
- `plan-insights.png`
- `progress-selection.png`
- `settings-desktop.png`
