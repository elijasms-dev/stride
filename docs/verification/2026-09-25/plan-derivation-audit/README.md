# Where the current plans actually come from

25 September 2026. This audit explains the current engine rather than changing it. The user requested the derivation of each distance/workout combination after questioning the quality of the generated plans.

**Finding: the engine is a stack of independently authored allocation and correction rules. Its outputs are mathematically traceable, but they are not transcriptions of a coherent external schedule. Several corrections interact in ways that change the intended training. Current validation accepts the reproduced defects below.**

## Coverage and evidence

- Recreated all 12 reviewed examples: 5K and 10K over 12 weeks, half over 16 weeks, marathon over 20 weeks, each with 0, 1 and 2 weekday workouts. All 180 weekly rows and the individual running days are in the [derivation trace](week-by-week-derivations.md).
- Ran 36 matched standard-plan inputs: four distances × three supplied baseline profiles × three workout counts. Within each group, mileage, long run, days, benchmark and recent quality history remain fixed; only the requested workout count changes.
- Ran 24 beginner-branch inputs: four distances × zero-history/first-race branches × three workout counts.
- Total: 72 attempted configurations, 45 generated, 27 refused generation, zero validation errors on generated plans. These are execution outcomes, **not 45 endorsements of training quality**. Several generated plans have the defects documented here. The half-marathon lower-baseline cases also explicitly require preparation review.
- The 12 original regenerated distance/session summaries match the saved examples. Read-only hooks captured the actual allocation stages, with no substitute implementation of those functions. Production source remained unchanged at SHA-256 `5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea`.
- Additional targeted probes reproduce measurement conversion and minimum-baseline beginner issues. They are recorded separately from the 72-case matrix.

Complete evidence: [machine-readable stages and inputs](derivations.json), [road analysis](road-analysis.md), [marathon analysis](marathon-analysis.md), [scheduling, recipe and beginner analysis](mix-and-beginner-analysis.md), and [measurement counterexample](marathon-measurement-counterexample.json).

## The actual decision sequence

1. **Select a branch.** Zero history routes to a timed beginner course. Beginner level with nonzero history routes to first-race rules. Standard road and marathon use different adaptive algorithms. Consequently a fix in the standard allocator does not fix the separate beginner allocator.
2. **Select days and eligible workout count.** The scheduler scores day combinations. In the reviewed examples, all seven days are available, so it replaces the preferred listed days with its favored pattern. Two workouts require at least five current runs, 45 km/week and two recent quality sessions in the standard gate.
3. **Choose an ability band.** Road bands use current frequency, weekly mileage and recent longest run. The bands assign long-run/time ceilings, preparation windows and weekly growth limits. These cutoffs are authored code constants.
4. **Convert a weekly kilometre budget into minutes.** The slow end of the model's easy pace is used to allocate time. This is 7:14/km for the 25-minute 5K benchmark, 7:00/km for the 50-minute 10K benchmark and 6:21/km for the 45-minute 10K marathon benchmark.
5. **Reserve the long run, choose quality recipes, and distribute the remainder.** Road plans use role/exposure ladders and a bounded recipe catalogue. Marathon plans may reserve a medium-long run; selecting two workouts removes that medium role and gives more of the remainder to quality-day easy padding.
6. **Apply multiple corrections.** Opening-mileage funding, time envelopes, quality limits, integer long-run rounding, easy/long percentage caps, variety refresh and weekly monotonicity reconciliation each alter the allocation. This sequence is repeated until it stops changing. A converged result only means the programmed rules agree with one another.

## All 12 opening combinations

E = easy, Q = weekday quality, M = medium endurance, L = long. Distances are km; three-decimal values reveal arithmetic remainders rather than physiological precision. Race distance is excluded from peak training totals. The whole-session distance of Q includes warm-up, recoveries, easy padding and cooldown.

| Plan | Supplied weekly / long / days | Opening running-day combination | Opening → peak weekly km | Start → peak long |
| --- | --- | --- | --- | --- |
| 5K, 0 Q | 30 / 8 / 4 | 5.2 E + 6.4 E + 6.4 E + 8 L | 26 → 30.75 | 8 → 10 |
| 5K, 1 Q | 30 / 8 / 4 | 5.2 E + 7.2 Q + 6.4 E + 8 L | 26.8 → 30.45 | 8 → 10 |
| 5K, 2 Q | 55 / 13 / 6 | 8.45 E + 8.4 Q + 8.45 E + 7.5 Q + 8.45 E + 13 L | 54.25 → 56.15 | 13 → 13 |
| 10K, 0 Q | 36 / 11 / 4 | 7.15 E + 8.8 E + 8.8 E + 11 L | 35.75 → 41 | 11 → 13 |
| 10K, 1 Q | 36 / 11 / 4 | 7.15 E + 7.5 Q + 8.8 E + 11 L | 34.45 → 39.1 | 11 → 13 |
| 10K, 2 Q | 60 / 16 / 6 | 9.508 E + 8.7 Q + 10.4 E + 7.7 Q + 7.692 E + 16 L | 60 → 66.6 | 16 → 16 |
| Half, 0 Q | 45 / 16 / 4 | 9.715 E + 9.715 E + 9.57 E + 16 L | 45 → 61 | 16 → 19 |
| Half, 1 Q | 45 / 16 / 4 | 10.4 E + 7.5 Q + 11.1 E + 16 L | 45 → 54.8 | 16 → 19 |
| Half, 2 Q | 65 / 18 / 6 | 10.247 E + 8.7 Q + 11.7 E + 8.2 Q + 8.153 E + 18 L | 65 → 76.34 | 18 → 21 |
| Marathon, 0 Q | 60 / 23 / 5 | 7.551 E + 14.961 M + 7.244 E + 7.244 E + 23 L | 60 → 77.929 | 23 → 35 |
| Marathon, 1 Q | 60 / 23 / 5 | 7.235 E + 7.717 Q + 14.961 M + 7.087 E + 23 L | 60 → 77.929 | 23 → 35 |
| Marathon, 2 Q | 70 / 23 / 5 | 12.197 E + 13.228 Q + 8.504 E + 13.071 Q + 23 L | 70 → 87.85 | 23 → 35 |

The original Q2 examples change the runner's baseline as well as the workout count. For example, 5K changes 30/8/4 to 55/13/6. Their better-looking distribution cannot be attributed simply to selecting two workouts. In the new matched middle-baseline road groups, Q2 is refused because four current running days do not satisfy the five-day gate; the audit does not quietly increase the baseline to obtain a passing output.

## Worked derivations

### 5K, zero workouts

The long starts at the declared 8 km. Tuesday is capped at 65% because Wednesday is another running day: 8×0.65=5.2. Wednesday and Friday are capped at 80%: 8×0.8=6.4 each. Total capacity is therefore 8+5.2+6.4+6.4=26 km. The opening 30 km input is reduced to that capacity.

The initial allocator actually produces approximately 7.327/7.327/7.327/8. A later reconciliation changes it to the above. The long ladder holds 8 km through weeks 1, 2, 3 and 5, so the same easy-run caps force repeated 26 km weeks. There is no separate published coaching reason for each repeated 5.2/6.4/6.4 outing.

### 5K, one workout

An established runner's opening threshold allowance is `min(14, recentWorkMinutes×0.8)`. Here `min(14,20×0.8)=14` minutes. That produces seven two-minute bouts. Six one-minute recoveries, ten minutes warm-up, fifteen minutes easy padding and five minutes cooldown bring the full outing to 50 minutes; resolving its mixed paces yields a 7.2 km distance-ended workout. Alongside 5.2, 6.4 and 8 km, the opening total becomes 26.8 km.

The initial four quality exposures are 7×2 minutes, 9×90 seconds, 7×2 minutes and 9×90 seconds. The history filter stops counting the early exposures at the preparation-window boundary, causing the opening dose to restart. Adding recipe variety did not remove that progression reset.

### 5K, two workouts

The advanced band has a 14 km/100-minute long ceiling. At the planning pace of 7.2333 min/km, the time ceiling is 100/7.2333≈13.825 km. Integer normalization floors that to 13 km, so a declared 13 km long has no room to grow. This is not a universal 13 km rule for 5K training.

Six chosen days put all three supporting easy runs on consecutive/adjacent days. Each is capped at 13×0.65=8.45 km. The two fully resolved workouts total 8.4 and 7.5 km. Therefore 13+3×8.45+8.4+7.5=54.25 km. The nominal weekly budget reaches 67 km, but the executable plan peaks at 56.15 after these constraints.

### 10K and half

The same calculation repeats with other authored bands. For 10K Q0, 11×(1+0.65+0.8+0.8)=35.75 km; replacing the middle easy allocation with the bounded 7.5 km quality outing gives Q1 34.45 km. The established 10K peak is 13 km. The advanced input already starts at its 16 km distance ceiling, so it holds 16.

The half's 45 km input fits within its initial 16 km long plus role capacities. With Q0, the remaining 29 km is spread among easy outings. With Q1, the fixed 7.5 km workout leaves 21.5 km to distribute across two easy runs. The first is capped at 10.4; the other receives 11.1. Later quality days have a bounded whole-session capacity, so the Q1 weekly peak is lower than Q0 even though both reach 19 km long. Advanced half has a 23 km/150-minute nominal ceiling; at the chosen planning pace the time limit and integer rounding yield 21 km.

### Marathon

60 km at 6.35 min/km is a 381-minute budget. The opening 23 km long consumes 146.05 minutes. With Q0/Q1, the medium endurance target is `min(21 km, weeklyKm×0.25, longKm×0.8)=15 km`. Whole-minute allocation turns it into 95 minutes/14.961 km. The remaining budget is spread around the other runs and later reconciled to the exact weekly sum.

With Q2, the medium role is removed. For the 70 km input the remaining weekday allocation uses weights 1/1.1/0.7/1.1. Both quality outings receive roughly 13 km despite initially containing only six minutes of tempo. Most of those outings are easy padding. The long ladder aims for 35 km, but preparation timing, fortnightly growth, separate long-run ceilings and normalization create its uneven sequence. See the full marathon analysis for every intermediate quantity.

## Reproduced defects and unresolved design conflicts

| Finding | Reproduction / impact | Cause |
| --- | --- | --- |
| Recovery reductions compound | 5K Q1 goes from 26.8 km in W3 to 16.25 in W4 (−39.4%). Its initial W4 long is 6, the time envelope makes it 5.806, integer normalization makes it 5, then the easy runs become 3.25/4/4. | Independent time, integer-distance and support-ratio corrections all reduce the same week. |
| Tiny time rounding removes nearly a kilometre | Half Q1's intended recovery long is 12 km/83.4 min. Flooring time to 83 min makes 11.942 km; flooring distance then makes 11 km. | Minute rounding followed by whole-kilometre flooring is a quantization defect, not an intentional coaching choice. |
| Measurement changes prescribed training | The same marathon Q2 long sessions contain 40/55/70 min marathon effort in time mode, but 31.5/43.315/55.125 in distance mode. Both pass validation. | Initial generation uses a proportional conversion path that does not preserve the paced work dose. |
| Extra hard long run does not replace a weekday workout | Marathon Q2 W5/W9/W15 contain two weekday workouts plus a hard long run. | A replacement branch is unreachable for the named marathon rhythm, despite comments/selection text promising replacement. The weekday-only count hides the third hard outing. |
| Opening mileage depends on future recipes | The opening target is the minimum capacity across all future ordinary weeks. A half Q1 input of 46.5 km/16 km long opens at 46 km despite the opening day's capacities allowing 46.7. | The algorithm lowers earlier load to avoid a later dip, instead of independently explaining a future workload change. |
| Quality progression restarts | All three road Q1 examples repeat their first pair of workouts after entry into the main preparation window. | History filtering discards the earlier planned exposures. |
| Marathon introduction still repeats | Q2 has four identical six-minute tempo exposures across its first two weeks. | Maintenance selection supplies strides, then frequency repair replaces them with the same fallback tempo. |
| Near-equal easy and long returns in mixed taper | Half Q1 W14 contains easy runs of 14.53 and 14.964 km beside a 15 km long. | Pre-taper weekdays are exempt from the cap when Sunday is already tapering. This is an explicit exception, but the displayed result recreates the user's complaint. |
| Beginner equality remains | Minimum first-race 5K emits 2.5/2.5/2.5 km; minimum first-race half emits 6/6/6. Both validate. | Separate first-race allocation preserves the input weekly total and only caps easy runs at the long distance; it excludes the latest standard-plan role rules. |
| Taper weekdays can rebound | Marathon Q2 Wednesday grows from 8.976 km in W19 to 10.394 km in race week. Total mileage still falls because the long is removed. | Race-week remaining volume is redistributed among fewer outings. This is a questionable shape, not proof of individual injury risk. |
| Explanation text can cite the wrong pace | Benchmark-based workouts claim a generic 7 min/km scheduling pace even when the actual value differs. | The description checks whether declared easyPace is blank, rather than the resolved model pace. |

## Why the earlier green results did not settle this

Tests checked serialization, totals, stored-history preservation, limits, count contracts and selected numerical invariants. Those checks are valuable software checks. Some of the training acceptance criteria, however, were derived from the very rules being implemented. A test that verifies a 65% cap or the chosen workout count cannot establish that the complete sequence follows a sound external programme.

The earlier broad audit also counted weekday quality separately from hard long runs, allowed mixed-taper exceptions and tested a measurement-preservation path that did not cover the fresh-generation path now reproduced. A stronger causal audit must follow the prescription through every transformation, compare the same runner across settings and preserve failures as evidence. This report does that; it does not certify the current plans.

## Reproduce

```sh
node --experimental-strip-types scripts/audit-plan-derivations.mjs --tag independent-rerun
```

Use a fresh tag: output files are exclusive-create so prior evidence is not overwritten. The script requires exact observer anchors, compares the 12 saved example summaries, records all inputs and verifies unchanged production-source fingerprints. No application implementation, commit or push was performed for this audit.
