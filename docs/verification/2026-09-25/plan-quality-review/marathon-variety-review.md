# Reviewed marathon recipe and balance migration

The original `road-overhaul-marathon.json`, `pacing-v1-marathon.json`, `plan-policy-v32.json` and `plan-policy-pace-v1.json` remain unchanged. New snapshots are in `marathon-variety-v1.json` (21 scenarios) and `plan-policy-marathon-variety-v1.json` (18 successful named-marathon generation/edit scenarios). Rejection cases still use their original expected errors. Base and custom plans retain the existing snapshots.

## Before/after evidence

The prior marathon selector and recipe collection were reconstructed from the Git index over a copy of the pre-balance runtime, retaining the already-reviewed pacing model. This reproduced **all 21 previous marathon snapshots exactly**. The paired comparison covers those 21 scenarios plus 22 successful marathon/custom generation inputs from the policy fixture: **43 pairs, zero independent semantic failures**. Full per-week and executable-set differences are in `marathon-variety-ab.json`.

- Fifteen of the 21 marathon scenarios change executable sessions; all six zero-workout scenarios retain their executable prescriptions. The new balance marker and opening-allocation metadata are included in the full new snapshots even where training stays the same.
- All nine custom-event comparison scenarios remain exactly unchanged. The new recipe rotation and corrected second-workout role are scoped to the named marathon.
- All declared, complete opening-week baselines remain feasible and unchanged in these fixtures, including fractional starting distances. Scheduled dates, selected running/workout frequency, input history and training status are preserved.
- Sixteen weekly distance totals differ across the paired comparison. Thirteen occur in recovery/taper/race weeks, where the pre-existing time-envelope calculation follows the new executable recipe duration. The added role-balance rule trims two ordinary weeks in the six-day 100 km/q2 scenario: 106 → 105.3 km and 112 → 111.4 km. The partial Wednesday opening changes 42 → 39.4 km. These are reductions of support that would crowd the long run, not new mileage from recipe variation.
- Ten long-run distances differ, all in recovery weeks, by at most 1 km. Ordinary long-run progression remains unchanged. No weekly allocation exceeds its input-based forecast ceiling.

The source-informed session families and their explicit Stride adaptations are documented in `marathon-variety-research.md`. Names or changed pace numbers alone do not qualify as variety: the dedicated tests compare executable work/recovery structures. Familiar, recovery and taper prescriptions retain their separate contracts.

## Independent regression checks

The snapshot tests also run `marathon-variety-contract.mjs`: declared input preservation; feasible opening weekly and long distance; selected weekday workout count; ordinary long-run progression; shorter supporting-run roles; 22% maximum work fraction; weekly forecast ceiling; session/day time capacity; work-duration accounting; and allocation within known pace endpoints. Public preference/recovery/shortening operations additionally preserve historical prescriptions and declared frequency. Prior numeric-model cases still match their frozen history/frequency hashes.

The reviewed snapshot, variety and seeded public-operation group passed **124/124 tests**. It includes all 48 seeded production cases and 576 operations. The separate measurement/prescription group, including the new conversion regression, passed **79/79 tests**; TypeScript checking passed. The broader current-source quality audit is reported separately in this directory.

## Measurement regression fixed

A valid 33 km timed long run included a 55-minute marathon-pace finish. Changing to distance previously split metres in proportion to elapsed seconds, undervaluing the faster finish at roughly 44 minutes; the reverse conversion restored its 55 timed minutes while retaining the extra easy allowance and rejected the now-inconsistent allocation. The migration fallback also valued explicit faster work at the easy pace.

A measurement edit now funds the existing paced work endpoint first, to metre precision, and apportions the remaining distance to easy steps. Its fallback uses the actual step target and only funds missing relaxed time. Generation is unaffected by this measurement-only branch. The regression runs three time/distance round trips, checks the same funded long-run metres and complete timed quality dose, limits distance-endpoint rounding to less than one second of quality work, validates targets/caps, and verifies input immutability. The previously failing seeded `marathon-q2-time` case passes all 12 operations.
