# Road-plan edit, logging and recovery audit

Fixed simulation day: **2026-09-19**. Source HEAD: `f6e80a3352ec8539a98c5dcb7ec1598202e88eaa`; dirty source: **true**. Production source SHA-256: `19543c5bc04ae14459028fa82cef0bfe950ecb9df14dcc2a04f75ef0902c5161`.

Only 5K, 10K, half-marathon and marathon; production route handlers, production engine, actual SQLite migrations, synthetic isolated accounts, no network. No custom/ultra profiles are generated.

**24/24 cases passed; 864 accepted operations passed; 144 correctly rejected incompatible requests; 0 operations need review.**

Production source did not change during this run.

## Coverage

Every distance was tested with 0, 1 and 2 explicit weekday workouts, starting in both kilometres/distance and miles/time modes. Each case logged real past workouts through the plan route, corrected a log, manually shortened a future easy run, switched units and prescription measure, updated benchmark metadata/performance, applied effort/heart-rate/pace targets, repeated recipe preferences, changed frequency 0 → 1 → 2 → 0, round-tripped JSON, and exported/restored through production routes.

Expected rejections cover future benchmarks, insufficient background for two workouts, corrections without a reason, stale versions, unreviewed target fingerprints and future workout logging. An arbitrary PlanError is never accepted as a passing outcome.

Measurement conversion produced 36 recorded distance-precision normalizations, at most 0.490196 metres. Converting a timed estimate to executable whole metres may round by at most 0.5 metres; all session dates/minutes and protected history must remain exact. Reapplying the same measurement must preserve every prescription exactly. This is reported separately from plan drift.

| Case | Passed operations | Correct rejections | Needs review |
|---|---:|---:|---:|
| 5k-q0-distance-km | 36 | 6 | 0 |
| 5k-q0-time-mi | 36 | 6 | 0 |
| 5k-q1-distance-km | 36 | 6 | 0 |
| 5k-q1-time-mi | 36 | 6 | 0 |
| 5k-q2-distance-km | 36 | 6 | 0 |
| 5k-q2-time-mi | 36 | 6 | 0 |
| 10k-q0-distance-km | 36 | 6 | 0 |
| 10k-q0-time-mi | 36 | 6 | 0 |
| 10k-q1-distance-km | 36 | 6 | 0 |
| 10k-q1-time-mi | 36 | 6 | 0 |
| 10k-q2-distance-km | 36 | 6 | 0 |
| 10k-q2-time-mi | 36 | 6 | 0 |
| half-q0-distance-km | 36 | 6 | 0 |
| half-q0-time-mi | 36 | 6 | 0 |
| half-q1-distance-km | 36 | 6 | 0 |
| half-q1-time-mi | 36 | 6 | 0 |
| half-q2-distance-km | 36 | 6 | 0 |
| half-q2-time-mi | 36 | 6 | 0 |
| marathon-q0-distance-km | 36 | 6 | 0 |
| marathon-q0-time-mi | 36 | 6 | 0 |
| marathon-q1-distance-km | 36 | 6 | 0 |
| marathon-q1-time-mi | 36 | 6 | 0 |
| marathon-q2-distance-km | 36 | 6 | 0 |
| marathon-q2-time-mi | 36 | 6 | 0 |

## Findings requiring review

None found in these cases.

## Boundaries of this result

- Synthetic application verification, not coaching/scientific validation.
- This audit does not establish hosted authentication, browser usability, watch delivery or production backup operations.
- Only comfortable established five-run baselines are used here; separate boundary audit covers constrained/new-runner inputs.

The paired `edits.json` contains all exact synthetic inputs, operation outcomes, status codes and reproduction commands.

Re-run the full audit: `node --experimental-strip-types scripts/audit-road-edits.mjs`.
