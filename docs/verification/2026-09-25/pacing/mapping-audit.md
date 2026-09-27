# Read-only pace mapping audit — 2026-09-25

Scope: current checkout; no application edits, dependency changes or index mutations. Synthetic scripts `/tmp/stride-pace-mapping-audit.mjs` and `/tmp/stride-pace-mapping-extra.mjs`; evidence JSON with the same names minus `.mjs`, plus `-results.json` for the first script. These probe generated plans and the real target/export functions. Rejected plan fixtures were retained as constraints, not counted as pace bugs. Known stale timed-distance estimates and manual-target scheduling priority are covered by the main audit and are not repeated here.

## Concrete additional findings

1. **Gentle custom road events can prescribe faster running than the race effort they replace.** With a 5K result of 40 minutes, valid generated custom 25K plans produce balanced race-rhythm targets **523–534 s/km** but gentle replacement targets **510–521 s/km**. For 30K: **529–540** versus **510–521**. These are 13/19 seconds per km faster, despite intensity dropping from 6 to 5 and the cue becoming steady. Both generated plans pass `validatePlan`. `lib/workout-targets.ts:205` bounds steady pace against event pace only for `5k`, `10k`, `half`; custom 25/30K uses the same half road recipes but bypasses that bound. Actual examples include `road-half-180s` / `road-half-long-blocks` after custom event contextualization.

2. **Numeric target selection depends on English display prose.** `lib/workout-targets.ts:168` checks `effort.startsWith('Steady and comfortable')` before race-rhythm. Changing only that phrase to “Comfortable and steady” in an actual generated gentle `road-half-180s` step changes its target from steady **388–399** to race **387–398 s/km**, without changing intensity or stimulus. Current authored standard-road phrasing works; this is a demonstrated fragile dispatch rule rather than evidence that all current gentle recipes are wrong. The general threshold rule independently maps intensity ≤5 to steady, so this wording dependency is especially material for gentle race-rhythm.

3. **Distance-ended quality accounting counts a planning allowance as delivered quality time.** A generated marathon plan with a 20-minute 5K benchmark, declared easy pace 7 min/km, 50 km/week, six days and two quality sessions contains “18 km · Long run · 4.285 km marathon effort” on 2026-10-18. Its work step is **4,285 m**, target **267–278 s/km**, retained `seconds: 1800`. The watch ends that step after approximately **19.07–19.85 minutes** at the prescribed range, while `qualityWorkMinutes` reports **30 minutes** because it always sums `seconds` (`lib/prescription.ts:56`). Weekly budgets/progression use this value. This is an accounting discrepancy, not a claim that the runner must hit the midpoint; exported program duration correctly calls distance-step time a planning allowance.

4. **Portable export misstates target provenance.** A generated automatic-only profile (`workoutTargets` absent) exports an easy target **485–496 s/km** with `basis: 'Explicit runner-supplied range, with effort cues retained.'` (`lib/program-export.ts:36`). It gives every saved target the same attribution, including calculated benchmark ranges. FIT and Intervals preserve numeric targets correctly in checked examples.

## Actual model and inputs

- `lib/fitness-pacing.ts:107–146`: Riegel exponent **1.06** predicts race duration. Threshold is predicted 60-minute race pace; tempo is threshold ×1.05; interval is the **faster** of predicted 5K and 20-minute race pace; `vo2Max` is an alias of interval; easy is predicted marathon pace ×1.20. These training conversions are explicit product heuristics, not outputs inherent in Riegel.
- Numeric fitness zones use only **benchmark distance and elapsed time**. Benchmark date, race versus time trial and course are validated and generate notices, but do not adjust pace. Replacing an undated road-unspecified 5K/30-minute result with a 998-day-old trail time trial produced identical numbers; the metadata correctly generated warnings. Training history, volume, longest run, frequency, difficulty, goal time, age, weather and elevation do not enter `calculateTrainingPaces`. History/difficulty still influence which recipes and effort bands are selected.
- At 5K/30 minutes the centers are: easy **490.98**, threshold **374.41**, tempo **393.13**, interval **351.83**, marathon **409.15 s/km**. Thus the interval heuristic is faster than the runner's benchmark 5K pace of 360. At 5K/40, interval **461.53** versus 5K **480**. `lib/marathon-workouts.ts:73,246,268` calls aerobic-power work “Current 5K effort”, but maps it to this faster global interval band. This is a **static recipe/model mismatch**; the bounded generated marathon fixtures yielded no aerobic-power sessions, so generated reachability was not established here. Do not report it as a generated failure from these fixtures.
- `fitnessPaceRange` (`:155`) creates floor(center−5) through ceil(center+5), generally an 11-second band. It is a watch execution band, not a confidence interval. There is no uncertainty adjustment based on benchmark distance, age or course.
- Goal affects **race pace**, plus the special standard-road steady ordering bound. Easy, threshold and interval remain shared fitness zones. Standard goals use exact 5/10/21.0975/42.195 km even when an unrelated `raceDistanceKm` is supplied; custom/ultra use the actual saved distance. Base uses a 5K race-range default. It would be inaccurate to describe the current model as scaling all training paces to the chosen race distance.

## Threshold, steady and manual targets

Actual generated half-marathon examples with 5K/30 minutes:

| Recipe / variant | Intensity | Actual automatic target (s/km) |
| --- | ---: | ---: |
| Established balanced road threshold | 6 | 369–380 (threshold) |
| Developing or gentle road threshold | 5 | 388–399 (steady) |
| Established balanced half rhythm | 6 | 387–398 (event pace) |
| Gentle half rhythm | 5 | 388–399 (steady) |

Thus a workout retaining stimulus `threshold` does **not** necessarily receive a threshold target: adaptation changes its intensity and role. The current standard-half mapping was coherent in these checks.

There is one saved manual **Tempo / threshold** band. Automatic mapping resolves that slot to threshold for `stimulus === 'threshold'` and to the 5%-slower tempo estimate for other >5-intensity fallback work (`lib/workout-targets.ts:214`). Explicit manual configurations use the same supplied band for both; there is no separate manual threshold and tempo value. Target settings initially show/prefill the threshold version (`lib/workout-target-form.ts:32,65`), and the UI currently explains that controlled automatic tempo can be slower. Switching to manual therefore loses that automatic stimulus-specific distinction. This is a representational limitation, not a demonstrated arithmetic error.

Other mapping rules: non-work/intensity<4 is easy; aerobic-power/economy >5 is interval; race kind or race-rhythm is event pace unless the steady prose override wins. Walking, recovery steps, hills identified by template-name regex and double-threshold pairs retain effort. Very short HR repeats omit HR; pace targets are still assigned to relaxed 20-second strides. Explicit effort mode disables all automatic targets; an incomplete manual configuration does not auto-fill missing bands.

## Checks without a confirmed defect

- **Miles:** benchmark form converts user distance via 1.609344 to canonical km; benchmark elapsed time remains minutes. Pace display multiplies s/km by 1.609344; parsing divides. Editing rounded strings can broaden an endpoint by ~1 s/km because validation rounds outward. Untouched manual mile drafts preserve original canonical endpoints exactly through `targetSettingsConfig` (verified 360/420 easy, 300/320 tempo, 330/340 race).
- **Race scope:** an explicit race band applies only when `${goal}:${raceDistanceKm ?? ''}` matches; missing/other-goal scopes suppress it, while matching scope applies. `updateWorkoutTargets` stamps the current scope after review. No actual silent cross-distance reuse was found. A standard goal's irrelevant distance field also participates in this string, but no valid user-flow bug was established.
- **FIT:** checked exported 485–496 s/km as approximately **2.016–2.062 m/s**, with fast/slow inversion handled correctly and decoder errors empty. Distance steps end at metres, timed steps at seconds.
- **Intervals:** uses canonical `/km Pace` and `mtr` distance syntax even when UI units are miles; these are explicit units, not a conversion loss. Recovery steps become `freeride`. Direct HR export is deliberately rejected with FIT guidance.
- **First-race:** current new beginner distance plans default to explicit effort mode (`lib/plan/first-race.ts:169`), retaining a deliberate user target override if present. C25K lessons bypass target application (`lib/workout-targets.ts:262`). A benchmark alone no longer creates numeric race/work targets for this path.

The custom gentle inversion and provenance error are independently actionable. The prose dispatch, merged manual band, interval cue/model mismatch and quality-time accounting should inform a unified pace/effort representation; they should not be generalized into claims that all current numeric conversions or standard-road mappings are broken.
