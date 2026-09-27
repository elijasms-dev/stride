# Marathon derivation audit — 25 September 2026

Read-only audit of the current saved q0/q1/q2 examples, with direct calls to the current generation-policy and allocation functions. No runtime changes. The three saved plans pass current validatePlan with zero errors; that does not establish coaching quality.

## What these plans are

They are authored adaptive algorithms, not reproductions of external schedules. The header in lib/marathon-book.ts:3–5 says the model is informed by user-supplied Advanced Marathoning, third edition, chapters 1, 3, 6 and 8–12, and explicitly says the schedules are not transcribed. This audit verifies that attribution exists in code; it does not independently verify the book contents or the asserted provenance of the supplied file. Later recipes cite Daniels, B.A.A. and McMillan as inspiration in lib/marathon-workouts.ts:94–96. None of those labels provides an external source for each final day or exact kilometre.

## Shared inputs and why the comparison is not controlled

All three are established runners, five days per week, 23 km recent long run, 20 weeks, 28 September 2026 through 14 February 2027, gradual volume, balanced difficulty, 120-minute weekday ceiling, 300-minute long ceiling, and 10 km in 45 minutes benchmark. q0/q1 start from 60 km/week; q2 starts from 70 km/week. Thus differences between q1 and q2 combine workout-count and baseline changes. Their declared recent quality is respectively 0/1/2 sessions and 0/20/40 minutes.

The calendar solver changes requested days [Monday, Tuesday, Wednesday, Friday, Sunday] to Tuesday, Wednesday, Thursday, Friday, Sunday. It scores a hard-coded classic five-day pattern above the originally listed days because all seven days are available (lib/training-structure.ts:89–146). This creates four consecutive weekday outings and Monday/Saturday rest; it is not copied from a source schedule.

## Distance arithmetic

1. The benchmark produces an easy range whose slow edge is 381 sec/km; schedulingEasyPace returns 6.35 min/km (lib/fitness-pacing.ts:250–270). Weekly distance becomes a minute budget: 60 × 6.35 = 381 minutes, or 70 × 6.35 = 444.5 minutes. All quality work has its own faster target, but allocation starts with this one easy pace.
2. Each opening long is 23 km = 146.05 minutes. The allocator reserves 147 whole minutes, then distributes the remainder as whole minutes. The exact distance pass later reconciles small differences (lib/plan/generation-allocation.ts:358–452; lib/training-structure.ts:195–244; lib/plan/generation-baseline.ts:145–151).
3. q0: reserve a Wednesday medium run min(21 km, 60×25%, 23×80%) = 15 km. It becomes 95 whole minutes = 14.961 km. Initial ordinary minute allocations Tue/Wed/Thu/Fri are 47/95/46/46. Final exact opening reconciliation gives 7.551/14.961/7.244/7.244 km, plus 23 km long = 60.
4. q1: Wednesday is quality, so Thursday gets the same 95-minute medium run. Initial Tue/Wed/Thu/Fri allocations are 45/49/95/45. Final output is 7.235/7.717/14.961/7.087 km, plus 23 = 60. The Wednesday 6-minute tempo is surrounded by easy running: 10-minute warm-up, 25:58 aerobic padding, 6-minute tempo, 5-minute cool-down. The title names only six minutes of a 46:58 outing.
5. q2: the medium-long role is explicitly disabled (lib/training-structure.ts:252–261), leaving weights Tue/Wed/Thu/Fri = 1/1.1/0.7/1.1. Initial allocations are 76/84/54/83 minutes. Final output is 12.197/13.228/8.504/13.071 km, plus 23 = 70. Each quality day contains only six minutes of tempo, but about an hour of extra aerobic padding. This comes from using the quality outings as recipients of the weekly remainder, not a source prescription.
6. Starting mileage grows by min(3 km, 6% of existing load) on alternating eligible weeks, never in recovery, taper or race-preparation phase. A 1.4× baseline forecast ceiling and a reference-band ceiling also apply (lib/plan/generation-load.ts:129–166; lib/plan/policy.ts:87–105). Both examples fall into the code's foundation reference tier because even q2's 70 km is below the 72 km established-tier cutoff (lib/marathon-book.ts:20–42). Raw load therefore rises 60→63→66→69→72→75→78, or 70→73→76→79→82→85→88. The final executable totals are slightly smaller because of whole-minute allocation, pace conversion, caps and repeated normalisation. A 0.1–0.2 km weekly wiggle is a numerical remainder, not a physiological progression decision.
7. Long-run target is 35 km because intent is improve; finish intent would prefer 32 (lib/progression-engine.ts:23–35). The long progression begins at week 3 because a 20-week calendar contains a hard-coded 18-week preparation window. The integer ladder spreads 2 km advances across ordinary opportunities; an additional ceiling holds new long runs below 26 km until 12 weeks remain and 28 km until 8 weeks remain (lib/progression-engine.ts:79–143; lib/plan/generation-policy.ts:257–273; lib/marathon-model.ts:30–36). Budget share (normally 45%), previous long +2 km, duration limits, and the final backward normalisation pass can lower that ladder. That interaction causes the final 23/23/23/recovery/23/25/25/recovery/27/28/28/recovery/30/31/33/recovery/35 progression rather than a clean external sequence.
8. Every fourth non-taper week is recovery. Weekly running time is capped to 70% and long distance to 80% of the prior ordinary long; final executable-time capping can reduce the long again (lib/plan/generation-load.ts:64–67; lib/marathon-book.ts:75–76; lib/plan/allocate.ts:268–320). This is why q0 and q1 have different recovery long distances despite identical baseline and ordinary long progression. The code is capping running time after faster work alters prior-week duration.
9. Taper fractions are 75%, 60%, then 40% of retained load, but final race-week allocation divides the 40% budget among pre-race outings (lib/marathon-book.ts:65–72; lib/plan/generation-calendar.ts:164–169; lib/plan/generation-allocation.ts:118–123). This decreases weekly running but can lengthen individual weekdays after the long run disappears. Race distance is excluded from the training totals in the tables.

## Workout arithmetic and inconsistencies

- q0 has no quality and no strides. Its ordinary week is three supporting easy runs, one medium aerobic run and one long. The same early weeks are repeated intentionally by the progression clock, not selected from varied external schedules.
- q1 has one weekday threshold slot. The primary selector uses previous threshold exposures and a current dose allowance, then alternates a continuous effort with cruise/ladder/other families (lib/workout-library.ts:1315–1382). Many later workouts are 20–28.5 minutes of work because complete repetitions fit below the requested dose; 30 target minutes can become 3×1.6 km = 22.8 work minutes. This difference is a whole-repetition rule, not necessarily a defect, but it should be visible in explanations.
- q2 adds a separate interval/marathon-effort rotation. Its allowance is 14–24 interval minutes or 24–36 marathon-effort minutes based on exposure index, familiar dose and modulo-three rotation (lib/workout-library.ts:1156–1236). Those exact thresholds and rotation are authored heuristics.
- **Extra hard long runs:** q1 actually has two hard outings, and q2 three, in weeks 5, 9 and 15. The code says a marathon-effort long should replace a weekday slot, but the replacement expression only executes when !usesMarathonRhythm(profile); every named balanced marathon makes that false (lib/plan/generation-allocation.ts:320–329). The selector text also falsely promises that paced long runs replace the second slot (lib/workout-library.ts:1212–1236). Validation counts weekday quality separately and accepts the result (lib/plan/generation-rhythm.ts:109–125). This is a concrete contract conflict; whether the UI intends a weekday-only or total-hard count needs one consistent definition.
- **Initial measure conversion changes the dose:** fresh makePlan with the same q2 input gives timed marathon-effort long blocks of 40/55/70 minutes, but distance mode gives 31.5/43.315/55.125 minutes. Both keep long distances 23/27/33 km and targetWorkMinutes 40/55/70. The first 40-minute block becomes 6.3 km because distance is distributed by elapsed-time share using the 6.35 min/km budget, then its clock is recomputed at 5 min/km marathon pace. The recent preserve-dose fix applies only when preserveFundedDistance is true; the initial withWorkoutTargets call does not provide it (lib/workout-targets.ts:408; lib/run-distance.ts:174–203). Changing measurement therefore changes prescribed training by about 21%. This is a reproduced defect.
- **Introductory repetition remains:** q2 produces the same six-minute tempo twice in each of the first two weeks. In Maintenance the selector returns strides (lib/workout-library.ts:1142–1154); the frequency repair replaces it with the fixed six-minute tempo fallback (lib/plan/generation-rhythm.ts:264–283). Thus a post-generation repair defeats the variety strategy. These are 13 km outings containing six minutes of tempo, despite a declared 20-minute-per-session quality background.
- **Race-week weekday rebound:** q2 week 19 Tue/Wed/Thu/Fri is 8/8.976/5.8/8.8 km, but week 20 is 9.4/10.394/5.8/9.4 km. Its Wednesday session is 62:58 including a nine-minute tempo. The total still drops from 52.6 to 35 because the Sunday long is gone. It passes the current taper check because the comparison uses a pre-taper daily ceiling, not a strict last-week reduction. This is a questionable authored taper shape, not proven unsafe from code alone.
- **Misleading explanations:** generation-weeks.ts:425 claims 'Distance estimated at 7 min/km' whenever easyPace is null, even though these benchmark-based examples use 6.35. Five-day supporting runs are broadly called Recovery run because usesFiveDaySplit is true, including a 14.8 km q2 Tuesday before a workout (generation-weeks.ts:190–208). These labels explain code branches, not actual recovery logic.
- **Apparent precision is not coaching precision:** 7.235 km, 8.663 km and small weekly differences derive from whole-minute allocation, pace resolution, proportional step conversion and rounding. No external schedule was found in this pipeline that prescribes those values.

## Complete current marathon combinations

All kilometre values below are taken directly from the saved examples and displayed to three decimals. E = easy/recovery, M = medium endurance, Q = weekday quality, L = long. Hard count excludes the race and excludes brief strides, but includes marathon-effort long runs. Monday and Saturday are rest in every listed week. The race is Sunday of week 20.

### marathon-q0

Input: 60 km/week, 23 km long, 0 weekday workouts.

| Week | Phase | Training km | Tuesday | Wednesday | Thursday | Friday | Sunday | Hard outings |
|---|---|---:|---|---|---|---|---|---:|
| 1 | Maintenance | 60 | 7.551 E | 14.961 M | 7.244 E | 7.244 E | 23.000 L | 0 |
| 2 | Maintenance | 60 | 7.551 E | 14.961 M | 7.244 E | 7.244 E | 23.000 L | 0 |
| 3 | Foundation | 62.7 | 8.000 E | 15.700 M | 8.000 E | 8.000 E | 23.000 L | 0 |
| 4 | Recovery | 43.8 | 6.600 E | 6.400 E | 6.400 E | 6.400 E | 18.000 L | 0 |
| 5 | Foundation | 65.7 | 8.800 E | 16.300 M | 8.800 E | 8.800 E | 23.000 L | 0 |
| 6 | Foundation | 65.7 | 8.200 E | 16.300 M | 8.100 E | 8.100 E | 25.000 L | 0 |
| 7 | Foundation | 68.7 | 8.900 E | 17.100 M | 8.900 E | 8.800 E | 25.000 L | 0 |
| 8 | Recovery | 47.9 | 7.000 E | 7.000 E | 7.000 E | 6.900 E | 20.000 L | 0 |
| 9 | Build | 71.6 | 8.900 E | 17.900 M | 8.900 E | 8.900 E | 27.000 L | 0 |
| 10 | Build | 71.7 | 8.600 E | 17.900 M | 8.600 E | 8.600 E | 28.000 L | 0 |
| 11 | Build | 74.7 | 9.400 E | 18.700 M | 9.400 E | 9.200 E | 28.000 L | 0 |
| 12 | Recovery | 52.2 | 7.700 E | 7.500 E | 7.500 E | 7.500 E | 22.000 L | 0 |
| 13 | Build | 77.7 | 9.700 E | 18.800 M | 9.600 E | 9.600 E | 30.000 L | 0 |
| 14 | Race preparation | 77.7 | 9.500 E | 18.800 M | 9.200 E | 9.200 E | 31.000 L | 0 |
| 15 | Race preparation | 77.9 | 8.709 E | 18.898 M | 8.661 E | 8.661 E | 33.000 L | 0 |
| 16 | Recovery | 54.2 | 7.700 E | 7.500 E | 7.500 E | 7.500 E | 24.000 L | 0 |
| 17 | Race preparation | 77.9 | 8.126 E | 18.898 M | 8.031 E | 7.874 E | 35.000 L | 0 |
| 18 | Taper | 57.8 | 8.000 E | 8.000 E | 8.000 E | 7.800 E | 26.000 L | 0 |
| 19 | Taper | 45.4 | 6.400 E | 6.400 E | 6.400 E | 6.200 E | 20.000 L | 0 |
| 20 | Race week | 30.4 | 7.700 E | 7.700 E | 7.500 E | 7.500 E | 42.195 race | 0 |

### marathon-q1

Input: 60 km/week, 23 km long, 1 weekday workouts.

| Week | Phase | Training km | Tuesday | Wednesday | Thursday | Friday | Sunday | Hard outings |
|---|---|---:|---|---|---|---|---|---:|
| 1 | Maintenance | 60 | 7.235 E | 7.717 Q: 6 min tempo | 14.961 M | 7.087 E | 23.000 L | 1 |
| 2 | Maintenance | 60 | 7.235 E | 7.717 Q: 9 min tempo | 14.961 M | 7.087 E | 23.000 L | 1 |
| 3 | Foundation | 62.8 | 7.874 E + strides | 8.504 Q: 20 min tempo | 15.700 M | 7.700 E | 23.000 L | 1 |
| 4 | Recovery | 42.3 | 6.600 E | 7.400 E | 4.700 E | 6.600 E | 17.000 L | 0 |
| 5 | Foundation | 65.8 | 8.504 E + strides | 9.449 Q: 5 × 1 km tempo | 16.300 M | 8.500 E | 23.000 L: Long run · 6.3 km marathon effort | 2 |
| 6 | Foundation | 65.8 | 7.874 E + strides | 8.819 Q: 5 × 5 min tempo | 16.300 M | 7.800 E | 25.000 L | 1 |
| 7 | Foundation | 68.8 | 8.661 E + strides | 9.449 Q: 25 min tempo | 17.100 M | 8.600 E | 25.000 L | 1 |
| 8 | Recovery | 46.7 | 7.400 E | 7.800 E | 5.100 E | 7.400 E | 19.000 L | 0 |
| 9 | Build | 71.8 | 8.661 E + strides | 9.606 Q: 3 × 1.6 km tempo | 17.900 M | 8.600 E | 27.000 L: Long run · 8.663 km marathon effort | 2 |
| 10 | Build | 71.8 | 8.346 E + strides | 9.291 Q: 2 × 2 km tempo | 17.900 M | 8.300 E | 28.000 L | 1 |
| 11 | Build | 74.9 | 9.134 E + strides | 9.921 Q: 20 min tempo | 18.700 M | 9.100 E | 28.000 L | 1 |
| 12 | Recovery | 50.6 | 7.800 E | 8.600 E | 5.500 E | 7.700 E | 21.000 L | 0 |
| 13 | Build | 77.7 | 9.449 E + strides | 10.236 Q: On / off kilometres | 18.800 M | 9.200 E | 30.000 L | 1 |
| 14 | Race preparation | 77.8 | 9.134 E + strides | 9.921 Q: Cut-down tempo | 18.800 M | 8.900 E | 31.000 L | 1 |
| 15 | Race preparation | 77.9 | 8.394 E + strides | 9.291 Q: 25 min tempo | 18.898 M | 8.346 E | 33.000 L: Long run · 11.025 km marathon effort | 2 |
| 16 | Recovery | 51.3 | 7.800 E | 8.500 E | 5.500 E | 7.500 E | 22.000 L | 0 |
| 17 | Race preparation | 77.9 | 7.653 E + strides | 8.661 Q: 6 × 1 km tempo | 18.898 M | 7.717 E | 35.000 L | 1 |
| 18 | Taper | 54 | 7.500 E | 8.661 Q: 9 min tempo | 6.100 E | 7.700 E | 24.000 L | 1 |
| 19 | Taper | 45.5 | 6.700 E | 7.402 Q: 9 min tempo | 4.800 E | 6.600 E | 20.000 L | 1 |
| 20 | Race week | 29 | 7.500 E | 8.661 Q: 9 min tempo | 5.100 E | 7.700 E | 42.195 race | 1 |

### marathon-q2

Input: 70 km/week, 23 km long, 2 weekday workouts.

| Week | Phase | Training km | Tuesday | Wednesday | Thursday | Friday | Sunday | Hard outings |
|---|---|---:|---|---|---|---|---|---:|
| 1 | Maintenance | 70 | 12.197 E | 13.228 Q: 6 min tempo | 8.504 E | 13.071 Q: 6 min tempo | 23.000 L | 2 |
| 2 | Maintenance | 70 | 12.197 E | 13.228 Q: 6 min tempo | 8.504 E | 13.071 Q: 6 min tempo | 23.000 L | 2 |
| 3 | Foundation | 72.7 | 12.756 E + strides | 14.016 Q: 20 min tempo | 9.100 E | 13.858 Q: 5 × 600 m intervals | 23.000 L | 2 |
| 4 | Recovery | 49.1 | 8.100 E | 9.100 E | 5.800 E | 9.100 E | 17.000 L | 0 |
| 5 | Foundation | 75.7 | 13.543 E + strides | 14.961 Q: 5 × 1 km tempo | 9.400 E | 14.803 Q: 4 × 3 min intervals | 23.000 L: Long run · 6.3 km marathon effort | 3 |
| 6 | Foundation | 75.8 | 12.913 E + strides | 14.331 Q: 5 × 5 min tempo | 9.200 E | 14.331 Q: 3 × 1.5 km marathon effort | 25.000 L | 2 |
| 7 | Foundation | 78.8 | 13.858 E + strides | 15.276 Q: 25 min tempo | 9.400 E | 15.276 Q: Pyramid intervals | 25.000 L | 2 |
| 8 | Recovery | 54.1 | 8.900 E | 9.900 E | 6.400 E | 9.900 E | 19.000 L | 0 |
| 9 | Build | 81.8 | 14.173 E + strides | 15.591 Q: 3 × 1.6 km tempo | 9.400 E | 15.591 Q: 2 × (4 × 400 m) intervals | 27.000 L: Long run · 8.663 km marathon effort | 3 |
| 10 | Build | 81.8 | 13.858 E + strides | 15.276 Q: 2 × 2 km tempo | 9.400 E | 15.276 Q: 4 × 1.5 km marathon effort | 28.000 L | 2 |
| 11 | Build | 84.8 | 14.803 E + strides | 16.378 Q: 20 min tempo | 9.400 E | 16.220 Q: 600 m into 200 m | 28.000 L | 2 |
| 12 | Recovery | 57.4 | 9.200 E | 10.300 E | 6.600 E | 10.300 E | 21.000 L | 0 |
| 13 | Build | 87.7 | 15.118 E + strides | 16.693 Q: On / off kilometres | 9.400 E | 16.535 Q: 6 × 600 m intervals | 30.000 L | 2 |
| 14 | Race preparation | 87.8 | 14.803 E + strides | 16.378 Q: Cut-down tempo | 9.400 E | 16.220 Q: 6 × 6 min marathon effort | 31.000 L | 2 |
| 15 | Race preparation | 87.9 | 14.219 E + strides | 15.591 Q: 25 min tempo | 9.449 E | 15.591 Q: 7 × 600 m intervals | 33.000 L: Long run · 11.025 km marathon effort | 3 |
| 16 | Recovery | 58.2 | 8.800 E | 9.600 E | 6.200 E | 9.600 E | 24.000 L | 0 |
| 17 | Race preparation | 87.9 | 13.637 E + strides | 14.961 Q: 6 × 1 km tempo | 9.449 E | 14.803 Q: Pyramid intervals | 35.000 L | 2 |
| 18 | Taper | 65.7 | 10.200 E | 11.181 Q: 4 × 600 m intervals | 7.200 E | 11.100 E | 26.000 L | 1 |
| 19 | Taper | 52.6 | 8.000 E | 8.976 Q: 4 × 600 m intervals | 5.800 E | 8.800 E | 21.000 L | 1 |
| 20 | Race week | 35 | 9.400 E | 10.394 Q: 9 min tempo | 5.800 E | 9.400 E | 42.195 race | 1 |

The exact fresh-generation input and both outputs for the measurement counterexample are saved in [marathon-measurement-counterexample.json](marathon-measurement-counterexample.json), including every long-run step and zero validation errors for both modes.

## Audit limits

These are the three existing established-runner marathon examples, not every Cartesian combination of beginner state, ability, benchmark, run frequency, timeline and preferences. Current validatePlan accepted all three with no errors. This audit did not alter runtime code, run a medical risk assessment or certify any plan as externally validated. The exact external-schedule requirement remains unimplemented in this generator.
