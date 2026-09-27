# Independent road-plan review

Reviewed the actual `plan.workouts` and input profiles in [plans.json](plans.json), separately from the main report's derived weekly views. The scope is twelve 12-week plans: 5K, 10K, half marathon and marathon, each with 0, 1 or 2 selected weekday workouts. This review does not cover custom events or ultras and made no production changes.

## Generated-plan contract checks

**No contract failures found in these examples:** 144 weeks, 720 session prescriptions including races, and 84 complete ordinary weeks outside recovery and actual race-relative taper windows. There are 115 meaningful weekday quality prescriptions across the complete plans, including recovery/taper weeks where applicable.

Independent checks covered:

- The first complete week's allocated distance and opening long run match the supplied baselines.
- Every ordinary week retains the selected 0, 1 or 2 meaningful weekday workouts. Long runs, races, easy runs and economy/strides recipes do not substitute for these.
- Ordinary weekly distances and long runs do not regress across recovery weeks; long-run progression uses whole kilometres after the opening anchor.
- Prescription steps have positive finite durations and sum to the session duration within one second. Counted quality sessions include warm-up, actual work and cool-down.
- Demanding sessions are separated by at least two calendar days.

The zero-workout examples contain no hidden hard long runs. Brief, genuine interval main sets are distinct from strides: for example, introductory four-by-one-minute intervals are counted as workouts, while easy-day strides are excluded. These are software contract checks, not an independent coaching or medical endorsement of every prescription.

## Allocation concern: short workouts receive very long aerobic lead-ins

The actual output can retain all counts and weekly totals while distributing them awkwardly. Twenty-seven weekday quality sessions in the reviewed plans have allocated distance more than 1 km above their week's designated long run. The clearest examples are:

| Plan and date | Prescription | Total duration | Main work | Allocated distance | Designated long run |
| --- | --- | ---: | ---: | ---: | ---: |
| `5k-q1`, 4 November, week 7 | 5 × 2 min 5K effort | 120 min | 10 min | 18.09 km | 10 km |
| `5k-q1`, 25 November, week 10 | 5 × 2 min 5K effort | 120 min | 10 min | 18.09 km | 7 km |
| `10k-q1`, 25 November, week 10 | 3 × 5 min 10K effort | 120 min | 15 min | 18.09 km | 9 km |

Both 5K examples prescribe 10 minutes of warm-up, then **87 minutes of aerobic running before the first interval**, then 10 minutes of work, eight minutes of recoveries and five minutes of cool-down. The 18.09 km is the saved planning allocation, not an assertion about the exact distance a runner will cover during the timed steps.

This is a concrete allocation/order concern for review: the workout title understates the outing, and the designated long run is substantially shorter. Consider limiting easy filler attached to a quality recipe, distributing supported volume onto easy outings, or explaining when the requested weekly volume cannot fit the chosen rhythm without this result. There is no claim that a universal 120-minute safety limit applies.

## Definite copy mismatch: mixed long runs describe an occupied workout slot

In `marathon-q1` and `marathon-q2`, the mixed long runs on 4 October, 25 October and 8 November all say: “This uses one of the week’s workout slots.” The chosen frequency is explicitly **weekday workouts**, and those selected weekday sessions remain present.

For example, `marathon-q2` week 2 includes Wednesday's 20.6-minute on/off-kilometre main set, Friday's 25-minute tempo, and Sunday's 25 km long run with 40 minutes at marathon effort. This means two weekday workouts plus a mixed long run, not a missing weekday workout. The explanation should distinguish sharing the weekly work allowance from consuming a selected weekday slot.

## Taper policy concern: two late peak long runs and rising final-week weekdays

All three marathon examples prescribe 35 km on both 22 and 29 November, respectively 21 and 14 days before the 13 December race. Each is allocated approximately 232 minutes, or 3 hours 52 minutes. This matches the current compact-marathon policy; it is a policy choice to review rather than a detected arithmetic failure.

All four race-week weekday runs also become longer than the corresponding outings in the prior week for each marathon frequency. For `marathon-q2`:

| Day | Previous week | Race week | Change |
| --- | ---: | ---: | ---: |
| Tuesday, 8 December | 44 min | 54 min | +10 min |
| Wednesday, 9 December | 49 min | 60 min | +11 min |
| Thursday, 10 December | 32 min | 35 min | +3 min |
| Friday, 11 December | 49 min | 60 min | +11 min |

The **weekly training total still falls** from 47.087 km to 31.345 km, excluding the race, because the 21 km long run disappears. This is redistribution of the remaining taper budget, not a rising weekly total. Review whether final-week individual outings should be bounded against the preceding week as well as against the current per-day caps. These observations warrant coaching-policy review; they do not independently establish unsafe training.

## Taper boundary labels need clearer explanation

The short-road plans' week 10 and half-marathon plans' week 9 can be labelled “Race preparation” while Sunday's long run already falls within the race-relative taper window. The associated long-run reduction follows the actual daily taper policy. A week-level label alone makes that legitimate exception look like an unexplained regression.

## Separate negative-case validator findings

The valid generated examples above must be distinguished from [validator.md](validator.md). That reproducible audit deliberately removes a quality session or substitutes an economy recipe while retaining a stale hard flag. All eight invalid mutations are currently accepted by `validatePlan`, despite all four untouched baselines passing. These are validation-gate gaps that could allow a future editing/generation regression through; the twelve actual examples did not exhibit those mutations.

Reproduce that separate audit with `node --experimental-strip-types scripts/audit-road-validator.mjs`. The command reports its findings and exits successfully; it is not a passing release assertion.
