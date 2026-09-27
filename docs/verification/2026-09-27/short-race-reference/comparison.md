# Reviewed comparison: before → Bug 1 → Bug 2

Each cell lists the original output, final recovery/quality fix, and final taper fix in that order. These are observations of the generated plans against the supplied narrow acceptance properties; they are not full transcriptions of the external schedules.

## Final result ledger

After the v35 update, the full suite passes **3,223/3,223 tests**, including **179 new regression checks** (24 recovery/reference, 22 taper/reference, 133 protected-family). Typecheck, application lint and scoped lint also pass. [Check summary](checks.txt) · [Bug-1 diff](diffs/bug1-recovery.patch) · [Bug-2 diff](diffs/bug2-taper.patch).

| Capture | Generated plans | Explicit refusals | Generated weeks | Protected exact comparisons | Applicable matrix failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| [before](before.md) | 204 | 80 | 2782 | 0 | 0 |
| [after-bug1-final](after-bug1-final.md) | 207 | 77 | 2830 | 90 | 0 |
| [after-bug2-final](after-bug2-final.md) | 207 | 77 | 2830 | 90 | 0 |

The baseline failure count checks capture validity, explicit-zero behavior and half cutbacks only; it intentionally does not require the yet-unfixed short-race properties. Both later captures compare against the same immutable baseline. All 90 protected generated half/marathon/ultra plans and all 42 protected refusals are unchanged. Three formerly rejected 5K three-day q1 cases (12/16/20 weeks) become accepted through the necessary bounded quality-slot funding repair; no accepted baseline case is lost.

The final 65 eligible short-race plans contain 858 weeks: every week has at least one real non-easy/non-long/non-race quality session. No such week has a Recovery phase. Explicit zero-workout choices remain zero. All 36 pre-taper fourth-week opportunities with a two-workout choice reduce to one weekday workout.

## Taper interpretation and limits

- 5K mandatory taper: **2 → 2 → 1 week**. Actual daily taper offsets: **D7..D0 → D7..D0 → D6..D0**. The final pre-taper Sunday at D7 now retains its full long-run slot, matching week seven in the supplied eight-week table.
- 10K mandatory taper: **2 → 2 → 2 weeks**. Actual daily taper offsets: **D7..D0 → D7..D0 → D13..D0**. D14 retains a full pre-taper long-run slot.
- The existing **0.6 allocation multiplier** is retained within both short-race taper windows. Extending 10K to two weeks applies that existing fraction to both weeks. The supplied reference establishes the two-week length and retained quality; it does **not** establish 0.6 as an exact external-plan percentage. Actual weekly mileage also depends on running days, race-week caps and removal of the long-run slot, so it is not claimed to equal exactly 60% of the preceding week.
- Half/marathon/ultra retain their exact pre-change taper behavior as requested. The unchanged helper/calendar differences visible in their rows are not silently rewritten or represented as newly validated coaching decisions.

## Full representative week rows

One representative per goal, plus short-race q2 examples. Every other case and week appears in the linked full capture reports. Values displayed below are rounded to three decimals; protected hashes compare the unrounded full prescription.

### 5k-8w-4d-q1

Same input at each stage: 28 km/week, 10 km familiar long run, 4 days, 1 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 28 → 28 → 28 | 28 → 28 → 28 | 10 → 10 → 10 | 1 → 1 → 1 | easy, tempo, easy, long |
| 2 | Foundation → Foundation → Foundation | 29.4 → 29.4 → 29.4 | 29.354 → 29.354 → 29.354 | 10 → 10 → 10 | 1 → 1 → 1 | easy, tempo, easy, long |
| 3 | Build → Build → Build | 30.5 → 30.5 → 30.5 | 30.451 → 30.451 → 30.451 | 10 → 10 → 10 | 1 → 1 → 1 | easy, fartlek, easy, long |
| 4 | Recovery → Build → Build | 22.7 → 31.4 → 31.4 | 22.65 → 31.4 → 31.4 | 7 → 10 → 10 | 0 → 1 → 1 | easy, tempo, easy, long |
| 5 | Race preparation → Race preparation → Race preparation | 31.1 → 31.4 → 31.4 | 31.142 → 31.4 → 31.4 | 10 → 10 → 10 | 1 → 1 → 1 | easy, fartlek, easy, long |
| 6 | Race preparation → Race preparation → Race preparation | 32.2 → 32.2 → 32.2 | 32.2 → 32.2 → 32.2 | 10 → 10 → 10 | 1 → 1 → 1 | easy, tempo, easy, long |
| 7 | Race preparation → Race preparation → Race preparation | 27.5 → 28.1 → 32.2 | 27.48 → 28.1 → 32.2 | — → — → 10 | 1 → 1 → 1 | easy, fartlek, easy, long |
| 8 | Race week → Race week → Race week | 11.7 → 11.6 → 11.6 | 11.697 → 11.622 → 11.622 | — → — → — | 1 → 1 → 1 | easy, fartlek, easy, race |

### 10k-8w-4d-q1

Same input at each stage: 32 km/week, 12 km familiar long run, 4 days, 1 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 32 → 32 → 32 | 32 → 32 → 32 | 12 → 12 → 12 | 1 → 1 → 1 | easy, tempo, easy, long |
| 2 | Foundation → Foundation → Foundation | 33.8 → 33.8 → 33.8 | 33.774 → 33.774 → 33.774 | 12 → 12 → 12 | 1 → 1 → 1 | easy, tempo, easy, long |
| 3 | Build → Build → Build | 35.2 → 35.2 → 35.2 | 35.171 → 35.171 → 35.171 | 12 → 12 → 12 | 1 → 1 → 1 | easy, tempo, easy, long |
| 4 | Recovery → Build → Build | 26 → 36.5 → 36.5 | 26 → 36.539 → 36.539 | 8 → 12 → 12 | 0 → 1 → 1 | easy, tempo, easy, long |
| 5 | Race preparation → Race preparation → Race preparation | 36.5 → 36.8 → 36.8 | 36.463 → 36.8 → 36.8 | 12 → 12 → 12 | 1 → 1 → 1 | easy, tempo, easy, long |
| 6 | Race preparation → Race preparation → Race preparation | 38.5 → 38.8 → 38.8 | 38.463 → 38.8 → 38.8 | 13 → 13 → 13 | 1 → 1 → 1 | easy, tempo, easy, long |
| 7 | Race preparation → Race preparation → Taper | 31.8 → 32.4 → 21.2 | 31.825 → 32.371 → 21.222 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, easy |
| 8 | Race week → Race week → Race week | 12.7 → 12.7 → 12.6 | 12.653 → 12.671 → 12.596 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, race |

### half-12w-4d-q1

Same input at each stage: 40 km/week, 16 km familiar long run, 4 days, 1 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 40 → 40 → 40 | 40 → 40 → 40 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, long |
| 2 | Foundation → Foundation → Foundation | 42.2 → 42.2 → 42.2 | 42.198 → 42.198 → 42.198 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, long |
| 3 | Build → Build → Build | 44.1 → 44.1 → 44.1 | 44.098 → 44.098 → 44.098 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, long |
| 4 | Recovery → Recovery → Recovery | 34.7 → 34.7 → 34.7 | 34.65 → 34.65 → 34.65 | 11 → 11 → 11 | 0 → 0 → 0 | easy, easy, easy, long |
| 5 | Build → Build → Build | 45.8 → 45.8 → 45.8 | 45.766 → 45.766 → 45.766 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, long |
| 6 | Build → Build → Build | 46.2 → 46.2 → 46.2 | 46.2 → 46.2 → 46.2 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, long |
| 7 | Race preparation → Race preparation → Race preparation | 46.9 → 46.9 → 46.9 | 46.9 → 46.9 → 46.9 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, long |
| 8 | Recovery → Recovery → Recovery | 35.8 → 35.8 → 35.8 | 35.75 → 35.75 → 35.75 | 11 → 11 → 11 | 0 → 0 → 0 | easy, easy, easy, long |
| 9 | Race preparation → Race preparation → Race preparation | 49.4 → 49.4 → 49.4 | 49.4 → 49.4 → 49.4 | 18 → 18 → 18 | 1 → 1 → 1 | easy, tempo, easy, long |
| 10 | Race preparation → Race preparation → Race preparation | 48.6 → 48.6 → 48.6 | 48.562 → 48.562 → 48.562 | 14 → 14 → 14 | 1 → 1 → 1 | easy, tempo, easy, long |
| 11 | Taper → Taper → Taper | 31.1 → 31.1 → 31.1 | 31.102 → 31.102 → 31.102 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, easy |
| 12 | Race week → Race week → Race week | 12.5 → 12.5 → 12.5 | 12.468 → 12.468 → 12.468 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, race |

### marathon-16w-5d-q2

Same input at each stage: 65 km/week, 23 km familiar long run, 5 days, 2 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 65 → 65 → 65 | 65 → 65 → 65 | 23 → 23 → 23 | 2 → 2 → 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation → Foundation → Foundation | 65 → 65 → 65 | 65 → 65 → 65 | 23 → 23 → 23 | 2 → 2 → 2 | easy, tempo, easy, intervals, long |
| 3 | Foundation → Foundation → Foundation | 67.8 → 67.8 → 67.8 | 67.778 → 67.778 → 67.778 | 25 → 25 → 25 | 2 → 2 → 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery → Recovery → Recovery | 46.4 → 46.4 → 46.4 | 46.4 → 46.4 → 46.4 | 19 → 19 → 19 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 5 | Build → Build → Build | 70.8 → 70.8 → 70.8 | 70.806 → 70.806 → 70.806 | 27 → 27 → 27 | 2 → 2 → 2 | easy, tempo, easy, intervals, long |
| 6 | Build → Build → Build | 70.8 → 70.8 → 70.8 | 70.806 → 70.806 → 70.806 | 27 → 27 → 27 | 2 → 2 → 2 | easy, tempo, easy, intervals, long |
| 7 | Build → Build → Build | 73.8 → 73.8 → 73.8 | 73.803 → 73.803 → 73.803 | 28 → 28 → 28 | 2 → 2 → 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery → Recovery → Recovery | 51.3 → 51.3 → 51.3 | 51.3 → 51.3 → 51.3 | 22 → 22 → 22 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 9 | Build → Build → Build | 76.8 → 76.8 → 76.8 | 76.772 → 76.772 → 76.772 | 30 → 30 → 30 | 2 → 2 → 2 | easy, tempo, easy, intervals, long |
| 10 | Race preparation → Race preparation → Race preparation | 76.9 → 76.9 → 76.9 | 76.867 → 76.867 → 76.867 | 31 → 31 → 31 | 2 → 2 → 2 | easy, tempo, easy, fartlek, long |
| 11 | Race preparation → Race preparation → Race preparation | 76.9 → 76.9 → 76.9 | 76.867 → 76.867 → 76.867 | 33 → 33 → 33 | 2 → 2 → 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery → Recovery → Recovery | 51.9 → 51.9 → 51.9 | 51.9 → 51.9 → 51.9 | 23 → 23 → 23 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 13 | Race preparation → Race preparation → Race preparation | 76.9 → 76.9 → 76.9 | 76.867 → 76.867 → 76.867 | 33 → 33 → 33 | 2 → 2 → 2 | easy, tempo, easy, intervals, long |
| 14 | Taper → Taper → Taper | 55.6 → 55.6 → 55.6 | 55.586 → 55.586 → 55.586 | 24 → 24 → 24 | 1 → 1 → 1 | easy, intervals, easy, easy, long |
| 15 | Taper → Taper → Taper | 44.4 → 44.4 → 44.4 | 44.389 → 44.389 → 44.389 | 19 → 19 → 19 | 1 → 1 → 1 | easy, intervals, easy, easy, long |
| 16 | Race week → Race week → Race week | 30.5 → 30.5 → 30.5 | 30.486 → 30.486 → 30.486 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, easy, race |

### ultra-20w-5d-q1

Same input at each stage: 75 km/week, 25 km familiar long run, 5 days, 1 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 75 → 75 → 75 | 75 → 75 → 75 | 25 → 25 → 25 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 2 | Foundation → Foundation → Foundation | 75 → 75 → 75 | 75 → 75 → 75 | 25 → 25 → 25 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 3 | Build → Build → Build | 75.5 → 75.5 → 75.5 | 75.527 → 75.527 → 75.527 | 27 → 27 → 27 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 4 | Recovery → Recovery → Recovery | 61.4 → 61.4 → 61.4 | 61.4 → 61.4 → 61.4 | 19 → 19 → 19 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 5 | Build → Build → Build | 77.5 → 77.5 → 77.5 | 77.527 → 77.527 → 77.527 | 29 → 29 → 29 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 6 | Build → Build → Build | 77.5 → 77.5 → 77.5 | 77.527 → 77.527 → 77.527 | 29 → 29 → 29 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 7 | Build → Build → Build | 79.5 → 79.5 → 79.5 | 79.527 → 79.527 → 79.527 | 31 → 31 → 31 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 8 | Recovery → Recovery → Recovery | 65 → 65 → 65 | 65 → 65 → 65 | 21 → 21 → 21 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 9 | Race preparation → Race preparation → Race preparation | 81.5 → 81.5 → 81.5 | 81.527 → 81.527 → 81.527 | 33 → 33 → 33 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation → Race preparation → Race preparation | 83.5 → 83.5 → 83.5 | 83.527 → 83.527 → 83.527 | 35 → 35 → 35 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 11 | Race preparation → Race preparation → Race preparation | 83.5 → 83.5 → 83.5 | 83.527 → 83.527 → 83.527 | 35 → 35 → 35 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 12 | Recovery → Recovery → Recovery | 68.1 → 68.1 → 68.1 | 68.1 → 68.1 → 68.1 | 23 → 23 → 23 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 13 | Race preparation → Race preparation → Race preparation | 85.5 → 85.5 → 85.5 | 85.527 → 85.527 → 85.527 | 37 → 37 → 37 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 14 | Race preparation → Race preparation → Race preparation | 87.5 → 87.5 → 87.5 | 87.527 → 87.527 → 87.527 | 39 → 39 → 39 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 15 | Race preparation → Race preparation → Race preparation | 87.5 → 87.5 → 87.5 | 87.527 → 87.527 → 87.527 | 39 → 39 → 39 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 16 | Recovery → Recovery → Recovery | 70.7 → 70.7 → 70.7 | 70.7 → 70.7 → 70.7 | 27 → 27 → 27 | 0 → 0 → 0 | easy, easy, easy, easy, long |
| 17 | Race preparation → Race preparation → Race preparation | 81.5 → 81.5 → 81.5 | 81.527 → 81.527 → 81.527 | 33 → 33 → 33 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 18 | Taper → Taper → Taper | 56.2 → 56.2 → 56.2 | 56.23 → 56.23 → 56.23 | 16 → 16 → 16 | 1 → 1 → 1 | easy, tempo, easy, easy, long |
| 19 | Taper → Taper → Taper | 37.6 → 37.6 → 37.6 | 37.6 → 37.6 → 37.6 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, easy, easy |
| 20 | Race week → Race week → Race week | 15.6 → 15.6 → 15.6 | 15.6 → 15.6 → 15.6 | — → — → — | 0 → 0 → 0 | easy, easy, easy, easy, race |

### 5k-8w-5d-q2-advanced

Same input at each stage: 45 km/week, 13 km familiar long run, 5 days, 2 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 45 → 45 → 45 | 45 → 45 → 45 | 13 → 13 → 13 | 2 → 2 → 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation → Foundation → Foundation | 45 → 45 → 45 | 45 → 45 → 45 | 13 → 13 → 13 | 2 → 2 → 2 | easy, tempo, easy, fartlek, long |
| 3 | Build → Build → Build | 46.5 → 46.5 → 46.5 | 46.468 → 46.468 → 46.468 | 13 → 13 → 13 | 2 → 2 → 2 | easy, fartlek, easy, tempo, long |
| 4 | Recovery → Build → Build | 33.4 → 46.8 → 46.8 | 33.4 → 46.8 → 46.8 | 9 → 13 → 13 | 0 → 1 → 1 | easy, fartlek, easy, easy, long |
| 5 | Race preparation → Race preparation → Race preparation | 46.7 → 46.8 → 46.8 | 46.7 → 46.8 → 46.8 | 13 → 13 → 13 | 2 → 2 → 2 | easy, fartlek, easy, tempo, long |
| 6 | Race preparation → Race preparation → Race preparation | 47.3 → 48.2 → 48.2 | 47.3 → 48.2 → 48.2 | 13 → 13 → 13 | 2 → 2 → 2 | easy, fartlek, easy, tempo, long |
| 7 | Race preparation → Race preparation → Race preparation | 41.2 → 41.9 → 48.7 | 41.166 → 41.921 → 48.7 | — → — → 13 | 2 → 2 → 2 | easy, fartlek, easy, tempo, long |
| 8 | Race week → Race week → Race week | 17.4 → 18.1 → 18.4 | 17.379 → 18.096 → 18.383 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, easy, race |

### 10k-12w-6d-q2

Same input at each stage: 48 km/week, 12 km familiar long run, 6 days, 2 requested weekday workouts.

| Week | Phase: before → Bug 1 → Bug 2 | Target km | Actual training km | Long km | Weekday Q | Final workout kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation → Foundation | 48 → 48 → 48 | 48 → 48 → 48 | 12 → 12 → 12 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation → Foundation → Foundation | 48 → 48 → 48 | 48 → 48 → 48 | 12 → 12 → 12 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build → Build → Build | 49 → 49 → 49 | 48.97 → 48.97 → 48.97 | 12 → 12 → 12 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery → Build → Build | 33.8 → 50.9 → 50.9 | 33.8 → 50.928 → 50.928 | 8 → 13 → 13 | 0 → 1 → 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build → Build → Build | 50.9 → 52.5 → 52.5 | 50.928 → 52.545 → 52.545 | 13 → 13 → 13 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build → Build → Build | 52.8 → 53.9 → 53.9 | 52.832 → 53.883 → 53.883 | 13 → 13 → 13 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build → Build → Build | 54.8 → 56 → 56 | 54.773 → 56.038 → 56.038 | 14 → 14 → 14 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery → Race preparation → Race preparation | 40.7 → 57 → 57 | 40.7 → 56.951 → 56.951 | 10 → 14 → 14 | 0 → 1 → 1 | easy, tempo, easy, easy, easy, long |
| 9 | Race preparation → Race preparation → Race preparation | 56.6 → 57.7 → 57.7 | 56.555 → 57.668 → 57.668 | 14 → 14 → 14 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Race preparation → Race preparation → Race preparation | 58.8 → 59.1 → 59.1 | 58.764 → 59.105 → 59.105 | 15 → 15 → 15 | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Race preparation → Race preparation → Taper | 52.4 → 53.1 → 30.9 | 52.361 → 53.061 → 30.852 | — → — → — | 2 → 2 → 2 | easy, tempo, easy, tempo, easy, easy |
| 12 | Race week → Race week → Race week | 20.6 → 20.4 → 20.1 | 20.595 → 20.357 → 20.068 | — → — → — | 1 → 1 → 1 | easy, tempo, easy, easy, easy, race |

## Out-of-scope observation

The unchanged `ultra-20w-5d-q1` rows show a **39 km** long-run peak in week 15, **27 km** in Recovery week 16, then **33 km** in ordinary Race preparation week 17 before taper. This pre-existing decline after a recovery week and peak below the supplied 40–45 km band are explicitly flagged, not approved as coaching. The user required ultra-specific output to remain unchanged, so neither is fixed here. The [previous marathon audit](../../2026-09-25/plan-derivation-audit/marathon-analysis.md) likewise records known issues that this narrow change deliberately does not repair. Identical protected snapshots demonstrate absence of a new regression; they do not establish correctness of all protected behavior.

## Source identity

| Stage | TypeScript lib SHA256 |
| --- | --- |
| before | `5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea` |
| after-bug1-final | `2699256a1950d24183efa347754106a3cc02d36860b2c595dace5722cbdd398b` |
| after-bug2-final | `673de7115adba1dabab90d826020ea955cbcfd098b0743749ced1de2007f5329` |

The supplied task described policy v30 and requested the next version v31. The actual repository baseline was already `provisional-2026-09-24-v34`; the final policy advances to v35 rather than rolling the version backward. The final Bug-2 capture was generated after that metadata change. Its scoped review status describes the reference properties verified and preservation of the protected families; it does not claim independent coaching approval.
