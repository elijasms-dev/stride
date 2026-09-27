# Training viability review — 24 September 2026

**Concrete prescription defects fixed; all final automated checks pass.** This review covers 5K, 10K, half-marathon and marathon, plus custom-distance, ultra and base-plan regression checks. It inspects saved daily runs and executable steps, rather than relying only on `validatePlan`.

Policy: `provisional-2026-09-24-v34`. Existing saved policies retain their validation scope. Account plans were not rewritten. Nothing was pushed or deployed.

## Problems found and corrected

| Issue | Before | Fix and verified result |
| --- | --- | --- |
| Hidden long runs on easy days | A 55 km/week 5K runner with a 12 km recent long received a 14.5 km “Recovery run”. A 60/14 km 10K runner received 16.417 km easy. | Ordinary road easy outings cannot exceed the actual long-run allocation. Remaining volume is shared across eligible easy slots. The fundable 60/14 10K example retains 60 km and two workouts. The unfundable 55/12 5K two-workout combination produces a descriptive error. |
| Validation missed missing workouts and load spikes | Deleting a marathon weekday workout or inflating subsequent long runs could still pass validation. | Fresh forecasts check selected dates, exact executable marathon workout counts, complete main sets, consistency between steps and workout labels, weekly growth and long-run ceilings. One-second work fragments and demanding work disguised as easy no longer pass. |
| Gentler half-marathon workouts could be faster | With a 40-minute 5K benchmark, balanced half repetitions targeted 8:38–8:49/km; gentle repetitions targeted 8:30–8:41/km. | Automatically derived road steady pace cannot be faster than event effort. Explicit runner targets and approved marathon targets retain their meaning. |
| Phantom taper in custom/ultra plans | An unscheduled Sunday exempted earlier untapered runs from progression checks: custom weekly distance fell 84→81.2 km; ultra long distance fell 39→35 km. | Taper membership follows scheduled dates for these families. Ordinary-week progression remains enforced. |
| Partial final base weeks corrupted earlier weeks | A Monday ending could collapse the last long run to five minutes and propagate reductions backward. | Generate the complete final base week internally, then crop to the requested finish. The 60/23 example retains the same 23 km Monday run as a Sunday-ending counterpart. Earlier prescriptions remain identical. |
| Vague preparation advice | Extending the timeline appeared to help low-baseline half runners even when fixed volume or duration limits prevented sufficient exposure. | Generation and read-time assessment now explain when additional weeks cannot remove a capacity limit: build and log a base, then review from recorded running. |
| Unrealistic accepted fixtures | Some tests declared 24 km across three runs with a 6 km longest outing. | Contradictory inputs remain as explicit rejection regressions. Accepted examples use possible routines. Surplus-funded ordinary road outings are called easy, rather than recovery. |

The allocator also rechecks day-level limits after whole-kilometre long-run normalization. An unchanged weekly total cannot conceal an oversized easy outing. A partial first week cannot accidentally establish an inflated full-week minimum.

## Final verification

| Check | Result |
| --- | --- |
| Full test suite | **2,791 passed; zero failed** |
| Independent viability sweep | **1,645 scenarios: 1,209 generated, 436 controlled rejections, zero failures** |
| Road contract matrix | **801 scenarios: 732 generated, 69 expected rejections, zero failures** |
| Weeks inspected across those scenario executions | **28,344** |
| Training state/edit contracts | **48 accepted cases, 4 expected rejections, 576 operations, zero failures** |
| Approved marathon prescriptions | **21/21 snapshots unchanged** |
| TypeScript / application lint | **Pass / pass** |
| Production build | **Pass**, using the repository’s CI command, `npm run build` |
| Patch whitespace | `git diff --check` passed |

The independent sweeps and road matrix execute overlapping profiles; the combined 2,446 cases are scenario executions, not 2,446 unique runners. Rejection is successful only where constraints or eligibility prevent a valid plan. No accepted-plan failure or uncontrolled exception remained in these checks.

The Sites build wrapper rejected the two pre-existing package-manager lockfiles (`package-lock.json` and `pnpm-lock.yaml`). CI uses npm. Both lockfiles and dependencies were preserved, and the actual production build passed.

## Independent coverage

| Sweep | Scenarios | Generated | Rejected | Failures | Weeks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Road abilities | 81 | 63 | 18 | 0 | 798 |
| Endurance baselines | 504 | 252 | 252 | 0 | 4,016 |
| Calendar and custom distances | 828 | 755 | 73 | 0 | 13,353 |
| Adversarial boundaries | 232 | 139 | 93 | 0 | 2,062 |

Cases cover 0/1/2 weekday workouts; developing, returning and established routines; 2–7 running days; clustered availability; 4:00–10:00/km scheduling paces; fractional baselines; time/distance prescriptions; maintained and growing volume; short blocks and timelines up to 52 weeks; start/race/long-run weekdays; weekly and daily time limits; benchmarks and explicit pace ranges. Custom distances span boundary values through 100 miles.

Checks inspect exact opening funding, every selected day, easy outings relative to the actual long run, complete quality sets, warm-up/cooldown, demanding-session spacing, integer long-run growth, ordinary-week monotonicity, taper, step/time agreement, race timing and JSON round trips. The 66 calendar regression checks include 48 exact-prefix comparisons for partial final base weeks and four timezone comparisons. Twelve deliberately corrupted-plan tests verify that invalid prescriptions are rejected.

## Example progression

These examples describe established five-day runners with recent quality history, two selected weekday workouts and a 6:00/km scheduling pace. The linked daily report also includes zero and one workout per week for every core distance. Ability-specific road examples are linked below.

| Distance | Starting weekly / long km | Twelve-week long-run sequence, km | Peak training km/week |
| --- | --- | --- | ---: |
| 5K | 55 / 13 | 13 → 13 → 13 → 10 R → 13 → 13 → 13 → 9 R → 13 → 14 → — → race | 62.6 |
| 10K | 60 / 15 | 15 → 15 → 15 → 11 R → 15 → 15 → 15 → 10 R → 15 → 16 → — → race | 69 |
| Half | 65 / 18 | 18 → 18 → 20 → 16 R → 20 → 22 → 22 → 17 R → 23 → 18 T → — → race | 80 |
| Marathon | 60 / 23 | 23 → 25 → 27 → 19 R → 29 → 29 → 31 → 21 R → 31 → 31 → 18 T → race | 69 |

R = recovery; T = taper. A dash means the shorter outing is labelled easy rather than long. Taper is date-relative and can begin partway through a week still labelled Race preparation. The daily report shows every run and rest day. Complete ordinary weeks retain the selected weekday workout count; recovery and taper have deliberate reductions. Long runs, relaxed strides and races are excluded from that count.

## Viability verdict and limits

The tested normal plans within their declared ability and availability passed the prescription checks. Conflicting inputs produce controlled errors instead of silently inflating easy runs or dropping workouts.

Accepted does not always mean complete event preparation. Shortened or capacity-limited previews remain **review-required**. In the independent ability/endurance/calendar cohorts, 2 half-marathon, 18 marathon, 26 custom and 21 ultra previews retained preparation warnings. The boundary sweep includes additional low-capacity cases. A developing half runner limited by the 120-minute long-run policy may need base building and another review even with many calendar weeks available. The engine does not invent fitness to claim readiness.

Published plans were used to review the pattern of load, easy support, quality and taper. These software checks do not establish an individual runner’s physiological readiness. Independent coaching review remains pending in the training policy.

## Published-plan cross-check

- [Higdon novice half-marathon](https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/) gives a 12-week example with progressively longer endurance outings, shorter support runs and a starting-running assumption. This supports checking actual daily allocations rather than only a tagged long-run field.
- [Higdon intermediate 5K](https://www.halhigdon.com/training-programs/5k-training/intermediate-5k/) separates easy support, quality and endurance running; a 5K plan’s long run need not stop at 5 km.
- [B.A.A. marathon training](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/) offers different training levels. It supports reviewing a range of appropriate long-run exposures, rather than forcing every runner to 35 km.
- [Higdon novice marathon](https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/) provides an 18-week, four-run example with a 20-mile peak.
- Previous detailed research: [road policy implementation](../../../research/road-policy-implementation-2026-09-23.md), [short-road plans](../../../research/short-road-plans-2026-09-23.md), [half-marathon plans](../../../research/half-road-plans-2026-09-23.md). These references do not independently certify Stride’s authored limits.

## Inspect and reproduce

- [Every day for all four distances, with 0/1/2 workouts](day-by-day.md)
- [Road matrix and ability-specific day-by-day examples](road-matrix/README.md)
- [Machine-readable summary](summary.json) and [final checks](checks.json)
- [Full example prescriptions](example-plans.json)
- [Independent road outputs](independent-road.json), [endurance outputs](endurance.json), [calendar outputs](calendar.json), [boundary checks](boundaries.json)

Run `npm test`, `npm run verify:viability`, `npm run verify:road`, `npm run verify:training`, `npm run typecheck`, `npm run lint:app` and `npm run build` from the repository. The generated reports include source hashes for reproducibility.
