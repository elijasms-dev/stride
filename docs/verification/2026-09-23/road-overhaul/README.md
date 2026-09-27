# 5K, 10K and half-marathon overhaul verification

Generated 2026-09-24T09:58:20.322Z. Library source SHA-256: `5fca0361e11fbd3e7c682d81a8a3a65b6ff4a67d1c946a9b46678b4265e95ffe`.

**801 scenarios: 732 accepted and checked, 69 explicitly rejected as expected, 0 failures.** 8115 generated weeks, 4737 ordinary weeks and 38031 runs inspected.

This is a software audit of declared contracts. Correct rejection means an intentionally contradictory or unsupported input returned a descriptive PlanError; it does not count as a generated plan. Unexpected rejection of a viable profile is a failure. No account data was accessed or modified.

The matrix covers developing, established and advanced starting routines; 0/1/2 selected workouts; 8/12/18-week blocks; all start/race weekdays; 4.5/6/8 min/km scheduling pace; timed and distance runs; gradual and maintained volume; finish/gentle settings; benchmarks; miles; fractional and disproportionately long baselines; 1–28-day short blocks; two-run schedules; and contradictory inputs.

Independent checks inspect actual saved steps and arithmetic rather than trusting validatePlan alone: exact full opening baselines, preserved workout choice, full ordinary-week frequency, integer long-run growth, no unmarked declines, bounded long-run jumps/ceilings, no extra days, valid dates/steps/totals, warm-up/cooldown, session/time caps and JSON round-trip validation. Separate marathon snapshot tests protect the approved marathon plans.

## Twelve-week examples

A dash (—) in a long-run progression means no outing is labelled LONG that week. Final taper outings become shorter EASY runs, not missing scheduled running days. Open the daily example to see every taper run and race day.

| Example | Opening km / long | Runs/week | Weekday workouts | Long-run progression km | Result |
| --- | ---: | ---: | ---: | --- | --- |
| [5k-developing-q0-12weeks](5k-developing-q0-12weeks.md) | 12 / 4 | 3 | 0 | 4 → 4 → 4 → 3 → 4 → 5 → 5 → 4 → 5 → 6 → — → — | PASS |
| [5k-developing-q1-12weeks](5k-developing-q1-12weeks.md) | 12 / 4 | 3 | 1 | 4 → 4 → 4 → 3 → 4 → 5 → 5 → 4 → 5 → 6 → — → — | PASS |
| [5k-established-q0-12weeks](5k-established-q0-12weeks.md) | 30 / 8 | 4 | 0 | 8 → 8 → 8 → 6 → 8 → 9 → 9 → 7 → 9 → 10 → — → — | PASS |
| [5k-established-q1-12weeks](5k-established-q1-12weeks.md) | 30 / 8 | 4 | 1 | 8 → 8 → 8 → 6 → 8 → 9 → 9 → 6 → 9 → 10 → — → — | PASS |
| [5k-advanced-q0-12weeks](5k-advanced-q0-12weeks.md) | 55 / 13 | 5 | 0 | 13 → 13 → 13 → 10 → 13 → 13 → 13 → 10 → 13 → 14 → — → — | PASS |
| [5k-advanced-q1-12weeks](5k-advanced-q1-12weeks.md) | 55 / 13 | 5 | 1 | 13 → 13 → 13 → 10 → 13 → 13 → 13 → 9 → 13 → 14 → — → — | PASS |
| [5k-advanced-q2-12weeks](5k-advanced-q2-12weeks.md) | 55 / 13 | 5 | 2 | 13 → 13 → 13 → 10 → 13 → 13 → 13 → 9 → 13 → 14 → — → — | PASS |
| [10k-developing-q0-12weeks](10k-developing-q0-12weeks.md) | 18 / 6 | 3 | 0 | 6 → 6 → 6 → 4 → 7 → 7 → 8 → 6 → 8 → 9 → — → — | PASS |
| [10k-developing-q1-12weeks](10k-developing-q1-12weeks.md) | 18 / 6 | 3 | 1 | 6 → 6 → 6 → 4 → 7 → 7 → 8 → 5 → 8 → 9 → — → — | PASS |
| [10k-established-q0-12weeks](10k-established-q0-12weeks.md) | 40 / 11 | 4 | 0 | 11 → 11 → 11 → 8 → 11 → 12 → 12 → 9 → 12 → 13 → — → — | PASS |
| [10k-established-q1-12weeks](10k-established-q1-12weeks.md) | 40 / 11 | 4 | 1 | 11 → 11 → 11 → 7 → 11 → 12 → 12 → 8 → 12 → 13 → — → — | PASS |
| [10k-advanced-q0-12weeks](10k-advanced-q0-12weeks.md) | 60 / 15 | 5 | 0 | 15 → 15 → 15 → 11 → 15 → 15 → 15 → 11 → 15 → 16 → — → — | PASS |
| [10k-advanced-q1-12weeks](10k-advanced-q1-12weeks.md) | 60 / 15 | 5 | 1 | 15 → 15 → 15 → 11 → 15 → 15 → 15 → 11 → 15 → 16 → — → — | PASS |
| [10k-advanced-q2-12weeks](10k-advanced-q2-12weeks.md) | 60 / 15 | 5 | 2 | 15 → 15 → 15 → 10 → 15 → 15 → 15 → 10 → 15 → 16 → — → — | PASS |
| [half-developing-q0-12weeks](half-developing-q0-12weeks.md) | 24 / 10 | 3 | 0 | 10 → 11 → 12 → 8 → 13 → 14 → 15 → 12 → 16 → 12 → — → — | PASS |
| [half-developing-q1-12weeks](half-developing-q1-12weeks.md) | 24 / 10 | 3 | 1 | 10 → 11 → 12 → 8 → 13 → 14 → 15 → 12 → 16 → 12 → — → — | PASS |
| [half-established-q0-12weeks](half-established-q0-12weeks.md) | 45 / 14 | 4 | 0 | 14 → 14 → 16 → 12 → 16 → 18 → 18 → 14 → 19 → 15 → — → — | PASS |
| [half-established-q1-12weeks](half-established-q1-12weeks.md) | 45 / 14 | 4 | 1 | 14 → 14 → 16 → 12 → 16 → 18 → 18 → 14 → 19 → 15 → — → — | PASS |
| [half-advanced-q0-12weeks](half-advanced-q0-12weeks.md) | 65 / 18 | 5 | 0 | 18 → 18 → 20 → 16 → 20 → 22 → 22 → 17 → 23 → 18 → — → — | PASS |
| [half-advanced-q1-12weeks](half-advanced-q1-12weeks.md) | 65 / 18 | 5 | 1 | 18 → 18 → 20 → 16 → 20 → 22 → 22 → 17 → 23 → 18 → — → — | PASS |
| [half-advanced-q2-12weeks](half-advanced-q2-12weeks.md) | 65 / 18 | 5 | 2 | 18 → 18 → 20 → 16 → 20 → 22 → 22 → 17 → 23 → 18 → — → — | PASS |

## Failures

None.

## Reproduce

```sh
node --experimental-strip-types --test tests/road-overhaul-marathon.test.mjs tests/road-overhaul-matrix.test.mjs
node --experimental-strip-types scripts/verify-road-overhaul.mjs
```
