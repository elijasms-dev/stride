# Pacing audit and proposed algorithm

**Historical audit:** the approved replacement has since been implemented. See the [implementation and final verification report](../pacing-implementation/README.md). This document and its original results describe the pre-implementation code; the current audit script writes to the new report directory.

Audit date: 25 September 2026, Europe/Dublin. This is a test and design report, not an implemented pacing replacement. Application files and the existing staged changes were not modified by this audit.

## Decision

Stride already calculates benchmark-based paces, but it does not yet have a consistently integrated, sufficiently verified pacing system. Keep a single current-fitness estimate shared across race distances. The selected plan should determine race-specific effort, session structure and training dose; changing the goal distance alone should not change a runner's easy or threshold fitness.

Use Riegel for **equivalent race performances**, not as evidence that arbitrary training-zone multipliers are correct. Adopt a documented Daniels/VDOT-style training-zone model only with independently verified reference values and permitted implementation material. The research performed here supports that architecture; it does not certify a replacement set of numerical coefficients. Fix the prescription/accounting integration before describing the existing output as consistent.

## What exists today

`lib/fitness-pacing.ts` implements:

```
equivalentTime = benchmarkTime × (targetDistance / benchmarkDistance)^1.06
threshold = pace at the equivalent 60-minute race distance
tempo = threshold pace × 1.05
easy = equivalent marathon pace × 1.20
interval = faster of equivalent 5K pace and equivalent 20-minute race pace
```

Paces are seconds per kilometre, so a larger value is slower. `vo2Max` is an alias for interval pace; it is not a measured VO2max value. Targets generally use an approximately ±5-second execution band, not a statistical confidence interval.

`lib/workout-targets.ts` applies these paces to steps. Selecting 5K, 10K, half or marathon changes event pace. It also bounds the steady band for the standard shorter road events. Core easy, threshold and interval estimates remain shared. Explicit effort mode suppresses automatic targets; explicit manual pace and heart-rate modes are also supported. Beginner first-race plans default to effort, and couch-to-5K lessons remain effort-based.

Only benchmark distance and elapsed time enter the fitness calculation. Date, source and course generate warnings, but do not numerically change fitness. Weekly distance, longest run and availability constrain the plan rather than identify running speed. There is no automatic pace improvement merely because a week passes or a workout is completed.

## Fresh test results

The seven existing pacing-related test files completed with **160 tests passed, zero failed**. The broader diagnostic matrix deliberately checks additional contracts that those tests do not establish.

| Check | Result |
| --- | --- |
| Benchmarks | 12, from 5K in 15–40 minutes through marathon in 4:00–5:30 |
| Riegel mappings | 48 arithmetic and event-target mappings passed |
| Plan inputs | 480 across 5K, 10K, half and marathon |
| Generated plans | 432; structural validation passed |
| Generation rejections | 48 controlled `PlanError` results; excluded from generated-plan pace results |
| Generated workouts inspected | 30,960 |
| Pace-target steps inspected | 24,738 |
| Plans with stale stored distance estimates | 168; 7,134 affected workouts |
| Plans with allocated kilometres outside the executable target range | 133; 1,720 affected workouts |
| Focused diagnostic contracts | 2 passed, 4 failed |

The two affected-plan counts overlap and must not be added. The 384 standard-plan inputs cross twelve benchmarks, four goals, time/distance prescriptions, and automatic/effort/manual/heart-rate modes. Another 96 beginner inputs verify that a benchmark alone does not enable numeric targets. These are synthetic cases, including deliberate conflicts between manual pace and benchmark fitness, not a random sample of real users.

| Goal | Attempted | Generated | Stale-estimate plans | Allocation-mismatch plans |
| --- | ---: | ---: | ---: | ---: |
| 5K | 120 | 120 | 48 | 34 |
| 10K | 120 | 120 | 48 | 36 |
| Half marathon | 120 | 96 | 36 | 27 |
| Marathon | 120 | 96 | 36 | 36 |

Half-marathon rejections comprised 16 opening-baseline/session-limit conflicts and eight later weekly-volume/session-limit conflicts. Marathon rejections comprised 24 cases whose allowed long-run exposure fell below the existing preparation minimum. This audit retained those outcomes; it did not establish an independent oracle proving every rejection was appropriate.

Generated standard plans also passed JSON round-trip validation. For each such plan with numeric pace targets, one workout was decoded from FIT to check integrity and speed targets, and its Intervals text was checked against the saved pace targets. This is sampled export coverage, not every workout exported or a live third-party sync test.

### Confirmed gaps

1. **Applying a pace can leave old distance metadata.** A 40-minute timed run changed to a target implying 7.2–7.5 km retained a stored estimate of 4.3–5.3 km. Some screens recompute estimates, so the finding concerns stored consistency rather than every displayed view.
2. **Allocated kilometres can disagree with executable instructions.** The same timed example retained an allocation of 5 km. More generally, old planning allocations can remain after final targets are applied. If these are intended purely as budgets, they need a separate type and label; they must not masquerade as the distance implied by the prescription.
3. **Complete manual pace targets can still produce an unknown distance estimate.** Thirty minutes at 5:30–6:00/km implies 5.0–5.5 km, but `distanceEstimate` returns an unknown range if both the separate easy-pace field and benchmark are absent.
4. **Manual precedence is inconsistent with its documented contract.** With a 35-minute 5K benchmark and an explicit 5:30–6:00/km easy range, scheduling still uses 9:38/km when declared easy pace is absent. Conservative funding may be intentional, but the conflict must be explicit and the policy consistent; changing precedence alone is not a substitute for resolving contradictory inputs.

The two passing focused contracts establish unchanged core training zones when only goal distance changes, and no invented automatic threshold/interval target when the runner has no benchmark.

Additional read-only mapping checks found distance-ended quality work counted using retained planning seconds, display-text-dependent target selection, and automatic target provenance mislabeled as runner-supplied in program exports. See [mapping details](mapping-audit.md). These checks also found a custom-distance gentle-target issue outside the requested four-distance matrix; it is reported separately rather than included in the matrix counts.

## Concrete current-model example

Input: a recent **5K in 25:00**. These are current model outputs, not a newly approved prescription or guaranteed finish times.

| Goal | Equivalent finish time | Equivalent event pace |
| --- | --- | --- |
| 5K | 25:00 | 5:00/km |
| 10K | 52:07 | 5:13/km |
| Half marathon | 1:55:00 | 5:27/km |
| Marathon | 3:59:47 | 5:41/km |

The shared current training ranges are easy 6:44–6:55/km, tempo 5:26–5:37/km, threshold 5:10–5:21/km and interval 4:51–5:02/km. These come from the heuristics above. Passing their arithmetic tests does not demonstrate that these narrow bands suit every runner, weather condition or workout duration.

## Proposed implementation contract

### 1. Separate fitness evidence from goals and constraints

Capture benchmark distance, time, date, race/time-trial source and course; add whether the effort was representative and any recent interruption. Keep goal finish time separate. Prefer a recent representative measured performance. Store weaker estimated inputs as estimates, never as equivalent evidence. If no usable benchmark exists, keep conversational effort/run-walk prescriptions and invite later calibration.

Do not infer speed from weekly kilometres or longest run. Those inputs describe training exposure and endurance preparation. Do not apply an undocumented numerical correction for an old or hilly result; show reduced confidence and the reason.

### 2. Compute one versioned fitness result

Introduce a pure `deriveFitness(evidence, modelVersion)` function that returns source provenance, training effort ranges, race equivalents and confidence reasons. Use seconds/km internally and convert only at presentation/export boundaries. Separate easy, steady/tempo, threshold, interval and repetition roles rather than hiding distinct stimuli in one manual field. Reference-test the selected coaching model before enabling its numeric output.

The same benchmark should produce the same core fitness zones in all four plans. A faster representative benchmark should produce monotonically faster estimates. A desired finish time must never silently replace current fitness.

### 3. Let each plan select appropriate efforts and doses

Each step needs a typed effort role, such as `easy`, `threshold`, `interval`, `repetition` or `racePace`, plus the relevant race distance. Resolve targets from that role rather than English text, template-name matching or a generic intensity number. Plan generation selects suitable session duration, repetitions, recovery and frequency using readiness and the distance strategy. It does not accelerate every pace just because the race is shorter.

Keep a physiological race equivalence separate from a recommended race target. Marathon readiness needs specific consideration: either use a separately validated model with its required inputs or clearly label the short-race extrapolation as provisional. Do not add an arbitrary universal marathon penalty.

### 4. Establish explicit override rules

An explicit effort setting means effort. A manual range overrides the automatic range for its own role, with source provenance preserved. Missing manual roles remain explicit rather than being silently filled. Contradictory benchmark, manual and declared easy paces trigger a reviewable explanation of which target and scheduling basis will be used. Heart-rate targets require their own evidence or manual zones; a race time does not uniquely determine heart-rate thresholds.

### 5. Resolve one canonical prescription

Use `resolvePrescription(workout, fitness, overrides)` to derive pace targets, duration/distance estimates, quality dose and export instructions together.

- A timed 40-minute run owns its time; changing pace changes the derived distance range.
- A 5-km run owns its distance; changing pace changes its predicted duration and whether it fits the time budget.
- A distance-ended interval must not count a retained time allowance as measured or prescribed quality minutes.
- Store planning budgets separately from expected executable outcomes. Preview any resulting weekly-load conflict before applying a pace revision.
- All views, weekly totals, validation and exports consume the same resolved result. Preserve completed workout history and retain the model version used.

### 6. Recalibrate from evidence, then validate the whole plan

Apply new representative benchmarks or reviewed manual changes to future workouts. Do not equate completing an easy run with proof of faster fitness. Fatigue can reduce the next workout's demand without redefining the underlying fitness score.

Release gates should include independent model-reference fixtures; unit and monotonicity properties; cross-goal invariance; missing/stale/manual-conflict cases; first-race effort fallback; target-to-duration-to-distance consistency; quality-dose accounting; history preservation; and FIT/Intervals equivalence after settings changes, workout swaps and plan regeneration. The four failing contracts above must be resolved or explicitly redesigned before the new system is called complete.

## Research basis and limits

- [Official V.O2 FAQ](https://support.vdoto2.com/v-o2-faq/) supports deriving paces from current performance rather than aspirational goal time.
- [Daniels training definitions](https://vdoto2.com/learn-more/training-definitions) distinguish conversational easy running, approximately one-hour threshold effort, VO2 intervals and faster repetitions. These definitions do not validate Stride's current easy/tempo/interval multipliers.
- [V.O2 calculator explanation](https://news.vdoto2.com/2023/04/pace-calculator/) distinguishes performance equivalence from an assured finish prediction.
- [Vickers and Vertosick, 2016](https://link.springer.com/article/10.1186/s13102-016-0052-y) found Riegel marathon predictions substantially optimistic for many recreational runners; their alternatives incorporated prior performances and training mileage. This does not justify one universal penalty.
- [NHS Couch to 5K](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/) supports time/effort and run/walk progression for true beginners.

The architecture above is a product/engineering recommendation informed by these sources. Automated consistency checks cannot certify a training prescription's suitability for every individual. See the [full primary-source notes](../../../research/pace-model-evidence.md).

## Reproduction and evidence

From the repository root:

```sh
node --experimental-strip-types --test tests/fitness-marathon-overhaul.test.mjs tests/workout-targets.test.mjs tests/benchmark-input.test.mjs tests/road-steady-targets.test.mjs tests/run-distance.test.mjs tests/measurement-baseline-migration.test.mjs tests/workout-settings-contract.test.mjs
node --experimental-strip-types scripts/audit-pacing.mjs
```

The diagnostic script intentionally exits **1** while findings/rejections remain; it is not included in the normal test command. It writes [machine-readable results](results.json). Counts describe the current fixtures, not exhaustive coverage of all possible profiles.

Application source SHA-256 at audit: `d3381ddd9c65b9d675b4ca9103ef49ba87d2ba6a99d6a5a03f8ab1c0cc5ec059`. The application source hash includes the accumulated staged changes, not merely the last committed revision. Existing tests exiting zero and this audit exiting one are both reported intentionally.
