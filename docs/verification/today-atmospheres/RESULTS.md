# Today workout focus — 30 September 2026

## Delivered

- Today opens with one prominent workout or rest panel. The calendar is available through Browse days.
- Empty dates before or after the block use a short note, without a modal or oversized panel. Actual recordings outside the block remain visible.
- Decorative animated SVG scenes reuse the existing run palette and drawn style: natural contours for easy/recovery, angled track strokes for quality, ridges and a trail for long runs, moon/stars for rest.
- Saved purpose, interactive session sequence, exact steps and daily preparation/recovery guidance appear below the main panel.
- Completed and skipped sessions retain recorded observations separately from their collapsed original prescription. Partial execution, easy substitutions and missing records are explicitly labelled.
- Motion respects the existing app preference and reduced-motion media query. Animations pause offscreen or in a hidden document; the artwork is excluded from accessibility output.

## Verification

- Focused Today, day-session, daily-guide, sequence, mobile, appearance and weather suites: 89 tests passed, including execution-label regression cases for partial sessions, easy substitutions and zero recorded quality work.
- TypeScript check, application lint, production build and diff whitespace check passed.
- Browser reviewed easy, quality, long and rest scenes; boundary note; opening/closing workout details; calendar navigation; fresh reload.
- Desktop and 390 px/320 px mobile layouts reviewed. No horizontal document overflow at 320 px. Mobile distance ranges use two metric columns to prevent awkward wrapping.
- Light and device/dark themes reviewed. With Motion disabled, computed animation names are all `none`. Original device theme and enabled motion restored after verification.
- Fresh reload shows Today’s saved session first. No new runtime errors during the final review; earlier transient development import errors occurred while the new component files were being integrated.

No training generator, pace calculations, saved plan or run records were changed for this UI task. API integration tests that mutate the live journal were not run. The existing training-update notice still requires the runner’s review to update an older saved plan.

## Screenshots

- `today-desktop.png`: current workout and natural underlay.
- `quality-desktop.png`: quality workout and sharper track sketch.
- `quality-mobile.png`: responsive quality session.
- `rest-mobile.png`: moonlit rest day.
- `long-320.png`: narrow long-run scene.
- `before-plan-desktop.png`: compact boundary note.
- `easy-light-static.png`: light theme with motion disabled.
