# All-distance training and pacing stress review

> Follow-up: the day-by-day examples exposed session-balance and repetition defects that these earlier consistency checks did not test. See the [current plan-quality review](../plan-quality-review/README.md) and [replacement daily examples](../plan-quality-review/day-by-day.md). The counts below describe the earlier source revision.

Completed 25 September 2026. This review found and fixed six defects beyond the previous pacing audit. The final expanded matrices contain **20,944 scenarios**, with **19,527 generated plans or completed edit sequences**, **1,417 separately recorded refusals**, and **zero unexpected failures**. These are synthetic scenarios, with some overlapping profiles across suites, not 20,944 unique runners or exhaustive enumeration of every possible input.

All changes remain local. No commit, push or deployment was performed.

## Results

| Matrix | Attempted | Generated / accepted sequences | Refused inputs, separately recorded | Unexpected failures |
| --- | ---: | ---: | ---: | ---: |
| Standard 5K, 10K and half marathon | 1,732 | 1,127 | 605 | 0 |
| Zero-history and first-race plans, all four road events | 13,928 | 13,546 | 382 | 0 |
| Marathon, custom events, ultra and base | 5,084 | 4,680 | 404 | 0 |
| Pace edits, measurement, variety, history, restore and exports | 200 | 174 | 26 | 0 |
| **Expanded total** | **20,944** | **19,527** | **1,417** | **0** |

The three generation matrices inspected **387,896 weeks and 1,504,631 workout rows**. The edit matrix additionally inspected 170,664 prescription snapshots after successive operations; those are repeated checks, not unique workouts.

The original **480-case pacing matrix** was also rerun separately: 444 generated plans, 36 capacity refusals, zero stale estimates, zero distance/pace allocation mismatches, and all six focused diagnostic contracts passing. These cases are not added to the expanded total above.

Final software checks:

- `npm test`: **2,955 passed**, zero failed, skipped or cancelled. Includes 35 new regressions compared with the previous 2,920-test suite.
- `npm run test:engine`: **12 additional tests passed**.
- Type checking, application lint and production build passed. Changed audit scripts and their new regression files also passed lint and formatting checks.
- The road matrix was rerun twice on identical source; all 1,732 case results were identical. Beginner, endurance and edit matrices were rerun after their fixes. Final generation sweeps verify source hashes before and after execution.
- 1,862 FIT encode/decode checks and 1,768 supported Intervals text exports passed. Another 94 absolute-BPM export attempts were explicitly refused because that output format is unsupported. No physical watch or live third-party synchronization was tested.
- 19,922 completed-history snapshot comparisons passed. Fifty-two pace edits that would exceed existing session limits were refused atomically without mutating the original plan.

## Defects found and fixed

| Issue | Impact | Fix and regression evidence |
| --- | --- | --- |
| Manual pace settings leaked into zero-history run/walk distance estimates. | A timed, untargeted NHS-style lesson displayed invented kilometres despite no usable running-distance evidence. | Generation and restoration now clear retained numerical pace evidence for foundation lesson estimates. Regression covers all four eventual race goals and JSON restoration. Actual recorded distance remains separate. |
| A funded 30-minute workout became 29 minutes through floating-point division/multiplication. | A 5K plan at 12 km/week and a 4 km long run lost its selected workout with a 10K benchmark of 52:07, while a nearby 5K benchmark worked. | Week generation reads the already-funded minute allowance directly. Four benchmark/measurement combinations retain one complete workout and the exact 12/4 km opening. |
| Rounded five-minute easy outings could not absorb a small mileage remainder. | A valid 30 km/week, 20 km long-run, six-day routine at 6:00/km was rejected while final totals were being reconciled. | Funding restores the minimum metre allowance before distributing the remainder. Six regressions cover 5K, 10K and half in both measurement modes, preserving mileage, long run, workout count and minimum duration. |
| Marathon quality reduction discarded a selected weekday workout while retaining optional faster long-run work. | Supported two-workout profiles at 45/16, 70/23 and 90/28 km failed generation despite available time and quality allowance. | Reserve a complete minimum dose for each selected slot, protect those slots from being used as easy-time donors, and reduce optional long-run quality first. Eighteen regressions cover both measurement modes and effort/benchmark/manual targets. |
| Time-to-distance conversion invalidated a previously reviewed pace-derived estimate. | A legitimate fractional estimate became an invalid “new long-run progression” after explicit measurement conversion. | A narrowly scoped `pace-edited-time` provenance marker retains the origin of the reviewed estimate through conversion and recovery. Fresh generation, generic preference changes and direct distance-target edits do not acquire this exemption. |
| Pace review treated newly derived timed long-run kilometres as a fresh distance progression. | Fixed-duration marathon runs could fail validation after a slower pace edit, even though their prescribed durations had not changed. | Reviewed timed estimates are excluded from generation-only whole-kilometre/progression comparisons. Step-derived estimates, time limits, current totals, provenance and all other structural checks remain enforced. Six regressions cover both editing defects, malformed data and protected history. |

The marathon repair chooses an existing complete smaller controlled workout when a larger recipe cannot fit. It preserves the requested frequency and available workload; it does not attempt to optimize for the largest possible alternative workout.

## Input coverage and independent checks

The combined matrices cover 5K, 10K, half marathon, marathon, base, custom distances and ultras through 100 miles. Custom probes include both sides of the 7.5, 15, 30, 45, 60 and 80.4672 km policy boundaries.

Inputs include zero running history; multiple beginner and established starting-mileage levels; 15–105 km/week endurance profiles; fractional weekly and long-run baselines; 3:00–15:00/km declared easy paces; mile, 5K, 10K, half and marathon benchmarks; separate manual effort roles; effort-only and heart-rate targets; zero, one and two weekday workouts; time and distance endpoints; different block lengths; all start/event weekdays; leap-year/DST cases; and all 127 nonempty weekly availability masks in the foundation audit. Not every dimension is crossed with every other dimension; the scripts record the exact combinations tested.

Checks go beyond `validatePlan`: preserve valid opening input mileage and long distance; retain selected frequency in ordinary weeks; keep recovery/taper exceptions explicit; prevent unexplained progression dips; use whole-kilometre long-run growth where required; respect individual session limits; separate demanding days; retain complete repetitions, warm-up and cooldown; reconcile step durations and kilometres; calculate quality dose from executable steps; preserve history and endpoint ownership; validate JSON recovery; and compare exported endpoints/targets. Internal validation runs afterward as an additional check.

## What the refusals mean

Refused inputs are **not passing training plans**. Of the 1,417 expanded-matrix refusals, 1,190 are expected eligibility, invalid-input or independently bounded capacity outcomes; 227 are explicitly recorded probes of the current bounded-quality allocation policy. Recognizing a policy refusal is not evidence that every other coaching approach would also reject that runner.

Examples:

- A 28 km long run at roughly 11:02/km needs about 309 minutes, beyond a 300-minute cap.
- A first half-marathon runner declaring 25 km/week, an 8.75 km long run and three days at 15:00/km needs 121.875 minutes for each remaining 8.125 km run, beyond a 120-minute weekday limit.
- A three-day 18/6 km 10K profile with a 25-minute 5K benchmark can conflict with the entry workout's bounded aerobic padding. A fourth-day counterpart is required to generate and does generate without changing its 18/6 km baseline. These companion cases prevent an overly broad refusal from satisfying the test.
- Base training deliberately has zero harder workouts; its UI disables the other choices. Ultra plans beyond 50 miles support at most one. The audit does not treat these existing product policies as a new frequency bug.

Initial reports also exposed mistakes in the audit assumptions: 196 beginner capacity cases and base-profile workout normalization were initially misclassified. The reports distinguish those checker corrections from actual application defects. Original evidence is retained; failures were not all rebranded as software bugs or all dismissed as valid refusals.

## Comparison with published running plans

The [primary-source comparison](published-plan-review.md) reviews NHS Couch to 5K, eight novice/intermediate Hal Higdon event plans and B.A.A. 10K/marathon guidance. The comparison checks starting ability, number of runs, easy versus quality work, long-run exposure, recovery and taper—not exact imitation of one table.

Examples of alignment: zero-history runners use timed run/walk lessons and rest between outings; first-race road plans emphasize comfortable running; first-marathon samples retain easy running, stepback weeks and taper; experienced plans distinguish threshold, race-rhythm and repetition work. Labels such as “beginner” vary materially between publishers, so starting capacity is checked explicitly. The reports also identify intentional differences in peak mileage, taper length and recovery cadence.

This is evidence of software consistency and comparison with established planning approaches. It is not individual physiological validation or a guarantee that a supplied benchmark predicts an achievable marathon finish.

## Plans you can inspect

[Twelve complete day-by-day plans](day-by-day.md) cover all four standard road distances with zero, one and two weekday workouts, using different benchmarks and starting workloads. The tables contain every rest/run day, weekly mileage, long-run progression and workout count. Exact quality-session steps and pace targets follow each table. Together they cover 180 weeks and 860 workouts; [full saved plan data](example-plans.json) is included.

## Evidence and reproduction

| Evidence | Detail |
| --- | --- |
| [Road results](road-final.json) and [repeatability check](road-repeatability.json) | 1,732 cases; unchanged results across two complete final runs |
| [Foundation report](foundation-audit.md) and [final results](foundation-final/matrix.json) | 13,928 cases; initial findings and independently corrected admission assumptions |
| [Endurance findings](endurance-findings.md) and [final results](endurance-final.json) | 5,084 marathon/custom/ultra/base cases |
| [Edit findings](pace-edits/FINDINGS.md) and [results](pace-edits/results.json) | 200 sequences, refusal classifications, exports and immutable history |
| [Original pacing matrix rerun](pacing-confirmation/results.json) | 480 cases; no estimate or executable-allocation findings |
| [Snapshot A/B evidence](funded-minute-snapshot-review.json) | Six current pace snapshots changed only because the funded-minute rounding bug was corrected |

Original v32 and marathon historical fixtures remain untouched. All 20 unpaced marathon execution contracts still pass exactly. Six current pace snapshots changed after isolated old/new-source comparison confirmed unchanged history, frequency, opening mileage, quality dose and recipe identity. Small recovery/taper allocations changed downstream; the largest reviewed recovery-week difference was 75.8/23 km to 74.3/22 km. The report retains that difference rather than claiming every numerical prescription was unchanged.

From the repository root, choose new labels/paths to retain previous evidence:

```sh
npm test
npm run test:engine
npm run typecheck
npm run lint:app
npm run build
node --experimental-strip-types scripts/stress-road-pacing.mjs review-2
node --experimental-strip-types scripts/verify-foundation-pace-stress.mjs review-2
node --experimental-strip-types scripts/stress-endurance-distances.mjs --tag review-2
node --experimental-strip-types scripts/verify-pace-edit-stress.mjs --out /tmp/stride-pace-review-2
node --experimental-strip-types scripts/audit-pacing.mjs --out /tmp/stride-pacing-review-2
node --experimental-strip-types scripts/report-stress-example-plans.mjs
```

Final `lib/**/*.ts` fingerprint using the ordered relative-path/content convention shared by the road, foundation and pacing audits: `046cf50ec1b0bb8c03615542a0454b136e55c678acad5cd8b13b0759603fb7c3`. The endurance script uses a different path prefix in its hash and records matching before/after hashes of its own.
