# Run combinations, workout recipes, pacing, and beginner branches: derivation audit

Read-only audit of the current implementation, 25 September 2026. No training rules were changed for this audit. The separate combination matrix holds the runner inputs constant when changing the requested workout count; the older twelve examples did not do that for q2.

## What the engine is actually doing

This is an independently authored generator with coaching references. It is not an implementation of one external plan per distance/level. Three separate generators run behind the same product:

| Profile | Generator | What governs its runs |
| --- | --- | --- |
| Zero weekly distance, zero longest run, zero current runs; new 5K runner, or beginner level for a named distance | `beginner.ts` | NHS-derived timed run/walk lessons. The calendar repeats the current stage until an explicit completion review advances it. |
| Beginner level, positive existing baseline, 5K/10K/half/marathon | `first-race.ts` | Independently authored all-easy progression, exact opening mileage, equal distribution of supporting mileage, and fixed model targets. |
| Other profiles | `generate.ts` | Ability bands, calendar/load formulas, long-run progression, weighted day allocation, authored workout recipes, pace conversion, and multiple reconciliation passes. |

Dispatch is explicit in `lib/plan/generate.ts:94–100`. Beginner eligibility is in `lib/beginner-course.ts:10–17`; first-race eligibility is in `lib/first-race-policy.ts:68–77`.

The source code itself describes the road bands as “Authored planning bands synthesised from the published plans” (`lib/road-training-policy.ts:32`) and the workouts as “Independently authored doses” (`lib/road-workouts.ts:9`). First-race policy is likewise labeled independently authored (`lib/first-race-policy.ts:7`). A link to Higdon beside a policy does not mean its calculated daily distances are Higdon's published schedule.

## How the running days and combination are chosen

With fixed days and no new availability/frequency options, the supplied days are retained. With availability options, the engine enumerates subsets containing the selected long-run day. Its score prioritizes fitting quality sessions, preferred hard days, a built-in “classic” pattern, and evenly spaced gaps, in that order (`lib/training-structure.ts:106–147`).

For a Sunday long run, the built-in patterns are:

| Runs/week | Built-in pattern |
| ---: | --- |
| 2 | Thursday / Sunday |
| 3 | Wednesday / Friday / Sunday |
| 4 | Tuesday / Wednesday / Friday / Sunday |
| 5 | Tuesday / Wednesday / Thursday / Friday / Sunday |
| 6 | Tuesday through Sunday |
| 7 | Every day |

These come from literal offset arrays in `lib/training-structure.ts:89–101`, not a source-plan calendar. Availability can force another arrangement. That is why the example input's initial four-day array does not guarantee Monday/Wednesday/Friday/Sunday after the availability solver runs.

Quality candidates must be at least two calendar days from the long run, at least two days from each other, and have at least 30 minutes available (`lib/training-structure.ts:149–191`). This treats an easy long run as a key endurance day for spacing; it does not make that run a speed workout.

| Selected weekday workouts | Normal standard-plan intent |
| ---: | --- |
| 0 | All supporting runs easy; long run also easy. |
| 1 | One weekday threshold/race-effort session, the separate long run, easy support. |
| 2 | Two weekday quality roles plus the long run; the q2 evidence and spacing checks must first pass. Marathon can replace a weekday role with a specific long-run effort under its separate policy. |

Explicit q2 is rejected unless the profile reports an established routine, at least five current runs, at least five selected runs, at least 45 km/week, and at least two recent quality sessions (`lib/plan/profile.ts:692–704`). These cutoffs are product policy. Changing only q from 1 to 2 on the previous four-day profiles is consequently an explicit refusal, not the larger q2 plan shown in the old examples.

Automatic road selection gives zero quality sessions to developing profiles, two-day schedules, or finish-oriented runners reporting no recent quality; other balanced road profiles normally receive one (`lib/training-structure.ts:17–25`). Beginner and first-race branches permit no speed workouts. Recovery removes ordinary quality sessions (`lib/plan/generation-weeks.ts:98–113`), while taper follows separate reduction rules.

Some old comments call the ordinary long run the “second quality session” (`lib/training-structure.ts:70`, `lib/plan/profile.ts:750`). That terminology differs from the UI's requested count of weekday workouts. Reports should always count weekday speed workouts and long runs separately.

## Why the previous q2 examples looked better

The previous report changed the runner as well as changing q. Its setup is visible in `scripts/report-stress-example-plans.mjs:13–44` and `:62–63`.

| Goal | q0/q1 weekly km / longest km / days | q2 weekly km / longest km / days |
| --- | --- | --- |
| 5K | 30 / 8 / 4 | 55 / 13 / 6 |
| 10K | 36 / 11 / 4 | 60 / 16 / 6 |
| Half | 45 / 16 / 4 | 65 / 18 / 6 |
| Marathon | 60 / 23 / 5 | 70 / 23 / 5 |

It also supplied `recentQualitySessions=q` and `recentQualityMinutes=q*20` (`:90–93`). Thus q0, q1 and q2 differ in evidence, and q2 differs in weekly distance, frequency, usually the long run, ability band, and main-set allowance. Those examples were different personas, not a controlled demonstration of the quality-count toggle. Any claim that q2 itself fixed the proportions from that comparison was unsupported.

## Where the road workout itself comes from

The selector first chooses a *role*, then a work budget, then a recipe that fits. All the numerical choices below are Stride-authored.

1. **Ability:** “Developing” means experience is not established, current running frequency is below four, or weekly distance is below 20 km for 5K, 25 km for 10K, or 35 km for half. “Advanced” needs five current runs and 45 km (5K/10K) or 55 km (half), plus a long run of 10/12/16 km respectively. Otherwise established. See `lib/road-training-policy.ts:15–29`.
2. **Role:** q1 starts with threshold. After at least two related threshold exposures it can alternate to the goal's current race effort; phase-specific rules can favor 5K or 10K effort later. With q2 there are two roles, and later 5K preparation puts 5K rhythm first and threshold second. See `lib/road-workouts.ts:237–276`.
3. **Reported per-session work:** `recentQualityMinutes / max(1, recentQualitySessions)`, when supplied. This is time actually spent in the faster main sets, not total workout duration.
4. **Opening work budget:** `max(6, min(levelLimit, reportedPerSession * roleFactor))`. Level limit is 10 minutes for controlled profiles, 18 advanced, otherwise 14. Role factors are 0.55 for 5K effort, 0.70 for 10K effort, and 0.80 for threshold or half effort. No reported work gives a six-minute seed. See `lib/road-workouts.ts:277–289`.
5. **Progression:** add 2 minutes for controlled work, 4 for half effort, otherwise 3, after each two related planned exposures. The maximum depends on the role (21 minutes of 5K effort, 30 of 10K/threshold, 36 of half effort for non-controlled profiles). Foundation and Maintenance reset the budget to the seed. See `:290–308`.
6. **Weekly share:** that role budget is further limited by `weeklyKm * schedulingPace * 0.22 / qualitySlots`. The 22% ceiling is Stride policy (`lib/plan/generation-weeks.ts:215–222`; `lib/plan/generation-constants.ts:142`). It is checked again against the actual final allocated week in `lib/plan/generate.ts:163–241`.
7. **Bout length:** threshold starts with a two-minute maximum bout and progresses through a literal `[120,180,240,300,360,480]` seconds array after repeated related exposures. Other roles have their own arrays. See `lib/road-workouts.ts:348–364`.
8. **Recipe:** choose from the authored repetition/pyramid catalogue, with template phases, longest-bout cap, complete-set feasibility, preferred format, and recent-template/shape variety applied. See `:365–458`.
9. **Executable session:** add a ten-minute warm-up and five-minute cooldown, all inter-repetition recoveries, and bounded easy padding. Fit the maximum complete number of repetitions inside the available time and main-set allowance. See `lib/workout-library.ts:1780–1878` and `lib/road-workouts.ts:65–171`.

### Concrete derivation: the 5K q1 opening “7 × 2 minutes”

The old example supplies 30 km/week, an 8 km long run, four current runs, one recent quality session containing 20 minutes of faster work, and a 25-minute 5K benchmark.

- This is the established ability band.
- The first role is threshold.
- Seed: `max(6, min(14, 20 * 0.8)) = 14` minutes.
- Its first threshold stage permits bouts up to two minutes.
- The two-minute recipe fits seven repetitions: `7*2=14` work minutes.
- Between repetitions are six one-minute jog recoveries.
- Ten minutes warming up, five cooling down, and fifteen minutes of allowed easy padding yield `10+15+14+6+5=50` total minutes.
- Per-step pace conversion gives a conservative displayed estimate of 7.2 km for this runner, rather than `50 minutes / threshold pace`.

The next 90-second version fits nine repetitions: 13.5 work minutes, eight minutes of jog recoveries, and the same 30 minutes of preparation/easy padding/cooldown, totaling 51.5 minutes. Its longer total duration despite less work follows directly from extra recoveries.

These exact sessions were not taken from a published schedule. The code creates them from the seed, bout cap, recovery recipe and filler allowance.

### An additional reason the opening recipes repeat

The generation context filters prior workouts to the final preparation window except while in Maintenance (`lib/plan/generation-weeks.ts:227–231`). In the latest saved examples, 5K, 10K and half all show the same first four quality exposures: 7 × 2 minutes, 9 × 90 seconds, 7 × 2 minutes, 9 × 90 seconds. The third exposure is described as an opening allowance again because the early Foundation/Maintenance workouts have fallen outside the selector's preparation window.

This explains the repeated introductory role sequence across different distances. Whether that phase reset is an appropriate coaching choice needs an explicit plan design; a passing frequency/shape test does not answer it.

## How pace becomes distance

The benchmark supplies current-fitness effort ranges via the Daniels/Gilbert model (`lib/fitness-model.ts:19–43`, `:70–87`). Riegel is a separate race-equivalence formula (`lib/fitness-pacing.ts:109–125`). Neither chooses weekly mileage or day combinations.

The scheduling pace comes from manual easy targets first, otherwise the declared easy pace and/or the benchmark's slow easy edge, otherwise a 7 min/km estimate (`lib/fitness-pacing.ts:237–271`). This changes how much distance fits into a time limit. A faster benchmark must not be mistaken for evidence that the runner tolerates a larger training load.

For timed steps with numerical pace targets, distance bounds are `seconds / slowPace` and `seconds / fastPace`. Distance-ended steps use their exact metres. Effort-only segments use broad authored estimates. Final bounds round outward to tenths (`lib/prescription.ts:8–62`). The generator also revisits the week's allocation after assigning known faster targets (`lib/plan/generate.ts:364–414`). Fractional totals can therefore be consequences of converting complete timed workouts, not a deliberate prescription to advance a long run by that fraction.

**Confirmed explanation defect:** when `easyPace` is blank, the generated reason text says “Distance estimated at 7 min/km” even when a valid benchmark supplies the actual scheduling pace. The conditional uses only `p.easyPace` (`lib/plan/generation-weeks.ts:425`). This incorrect reason appears throughout the current benchmark-based q1 examples. It makes the distances harder to audit even when the numerical calculation uses the benchmark correctly.

## Beginner branches: the latest long/easy balance fix does not cover them

The standard distinct-long helper explicitly excludes both `plan.beginner` and `plan.firstRace` (`lib/plan/session-balance.ts:42–48`). Those branches have different contracts.

### Zero-running foundation

The nine stages are literal run/walk minute arrays in `lib/beginner-course.ts:24–34`, with a five-minute walk before and after. The stage progression is NHS-derived. Stride's decision to repeat the current stage on the entire future calendar until the user completes a review is a separate product behavior (`lib/plan/beginner.ts:162`, `:211–214`, `:220–236`).

Consequently a fresh 12-week foundation calendar intentionally looks repetitive: it has not certified completion of stage one. A correct *simulation of successful completion* must log each stage and call the review transition. Merely generating a long calendar does not simulate successful progression. For zero-base 10K, half or marathon, this is explicitly only a learning-to-run foundation, not an actual distance-specific race plan.

### Existing beginner / first race

The following literal constants select entry requirements and growth ceilings (`lib/first-race-policy.ts:9–65`):

| Goal | Minimum weekly / long km | Running days | Model length | Target long | Weekly ceiling |
| --- | --- | --- | --- | --- | --- |
| 5K | 7.5 / 2.5 | 3 | 8 weeks | 5 km | 18 km |
| 10K | 12 / 5 | 3 | 8 weeks | 9 km | 28 km |
| Half | 18 / 6 | 3 or 4 | 12 weeks | 16 km | 44 km |
| Marathon | 24 / 10 | 4 | 18 weeks | 32 km | 64 km |

These are model constants, not an exact reproduction of the source links. The first full week preserves reported weekly and longest distance. Supporting kilometres are `(weekly-long)/(days-1)`, evenly water-filled subject to caps. Each support can be as long as the long run (`lib/plan/first-race.ts:54–79`, `:211–223`, `:361–386`). Later ordinary build anchors grow by up to 10%, rounded down to 0.1 km. Long growth uses one kilometre for 5K/10K, two for half/marathon, then three for marathon above 20 km, subject to a 50% weekly allocation limit, duration limits and the target. Recovery uses 80% weekly distance and a floored 75% long run (`:322–359`). All are authored product rules.

The audit generated these minimum-entry inputs with 7 min/km declared easy pace, generous limits, fixed allowed running days, beginner level and q0. All four pass `validatePlan`; all four receive `feasibility.status='forecast'`:

| Goal | Actual generated first-week distances |
| --- | --- |
| 5K | Easy 2.5, easy 2.5, **long 2.5 km** |
| 10K | Easy 3.5, easy 3.5, **long 5 km** |
| Half | Easy 6, easy 6, **long 6 km** |
| Marathon | Easy 4.667, easy 4.667, easy 4.666, **long 10 km** |

This is a concrete remaining mismatch with the request for a meaningfully distinct long run across all plan combinations. It is not a hidden rounding issue: equality is deliberately allowed by this branch, and current tests validate that branch's own rules. Equal novice outings are not inherently proof of an unsafe plan, but presenting one of three equal runs as meaningfully “long” conflicts with the product expectation and with claims that the latest role fix covered every plan.

## What a passing test proves here

A passing allocator/frequency test establishes compliance with the implementation's own budgets, selected workout count, serialization, schedule and history constraints. A recipe test establishes that complete sets and recovery fit. A snapshot checks agreement with a reviewed saved output. An independent arithmetic oracle can expose contradictions those tests missed.

None of those proves that 14 work minutes, a 65%/80% support cap, 22% work share, a six-minute introduction, a particular pyramid, a preparation-window reset, or a ten-percent first-race growth rule is the correct prescription for that person. They also cannot prove equality to an external plan when no external day-by-day fixture is being compared.

The current code explains the numbers mechanically. It does not provide a source-backed coaching justification for every combination. That distinction is the central unresolved issue.
