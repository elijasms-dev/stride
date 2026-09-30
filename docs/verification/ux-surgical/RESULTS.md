# Surgical UX fixes — 30 September 2026

All 22 requested items are done. No dependencies, training calculations, persistence, route definitions or workout actions were changed.

| Item | Result |
| --- | --- |
| 1 | Done — small Week/phase eyebrow; workout title remains largest. |
| 2 | Done — removed minimum hero height and automatic footer spacer; CTA gap is 24px. |
| 3 | Done — dark filled CTA with high-contrast text; existing callback retained. |
| 4 | Done — removed the session-details hint link from workout cards. |
| 5 | Done — distance and unit form the dominant stat; time/effort are secondary. |
| 6 | Done — saved main-set pace/HR summary appears beneath stats; absent data remains absent. Mixed prescriptions retain the existing varied-target summary. Completed actuals do not show prescribed targets as recorded data. |
| 7 | Done — stripped repeated distance prefix in Up next; distance/time each appear once. |
| 8 | Done — measured nav height + safe-area inset +16px used once as page padding. At 390px, 64px nav produces 80px padding with zero safe inset. Focus reveal stops above the floating nav. |
| 9 | Done — fixed a mobile flex-axis/basis conflict, not a missing chart. Header height 152px and day list begins at 568px in 390×844. |
| 10 | Done — filled active option. Browser verified Full plan exposes 23 weeks and Week exposes 1. |
| 11 | Done — star has a visible Key session label. |
| 12 | Done — phase gets a one-line explanation. |
| 13 | Done — blue/purple keyed legend chips match bars. |
| 14 | Done — chart units appear in both legend chips and accessible key. |
| 15 | Done — horizontal overflow, edge shadows, scroll cue, snapping and selected-week reveal. Week 20 was centered after selection. |
| 16 | Done — bold, contrasting filled week-number selection. |
| 17 | Done — measured chart buttons 44.17px wide at 390px. |
| 18 | Done — dark text on lime fill, contrasting day border and switch track/knob. |
| 19 | Done — existing Base UI switch semantics retained with visible track, knob and On/Off; both states tested. |
| 20 | Done — main-view secondary text has 14px minimum; existing readable semantic colours retained. |
| 21 | Done — underlined Garmin connection affordance within the existing focusable row button. |
| 22 | Done — main-view controls and menu options meet 44×44 minimums, retain focus rings and explicit selected-day labels. |

## Checks

- 3,362 tests passed; no failures/skips.
- Type checking, app lint, final production build and whitespace checks passed.
- All four views reviewed at 390×844 in light and dark themes. No document horizontal overflow; the chart owns horizontal scrolling.
- Verified original Open workout dialog, both schedule modes, chart selection/reveal, Motion On/Off, and Progress empty-state clearance above the nav.
- Browser error log empty at final check. Theme and Motion preferences restored; viewport override reset. No plan or journal records edited.
- Secondary text contrast: 7.36:1 light raised surface, 7.96:1 dark raised surface; workout surface minimum 7.30:1. CTA 16.52:1; selected lime text 16.93:1; day border against light canvas 4.36:1; switch track/knob 8.34:1 light and 8.64:1 dark.

## Files changed in this pass

Components:

- `components/AppLayout.tsx`
- `components/app/today-route.tsx`
- `components/app/today-workout-card.tsx`
- `components/date-rail.tsx`
- `components/journal-panels.tsx`
- `components/settings.tsx`
- `components/plan/inline-workout.tsx`
- `components/plan/week-schedule.tsx`
- `components/plan/progression-chart.tsx`
- `components/plan/phase-caption.ts` (new presentation helper)

Styles:

- `app/athletic-tokens.css`
- `app/app-shell.css`
- `app/today-stage.css`
- `app/stride-design.css`
- `app/daily-guide.css`
- `app/settings-profile.css`
- `app/plan-explorer.css`
- `app/progress-journal.css`
- `app/training-ink.css`

Tests:

- `tests/today-summary.test.mjs`
- `tests/ui-refactor.test.mjs`
- `tests/settings-profile.test.mjs`

This report and screenshots are in `docs/verification/ux-surgical/`. Other pre-existing working-tree changes are preserved.
