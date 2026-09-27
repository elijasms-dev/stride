# Existing assertions changed for the supplied reference

The user supplied `TRAINING_REFERENCE.md` and a task brief on 27 September 2026. These changes follow the two requested properties, not a recapture of whatever the implementation happens to generate. They do not establish that Stride reproduces a complete published plan or that the rest of its coaching rules have been validated.

## Bug 1: short-race recovery and retained quality

The supplied reference requires an interval/tempo session every week for the intermediate 5K/10K schedules. The requested replacement for full recovery is a smaller number of quality sessions, retaining at least one when quality was selected. The existing configurable back-off cadence remains; its default is every fourth week. Explicit zero-quality choices and separate beginner courses remain outside the intermediate reference.

| File | Previous assertion / assumption | Change and reason |
| --- | --- | --- |
| `tests/engine.test.mjs` | The default 10K must label week 4 `Recovery`, reduce its mileage and prescribe no hard workout. | Keep the recovery reduction/rebound and taper checks, but exercise a half-marathon. The reference explicitly retains half-marathon recovery and forbids a full 10K recovery week. New short-race reference tests separately require quality and no `Recovery` label. |
| `tests/distinct-long-run-balance.test.mjs` | The 5K week-4 runs must equal a previously generated `3.9 / 4.8 / 4.8 / 6 km` recovery week. | Preserve recovery long/easy separation and corruption detection using the half-marathon example. Assert an actual long-run reduction and supporting-run separation instead of pinning a superseded 5K recovery output. |
| `tests/road-overhaul-contract.mjs` | Every ordinary week must contain the profile's exact selected count, including two workouts in week 4. | On named 5K/10K back-off weeks, require exactly one when two were selected. Continue requiring the selected count elsewhere, including all ordinary half-marathon weeks. |
| `tests/road-overhaul-edits.test.mjs` | The same exact-count assumption applies after variety, measurement and preference changes. | Apply the same independently calculated count to the existing edit/history tests. The saved profile still has to retain the user's original selected count. |
| `tests/road-frequency-validation.test.mjs` | Applying a `Recovery` label to a 5K fixture exempts it from retaining any real quality work. | Keep recorded/manual exceptions, exercise the legitimate recovery exemption with half-marathon, and explicitly reject a forged 5K/10K recovery label and missing quality. This follows the supplied no-full-recovery rule rather than accepting labels as evidence. |
| `scripts/audit-plan-quality.mjs` | The independent example-plan audit flags a single quality workout on every fourth 5K/10K week as a lost workout. | Require the explicit reference back-off count on those weeks. Keep progression, workload, long/easy hierarchy and executable workout-variety checks intact. |
| `scripts/verify-training-contracts.mjs` | Public-operation sequences always expect two workouts when two were selected. | Expect one only on the prescribed short-race back-off cadence, retaining exact counts elsewhere and all baseline, history, serialization and running-frequency checks. |
| `tests/prescribed-work-cap.test.mjs` | The first generated ten-minute race-rhythm outing is implicitly a Race preparation outing, where the requested alternative is eligible. | Select a Race preparation outing with enough saved work for three three-minute repeats but not four (9 ≤ work < 12 minutes). Removing recovery advances exposures and creates an earlier Build outing; that phase must not be used to test a Race preparation-only alternative. Still assert the actual three-repeat prescription, nine work minutes, saved title, time limit and validation. |
| `tests/ui-refactor.test.mjs` | Summing decimal minute values before or after a ten-minute addition must have identical IEEE-754 bits. | Use a 1e-9-minute arithmetic tolerance for the same ten-minute difference. The observed discrepancy was approximately 4.5e-13 minutes; this does not permit a changed training duration. |

`scripts/short-race-reference-oracle.mjs` contains the independent expected-count calculation shared by the test/audit callers. It imports no production scheduling helper or runtime policy constants. It uses the supplied short-race property plus the explicitly retained cadence (`profile.recoveryWeeks`, default four); it does not infer expected counts from the generated workout list.

No old test was deleted. No endurance snapshots were regenerated to hide changes. Taper expectations are deliberately unchanged in the Bug 1 patch and belong to the separate Bug 2 change.

## Bug 1 verification of these assertion updates

- The targeted set covering engine/recovery, long/easy hierarchy, all road-overhaul scenarios and edits, example quality, public-operation sequences and UI comparison: **899 tests passed** (`/tmp/stride-bug1-stale-tests.log`).
- The phase-correct gentle-alternative fixture and the rest of its work-cap tests: **13 tests passed** (`/tmp/stride-bug1-gentle-alternative.log`).
- The new source-derived short-race recovery suite: **18 tests passed** before this assertion migration.
- After adding retained-slot and executable race-week mutation guards, the combined new recovery, existing frequency-validation and personalization suites: **120 tests passed** (`/tmp/stride-bug1-frequency-guards.log`).

The initial failures caused by genuine new generation refusals or hard-day adjacency were retained for production investigation. They were not changed into expected errors or removed to obtain passing tests.

## Bug 2: separate short-race taper windows

The supplied 5K table keeps the full long run in week 7 and tapers only week 8. Accordingly, its seven-day taper includes race day: D6 through D0, with the preceding Sunday D7 still untapered. The requested two-week 10K taper uses the same counting convention: D13 through D0; D14 remains outside taper. `mandatoryTaperWeeks` must return 1 and 2 respectively. The existing short-race reduction factor of 0.6 is retained, including both 10K taper weeks; no new reduction coefficient was inferred from the reference. Half-marathon retains its existing D14 boundary and 0.8/0.5 factors.

| File | Previous assumption | Change and reason |
| --- | --- | --- |
| `tests/road-overhaul-matrix.test.mjs` | Both named short-race tapers begin at D7. | Assert the supplied race-inclusive 5K D6 and 10K D13 boundaries. Keep half D14 exactly unchanged. |
| `tests/road-overhaul-contract.mjs` | The independent ordinary-week and taper-label oracle applies D7 to both 5K/10K. | Use D6/D13 to classify ordinary versus tapered weeks. The existing count, load, long-run and day-frequency requirements are unchanged. |
| `tests/road-overhaul-edits.test.mjs` | Future frequency checks treat 10K's newly tapered second week as an ordinary build week. | Use the same independently stated D6/D13 windows after edits, with half unchanged. |
| `tests/road-overhaul-helpers.mjs` | Opening and future capacity checks assume a shared D7 short-race boundary. | Apply D6/D13 for the named short events while preserving half/marathon offsets. This helper is also used by the declared-baseline compatibility tests. |
| `tests/road-taper-phase.test.mjs` | Named 5K and 10K both start on D7. | Preserve custom/endurance expectations and change only named 5K/10K boundary and factor probes. The 5K D7 probe is now 1; D6 is tapered. |
| `tests/plan-generation-stages.test.mjs` | Shared short-road factor table expects 5K reduction on D7 and no 10K reduction on D8. | Split the two literal expected tables. Check 5K D7=1/D6=0.6 and 10K D14=1/D13=0.6, leaving half's full table unchanged. |
| `tests/taper-reference.test.mjs` | Repeated 10K reviews are checked at the old single-week boundary. | Check the first day of the two-week taper (D13), confirm D14 is untapered, and retain the repeated-review no-compounding assertion. |
| `tests/taper-weekdays.test.mjs` | Only one 10K taper-volume bucket is checked, using D1..D7. | Check both 0.6 buckets with race-inclusive D0..D6 and D7..D13 windows across every race weekday. Half/marathon bucket factors and boundaries remain unchanged. |
| `tests/five-k-endurance.test.mjs` | Every 5K long run must finish at least eight days before the race; an unused branch still assumes periodic recovery. | Retain the user's week-7 long-run slot at D7, enforce the familiar duration ceiling, and explicitly disallow a full recovery label. Keep partial-start and alternate race-weekday coverage. |

No taper test is updated by copying a fresh generated distance or template identifier. The reference-derived timing determines each changed expected boundary; all custom/endurance expectations stay in place.

The existing `tests/workout-variety.test.mjs` requirement to retain a previously encountered recipe in taper was **not weakened**. The longer 10K taper exposed a genuine fallback regression: the most recent five-minute recipe no longer fit the final reduced budget, and selection introduced an unfamiliar two-minute recipe. Production now tries earlier familiar recipes before creating a new selection. The original variety guard passes unchanged.

The existing custom-5K taper-note assertion was also retained. It exposed a mismatch when the generic family helper's one-week result leaked into custom events whose daily taper remained two weeks. Production keeps that custom branch unchanged. After these corrections, the combined daily-phase, original workout-variety and new reference-taper suites pass **49/49 tests** (`/tmp/stride-bug2-boundary-and-variety-guards.log`).

## Final policy-version assertion

`tests/plan-refactor-compatibility.test.mjs` now expects `provisional-2026-09-27-v35`. The request described an older v30→v31 transition; the actual baseline was already v34, so the verified policy advances to v35. Its review status distinguishes the supplied reference-property checks and unchanged protected-family regressions from independent coaching review, which is still pending. No historical workout snapshots were rewritten.
