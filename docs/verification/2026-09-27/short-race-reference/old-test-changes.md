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
