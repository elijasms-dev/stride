# Shared fitness pacing: implementation and verification

Follow-up: the [all-distance stress review](../all-distance-stress/README.md) expands this coverage, documents six subsequently discovered defects and their fixes, and records the newer final results. The figures below retain the original implementation verification.

Verified 25 September 2026, Europe/Dublin. This report supersedes the [earlier diagnostic audit](../pacing/README.md), whose original results are retained. Changes are local; this work did not commit or push them.

## What changed

Stride now derives one versioned current-fitness result from a representative race benchmark. The same benchmark gives the same easy, steady/tempo, threshold, interval and repetition ranges across 5K, 10K, half-marathon and marathon plans. The selected plan determines race-specific targets, workout structure and training dose. A goal time does not substitute for measured current fitness.

`stride-daniels-1` implements the documented Daniels/Gilbert performance equations and training-intensity bands. Riegel remains a separate `riegel-1.06` race-equivalence calculation. Numeric reference tests use independently published performance and training tables, including novice values. Formulas, sources, tolerances and product assumptions are in the [research record](../../../research/pace-model-evidence.md).

- Explicit effort mode keeps effort guidance. Beginner run/walk plans and short strides do not acquire automatic numerical targets merely because a benchmark exists.
- Manual targets take priority for their specified roles. Tempo, threshold and repetition have separate controls; existing merged settings retain their meaning until reviewed. Manual heart-rate targets remain separate from benchmark-derived pace.
- Unsupported benchmarks retain their data and use effort guidance. Missing or older benchmark information generates confidence explanations; it does not trigger invented numerical age or terrain corrections.
- Typed effort roles replace dependence on cue wording when selecting a target. Exported targets identify whether their source is a benchmark or a manual setting.

## Prescription consistency

Pace targets, distance estimates, expected duration, quality-work minutes, weekly totals and export instructions now resolve from the same workout steps.

| Existing prescription | Effect of changing pace |
| --- | --- |
| Timed run or interval | Keeps its seconds; recalculates expected distance and weekly totals. |
| Distance run or interval | Keeps its metres; recalculates expected duration and checks session limits. |
| Completed, historical or otherwise protected workout | Retains its saved prescription and pace basis. |

Initial plan allocation may fit a new draft to the user's distance and time constraints. Refreshing an existing prescription cannot silently convert its endpoint type or shorten its distance to conceal a time conflict. A saved timed long run remains timed even if the profile's default measurement is distance.

Generation also accounts for the actual faster work sections when checking weekly capacity. This fixes a valid two-workout 5K week that was previously rejected after pricing all running at easy pace. Repeated long-run allocation no longer shrinks faster sections. Validation checks serialized step targets, time allowances, stored estimates and quality dose.

## Final verification

All commands below exited zero on the final application code:

| Check | Result |
| --- | --- |
| `npm test` | 2,920 passed; zero failed, skipped or cancelled |
| `npm run test:engine` | 12 additional tests passed |
| `npm run typecheck` | Passed |
| `npm run lint:app` | Passed |
| `npm run build` | Production build passed |
| Formatting check of changed source/test files | Passed |
| `npm run verify:pacing` | No unexpected errors or failed diagnostic contracts |

The build retains Vinext's informational notice that static analysis cannot classify some routes. No live device export delivery or deployment was performed.

The pacing audit crosses twelve benchmarks, four goals, time/distance prescriptions and automatic/effort/manual/heart-rate settings, plus 96 beginner cases. The standard matrix uses one quality workout per week; the broader regression suite separately exercises other workout frequencies and editing operations. These counts are synthetic coverage, not every possible input combination.

| Goal | Attempted | Generated and validated | Capacity rejections |
| --- | ---: | ---: | ---: |
| 5K | 120 | 120 | 0 |
| 10K | 120 | 120 | 0 |
| Half marathon | 120 | 102 | 18 |
| Marathon | 120 | 102 | 18 |
| **Total** | **480** | **444** | **36** |

The 18 half-marathon rejections report incompatible opening mileage, running-day and session-time constraints. The 18 marathon rejections allow peak long-run exposures of 22–24 km against the existing policy's 26 km minimum. These are separately recorded constraint outcomes, **not passing generated plans**. The audit identifies these existing policy responses; it does not independently establish that every policy threshold is optimal for every runner.

For the 444 generated plans:

- 31,920 workouts and 26,428 pace-target steps inspected.
- Zero stale stored distance estimates; zero plans with allocations outside their executable pace/distance bounds.
- All six focused diagnostic contracts passed, compared with two passing and four failing before implementation.
- 48 Riegel arithmetic/event mappings passed. Generated standard plans passed JSON round-trip validation.
- One pace-targeted workout per applicable standard plan was decoded from FIT and checked against Intervals text. This is sampled export verification, not an export of every workout or a live third-party sync.

The old audit found 168 generated plans with stale estimates and 133 with allocation mismatches. Both counts are now zero. Generated plans increased from 432 to 444; classified constraint rejections decreased from 48 to 36.

## Regression protection

All 20 original marathon scenarios without benchmark-driven pace changes retain their exact executable training prescriptions: dates, distances, durations, step endpoints, intensity, workout frequency and weekly totals. The benchmark-driven marathon scenario intentionally changes under the new fitness model and has independent checks for starting mileage, integer long-run progression, frequency, time limits and pace accounting.

Original marathon and v32 compatibility fixtures were left intact. New model snapshots are separate files. Compatibility tests preserve old executable hashes where appropriate and separately verify historical workouts for intentional pace-model migrations. Fixed-time refreshes, fixed-distance refreshes, repeated conversions, manual-only targets, unsupported benchmarks, quality-dose accounting, and legacy historical estimates have dedicated regressions.

## Example: current 5K in 25:00

Before plan-specific effort adjustments or manual overrides, the shared model produces:

| Training role | Pace range per kilometre |
| --- | --- |
| Easy | 6:03–7:14 |
| Steady / tempo | 5:28–6:00 |
| Threshold | 5:16–5:26 |
| Interval | 4:45–4:58 |
| Repetition | 4:33–4:36 |

These are estimated effort bands, not statistical confidence intervals or an instruction to use every band in every plan. Stride's steady/tempo naming corresponds to the documented M-intensity band; it is not a guaranteed sustainable marathon pace. The separate Riegel equivalents are 25:00 for 5K, 52:07 for 10K, 1:55:00 for half marathon and 3:59:47 for marathon. Marathon equivalence remains provisional without sufficient endurance preparation.

## Reproduction and evidence

From the repository root, run the commands in the verification table. `npm run verify:pacing` writes [machine-readable results](results.json) here and exits nonzero for unexpected generation errors, failed focused contracts, stale estimates or inconsistent allocations. Expected capacity rejections remain visible in the results.

Final `lib/**/*.ts` source SHA-256, using the audit script's ordered path/content hash:

`494ba12b882b96c491b4a46e4fa170cd937f078b1e5a97f048b8c9b99886f8dd`

Automated passing results establish the stated model and software contracts. They do not establish individual physiological suitability or validate automatic pace improvement without new performance evidence.
