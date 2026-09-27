# Bug 1: reviewed before/after comparison

The verified capture passes all Bug-1 matrix assertions: 284 attempts, 207 generated plans, 77 explicit refusals, 2,830 weeks. All 90 protected half/marathon/ultra plans and all 42 protected-family refusal results remain identical. Three pre-existing short-race pace-capacity refusals now generate successfully. No previously generated input became a refusal.

The 5K/10K plans requesting quality contain 858 weeks: all retain at least one actual weekday quality session, and none has a full Recovery phase. All 36 pre-taper fourth-week q2 back-off opportunities have exactly one weekday workout. Explicit zero-workout cases remain zero. Taper is deliberately unchanged in this first fix.

- [Every baseline case and week](before.md)
- [Every verified Bug-1 case and week](after-bug1-verified.md)
- Baseline source SHA256: `5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea`
- Verified Bug-1 source SHA256: `567a6b5d9d857e13293e370db0a10d13bb2862d57c0bce9959fa4fbfae026297`

Below are full before/after week rows for one representative of each goal and two additional short-race q2 examples. The linked full matrix contains all other schedules and all refusals. The source-field hashes compare every unrounded value; displayed figures are rounded to three decimals. These are regression observations, not approval of every unchanged coaching decision.

## 5k-8w-4d-q1

Identical input: 28 km/week, 10 km recent long run, 4 days, 1 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 28 → 28 | 28 → 28 | 10 → 10 | 1 → 1 | easy, tempo, easy, long |
| 2 | Foundation → Foundation | 29.4 → 29.4 | 29.354 → 29.354 | 10 → 10 | 1 → 1 | easy, tempo, easy, long |
| 3 | Build → Build | 30.5 → 30.5 | 30.451 → 30.451 | 10 → 10 | 1 → 1 | easy, fartlek, easy, long |
| 4 | Recovery → Build | 22.7 → 31.4 | 22.65 → 31.4 | 7 → 10 | 0 → 1 | easy, tempo, easy, long |
| 5 | Race preparation → Race preparation | 31.1 → 31.4 | 31.142 → 31.4 | 10 → 10 | 1 → 1 | easy, fartlek, easy, long |
| 6 | Race preparation → Race preparation | 32.2 → 32.2 | 32.2 → 32.2 | 10 → 10 | 1 → 1 | easy, tempo, easy, long |
| 7 | Race preparation → Race preparation | 27.5 → 28.1 | 27.48 → 28.1 | — → — | 1 → 1 | easy, fartlek, easy, easy |
| 8 | Race week → Race week | 11.7 → 11.6 | 11.697 → 11.622 | — → — | 1 → 1 | easy, fartlek, easy, race |

## 10k-8w-4d-q1

Identical input: 32 km/week, 12 km recent long run, 4 days, 1 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 32 → 32 | 32 → 32 | 12 → 12 | 1 → 1 | easy, tempo, easy, long |
| 2 | Foundation → Foundation | 33.8 → 33.8 | 33.774 → 33.774 | 12 → 12 | 1 → 1 | easy, tempo, easy, long |
| 3 | Build → Build | 35.2 → 35.2 | 35.171 → 35.171 | 12 → 12 | 1 → 1 | easy, tempo, easy, long |
| 4 | Recovery → Build | 26 → 36.5 | 26 → 36.539 | 8 → 12 | 0 → 1 | easy, tempo, easy, long |
| 5 | Race preparation → Race preparation | 36.5 → 36.8 | 36.463 → 36.8 | 12 → 12 | 1 → 1 | easy, tempo, easy, long |
| 6 | Race preparation → Race preparation | 38.5 → 38.8 | 38.463 → 38.8 | 13 → 13 | 1 → 1 | easy, tempo, easy, long |
| 7 | Race preparation → Race preparation | 31.8 → 32.4 | 31.825 → 32.371 | — → — | 1 → 1 | easy, tempo, easy, easy |
| 8 | Race week → Race week | 12.7 → 12.7 | 12.653 → 12.671 | — → — | 1 → 1 | easy, tempo, easy, race |

## half-12w-4d-q1

Identical input: 40 km/week, 16 km recent long run, 4 days, 1 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 40 → 40 | 40 → 40 | 16 → 16 | 1 → 1 | easy, tempo, easy, long |
| 2 | Foundation → Foundation | 42.2 → 42.2 | 42.198 → 42.198 | 16 → 16 | 1 → 1 | easy, tempo, easy, long |
| 3 | Build → Build | 44.1 → 44.1 | 44.098 → 44.098 | 16 → 16 | 1 → 1 | easy, tempo, easy, long |
| 4 | Recovery → Recovery | 34.7 → 34.7 | 34.65 → 34.65 | 11 → 11 | 0 → 0 | easy, easy, easy, long |
| 5 | Build → Build | 45.8 → 45.8 | 45.766 → 45.766 | 16 → 16 | 1 → 1 | easy, tempo, easy, long |
| 6 | Build → Build | 46.2 → 46.2 | 46.2 → 46.2 | 16 → 16 | 1 → 1 | easy, tempo, easy, long |
| 7 | Race preparation → Race preparation | 46.9 → 46.9 | 46.9 → 46.9 | 16 → 16 | 1 → 1 | easy, tempo, easy, long |
| 8 | Recovery → Recovery | 35.8 → 35.8 | 35.75 → 35.75 | 11 → 11 | 0 → 0 | easy, easy, easy, long |
| 9 | Race preparation → Race preparation | 49.4 → 49.4 | 49.4 → 49.4 | 18 → 18 | 1 → 1 | easy, tempo, easy, long |
| 10 | Race preparation → Race preparation | 48.6 → 48.6 | 48.562 → 48.562 | 14 → 14 | 1 → 1 | easy, tempo, easy, long |
| 11 | Taper → Taper | 31.1 → 31.1 | 31.102 → 31.102 | — → — | 1 → 1 | easy, tempo, easy, easy |
| 12 | Race week → Race week | 12.5 → 12.5 | 12.468 → 12.468 | — → — | 1 → 1 | easy, tempo, easy, race |

## marathon-16w-5d-q2

Identical input: 65 km/week, 23 km recent long run, 5 days, 2 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 65 → 65 | 65 → 65 | 23 → 23 | 2 → 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation → Foundation | 65 → 65 | 65 → 65 | 23 → 23 | 2 → 2 | easy, tempo, easy, intervals, long |
| 3 | Foundation → Foundation | 67.8 → 67.8 | 67.778 → 67.778 | 25 → 25 | 2 → 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery → Recovery | 46.4 → 46.4 | 46.4 → 46.4 | 19 → 19 | 0 → 0 | easy, easy, easy, easy, long |
| 5 | Build → Build | 70.8 → 70.8 | 70.806 → 70.806 | 27 → 27 | 2 → 2 | easy, tempo, easy, intervals, long |
| 6 | Build → Build | 70.8 → 70.8 | 70.806 → 70.806 | 27 → 27 | 2 → 2 | easy, tempo, easy, intervals, long |
| 7 | Build → Build | 73.8 → 73.8 | 73.803 → 73.803 | 28 → 28 | 2 → 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery → Recovery | 51.3 → 51.3 | 51.3 → 51.3 | 22 → 22 | 0 → 0 | easy, easy, easy, easy, long |
| 9 | Build → Build | 76.8 → 76.8 | 76.772 → 76.772 | 30 → 30 | 2 → 2 | easy, tempo, easy, intervals, long |
| 10 | Race preparation → Race preparation | 76.9 → 76.9 | 76.867 → 76.867 | 31 → 31 | 2 → 2 | easy, tempo, easy, fartlek, long |
| 11 | Race preparation → Race preparation | 76.9 → 76.9 | 76.867 → 76.867 | 33 → 33 | 2 → 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery → Recovery | 51.9 → 51.9 | 51.9 → 51.9 | 23 → 23 | 0 → 0 | easy, easy, easy, easy, long |
| 13 | Race preparation → Race preparation | 76.9 → 76.9 | 76.867 → 76.867 | 33 → 33 | 2 → 2 | easy, tempo, easy, intervals, long |
| 14 | Taper → Taper | 55.6 → 55.6 | 55.586 → 55.586 | 24 → 24 | 1 → 1 | easy, intervals, easy, easy, long |
| 15 | Taper → Taper | 44.4 → 44.4 | 44.389 → 44.389 | 19 → 19 | 1 → 1 | easy, intervals, easy, easy, long |
| 16 | Race week → Race week | 30.5 → 30.5 | 30.486 → 30.486 | — → — | 1 → 1 | easy, tempo, easy, easy, race |

## ultra-20w-5d-q1

Identical input: 75 km/week, 25 km recent long run, 5 days, 1 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 75 → 75 | 75 → 75 | 25 → 25 | 1 → 1 | easy, tempo, easy, easy, long |
| 2 | Foundation → Foundation | 75 → 75 | 75 → 75 | 25 → 25 | 1 → 1 | easy, tempo, easy, easy, long |
| 3 | Build → Build | 75.5 → 75.5 | 75.527 → 75.527 | 27 → 27 | 1 → 1 | easy, tempo, easy, easy, long |
| 4 | Recovery → Recovery | 61.4 → 61.4 | 61.4 → 61.4 | 19 → 19 | 0 → 0 | easy, easy, easy, easy, long |
| 5 | Build → Build | 77.5 → 77.5 | 77.527 → 77.527 | 29 → 29 | 1 → 1 | easy, tempo, easy, easy, long |
| 6 | Build → Build | 77.5 → 77.5 | 77.527 → 77.527 | 29 → 29 | 1 → 1 | easy, tempo, easy, easy, long |
| 7 | Build → Build | 79.5 → 79.5 | 79.527 → 79.527 | 31 → 31 | 1 → 1 | easy, tempo, easy, easy, long |
| 8 | Recovery → Recovery | 65 → 65 | 65 → 65 | 21 → 21 | 0 → 0 | easy, easy, easy, easy, long |
| 9 | Race preparation → Race preparation | 81.5 → 81.5 | 81.527 → 81.527 | 33 → 33 | 1 → 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation → Race preparation | 83.5 → 83.5 | 83.527 → 83.527 | 35 → 35 | 1 → 1 | easy, tempo, easy, easy, long |
| 11 | Race preparation → Race preparation | 83.5 → 83.5 | 83.527 → 83.527 | 35 → 35 | 1 → 1 | easy, tempo, easy, easy, long |
| 12 | Recovery → Recovery | 68.1 → 68.1 | 68.1 → 68.1 | 23 → 23 | 0 → 0 | easy, easy, easy, easy, long |
| 13 | Race preparation → Race preparation | 85.5 → 85.5 | 85.527 → 85.527 | 37 → 37 | 1 → 1 | easy, tempo, easy, easy, long |
| 14 | Race preparation → Race preparation | 87.5 → 87.5 | 87.527 → 87.527 | 39 → 39 | 1 → 1 | easy, tempo, easy, easy, long |
| 15 | Race preparation → Race preparation | 87.5 → 87.5 | 87.527 → 87.527 | 39 → 39 | 1 → 1 | easy, tempo, easy, easy, long |
| 16 | Recovery → Recovery | 70.7 → 70.7 | 70.7 → 70.7 | 27 → 27 | 0 → 0 | easy, easy, easy, easy, long |
| 17 | Race preparation → Race preparation | 81.5 → 81.5 | 81.527 → 81.527 | 33 → 33 | 1 → 1 | easy, tempo, easy, easy, long |
| 18 | Taper → Taper | 56.2 → 56.2 | 56.23 → 56.23 | 16 → 16 | 1 → 1 | easy, tempo, easy, easy, long |
| 19 | Taper → Taper | 37.6 → 37.6 | 37.6 → 37.6 | — → — | 1 → 1 | easy, tempo, easy, easy, easy |
| 20 | Race week → Race week | 15.6 → 15.6 | 15.6 → 15.6 | — → — | 0 → 0 | easy, easy, easy, easy, race |

## 5k-8w-5d-q2-advanced

Identical input: 45 km/week, 13 km recent long run, 5 days, 2 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 45 → 45 | 45 → 45 | 13 → 13 | 2 → 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation → Foundation | 45 → 45 | 45 → 45 | 13 → 13 | 2 → 2 | easy, tempo, easy, fartlek, long |
| 3 | Build → Build | 46.5 → 46.5 | 46.468 → 46.468 | 13 → 13 | 2 → 2 | easy, fartlek, easy, tempo, long |
| 4 | Recovery → Build | 33.4 → 46.8 | 33.4 → 46.8 | 9 → 13 | 0 → 1 | easy, fartlek, easy, easy, long |
| 5 | Race preparation → Race preparation | 46.7 → 46.8 | 46.7 → 46.8 | 13 → 13 | 2 → 2 | easy, fartlek, easy, tempo, long |
| 6 | Race preparation → Race preparation | 47.3 → 48.2 | 47.3 → 48.2 | 13 → 13 | 2 → 2 | easy, fartlek, easy, tempo, long |
| 7 | Race preparation → Race preparation | 41.2 → 41.9 | 41.166 → 41.921 | — → — | 2 → 2 | easy, fartlek, easy, tempo, easy |
| 8 | Race week → Race week | 17.4 → 18.1 | 17.379 → 18.096 | — → — | 1 → 1 | easy, tempo, easy, easy, race |

## 10k-12w-6d-q2

Identical input: 48 km/week, 12 km recent long run, 6 days, 2 requested weekday workouts.

| Week | Phase before → after | Target km before → after | Actual km before → after | Long km before → after | Weekday Q before → after | Kinds after |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation → Foundation | 48 → 48 | 48 → 48 | 12 → 12 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation → Foundation | 48 → 48 | 48 → 48 | 12 → 12 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build → Build | 49 → 49 | 48.97 → 48.97 | 12 → 12 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery → Build | 33.8 → 50.9 | 33.8 → 50.928 | 8 → 13 | 0 → 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build → Build | 50.9 → 52.5 | 50.928 → 52.545 | 13 → 13 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build → Build | 52.8 → 53.9 | 52.832 → 53.883 | 13 → 13 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build → Build | 54.8 → 56 | 54.773 → 56.038 | 14 → 14 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery → Race preparation | 40.7 → 57 | 40.7 → 56.951 | 10 → 14 | 0 → 1 | easy, tempo, easy, easy, easy, long |
| 9 | Race preparation → Race preparation | 56.6 → 57.7 | 56.555 → 57.668 | 14 → 14 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Race preparation → Race preparation | 58.8 → 59.1 | 58.764 → 59.105 | 15 → 15 | 2 → 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Race preparation → Race preparation | 52.4 → 53.1 | 52.361 → 53.061 | — → — | 2 → 2 | easy, tempo, easy, tempo, easy, easy |
| 12 | Race week → Race week | 20.6 → 20.4 | 20.595 → 20.357 | — → — | 1 → 1 | easy, tempo, easy, easy, easy, race |
