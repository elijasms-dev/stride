# Follow-up UI review — 18 September 2026

The review preserved the current visual design and checked whether Today, setup, workout details, the calendar and exports describe the same saved training data.

## Implemented

- Today and the date rail now use the same canonical recorded-workout identities and actual dates as the plan calendar. Retained completed runs remain accessible; duplicate imports are not repeated. Retired planned workouts cannot appear under Up next.
- Today no longer presents an internal race planning duration as a finish-time estimate. Distance-based and mixed sessions identify estimated duration; exact targets remain visible when estimates are hidden. Completed cards use recorded values, and missing feedback is explicit instead of falling back to the prescription.
- Race and long-run labels are consistent in workout details. Qualitative “By feel” effort no longer receives a numeric “/10” suffix.
- Completed workout details show saved execution and quality work, preserving the distinction between zero and unknown. Missing feedback has an Add run details action and keeps the original prescription separate.
- Quality-minute entry matches the API’s execution requirements and cannot exceed recorded running duration through the input control.
- Repetition grouping preserves different coaching instructions even when interval lengths and targets are identical.
- Onboarding reuses the full workout-step renderer. Distance targets, pace/heart-rate targets, repetitions and recoveries match the active plan; race distance is shown without a forecast finish time. Phone layouts keep measurements and expand controls aligned.
- Editing an incomplete timezone while race search is open shows a recoverable prompt instead of throwing a RangeError. Restoring a valid zone resumes search.
- Printed weekly totals exclude retained workouts from a previous plan. The regression case now shows 5 km rather than 25 km. Routine mile values use readable precision; exact race distances remain intact. Missing recorded results are distinguished from original prescriptions.
- Week phase labels agree across chart, schedule and export, including legacy boundary weeks.
- Login uses local SVG running-track artwork, replacing a missing photo. Metadata and legacy CSS no longer reference missing image files.

## Verification

- `npm test`: 1,516 passed, zero failures (22 additional regressions).
- `npm run test:engine`: 9 passed, zero failures.
- `npm run typecheck`: passed.
- `npm run build`: passed. The missing-image warnings are gone; the existing bundle-size warning remains.
- Oxlint on changed TypeScript files and new components: passed.
- `git diff --check`: passed.
- Browser checks: login at desktop and 390 px; onboarding preview with expanded 23 km long run at 390 px; incomplete timezone entered and corrected with race search open; race-day card and detail labels; plan navigation; restored original Today selection. No browser console errors at the end of the checks.
- Saved training plan was not replaced. The temporary verification draft was discarded and viewport overrides were reset.

## Further improvements worth a separate pass

1. Benchmark entry currently requires kilometres and decimal total minutes. Selected-unit distance entry and an `hh:mm:ss` finish-time input would reduce conversion mistakes.
2. Secondary modal screens are eagerly imported. Loading them when opened, with accessible loading and retry states, could reduce initial JavaScript. Measure the improvement against the current bundle before changing all imports.
3. The existing API blocks both logging and correcting a workout before its scheduled date, even if an attached recording has an earlier actual date. The UI now reflects that existing restriction. Supporting early recorded runs would need a deliberate API validation change and integration tests.

The stale Sites hosting reference was not used and no deployment was made.
