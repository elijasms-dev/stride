# Foundation and first-race audit

This audit covers zero-history foundation lessons and first-race plans for 5K, 10K, half marathon and marathon. It uses explicit admission expectations before calling the generator. It does not treat an unexpected `PlanError` as a successful result, and it does not infer physiological readiness from successful software validation.

## Matrix and independent checks

The 13,928 synthetic cases span pace inputs from 3 to 15 min/km, missing pace, retained manual targets and supported/unsupported benchmarks, time/distance display choices, two starting-mileage levels, every start weekday and event weekday, leap-year and daylight-saving calendars, all 127 nonempty availability masks, two/three weekly foundation outings, exact daily/weekly capacity boundaries, midnight boundaries, minimum-entry values and deliberately unsupported requests.

Independent checks include declared opening mileage/long-run preservation, selected dates, positive executable step durations, session caps, easy-only first-race work, unknown untargeted foundation distance, rest between foundation lessons, JSON round trips and the recorded product forecast screens. Entry and forecast numbers are Stride policy, not universal safe or sufficient training thresholds.

## Findings and correction

The initial run recorded 200 failures. Four were a real defect: a zero-history lesson with retained manual easy targets showed a fabricated numerical distance range even though every lesson step remained timed and untargeted. Generation had cleared the benchmark and declared easy pace but retained the manual-target fallback. Generation now clears that evidence for foundation lesson estimates; restoration also repairs affected saved lesson estimates. Actual recorded feedback remains separate. A focused regression in `tests/beginner-course.test.mjs` covers all four eventual race goals, generation and restored corrupt legacy estimates.

The other 196 initial failures exposed an omission in the audit's expected-admission calculation, not an application defect. For the half-marathon profile with 25 km/week, an 8.75 km long run, three runs and 15 min/km, each of the two supporting 8.125 km runs requires 121.875 minutes, exceeding the supplied 120-minute weekday limit. The expected result now independently evaluates the opening supporting-run capacity and correctly requires rejection. Both the original and corrected reports are retained.

The corrected and final runs both passed all 13,928 cases: 13,546 generated plans and 382 expected rejections, inspecting 269,020 weeks and 844,898 workouts. The final run repeated the matrix after the other all-distance fixes. Its start/end library fingerprints match: `046cf50ec1b0bb8c03615542a0454b136e55c678acad5cd8b13b0759603fb7c3`. Its machine-readable result is `foundation-final/matrix.json`.

## Related funded-workout regression

The road stress matrix found that a 10K benchmark of 52:07.397 could remove a requested weekly workout while the approximately equivalent 25-minute 5K benchmark retained it. A funded 30-minute slot was converted to distance and back: `30 / (436 / 60) * (436 / 60)` evaluates to `29.999999999999996`; flooring it failed the 30-minute workout gate. Generation now reads the already-funded minutes directly. It still floors genuine fractional allowances and respects the original caps.

Four focused regressions in `tests/road-frequency-validation.test.mjs` exercise both benchmark distances and both measurement choices, preserving the 12 km opening week, 4 km long run and one complete workout. Seventy-one road/frequency regressions passed. The compatibility suite passed all 81 cases after updating only six current pace-model hashes; original v32 hashes and frozen history/frequency hashes were preserved.

`funded-minute-snapshot-review.json` records the isolated A/B verification. Restoring only the old floating-point expression through a temporary loader reproduces all 18 previous pace hashes exactly. Current plans retain baseline, IDs, dates, status, frequency, quality dose, workout type and recipe; executable durations, caps and serialization validate. Downstream allocation and rounding alter some recovery/taper minutes and distances, with the largest effect a custom-plan recovery week changing from 75.8/23 km to 74.3/22 km. This is recorded explicitly rather than hidden by numeric normalization.

## Reproduction and reference review

Run `node --experimental-strip-types scripts/verify-foundation-pace-stress.mjs NEW_RUN_LABEL`. Each invocation requires a new output directory and preserves older reports. See `published-plan-review.md` for primary-source comparisons with NHS, coach-authored Higdon novice/intermediate plans and B.A.A. plans, including deliberate policy differences and the limits of those comparisons.
