# Actual derivation trace

Read-only observations of the production generator. The hook inserts observations after existing calls; it does not substitute their logic. All 12 regenerated examples must equal the saved day-by-day example summaries, including titles, actual work minutes and templates. No production files are changed.

```json
{
  "attempted": 72,
  "generated": 45,
  "rejected": 27,
  "validationFailures": 0,
  "originalsMatched": 12,
  "sourceFingerprint": "5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea",
  "sourceUnchanged": true
}
```

## Comparison caveat

The earlier two-workout examples changed starting mileage, familiar long run and/or running frequency. They cannot isolate the effect of selecting a second workout. The matched matrix below holds those inputs, benchmark and declared quality history fixed within each three-case group. These are synthetic input fixtures, not recommended starting routines. Lower/middle/higher are fixture labels, not source-authored coaching levels.

## All original examples: each week explained

Initial km is the sum after the first recipe allocation, before reconciliation. Nominal km is the allocator’s weekly budget. Final km excludes race distance. Q counts weekday quality; hard includes hard long runs and therefore can exceed Q. A dash means no designated long outing.

## 5k-q0

Input: 30 km/week, 8 km familiar long, 4 days; 5 km in 25 minutes. Input days: Mon/Wed/Fri/Sun; chosen days: Tue/Wed/Fri/Sun.
Policy: established; allocation easy pace 7.233 min/km; nominal long target 10 km; peak week 10; preparation window 10 weeks; quality days none; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 30 | 29.981 | 26 | 8 → 8 | 0 / 0 | Tue easy(easy) 5.2; Wed easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 8 |
| 2 Foundation | 30 | 29.981 | 26 | 8 → 8 | 0 / 0 | Tue easy(easy) 5.2; Wed easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 8 |
| 3 Build | 31.5 | 31.364 | 26 | 8 → 8 | 0 / 0 | Tue easy(easy) 5.2; Wed easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 8 |
| 4 Recovery | 25.83 | 23.835 | 19.5 | 6 → 6 | 0 / 0 | Tue easy(easy) 3.9; Wed easy(easy) 4.8; Fri easy(easy) 4.8; Sun long(long) 6 |
| 5 Build | 33 | 31.64 | 26 | 8 → 8 | 0 / 0 | Tue easy(easy) 5.2; Wed easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 8 |
| 6 Build | 34.5 | 34.299 | 27.5 | 9 → 9 | 0 / 0 | Tue easy(easy) 5.353; Wed easy(easy) 6.573; Fri easy(easy) 6.574; Sun long(long) 9 |
| 7 Build | 36 | 35.82 | 29 | 9 → 9 | 0 / 0 | Tue easy(easy) 5.779; Wed easy(easy) 7.11; Fri easy(easy) 7.111; Sun long(long) 9 |
| 8 Recovery | 29.52 | 27.736 | 22.75 | 7 → 7 | 0 / 0 | Tue easy(easy) 4.55; Wed easy(easy) 5.6; Fri easy(easy) 5.6; Sun long(long) 7 |
| 9 Race preparation | 37.5 | 35.958 | 29.25 | 9 → 9 | 0 / 0 | Tue easy(easy) 5.85; Wed easy(easy) 7.2; Fri easy(easy) 7.2; Sun long(long) 9 |
| 10 Race preparation | 39 | 38.893 | 30.75 | 10 → 10 | 0 / 0 | Tue easy(easy) 6.002; Wed easy(easy) 7.373; Fri easy(easy) 7.375; Sun long(long) 10 |
| 11 Race preparation | 35.1 | 34.976 | 28.4 | — → — | 0 / 0 | Tue easy(easy) 6.5; Wed easy(easy) 8; Fri easy(easy) 8; Sun easy(easy) 5.9 |
| 12 Race week | 17.55 | 15.898 | 11.3 | — → — | 0 / 0 | Tue easy(easy) 3.5; Wed easy(easy) 4.4; Fri easy(easy) 3.4 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 29.981 | 8 | 7.327 / 7.327 / 7.327 / 8 |
| reconcileOpeningBaseline | 26 | 8 | 5.2 / 6.4 / 6.4 / 8 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 23.835 km total / 6 km long → normalizeGeneratedLongRuns: 19.5 km total / 6 km long.
- Week 8: 01 initial recipe allocation: 27.736 km total / 7 km long → normalizeGeneratedLongRuns: 22.75 km total / 7 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.

## 5k-q1

Input: 30 km/week, 8 km familiar long, 4 days; 5 km in 25 minutes. Input days: Mon/Wed/Fri/Sun; chosen days: Tue/Wed/Fri/Sun.
Policy: established; allocation easy pace 7.233 min/km; nominal long target 10 km; peak week 10; preparation window 10 weeks; quality days Wed; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 30 | 29.981 | 26.8 | 8 → 8 | 1 / 1 | Tue easy(easy) 5.2; Wed tempo(threshold) 7.2; Fri easy(easy) 6.4; Sun long(long) 8 |
| 2 Maintenance | 30 | 29.912 | 26.8 | 8 → 8 | 1 / 1 | Tue easy(easy) 5.155; Wed tempo(threshold) 7.3; Fri easy(easy) 6.345; Sun long(long) 8 |
| 3 Build | 31.5 | 30.672 | 26.8 | 8 → 8 | 1 / 1 | Tue easy(easy) 5.2; Wed tempo(threshold) 7.2; Fri easy(easy) 6.4; Sun long(long) 8 |
| 4 Recovery | 25.83 | 25.632 | 16.25 | 6 → 5 | 0 / 0 | Tue easy(easy) 3.25; Wed easy(easy) 4; Fri easy(easy) 4; Sun long(long) 5 |
| 5 Build | 33 | 30.88 | 26.9 | 8 → 8 | 1 / 1 | Tue easy(easy) 5.2; Wed tempo(threshold) 7.3; Fri easy(easy) 6.4; Sun long(long) 8 |
| 6 Build | 34.5 | 33.608 | 28.4 | 9 → 9 | 1 / 1 | Tue easy(easy) 5.606; Wed fartlek(race-rhythm) 6.9; Fri easy(easy) 6.894; Sun long(long) 9 |
| 7 Build | 36 | 33.746 | 28.95 | 9 → 9 | 1 / 1 | Tue easy(easy) 5.717; Wed tempo(threshold) 7.2; Fri easy(easy) 7.033; Sun long(long) 9 |
| 8 Recovery | 29.52 | 29.395 | 19.5 | 7 → 6 | 0 / 0 | Tue easy(easy) 3.9; Wed easy(easy) 4.8; Fri easy(easy) 4.8; Sun long(long) 6 |
| 9 Race preparation | 37.5 | 33.769 | 28.95 | 9 → 9 | 1 / 1 | Tue easy(easy) 5.85; Wed fartlek(race-rhythm) 6.9; Fri easy(easy) 7.2; Sun long(long) 9 |
| 10 Race preparation | 39 | 37.235 | 30.45 | 10 → 10 | 1 / 1 | Tue easy(easy) 5.725; Wed tempo(threshold) 7.7; Fri easy(easy) 7.025; Sun long(long) 10 |
| 11 Race preparation | 35.1 | 33.318 | 28.1 | — → — | 1 / 1 | Tue easy(easy) 6.5; Wed fartlek(race-rhythm) 7.7; Fri easy(easy) 8; Sun easy(easy) 5.9 |
| 12 Race week | 17.55 | 14.585 | 11.122 | — → — | 1 / 1 | Tue easy(easy) 3.3; Wed fartlek(race-rhythm) 4.366; Fri easy(easy) 3.456 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 29.981 | 8 | 7.604 / 6.912 / 7.465 / 8 |
| reconcileOpeningBaseline | 26.8 | 8 | 5.2 / 7.2 / 6.4 / 8 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 25.632 km total / 6 km long → applyActualTrainingEnvelope: 24.806 km total / 5.806 km long → normalizeGeneratedLongRuns: 16.25 km total / 5 km long.
- Week 8: 01 initial recipe allocation: 29.395 km total / 7 km long → applyActualTrainingEnvelope: 27.097 km total / 6.497 km long → normalizeGeneratedLongRuns: 19.5 km total / 6 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 7 × 2 min tempo [road-threshold-120s], 14 min work, 7.2 km total.
- Week 2: 9 × 90 sec tempo [road-threshold-90s], 13.5 min work, 7.3 km total.
- Week 3: 7 × 2 min tempo [road-threshold-120s], 14 min work, 7.2 km total.
- Week 5: 9 × 90 sec tempo [road-threshold-90s], 13.5 min work, 7.3 km total.
- Week 6: 7 × 90 sec 5K effort [road-5k-90s], 10.5 min work, 6.9 km total.
- Week 7: 5 × 3 min tempo [road-threshold-180s], 15 min work, 7.2 km total.
- Week 9: 10 × 200 m 5K effort [road-5k-200m], 10.167 min work, 6.9 km total.
- Week 10: 10 × 90 sec tempo [road-threshold-90s], 15 min work, 7.7 km total.
- Week 11: 7 × 2 min 5K effort [road-5k-120s], 14 min work, 7.7 km total.
- Week 12: 2 × 2 min 5K effort [road-5k-120s], 4 min work, 4.366 km total.

## 5k-q2

Input: 55 km/week, 13 km familiar long, 6 days; 5 km in 25 minutes. Input days: Mon/Tue/Wed/Thu/Fri/Sun; chosen days: Tue/Wed/Thu/Fri/Sat/Sun.
Policy: advanced; allocation easy pace 7.233 min/km; nominal long target 13.825 km; peak week 10; preparation window 10 weeks; quality days Wed/Fri; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 55 | 54.751 | 54.25 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed tempo(threshold) 8.4; Thu easy(easy) 8.45; Fri fartlek(race-rhythm) 7.5; Sat easy(easy) 8.45; Sun long(long) 13 |
| 2 Maintenance | 55 | 54.636 | 54.25 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 7.6; Thu easy(easy) 8.4; Fri tempo(threshold) 8.4; Sat easy(easy) 8.4; Sun long(long) 13 |
| 3 Build | 57 | 56.825 | 54.25 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 7.9; Thu easy(easy) 8.25; Fri tempo(threshold) 8.4; Sat easy(easy) 8.25; Sun long(long) 13 |
| 4 Recovery | 46.74 | 46.636 | 37.75 | 10 → 9 | 0 / 0 | Tue easy(easy) 5.85; Wed easy(easy) 5.85; Thu easy(easy) 5.6; Fri easy(easy) 5.85; Sat easy(easy) 5.6; Sun long(long) 9 |
| 5 Build | 59 | 58.761 | 54.25 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 7.5; Thu easy(easy) 8.45; Fri tempo(threshold) 8.4; Sat easy(easy) 8.45; Sun long(long) 13 |
| 6 Build | 61 | 60.833 | 55.25 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.416; Wed fartlek(race-rhythm) 8.4; Thu easy(easy) 8.416; Fri tempo(threshold) 8.6; Sat easy(easy) 8.418; Sun long(long) 13 |
| 7 Build | 63 | 62.66 | 55.25 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 8.5; Thu easy(easy) 8.45; Fri tempo(threshold) 8.4; Sat easy(easy) 8.45; Sun long(long) 13 |
| 8 Recovery | 51.66 | 51.474 | 38.25 | 10 → 9 | 0 / 0 | Tue easy(easy) 5.85; Wed easy(easy) 5.85; Thu easy(easy) 5.85; Fri easy(easy) 5.85; Sat easy(easy) 5.85; Sun long(long) 9 |
| 9 Race preparation | 65 | 64.842 | 55.75 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 8.5; Thu easy(easy) 8.45; Fri tempo(threshold) 8.9; Sat easy(easy) 8.45; Sun long(long) 13 |
| 10 Race preparation | 67 | 66.691 | 56.15 | 13 → 13 | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 9; Thu easy(easy) 8.45; Fri tempo(threshold) 8.8; Sat easy(easy) 8.45; Sun long(long) 13 |
| 11 Race preparation | 62.533 | 58.963 | 51.471 | — → — | 2 / 2 | Tue easy(easy) 8.45; Wed fartlek(race-rhythm) 10; Thu easy(easy) 8.45; Fri tempo(threshold) 9.9; Sat easy(easy) 8.45; Sun easy(easy) 6.221 |
| 12 Race week | 33.5 | 22.81 | 20.695 | — → — | 1 / 1 | Tue easy(easy) 4.9; Wed tempo(threshold) 5.427; Thu easy(easy) 4.147; Fri easy(easy) 3.456; Sat easy(easy) 2.765 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 54.751 | 13 | 10.922 / 8.018 / 7.742 / 7.327 / 7.742 / 13 |
| reconcileOpeningBaseline | 54.25 | 13 | 8.45 / 8.4 / 8.45 / 7.5 / 8.45 / 13 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 46.636 km total / 10 km long → applyActualTrainingEnvelope: 45.851 km total / 9.815 km long → normalizeGeneratedLongRuns: 37.886 km total / 9 km long → applyActualTrainingEnvelope: 37.75 km total / 9 km long.
- Week 8: 01 initial recipe allocation: 51.474 km total / 10 km long → applyActualTrainingEnvelope: 50.733 km total / 9.815 km long → normalizeGeneratedLongRuns: 38.25 km total / 9 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.4 km total; 7 × 90 sec 5K effort [road-5k-90s], 10.5 min work, 7.5 km total.
- Week 2: 10 × 200 m 5K effort [road-5k-200m], 10.167 min work, 7.6 km total; 10 × 90 sec tempo [road-threshold-90s], 15 min work, 8.4 km total.
- Week 3: 11 × 1 min 5K effort [road-5k-60s], 11 min work, 7.9 km total; 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.4 km total.
- Week 5: 7 × 90 sec 5K effort [road-5k-90s], 10.5 min work, 7.5 km total; 10 × 90 sec tempo [road-threshold-90s], 15 min work, 8.4 km total.
- Week 6: 7 × 2 min 5K effort [road-5k-120s], 14 min work, 8.4 km total; 6 × 3 min tempo [road-threshold-180s], 18 min work, 8.6 km total.
- Week 7: 13 × 200 m 5K effort [road-5k-200m], 13.217 min work, 8.5 km total; 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.4 km total.
- Week 9: 5 × 3 min 5K effort [road-5k-180s], 15 min work, 8.5 km total; 5 × 4 min tempo [road-threshold-240s], 20 min work, 8.9 km total.
- Week 10: 8 × 400 m 5K effort [road-5k-400m], 16.267 min work, 9 km total; 6 × 600 m tempo [road-threshold-600m], 19.6 min work, 8.8 km total.
- Week 11: 10 × 2 min 5K effort [road-5k-120s], 20 min work, 10 km total; 5 × 5 min tempo [road-threshold-300s], 25 min work, 9.9 km total.
- Week 12: 2 × 5 min tempo [road-threshold-300s], 10 min work, 5.427 km total.

## 10k-q0

Input: 36 km/week, 11 km familiar long, 4 days; 10 km in 50 minutes. Input days: Mon/Wed/Fri/Sun; chosen days: Tue/Wed/Fri/Sun.
Policy: established; allocation easy pace 7 min/km; nominal long target 13 km; peak week 10; preparation window 10 weeks; quality days none; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 36 | 36.001 | 35.75 | 11 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 8.8; Fri easy(easy) 8.8; Sun long(long) 11 |
| 2 Foundation | 36 | 36.001 | 35.75 | 11 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 8.8; Fri easy(easy) 8.8; Sun long(long) 11 |
| 3 Build | 38 | 38 | 35.75 | 11 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 8.8; Fri easy(easy) 8.8; Sun long(long) 11 |
| 4 Recovery | 31.16 | 31.142 | 26 | 8 → 8 | 0 / 0 | Tue easy(easy) 5.2; Wed easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 8 |
| 5 Build | 40 | 39.999 | 35.75 | 11 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 8.8; Fri easy(easy) 8.8; Sun long(long) 11 |
| 6 Build | 42 | 42 | 37.75 | 12 → 12 | 0 / 0 | Tue easy(easy) 7.443; Wed easy(easy) 9.153; Fri easy(easy) 9.154; Sun long(long) 12 |
| 7 Build | 44 | 43.999 | 39 | 12 → 12 | 0 / 0 | Tue easy(easy) 7.8; Wed easy(easy) 9.6; Fri easy(easy) 9.6; Sun long(long) 12 |
| 8 Recovery | 36.08 | 36 | 29.25 | 9 → 9 | 0 / 0 | Tue easy(easy) 5.85; Wed easy(easy) 7.2; Fri easy(easy) 7.2; Sun long(long) 9 |
| 9 Race preparation | 46 | 46.001 | 39 | 12 → 12 | 0 / 0 | Tue easy(easy) 7.8; Wed easy(easy) 9.6; Fri easy(easy) 9.6; Sun long(long) 12 |
| 10 Race preparation | 48 | 47.999 | 41 | 13 → 13 | 0 / 0 | Tue easy(easy) 8.093; Wed easy(easy) 9.953; Fri easy(easy) 9.954; Sun long(long) 13 |
| 11 Race preparation | 43.2 | 43.144 | 35.65 | — → — | 0 / 0 | Tue easy(easy) 8.45; Wed easy(easy) 10.4; Fri easy(easy) 10.4; Sun easy(easy) 6.4 |
| 12 Race week | 21.6 | 16.429 | 14 | — → — | 0 / 0 | Tue easy(easy) 4.7; Wed easy(easy) 5.8; Fri easy(easy) 3.5 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 36.001 | 11 | 8.429 / 8.286 / 8.286 / 11 |
| reconcileOpeningBaseline | 35.75 | 11 | 7.15 / 8.8 / 8.8 / 11 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 31.142 km total / 8 km long → normalizeGeneratedLongRuns: 26 km total / 8 km long.
- Week 8: 01 initial recipe allocation: 36 km total / 9 km long → normalizeGeneratedLongRuns: 29.25 km total / 9 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.

## 10k-q1

Input: 36 km/week, 11 km familiar long, 4 days; 10 km in 50 minutes. Input days: Mon/Wed/Fri/Sun; chosen days: Tue/Wed/Fri/Sun.
Policy: established; allocation easy pace 7 min/km; nominal long target 13 km; peak week 10; preparation window 10 weeks; quality days Wed; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 36 | 36 | 34.45 | 11 → 11 | 1 / 1 | Tue easy(easy) 7.15; Wed tempo(threshold) 7.5; Fri easy(easy) 8.8; Sun long(long) 11 |
| 2 Maintenance | 36 | 35.928 | 34.45 | 11 → 11 | 1 / 1 | Tue easy(easy) 7.143; Wed tempo(threshold) 7.6; Fri easy(easy) 8.707; Sun long(long) 11 |
| 3 Build | 38 | 38 | 34.45 | 11 → 11 | 1 / 1 | Tue easy(easy) 7.15; Wed tempo(threshold) 7.5; Fri easy(easy) 8.8; Sun long(long) 11 |
| 4 Recovery | 31.16 | 31.144 | 22.75 | 8 → 7 | 0 / 0 | Tue easy(easy) 4.55; Wed easy(easy) 5.6; Fri easy(easy) 5.6; Sun long(long) 7 |
| 5 Build | 40 | 39.928 | 34.55 | 11 → 11 | 1 / 1 | Tue easy(easy) 7.15; Wed tempo(threshold) 7.6; Fri easy(easy) 8.8; Sun long(long) 11 |
| 6 Build | 42 | 41.928 | 36.4 | 12 → 12 | 1 / 1 | Tue easy(easy) 7.8; Wed tempo(race-rhythm) 7; Fri easy(easy) 9.6; Sun long(long) 12 |
| 7 Build | 44 | 43 | 36.9 | 12 → 12 | 1 / 1 | Tue easy(easy) 7.8; Wed tempo(threshold) 7.5; Fri easy(easy) 9.6; Sun long(long) 12 |
| 8 Recovery | 36.08 | 35.999 | 26 | 9 → 8 | 0 / 0 | Tue easy(easy) 5.2; Wed easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 8 |
| 9 Race preparation | 46 | 43.357 | 37.1 | 12 → 12 | 1 / 1 | Tue easy(easy) 7.8; Wed tempo(race-rhythm) 7.7; Fri easy(easy) 9.6; Sun long(long) 12 |
| 10 Race preparation | 48 | 46.571 | 39.1 | 13 → 13 | 1 / 1 | Tue easy(easy) 8.116; Wed tempo(threshold) 8; Fri easy(easy) 9.984; Sun long(long) 13 |
| 11 Race preparation | 43.2 | 40.287 | 32.879 | — → — | 1 / 1 | Tue easy(easy) 8.45; Wed tempo(race-rhythm) 7.6; Fri easy(easy) 10.4; Sun easy(easy) 6.429 |
| 12 Race week | 21.6 | 14.714 | 12.88 | — → — | 1 / 1 | Tue easy(easy) 4.8; Wed tempo(race-rhythm) 4.509; Fri easy(easy) 3.571 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 36 | 11 | 9 / 7.143 / 8.857 / 11 |
| reconcileOpeningBaseline | 34.45 | 11 | 7.15 / 7.5 / 8.8 / 11 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 31.144 km total / 8 km long → applyActualTrainingEnvelope: 30.815 km total / 7.857 km long → normalizeGeneratedLongRuns: 22.75 km total / 7 km long.
- Week 8: 01 initial recipe allocation: 35.999 km total / 9 km long → applyActualTrainingEnvelope: 34.614 km total / 8.714 km long → normalizeGeneratedLongRuns: 26 km total / 8 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 7 × 2 min tempo [road-threshold-120s], 14 min work, 7.5 km total.
- Week 2: 9 × 90 sec tempo [road-threshold-90s], 13.5 min work, 7.6 km total.
- Week 3: 7 × 2 min tempo [road-threshold-120s], 14 min work, 7.5 km total.
- Week 5: 9 × 90 sec tempo [road-threshold-90s], 13.5 min work, 7.6 km total.
- Week 6: 4 × 3 min 10K effort [road-10k-180s], 12 min work, 7 km total.
- Week 7: 5 × 3 min tempo [road-threshold-180s], 15 min work, 7.5 km total.
- Week 9: 7 × 2 min 10K effort [road-10k-120s], 14 min work, 7.7 km total.
- Week 10: 10 × 90 sec tempo [road-threshold-90s], 15 min work, 8 km total.
- Week 11: 10K effort pyramid [road-10k-pyramid-2-3-4-3-2], 14 min work, 7.6 km total.
- Week 12: 3 min 10K effort [road-10k-180s], 3 min work, 4.509 km total.

## 10k-q2

Input: 60 km/week, 16 km familiar long, 6 days; 10 km in 50 minutes. Input days: Mon/Tue/Wed/Thu/Fri/Sun; chosen days: Tue/Wed/Thu/Fri/Sat/Sun.
Policy: advanced; allocation easy pace 7 min/km; nominal long target 16 km; peak week 10; preparation window 12 weeks; quality days Wed/Fri; medium day Thu.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 60 | 59.928 | 60 | 16 → 16 | 2 / 2 | Tue easy(easy) 9.508; Wed tempo(threshold) 8.7; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 7.7; Sat easy(easy) 7.692; Sun long(long) 16 |
| 2 Foundation | 62.4 | 62.214 | 60 | 16 → 16 | 2 / 2 | Tue easy(easy) 9.307; Wed tempo(threshold) 8.7; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 8.4; Sat easy(easy) 7.193; Sun long(long) 16 |
| 3 Build | 64.896 | 64.856 | 60.685 | 16 → 16 | 2 / 2 | Tue easy(easy) 9.514; Wed tempo(threshold) 8.9; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 8.3; Sat easy(easy) 7.571; Sun long(long) 16 |
| 4 Recovery | 53.215 | 53.143 | 45.25 | 12 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 7.15; Thu easy(easy) 6.4; Fri easy(easy) 7.15; Sat easy(easy) 6.4; Sun long(long) 11 |
| 5 Build | 67.396 | 67.18 | 62.143 | 16 → 16 | 2 / 2 | Tue easy(easy) 10.4; Wed tempo(threshold) 8.7; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 8.5; Sat easy(easy) 8.143; Sun long(long) 16 |
| 6 Build | 69.896 | 69.857 | 63.929 | 16 → 16 | 2 / 2 | Tue easy(easy) 10.4; Wed tempo(threshold) 9.2; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 9.5; Sat easy(easy) 8.429; Sun long(long) 16 |
| 7 Build | 72.396 | 72.238 | 64.257 | 16 → 16 | 2 / 2 | Tue easy(easy) 10.4; Wed tempo(threshold) 9; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 8.6; Sat easy(easy) 9.857; Sun long(long) 16 |
| 8 Recovery | 59.365 | 59.287 | 46.75 | 12 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 7.15; Thu easy(easy) 7.15; Fri easy(easy) 7.15; Sat easy(easy) 7.15; Sun long(long) 11 |
| 9 Race preparation | 74.896 | 74.858 | 66.286 | 16 → 16 | 2 / 2 | Tue easy(easy) 10.4; Wed tempo(threshold) 10.3; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 8.9; Sat easy(easy) 10.286; Sun long(long) 16 |
| 10 Race preparation | 77.396 | 77.193 | 66.6 | 16 → 16 | 2 / 2 | Tue easy(easy) 10.4; Wed tempo(threshold) 9.4; Thu easy(medium-long) 10.4; Fri tempo(race-rhythm) 10; Sat easy(easy) 10.4; Sun long(long) 16 |
| 11 Race preparation | 72.236 | 66.643 | 58.229 | — → — | 2 / 2 | Tue easy(easy) 10.4; Wed tempo(threshold) 10; Thu easy(easy) 10.4; Fri tempo(race-rhythm) 10.6; Sat easy(easy) 10.4; Sun easy(easy) 6.429 |
| 12 Race week | 38.698 | 23.572 | 22.212 | — → — | 1 / 1 | Tue easy(easy) 6.058; Wed tempo(race-rhythm) 5.44; Thu easy(easy) 4.286; Fri easy(easy) 3.571; Sat easy(easy) 2.857 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 59.928 | 16 | 9.143 / 8.286 / 12.571 / 7.357 / 6.571 / 16 |
| reconcileOpeningBaseline | 60 | 16 | 9.508 / 8.7 / 10.4 / 7.7 / 7.692 / 16 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 53.143 km total / 12 km long → applyActualTrainingEnvelope: 52.172 km total / 11.714 km long → normalizeGeneratedLongRuns: 45.308 km total / 11 km long → applyActualTrainingEnvelope: 45.25 km total / 11 km long.
- Week 8: 01 initial recipe allocation: 59.287 km total / 12 km long → applyActualTrainingEnvelope: 58.086 km total / 11.714 km long → normalizeGeneratedLongRuns: 46.75 km total / 11 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.7 km total; 4 × 3 min 10K effort [road-10k-180s], 12 min work, 7.7 km total.
- Week 2: 10 × 90 sec tempo [road-threshold-90s], 15 min work, 8.7 km total; 7 × 2 min 10K effort [road-10k-120s], 14 min work, 8.4 km total.
- Week 3: 6 × 3 min tempo [road-threshold-180s], 18 min work, 8.9 km total; 10K effort pyramid [road-10k-pyramid-2-3-4-3-2], 14 min work, 8.3 km total.
- Week 5: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.7 km total; 5 × 600 m 10K effort [road-10k-600m], 15.25 min work, 8.5 km total.
- Week 6: 5 × 4 min tempo [road-threshold-240s], 20 min work, 9.2 km total; 4 × 5 min 10K effort [road-10k-300s], 20 min work, 9.5 km total.
- Week 7: 6 × 600 m tempo [road-threshold-600m], 18.9 min work, 9 km total; 4 × 800 m 10K effort [road-10k-800m], 16.267 min work, 8.6 km total.
- Week 9: 5 × 5 min tempo [road-threshold-300s], 25 min work, 10.3 km total; 3 × 6 min 10K effort [road-10k-360s], 18 min work, 8.9 km total.
- Week 10: 5 × 800 m tempo [road-threshold-800m], 21 min work, 9.4 km total; 7 × 600 m 10K effort [road-10k-600m], 21.35 min work, 10 km total.
- Week 11: 4 × 6 min tempo [road-threshold-360s], 24 min work, 10 km total; 5 × 5 min 10K effort [road-10k-300s], 25 min work, 10.6 km total.
- Week 12: 2 × 5 min 10K effort [road-10k-300s], 10 min work, 5.44 km total.

## half-q0

Input: 45 km/week, 16 km familiar long, 4 days; 21.0975 km in 110 minutes. Input days: Mon/Wed/Fri/Sun; chosen days: Tue/Wed/Fri/Sun.
Policy: established; allocation easy pace 6.95 min/km; nominal long target 19 km; peak week 13; preparation window 14 weeks; quality days none; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 45 | 44.776 | 45 | 16 → 16 | 0 / 0 | Tue easy(easy) 9.715; Wed easy(easy) 9.715; Fri easy(easy) 9.57; Sun long(long) 16 |
| 2 Foundation | 45 | 44.776 | 45 | 16 → 16 | 0 / 0 | Tue easy(easy) 9.715; Wed easy(easy) 9.715; Fri easy(easy) 9.57; Sun long(long) 16 |
| 3 Build | 47.5 | 47.368 | 47.2 | 16 → 16 | 0 / 0 | Tue easy(easy) 10.4; Wed easy(easy) 10.5; Fri easy(easy) 10.3; Sun long(long) 16 |
| 4 Recovery | 38.95 | 38.763 | 37.6 | 12 → 12 | 0 / 0 | Tue easy(easy) 7.8; Wed easy(easy) 8.9; Fri easy(easy) 8.9; Sun long(long) 12 |
| 5 Build | 50 | 49.813 | 48.8 | 16 → 16 | 0 / 0 | Tue easy(easy) 10.4; Wed easy(easy) 11.2; Fri easy(easy) 11.2; Sun long(long) 16 |
| 6 Build | 52.5 | 52.258 | 50.4 | 16 → 16 | 0 / 0 | Tue easy(easy) 10.4; Wed easy(easy) 12; Fri easy(easy) 12; Sun long(long) 16 |
| 7 Build | 55 | 54.834 | 52.9 | 18 → 18 | 0 / 0 | Tue easy(easy) 11.292; Wed easy(easy) 11.802; Fri easy(easy) 11.806; Sun long(long) 18 |
| 8 Recovery | 45.1 | 44.936 | 41.65 | 14 → 13 | 0 / 0 | Tue easy(easy) 8.45; Wed easy(easy) 10.2; Fri easy(easy) 10; Sun long(long) 13 |
| 9 Build | 57.5 | 57.282 | 55.4 | 18 → 18 | 0 / 0 | Tue easy(easy) 11.549; Wed easy(easy) 12.924; Fri easy(easy) 12.927; Sun long(long) 18 |
| 10 Build | 60 | 59.871 | 57.5 | 18 → 18 | 0 / 0 | Tue easy(easy) 11.7; Wed easy(easy) 13.9; Fri easy(easy) 13.9; Sun long(long) 18 |
| 11 Race preparation | 62.5 | 62.316 | 58.5 | 18 → 18 | 0 / 0 | Tue easy(easy) 11.7; Wed easy(easy) 14.4; Fri easy(easy) 14.4; Sun long(long) 18 |
| 12 Recovery | 51.25 | 51.122 | 42.25 | 14 → 13 | 0 / 0 | Tue easy(easy) 8.45; Wed easy(easy) 10.4; Fri easy(easy) 10.4; Sun long(long) 13 |
| 13 Race preparation | 65 | 64.756 | 61 | 19 → 19 | 0 / 0 | Tue easy(easy) 12.135; Wed easy(easy) 14.932; Fri easy(easy) 14.933; Sun long(long) 19 |
| 14 Race preparation | 61.75 | 59.892 | 59.7 | 15 → 15 | 0 / 0 | Tue easy(easy) 14.9; Wed easy(easy) 14.9; Fri easy(easy) 14.9; Sun long(long) 15 |
| 15 Taper | 47.125 | 47.05 | 39.8 | — → — | 0 / 0 | Tue easy(easy) 9.6; Wed easy(easy) 11.9; Fri easy(easy) 11.9; Sun easy(easy) 6.4 |
| 16 Race week | 24.375 | 16.547 | 15.9 | — → — | 0 / 0 | Tue easy(easy) 6; Wed easy(easy) 6.4; Fri easy(easy) 3.5 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 44.776 | 16 | 9.64 / 9.64 / 9.496 / 16 |
| reconcileOpeningBaseline | 45 | 16 | 9.715 / 9.715 / 9.57 / 16 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 38.763 km total / 12 km long → normalizeGeneratedLongRuns: 37.642 km total / 12 km long → applyActualTrainingEnvelope: 37.6 km total / 12 km long.
- Week 8: 01 initial recipe allocation: 44.936 km total / 14 km long → normalizeGeneratedLongRuns: 43.676 km total / 14 km long → applyActualTrainingEnvelope: 43.156 km total / 13.956 km long → normalizeGeneratedLongRuns: 41.65 km total / 13 km long.
- Week 12: 01 initial recipe allocation: 51.122 km total / 14 km long → applyActualTrainingEnvelope: 51.078 km total / 13.956 km long → normalizeGeneratedLongRuns: 42.25 km total / 13 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.

## half-q1

Input: 45 km/week, 16 km familiar long, 4 days; 21.0975 km in 110 minutes. Input days: Mon/Wed/Fri/Sun; chosen days: Tue/Wed/Fri/Sun.
Policy: established; allocation easy pace 6.95 min/km; nominal long target 19 km; peak week 13; preparation window 14 weeks; quality days Wed; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 45 | 44.776 | 45 | 16 → 16 | 1 / 1 | Tue easy(easy) 10.4; Wed tempo(threshold) 7.5; Fri easy(easy) 11.1; Sun long(long) 16 |
| 2 Maintenance | 45 | 44.705 | 45 | 16 → 16 | 1 / 1 | Tue easy(easy) 10.4; Wed tempo(threshold) 7.6; Fri easy(easy) 11; Sun long(long) 16 |
| 3 Build | 47.5 | 47.366 | 45.842 | 16 → 16 | 1 / 1 | Tue easy(easy) 10.4; Wed tempo(threshold) 7.5; Fri easy(easy) 11.942; Sun long(long) 16 |
| 4 Recovery | 38.95 | 38.762 | 35.55 | 12 → 11 | 0 / 0 | Tue easy(easy) 7.15; Wed easy(easy) 8.8; Fri easy(easy) 8.6; Sun long(long) 11 |
| 5 Build | 50 | 49.741 | 46 | 16 → 16 | 1 / 1 | Tue easy(easy) 10.044; Wed tempo(threshold) 7.6; Fri easy(easy) 12.356; Sun long(long) 16 |
| 6 Build | 52.5 | 52.259 | 46 | 16 → 16 | 1 / 1 | Tue easy(easy) 10.4; Wed tempo(race-rhythm) 6.8; Fri easy(easy) 12.8; Sun long(long) 16 |
| 7 Build | 55 | 54.834 | 48.5 | 18 → 18 | 1 / 1 | Tue easy(easy) 10.319; Wed tempo(threshold) 7.5; Fri easy(easy) 12.681; Sun long(long) 18 |
| 8 Recovery | 45.1 | 44.935 | 38.6 | 14 → 12 | 0 / 0 | Tue easy(easy) 7.8; Wed easy(easy) 9.6; Fri easy(easy) 9.2; Sun long(long) 12 |
| 9 Build | 57.5 | 57.28 | 51 | 18 → 18 | 1 / 1 | Tue easy(easy) 11.521; Wed tempo(race-rhythm) 7.3; Fri easy(easy) 14.179; Sun long(long) 18 |
| 10 Build | 60 | 59.87 | 52.1 | 18 → 18 | 1 / 1 | Tue easy(easy) 11.7; Wed tempo(threshold) 8; Fri easy(easy) 14.4; Sun long(long) 18 |
| 11 Race preparation | 62.5 | 60.302 | 52.3 | 18 → 18 | 1 / 1 | Tue easy(easy) 11.7; Wed tempo(race-rhythm) 8.2; Fri easy(easy) 14.4; Sun long(long) 18 |
| 12 Recovery | 51.25 | 51.123 | 42.25 | 14 → 13 | 0 / 0 | Tue easy(easy) 8.45; Wed easy(easy) 10.4; Fri easy(easy) 10.4; Sun long(long) 13 |
| 13 Race preparation | 65 | 61.446 | 54.8 | 19 → 19 | 1 / 1 | Tue easy(easy) 12.194; Wed tempo(threshold) 8.6; Fri easy(easy) 15.006; Sun long(long) 19 |
| 14 Race preparation | 61.75 | 52.194 | 52.194 | 15 → 15 | 1 / 1 | Tue easy(easy) 14.53; Wed tempo(race-rhythm) 7.7; Fri easy(easy) 14.964; Sun long(long) 15 |
| 15 Taper | 47.125 | 41.222 | 34.125 | — → — | 1 / 1 | Tue easy(easy) 9.75; Wed tempo(race-rhythm) 5.9; Fri easy(easy) 12; Sun easy(easy) 6.475 |
| 16 Race week | 24.375 | 14.82 | 13.524 | — → — | 1 / 1 | Tue easy(easy) 6; Wed tempo(race-rhythm) 3.927; Fri easy(easy) 3.597 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 44.776 | 16 | 10.935 / 7.194 / 10.647 / 16 |
| reconcileOpeningBaseline | 45 | 16 | 10.4 / 7.5 / 11.1 / 16 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 38.762 km total / 12 km long → applyActualTrainingEnvelope: 38.508 km total / 11.942 km long → normalizeGeneratedLongRuns: 35.583 km total / 11 km long → applyActualTrainingEnvelope: 35.55 km total / 11 km long.
- Week 8: 01 initial recipe allocation: 44.935 km total / 14 km long → applyActualTrainingEnvelope: 44.34 km total / 13.812 km long → normalizeGeneratedLongRuns: 41.778 km total / 13 km long → applyActualTrainingEnvelope: 39.13 km total / 12.23 km long → normalizeGeneratedLongRuns: 38.6 km total / 12 km long.
- Week 12: 01 initial recipe allocation: 51.123 km total / 14 km long → applyActualTrainingEnvelope: 48.881 km total / 13.381 km long → normalizeGeneratedLongRuns: 42.25 km total / 13 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 7 × 2 min tempo [road-threshold-120s], 14 min work, 7.5 km total.
- Week 2: 9 × 90 sec tempo [road-threshold-90s], 13.5 min work, 7.6 km total.
- Week 3: 7 × 2 min tempo [road-threshold-120s], 14 min work, 7.5 km total.
- Week 5: 9 × 90 sec tempo [road-threshold-90s], 13.5 min work, 7.6 km total.
- Week 6: 4 × 3 min half-marathon effort [road-half-180s], 12 min work, 6.8 km total.
- Week 7: 5 × 3 min tempo [road-threshold-180s], 15 min work, 7.5 km total.
- Week 9: Half-marathon effort pyramid [road-half-pyramid-2-3-3-3-2], 13 min work, 7.3 km total.
- Week 10: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8 km total.
- Week 11: Half-marathon effort pyramid [road-half-pyramid-3-4-4-4-3], 18 min work, 8.2 km total.
- Week 13: 5 × 4 min tempo [road-threshold-240s], 20 min work, 8.6 km total.
- Week 14: 4 × 4 min half-marathon effort [road-half-240s], 16 min work, 7.7 km total.
- Week 15: 2 × 4 min half-marathon effort [road-half-240s], 8 min work, 5.9 km total.
- Week 16: 3 min half-marathon effort [road-half-180s], 3 min work, 3.927 km total.

## half-q2

Input: 65 km/week, 18 km familiar long, 6 days; 21.0975 km in 110 minutes. Input days: Mon/Tue/Wed/Thu/Fri/Sun; chosen days: Tue/Wed/Thu/Fri/Sat/Sun.
Policy: advanced; allocation easy pace 6.95 min/km; nominal long target 21.583 km; peak week 13; preparation window 14 weeks; quality days Wed/Fri; medium day Thu.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Foundation | 65 | 64.762 | 65 | 18 → 18 | 2 / 2 | Tue easy(easy) 10.247; Wed tempo(threshold) 8.7; Thu easy(medium-long) 11.7; Fri tempo(race-rhythm) 8.2; Sat easy(easy) 8.153; Sun long(long) 18 |
| 2 Maintenance | 65 | 64.762 | 65 | 18 → 18 | 2 / 2 | Tue easy(easy) 10.519; Wed tempo(threshold) 8.7; Thu easy(medium-long) 11.7; Fri tempo(race-rhythm) 8; Sat easy(easy) 8.081; Sun long(long) 18 |
| 3 Build | 67.6 | 67.352 | 65 | 18 → 18 | 2 / 2 | Tue easy(easy) 10.318; Wed tempo(threshold) 8.7; Thu easy(medium-long) 11.7; Fri tempo(race-rhythm) 8.2; Sat easy(easy) 8.082; Sun long(long) 18 |
| 4 Recovery | 55.432 | 55.295 | 50.95 | 14 → 13 | 0 / 0 | Tue easy(easy) 8.45; Wed easy(easy) 8.45; Thu easy(easy) 6.3; Fri easy(easy) 8.45; Sat easy(easy) 6.3; Sun long(long) 13 |
| 5 Build | 70.304 | 70.086 | 65.815 | 18 → 18 | 2 / 2 | Tue easy(easy) 11.214; Wed tempo(threshold) 8.7; Thu easy(medium-long) 11.7; Fri tempo(race-rhythm) 8; Sat easy(easy) 8.201; Sun long(long) 18 |
| 6 Build | 73.116 | 72.963 | 67.685 | 18 → 18 | 2 / 2 | Tue easy(easy) 11.308; Wed tempo(threshold) 8.9; Thu easy(medium-long) 11.7; Fri tempo(race-rhythm) 9; Sat easy(easy) 8.777; Sun long(long) 18 |
| 7 Build | 76.041 | 75.971 | 70.392 | 20 → 20 | 2 / 2 | Tue easy(easy) 11.323; Wed tempo(threshold) 8.7; Thu easy(medium-long) 12.488; Fri tempo(race-rhythm) 9.3; Sat easy(easy) 8.581; Sun long(long) 20 |
| 8 Recovery | 62.353 | 62.186 | 55.3 | 16 → 14 | 0 / 0 | Tue easy(easy) 9.1; Wed easy(easy) 9.1; Thu easy(easy) 7; Fri easy(easy) 9.1; Sat easy(easy) 7; Sun long(long) 14 |
| 9 Build | 79.041 | 78.921 | 73.207 | 20 → 20 | 2 / 2 | Tue easy(easy) 12.151; Wed tempo(threshold) 9.3; Thu easy(medium-long) 12.465; Fri tempo(race-rhythm) 9.9; Sat easy(easy) 9.391; Sun long(long) 20 |
| 10 Build | 80 | 79.882 | 75.616 | 20 → 20 | 2 / 2 | Tue easy(easy) 13; Wed tempo(threshold) 9.8; Thu easy(medium-long) 13; Fri tempo(race-rhythm) 9.6; Sat easy(easy) 10.216; Sun long(long) 20 |
| 11 Race preparation | 80 | 80 | 75.734 | 20 → 20 | 2 / 2 | Tue easy(easy) 12.362; Wed tempo(threshold) 10.4; Thu easy(medium-long) 13; Fri tempo(race-rhythm) 9.9; Sat easy(easy) 10.072; Sun long(long) 20 |
| 12 Recovery | 65.6 | 65.353 | 59.45 | 16 → 15 | 0 / 0 | Tue easy(easy) 9.75; Wed easy(easy) 9.75; Thu easy(easy) 7.6; Fri easy(easy) 9.75; Sat easy(easy) 7.6; Sun long(long) 15 |
| 13 Race preparation | 80 | 79.956 | 76.34 | 21 → 21 | 2 / 2 | Tue easy(easy) 11.481; Wed tempo(threshold) 10.4; Thu easy(medium-long) 13.65; Fri tempo(race-rhythm) 10.6; Sat easy(easy) 9.209; Sun long(long) 21 |
| 14 Race preparation | 77.333 | 68.59 | 68.59 | 16 → 16 | 2 / 2 | Tue easy(easy) 12.434; Wed tempo(threshold) 10; Thu easy(easy) 9.928; Fri tempo(race-rhythm) 10.3; Sat easy(easy) 9.928; Sun long(long) 16 |
| 15 Taper | 60 | 48.921 | 45.924 | — → — | 2 / 2 | Tue easy(easy) 9; Wed tempo(race-rhythm) 8.048; Thu easy(easy) 8.201; Fri tempo(race-rhythm) 6.9; Sat easy(easy) 7.3; Sun easy(easy) 6.475 |
| 16 Race week | 33.333 | 22.735 | 21.255 | — → — | 1 / 1 | Tue easy(easy) 5.6; Wed tempo(race-rhythm) 4.863; Thu easy(easy) 4.317; Fri easy(easy) 3.597; Sat easy(easy) 2.878 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 64.762 | 18 | 9.928 / 8.345 / 13.669 / 7.77 / 7.05 / 18 |
| reconcileOpeningBaseline | 65 | 18 | 10.247 / 8.7 / 11.7 / 8.2 / 8.153 / 18 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 55.295 km total / 14 km long → applyActualTrainingEnvelope: 54.331 km total / 13.669 km long → normalizeGeneratedLongRuns: 51.012 km total / 13 km long → applyActualTrainingEnvelope: 50.95 km total / 13 km long.
- Week 8: 01 initial recipe allocation: 62.186 km total / 16 km long → applyActualTrainingEnvelope: 61.171 km total / 15.683 km long → normalizeGeneratedLongRuns: 58.588 km total / 15 km long → applyActualTrainingEnvelope: 56.632 km total / 14.532 km long → normalizeGeneratedLongRuns: 55.3 km total / 14 km long.
- Week 12: 01 initial recipe allocation: 65.353 km total / 16 km long → applyActualTrainingEnvelope: 64.035 km total / 15.683 km long → normalizeGeneratedLongRuns: 59.502 km total / 15 km long → applyActualTrainingEnvelope: 59.45 km total / 15 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.7 km total; 5 × 3 min half-marathon effort [road-half-180s], 15 min work, 8.2 km total.
- Week 2: 10 × 90 sec tempo [road-threshold-90s], 15 min work, 8.7 km total; Half-marathon effort pyramid [road-half-pyramid-2-3-3-3-2], 13 min work, 8 km total.
- Week 3: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.7 km total; 5 × 3 min half-marathon effort [road-half-180s], 15 min work, 8.2 km total.
- Week 5: 10 × 90 sec tempo [road-threshold-90s], 15 min work, 8.7 km total; Half-marathon effort pyramid [road-half-pyramid-2-3-3-3-2], 13 min work, 8 km total.
- Week 6: 6 × 3 min tempo [road-threshold-180s], 18 min work, 8.9 km total; Half-marathon effort pyramid [road-half-pyramid-3-4-4-4-3], 18 min work, 9 km total.
- Week 7: 8 × 2 min tempo [road-threshold-120s], 16 min work, 8.7 km total; 5 × 4 min half-marathon effort [road-half-240s], 20 min work, 9.3 km total.
- Week 9: 5 × 4 min tempo [road-threshold-240s], 20 min work, 9.3 km total; 4 × 6 min half-marathon effort [road-half-360s], 24 min work, 9.9 km total.
- Week 10: 7 × 600 m tempo [road-threshold-600m], 21.933 min work, 9.8 km total; 5 × 800 m half-marathon effort [road-half-800m], 21.25 min work, 9.6 km total.
- Week 11: 5 × 5 min tempo [road-threshold-300s], 25 min work, 10.4 km total; 3 × 8 min half-marathon effort [road-half-480s], 24 min work, 9.9 km total.
- Week 13: 6 × 800 m tempo [road-threshold-800m], 25 min work, 10.4 km total; 5 × 1 km half-marathon effort [road-half-1000m], 26.5 min work, 10.6 km total.
- Week 14: 4 × 6 min tempo [road-threshold-360s], 24 min work, 10 km total; Half-marathon effort pyramid [road-half-pyramid-3-5-8-5-3], 24 min work, 10.3 km total.
- Week 15: 5 × 3 min half-marathon effort [road-half-180s], 15 min work, 8.048 km total; 3 × 3 min half-marathon effort [road-half-180s], 9 min work, 6.9 km total.
- Week 16: 3 min half-marathon effort [road-half-180s], 3 min work, 4.863 km total.

## marathon-q0

Input: 60 km/week, 23 km familiar long, 5 days; 10 km in 45 minutes. Input days: Mon/Tue/Wed/Fri/Sun; chosen days: Tue/Wed/Thu/Fri/Sun.
Policy: marathon; allocation easy pace 6.35 min/km; nominal long target 35 km; peak week 17; preparation window 18 weeks; quality days none; medium day Wed.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Maintenance | 60 | 59.851 | 60 | 23 → 23 | 0 / 0 | Tue easy(easy) 7.551; Wed easy(medium-long) 14.961; Thu easy(easy) 7.244; Fri easy(easy) 7.244; Sun long(long) 23 |
| 2 Maintenance | 60 | 59.851 | 60 | 23 → 23 | 0 / 0 | Tue easy(easy) 7.551; Wed easy(medium-long) 14.961; Thu easy(easy) 7.244; Fri easy(easy) 7.244; Sun long(long) 23 |
| 3 Foundation | 63 | 62.841 | 62.7 | 23 → 23 | 0 / 0 | Tue easy(easy) 8; Wed easy(medium-long) 15.7; Thu easy(easy) 8; Fri easy(easy) 8; Sun long(long) 23 |
| 4 Recovery | 44.1 | 43.985 | 43.8 | 18 → 18 | 0 / 0 | Tue easy(easy) 6.6; Wed easy(easy) 6.4; Thu easy(easy) 6.4; Fri easy(easy) 6.4; Sun long(long) 18 |
| 5 Foundation | 66 | 65.835 | 65.7 | 23 → 23 | 0 / 0 | Tue easy(easy) 8.8; Wed easy(medium-long) 16.3; Thu easy(easy) 8.8; Fri easy(easy) 8.8; Sun long(long) 23 |
| 6 Foundation | 66 | 65.945 | 65.7 | 25 → 25 | 0 / 0 | Tue easy(easy) 8.2; Wed easy(medium-long) 16.3; Thu easy(easy) 8.1; Fri easy(easy) 8.1; Sun long(long) 25 |
| 7 Foundation | 69 | 68.936 | 68.7 | 25 → 25 | 0 / 0 | Tue easy(easy) 8.9; Wed easy(medium-long) 17.1; Thu easy(easy) 8.9; Fri easy(easy) 8.8; Sun long(long) 25 |
| 8 Recovery | 48.3 | 48.19 | 47.9 | 20 → 20 | 0 / 0 | Tue easy(easy) 7; Wed easy(easy) 7; Thu easy(easy) 7; Fri easy(easy) 6.9; Sun long(long) 20 |
| 9 Build | 72 | 71.881 | 71.6 | 27 → 27 | 0 / 0 | Tue easy(easy) 8.9; Wed easy(medium-long) 17.9; Thu easy(easy) 8.9; Fri easy(easy) 8.9; Sun long(long) 27 |
| 10 Build | 72 | 71.936 | 71.7 | 28 → 28 | 0 / 0 | Tue easy(easy) 8.6; Wed easy(medium-long) 17.9; Thu easy(easy) 8.6; Fri easy(easy) 8.6; Sun long(long) 28 |
| 11 Build | 75 | 74.929 | 74.7 | 28 → 28 | 0 / 0 | Tue easy(easy) 9.4; Wed easy(medium-long) 18.7; Thu easy(easy) 9.4; Fri easy(easy) 9.2; Sun long(long) 28 |
| 12 Recovery | 52.5 | 52.394 | 52.2 | 22 → 22 | 0 / 0 | Tue easy(easy) 7.7; Wed easy(easy) 7.5; Thu easy(easy) 7.5; Fri easy(easy) 7.5; Sun long(long) 22 |
| 13 Build | 78 | 77.874 | 77.7 | 30 → 30 | 0 / 0 | Tue easy(easy) 9.7; Wed easy(medium-long) 18.8; Thu easy(easy) 9.6; Fri easy(easy) 9.6; Sun long(long) 30 |
| 14 Race preparation | 78 | 77.929 | 77.7 | 31 → 31 | 0 / 0 | Tue easy(easy) 9.5; Wed easy(medium-long) 18.8; Thu easy(easy) 9.2; Fri easy(easy) 9.2; Sun long(long) 31 |
| 15 Race preparation | 78 | 77.881 | 77.929 | 33 → 33 | 0 / 0 | Tue easy(easy) 8.709; Wed easy(medium-long) 18.898; Thu easy(easy) 8.661; Fri easy(easy) 8.661; Sun long(long) 33 |
| 16 Recovery | 54.6 | 54.394 | 54.2 | 24 → 24 | 0 / 0 | Tue easy(easy) 7.7; Wed easy(easy) 7.5; Thu easy(easy) 7.5; Fri easy(easy) 7.5; Sun long(long) 24 |
| 17 Race preparation | 78 | 77.834 | 77.929 | 35 → 35 | 0 / 0 | Tue easy(easy) 8.126; Wed easy(medium-long) 18.898; Thu easy(easy) 8.031; Fri easy(easy) 7.874; Sun long(long) 35 |
| 18 Taper | 58.5 | 58.282 | 57.8 | 26 → 26 | 0 / 0 | Tue easy(easy) 8; Wed easy(easy) 8; Thu easy(easy) 8; Fri easy(easy) 7.8; Sun long(long) 26 |
| 19 Taper | 46.8 | 46.67 | 45.4 | 21 → 20 | 0 / 0 | Tue easy(easy) 6.4; Wed easy(easy) 6.4; Thu easy(easy) 6.4; Fri easy(easy) 6.2; Sun long(long) 20 |
| 20 Race week | 31.2 | 31.182 | 30.4 | — → — | 0 / 0 | Tue easy(easy) 7.7; Wed easy(easy) 7.7; Thu easy(easy) 7.5; Fri easy(easy) 7.5 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 59.851 | 23 | 7.402 / 14.961 / 7.244 / 7.244 / 23 |
| reconcileOpeningBaseline | 60 | 23 | 7.551 / 14.961 / 7.244 / 7.244 / 23 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 43.985 km total / 18 km long → applyActualTrainingEnvelope: 43.8 km total / 18 km long.
- Week 8: 01 initial recipe allocation: 48.19 km total / 20 km long → applyActualTrainingEnvelope: 47.9 km total / 20 km long.
- Week 12: 01 initial recipe allocation: 52.394 km total / 22 km long → applyActualTrainingEnvelope: 52.2 km total / 22 km long.
- Week 16: 01 initial recipe allocation: 54.394 km total / 24 km long → applyActualTrainingEnvelope: 54.2 km total / 24 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.

## marathon-q1

Input: 60 km/week, 23 km familiar long, 5 days; 10 km in 45 minutes. Input days: Mon/Tue/Wed/Fri/Sun; chosen days: Tue/Wed/Thu/Fri/Sun.
Policy: marathon; allocation easy pace 6.35 min/km; nominal long target 35 km; peak week 17; preparation window 18 weeks; quality days Wed; medium day Thu.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Maintenance | 60 | 59.852 | 60 | 23 → 23 | 1 / 1 | Tue easy(easy) 7.235; Wed tempo(threshold) 7.717; Thu easy(medium-long) 14.961; Fri easy(easy) 7.087; Sun long(long) 23 |
| 2 Maintenance | 60 | 59.852 | 60 | 23 → 23 | 1 / 1 | Tue easy(easy) 7.235; Wed tempo(threshold) 7.717; Thu easy(medium-long) 14.961; Fri easy(easy) 7.087; Sun long(long) 23 |
| 3 Foundation | 63 | 62.843 | 62.778 | 23 → 23 | 1 / 1 | Tue easy(economy) 7.874; Wed tempo(threshold) 8.504; Thu easy(medium-long) 15.7; Fri easy(easy) 7.7; Sun long(long) 23 |
| 4 Recovery | 44.1 | 43.985 | 42.3 | 18 → 17 | 0 / 0 | Tue easy(easy) 6.6; Wed easy(easy) 7.4; Thu easy(recovery) 4.7; Fri easy(easy) 6.6; Sun long(long) 17 |
| 5 Foundation | 66 | 65.835 | 65.753 | 23 → 23 | 1 / 2 | Tue easy(economy) 8.504; Wed tempo(threshold) 9.449; Thu easy(medium-long) 16.3; Fri easy(easy) 8.5; Sun long(long) 23 |
| 6 Foundation | 66 | 65.945 | 65.793 | 25 → 25 | 1 / 1 | Tue easy(economy) 7.874; Wed tempo(threshold) 8.819; Thu easy(medium-long) 16.3; Fri easy(easy) 7.8; Sun long(long) 25 |
| 7 Foundation | 69 | 68.936 | 68.81 | 25 → 25 | 1 / 1 | Tue easy(economy) 8.661; Wed tempo(threshold) 9.449; Thu easy(medium-long) 17.1; Fri easy(easy) 8.6; Sun long(long) 25 |
| 8 Recovery | 48.3 | 48.189 | 46.7 | 20 → 19 | 0 / 0 | Tue easy(easy) 7.4; Wed easy(easy) 7.8; Thu easy(recovery) 5.1; Fri easy(easy) 7.4; Sun long(long) 19 |
| 9 Build | 72 | 71.881 | 71.767 | 27 → 27 | 1 / 2 | Tue easy(economy) 8.661; Wed tempo(threshold) 9.606; Thu easy(medium-long) 17.9; Fri easy(easy) 8.6; Sun long(long) 27 |
| 10 Build | 72 | 71.936 | 71.837 | 28 → 28 | 1 / 1 | Tue easy(economy) 8.346; Wed tempo(threshold) 9.291; Thu easy(medium-long) 17.9; Fri easy(easy) 8.3; Sun long(long) 28 |
| 11 Build | 75 | 74.929 | 74.855 | 28 → 28 | 1 / 1 | Tue easy(economy) 9.134; Wed tempo(threshold) 9.921; Thu easy(medium-long) 18.7; Fri easy(easy) 9.1; Sun long(long) 28 |
| 12 Recovery | 52.5 | 52.393 | 50.6 | 22 → 21 | 0 / 0 | Tue easy(easy) 7.8; Wed easy(easy) 8.6; Thu easy(recovery) 5.5; Fri easy(easy) 7.7; Sun long(long) 21 |
| 13 Build | 78 | 77.874 | 77.685 | 30 → 30 | 1 / 1 | Tue easy(economy) 9.449; Wed tempo(threshold) 10.236; Thu easy(medium-long) 18.8; Fri easy(easy) 9.2; Sun long(long) 30 |
| 14 Race preparation | 78 | 77.929 | 77.755 | 31 → 31 | 1 / 1 | Tue easy(economy) 9.134; Wed tempo(threshold) 9.921; Thu easy(medium-long) 18.8; Fri easy(easy) 8.9; Sun long(long) 31 |
| 15 Race preparation | 78 | 77.881 | 77.929 | 33 → 33 | 1 / 2 | Tue easy(economy) 8.394; Wed tempo(threshold) 9.291; Thu easy(medium-long) 18.898; Fri easy(easy) 8.346; Sun long(long) 33 |
| 16 Recovery | 54.6 | 54.393 | 51.3 | 24 → 22 | 0 / 0 | Tue easy(easy) 7.8; Wed easy(easy) 8.5; Thu easy(recovery) 5.5; Fri easy(easy) 7.5; Sun long(long) 22 |
| 17 Race preparation | 78 | 77.835 | 77.929 | 35 → 35 | 1 / 1 | Tue easy(economy) 7.653; Wed tempo(threshold) 8.661; Thu easy(medium-long) 18.898; Fri easy(easy) 7.717; Sun long(long) 35 |
| 18 Taper | 58.5 | 58.283 | 53.961 | 26 → 24 | 1 / 1 | Tue easy(easy) 7.5; Wed tempo(threshold) 8.661; Thu easy(recovery) 6.1; Fri easy(easy) 7.7; Sun long(long) 24 |
| 19 Taper | 46.8 | 46.67 | 45.502 | 21 → 20 | 1 / 1 | Tue easy(easy) 6.7; Wed tempo(threshold) 7.402; Thu easy(recovery) 4.8; Fri easy(easy) 6.6; Sun long(long) 20 |
| 20 Race week | 31.2 | 31.18 | 28.961 | — → — | 1 / 1 | Tue easy(easy) 7.5; Wed tempo(threshold) 8.661; Thu easy(recovery) 5.1; Fri easy(easy) 7.7 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 59.852 | 23 | 7.087 / 7.717 / 14.961 / 7.087 / 23 |
| reconcileOpeningBaseline | 60 | 23 | 7.235 / 7.717 / 14.961 / 7.087 / 23 |
| applyActualTrainingEnvelope | 60 | 23 | 7.235 / 7.717 / 14.961 / 7.087 / 23 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 43.985 km total / 18 km long → applyActualTrainingEnvelope: 43.095 km total / 17.795 km long → normalizeGeneratedLongRuns: 42.3 km total / 17 km long.
- Week 8: 01 initial recipe allocation: 48.189 km total / 20 km long → applyActualTrainingEnvelope: 46.912 km total / 19.212 km long → normalizeGeneratedLongRuns: 46.7 km total / 19 km long.
- Week 12: 01 initial recipe allocation: 52.393 km total / 22 km long → applyActualTrainingEnvelope: 51.489 km total / 21.889 km long → normalizeGeneratedLongRuns: 50.6 km total / 21 km long.
- Week 16: 01 initial recipe allocation: 54.393 km total / 24 km long → applyActualTrainingEnvelope: 51.819 km total / 22.519 km long → normalizeGeneratedLongRuns: 51.3 km total / 22 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 6 min tempo [marathon-book-lt-6], 6 min work, 7.717 km total.
- Week 2: 9 min tempo [marathon-book-lt-9], 9 min work, 7.717 km total.
- Week 3: 20 min tempo [marathon-book-lt-20], 20 min work, 8.504 km total.
- Week 5: 5 × 1 km tempo [marathon-book-cruise-five-metres], 23.75 min work, 9.449 km total.
- Week 6: 5 × 5 min tempo [marathon-book-cruise-five-timed], 25 min work, 8.819 km total.
- Week 7: 25 min tempo [marathon-book-lt-25], 25 min work, 9.449 km total.
- Week 9: 3 × 1.6 km tempo [marathon-book-cruise-eight-metres], 22.8 min work, 9.606 km total.
- Week 10: 2 × 2 km tempo [marathon-book-tempo-blocks-metres], 19 min work, 9.291 km total.
- Week 11: 20 min tempo [marathon-book-lt-20], 20 min work, 9.921 km total.
- Week 13: On / off kilometres [marathon-book-on-off-metres], 23.75 min work, 10.236 km total.
- Week 14: Cut-down tempo [marathon-book-tempo-cut-down-timed], 24 min work, 9.921 km total.
- Week 15: 25 min tempo [marathon-book-lt-25], 25 min work, 9.291 km total.
- Week 17: 6 × 1 km tempo [marathon-book-tempo-repeats-metres], 28.5 min work, 8.661 km total.
- Week 18: 9 min tempo [marathon-book-lt-9], 9 min work, 8.661 km total.
- Week 19: 9 min tempo [marathon-book-lt-9], 9 min work, 7.402 km total.
- Week 20: 9 min tempo [marathon-book-lt-9], 9 min work, 8.661 km total.

## marathon-q2

Input: 70 km/week, 23 km familiar long, 5 days; 10 km in 45 minutes. Input days: Mon/Tue/Wed/Fri/Sun; chosen days: Tue/Wed/Thu/Fri/Sun.
Policy: marathon; allocation easy pace 6.35 min/km; nominal long target 35 km; peak week 17; preparation window 18 weeks; quality days Wed/Fri; medium day none.

| Week / phase | Nominal km | Initial km | Final km | Initial → final long km | Q / hard | Final running days (training km) |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 Maintenance | 70 | 69.772 | 70 | 23 → 23 | 2 / 2 | Tue easy(easy) 12.197; Wed tempo(threshold) 13.228; Thu easy(recovery) 8.504; Fri tempo(threshold) 13.071; Sun long(long) 23 |
| 2 Maintenance | 70 | 69.772 | 70 | 23 → 23 | 2 / 2 | Tue easy(easy) 12.197; Wed tempo(threshold) 13.228; Thu easy(recovery) 8.504; Fri tempo(threshold) 13.071; Sun long(long) 23 |
| 3 Foundation | 73 | 72.764 | 72.73 | 23 → 23 | 2 / 2 | Tue easy(economy) 12.756; Wed tempo(threshold) 14.016; Thu easy(recovery) 9.1; Fri fartlek(aerobic-power) 13.858; Sun long(long) 23 |
| 4 Recovery | 51.1 | 50.912 | 49.1 | 18 → 17 | 0 / 0 | Tue easy(easy) 8.1; Wed easy(easy) 9.1; Thu easy(recovery) 5.8; Fri easy(easy) 9.1; Sun long(long) 17 |
| 5 Foundation | 76 | 75.756 | 75.707 | 23 → 23 | 2 / 3 | Tue easy(economy) 13.543; Wed tempo(threshold) 14.961; Thu easy(recovery) 9.4; Fri intervals(aerobic-power) 14.803; Sun long(long) 23 |
| 6 Foundation | 76 | 75.866 | 75.775 | 25 → 25 | 2 / 2 | Tue easy(economy) 12.913; Wed tempo(threshold) 14.331; Thu easy(recovery) 9.2; Fri tempo(race-rhythm) 14.331; Sun long(long) 25 |
| 7 Foundation | 79 | 78.859 | 78.81 | 25 → 25 | 2 / 2 | Tue easy(economy) 13.858; Wed tempo(threshold) 15.276; Thu easy(recovery) 9.4; Fri intervals(aerobic-power) 15.276; Sun long(long) 25 |
| 8 Recovery | 55.3 | 55.275 | 54.1 | 20 → 19 | 0 / 0 | Tue easy(easy) 8.9; Wed easy(easy) 9.9; Thu easy(recovery) 6.4; Fri easy(easy) 9.9; Sun long(long) 19 |
| 9 Build | 82 | 81.804 | 81.755 | 27 → 27 | 2 / 3 | Tue easy(economy) 14.173; Wed tempo(threshold) 15.591; Thu easy(recovery) 9.4; Fri intervals(aerobic-power) 15.591; Sun long(long) 27 |
| 10 Build | 82 | 81.859 | 81.81 | 28 → 28 | 2 / 2 | Tue easy(economy) 13.858; Wed tempo(threshold) 15.276; Thu easy(recovery) 9.4; Fri tempo(race-rhythm) 15.276; Sun long(long) 28 |
| 11 Build | 85 | 84.85 | 84.801 | 28 → 28 | 2 / 2 | Tue easy(economy) 14.803; Wed tempo(threshold) 16.378; Thu easy(recovery) 9.4; Fri intervals(aerobic-power) 16.22; Sun long(long) 28 |
| 12 Recovery | 59.5 | 59.323 | 57.4 | 22 → 21 | 0 / 0 | Tue easy(easy) 9.2; Wed easy(easy) 10.3; Thu easy(recovery) 6.6; Fri easy(easy) 10.3; Sun long(long) 21 |
| 13 Build | 88 | 87.795 | 87.746 | 30 → 30 | 2 / 2 | Tue easy(economy) 15.118; Wed tempo(threshold) 16.693; Thu easy(recovery) 9.4; Fri fartlek(aerobic-power) 16.535; Sun long(long) 30 |
| 14 Race preparation | 88 | 87.85 | 87.801 | 31 → 31 | 2 / 2 | Tue easy(economy) 14.803; Wed tempo(threshold) 16.378; Thu easy(recovery) 9.4; Fri tempo(race-rhythm) 16.22; Sun long(long) 31 |
| 15 Race preparation | 88 | 87.804 | 87.85 | 33 → 33 | 2 / 3 | Tue easy(economy) 14.219; Wed tempo(threshold) 15.591; Thu easy(recovery) 9.449; Fri intervals(aerobic-power) 15.591; Sun long(long) 33 |
| 16 Recovery | 61.6 | 61.433 | 58.2 | 26 → 24 | 0 / 0 | Tue easy(easy) 8.8; Wed easy(easy) 9.6; Thu easy(recovery) 6.2; Fri easy(easy) 9.6; Sun long(long) 24 |
| 17 Race preparation | 88 | 87.756 | 87.85 | 35 → 35 | 2 / 2 | Tue easy(economy) 13.637; Wed tempo(threshold) 14.961; Thu easy(recovery) 9.449; Fri intervals(aerobic-power) 14.803; Sun long(long) 35 |
| 18 Taper | 66 | 65.842 | 65.681 | 26 → 26 | 1 / 1 | Tue easy(easy) 10.2; Wed intervals(aerobic-power) 11.181; Thu easy(recovery) 7.2; Fri easy(easy) 11.1; Sun long(long) 26 |
| 19 Taper | 52.8 | 52.653 | 52.576 | 21 → 21 | 1 / 1 | Tue easy(easy) 8; Wed intervals(aerobic-power) 8.976; Thu easy(recovery) 5.8; Fri easy(easy) 8.8; Sun long(long) 21 |
| 20 Race week | 35.2 | 35.119 | 34.994 | — → — | 1 / 1 | Tue easy(easy) 9.4; Wed tempo(threshold) 10.394; Thu easy(recovery) 5.8; Fri easy(easy) 9.4 |

### Week-one calculation changes

Repeated stages with no change are omitted. Stages may occur repeatedly because the generator settles constraints in a loop.

| Operation | Week-one km | Long km | Individual distances |
| --- | ---: | ---: | --- |
| 01 initial recipe allocation | 69.772 | 23 | 11.969 / 13.228 / 8.504 / 13.071 / 23 |
| reconcileOpeningBaseline | 70 | 23 | 12.197 / 13.228 / 8.504 / 13.071 / 23 |
| ensureGeneratedMarathonRhythm | 70 | 23 | 12.197 / 13.228 / 8.504 / 13.071 / 23 |

### Recovery-week calculation changes

Only stages changing the week are shown; both distances and prescription time/template changes count.
- Week 4: 01 initial recipe allocation: 50.912 km total / 18 km long → applyActualTrainingEnvelope: 49.895 km total / 17.795 km long → normalizeGeneratedLongRuns: 49.1 km total / 17 km long.
- Week 8: 01 initial recipe allocation: 55.275 km total / 20 km long → applyActualTrainingEnvelope: 55.117 km total / 19.842 km long → normalizeGeneratedLongRuns: 54.275 km total / 19 km long → applyActualTrainingEnvelope: 54.1 km total / 19 km long.
- Week 12: 01 initial recipe allocation: 59.323 km total / 22 km long → applyActualTrainingEnvelope: 58.289 km total / 21.889 km long → normalizeGeneratedLongRuns: 57.4 km total / 21 km long.
- Week 16: 01 initial recipe allocation: 61.433 km total / 26 km long → applyActualTrainingEnvelope: 58.766 km total / 24.566 km long → normalizeGeneratedLongRuns: 58.2 km total / 24 km long.

### Actual weekday workout main sets

These are generated Stride prescriptions. They are not transcriptions from a published schedule.
- Week 1: 6 min tempo [marathon-book-lt-6], 6 min work, 13.228 km total; 6 min tempo [marathon-book-lt-6], 6 min work, 13.071 km total.
- Week 2: 6 min tempo [marathon-book-lt-6], 6 min work, 13.228 km total; 6 min tempo [marathon-book-lt-6], 6 min work, 13.071 km total.
- Week 3: 20 min tempo [marathon-book-lt-20], 20 min work, 14.016 km total; 5 × 600 m intervals [marathon-book-controlled-fartlek-metres], 13 min work, 13.858 km total.
- Week 5: 5 × 1 km tempo [marathon-book-cruise-five-metres], 23.75 min work, 14.961 km total; 4 × 3 min intervals [marathon-book-six-hundred-timed], 12 min work, 14.803 km total.
- Week 6: 5 × 5 min tempo [marathon-book-cruise-five-timed], 25 min work, 14.331 km total; 3 × 1.5 km marathon effort [marathon-book-marathon-short-blocks-metres], 22.5 min work, 14.331 km total.
- Week 7: 25 min tempo [marathon-book-lt-25], 25 min work, 15.276 km total; Pyramid intervals [marathon-book-pyramid-metres], 12.133 min work, 15.276 km total.
- Week 9: 3 × 1.6 km tempo [marathon-book-cruise-eight-metres], 22.8 min work, 15.591 km total; 2 × (4 × 400 m) intervals [marathon-book-split-repeats-metres], 13.867 min work, 15.591 km total.
- Week 10: 2 × 2 km tempo [marathon-book-tempo-blocks-metres], 19 min work, 15.276 km total; 4 × 1.5 km marathon effort [marathon-book-marathon-short-blocks-metres], 30 min work, 15.276 km total.
- Week 11: 20 min tempo [marathon-book-lt-20], 20 min work, 16.378 km total; 600 m into 200 m [marathon-book-long-into-short-metres], 13.867 min work, 16.22 km total.
- Week 13: On / off kilometres [marathon-book-on-off-metres], 23.75 min work, 16.693 km total; 6 × 600 m intervals [marathon-book-controlled-fartlek-metres], 15.6 min work, 16.535 km total.
- Week 14: Cut-down tempo [marathon-book-tempo-cut-down-timed], 24 min work, 16.378 km total; 6 × 6 min marathon effort [marathon-book-marathon-short-blocks-timed], 36 min work, 16.22 km total.
- Week 15: 25 min tempo [marathon-book-lt-25], 25 min work, 15.591 km total; 7 × 600 m intervals [marathon-book-six-hundred-metres], 18.2 min work, 15.591 km total.
- Week 17: 6 × 1 km tempo [marathon-book-tempo-repeats-metres], 28.5 min work, 14.961 km total; Pyramid intervals [marathon-book-pyramid-timed], 14 min work, 14.803 km total.
- Week 18: 4 × 600 m intervals [marathon-book-six-hundred-metres], 10.4 min work, 11.181 km total.
- Week 19: 4 × 600 m intervals [marathon-book-six-hundred-metres], 10.4 min work, 8.976 km total.
- Week 20: 9 min tempo [marathon-book-lt-9], 9 min work, 10.394 km total.

## Matched inputs and beginner branches

Q0/Q1/Q2 in each matched group differ only in requested quality count. All other runner inputs, including declared recent quality exposure, stay identical. Beginner branches explicitly declare no recent quality. Refusals are outcomes, not successful or suitable training plans.

| Case | Input weekly / long / days | Outcome | Opening → peak training km | Long sequence (all weeks) | Weekday workout counts (all weeks) |
| --- | --- | --- | --- | --- | --- |
| 5k-lower-q0 | 12 / 4 / 3 | forecast | 10.4 → 14 | 4, 4, 4, 3, 4, 5, 5, 3, 5, 6, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 5k-lower-q1 | 12 / 4 / 3 | The planned weekly distance cannot fit the prescribed pace ranges and session limits. Review the pace and available time together. | — | — | — |
| 5k-lower-q2 | 12 / 4 / 3 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | — | — | — |
| 5k-middle-q0 | 30 / 8 / 4 | forecast | 26 → 30.75 | 8, 8, 8, 6, 8, 9, 9, 7, 9, 10, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 5k-middle-q1 | 30 / 8 / 4 | forecast | 26.8 → 30.45 | 8, 8, 8, 5, 8, 9, 9, 6, 9, 10, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| 5k-middle-q2 | 30 / 8 / 4 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | — | — | — |
| 5k-higher-q0 | 55 / 13 / 6 | forecast | 55 → 55 | 13, 13, 13, 9, 13, 13, 13, 9, 13, 13, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 5k-higher-q1 | 55 / 13 / 6 | forecast | 54.3 → 55.2 | 13, 13, 13, 9, 13, 13, 13, 9, 13, 13, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| 5k-higher-q2 | 55 / 13 / 6 | forecast | 54.25 → 56.15 | 13, 13, 13, 9, 13, 13, 13, 9, 13, 13, —, — | 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 1 |
| 10k-lower-q0 | 18 / 6 / 3 | forecast | 15.6 → 19.656 | 6, 6, 6, 4, 6, 7, 7, 5, 7, 8, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 10k-lower-q1 | 18 / 6 / 3 | The planned weekly distance cannot fit the prescribed pace ranges and session limits. Review the pace and available time together. | — | — | — |
| 10k-lower-q2 | 18 / 6 / 3 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | — | — | — |
| 10k-middle-q0 | 36 / 11 / 4 | forecast | 35.75 → 41 | 11, 11, 11, 8, 11, 12, 12, 9, 12, 13, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 10k-middle-q1 | 36 / 11 / 4 | forecast | 34.45 → 39.1 | 11, 11, 11, 7, 11, 12, 12, 8, 12, 13, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| 10k-middle-q2 | 36 / 11 / 4 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | — | — | — |
| 10k-higher-q0 | 60 / 16 / 6 | forecast | 60 → 66.1 | 16, 16, 16, 12, 16, 16, 16, 11, 16, 16, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 10k-higher-q1 | 60 / 16 / 6 | forecast | 60 → 65.271 | 16, 16, 16, 11, 16, 16, 16, 11, 16, 16, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| 10k-higher-q2 | 60 / 16 / 6 | forecast | 60 → 66.6 | 16, 16, 16, 11, 16, 16, 16, 11, 16, 16, —, — | 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 1 |
| half-lower-q0 | 25 / 8 / 4 | review-required | 25 → 37.95 | 8, 8, 9, 7, 9, 10, 10, 8, 11, 11, 12, 8, 13, 10, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| half-lower-q1 | 25 / 8 / 4 | review-required | 23.6 → 34.95 | 8, 8, 9, 6, 9, 10, 10, 7, 11, 11, 12, 8, 13, 10, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| half-lower-q2 | 25 / 8 / 4 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | — | — | — |
| half-middle-q0 | 45 / 16 / 4 | forecast | 45 → 61 | 16, 16, 16, 12, 16, 16, 18, 13, 18, 18, 18, 13, 19, 15, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| half-middle-q1 | 45 / 16 / 4 | forecast | 45 → 54.8 | 16, 16, 16, 11, 16, 16, 18, 12, 18, 18, 18, 13, 19, 15, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| half-middle-q2 | 45 / 16 / 4 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | — | — | — |
| half-higher-q0 | 65 / 18 / 6 | forecast | 65 → 77.75 | 18, 18, 18, 13, 18, 18, 20, 15, 20, 20, 20, 15, 21, 16, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| half-higher-q1 | 65 / 18 / 6 | forecast | 65 → 76.808 | 18, 18, 18, 13, 18, 18, 20, 14, 20, 20, 20, 15, 21, 16, —, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| half-higher-q2 | 65 / 18 / 6 | forecast | 65 → 76.34 | 18, 18, 18, 13, 18, 18, 20, 14, 20, 20, 20, 15, 21, 16, —, — | 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 1 |
| marathon-lower-q0 | 30 / 10 / 4 | This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. | — | — | — |
| marathon-lower-q1 | 30 / 10 / 4 | This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. | — | — | — |
| marathon-lower-q2 | 30 / 10 / 4 | This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. | — | — | — |
| marathon-middle-q0 | 60 / 23 / 5 | forecast | 60 → 77.929 | 23, 23, 23, 18, 23, 25, 25, 20, 27, 28, 28, 22, 30, 31, 33, 24, 35, 26, 20, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| marathon-middle-q1 | 60 / 23 / 5 | forecast | 60 → 77.929 | 23, 23, 23, 17, 23, 25, 25, 19, 27, 28, 28, 21, 30, 31, 33, 22, 35, 24, 20, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| marathon-middle-q2 | 60 / 23 / 5 | forecast | 60 → 77.929 | 23, 23, 23, 17, 23, 25, 25, 19, 27, 28, 28, 21, 30, 31, 33, 22, 35, 26, 20, — | 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 1, 1, 1 |
| marathon-higher-q0 | 70 / 23 / 5 | forecast | 70 → 87.85 | 23, 23, 23, 18, 23, 25, 25, 19, 27, 28, 28, 22, 30, 31, 33, 26, 35, 26, 21, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| marathon-higher-q1 | 70 / 23 / 5 | forecast | 70 → 87.85 | 23, 23, 23, 17, 23, 25, 25, 19, 27, 28, 28, 21, 30, 31, 33, 24, 35, 26, 21, — | 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1 |
| marathon-higher-q2 | 70 / 23 / 5 | forecast | 70 → 87.85 | 23, 23, 23, 17, 23, 25, 25, 19, 27, 28, 28, 21, 30, 31, 33, 24, 35, 26, 21, — | 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 2, 2, 0, 2, 1, 1, 1 |
| 5k-zero-history-q0 | 0 / 0 / 3 | review-required | Unprescribed (timed run/walk) | —, —, —, —, —, —, —, —, —, —, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 5k-zero-history-q1 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| 5k-zero-history-q2 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| 5k-first-race-q0 | 8 / 3 / 3 | forecast | 8 → 12.6 | 3, 4, 4, 3, 5, 5, 5, — | 0, 0, 0, 0, 0, 0, 0, 0 |
| 5k-first-race-q1 | 8 / 3 / 3 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| 5k-first-race-q2 | 8 / 3 / 3 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| 10k-zero-history-q0 | 0 / 0 / 3 | review-required | Unprescribed (timed run/walk) | —, —, —, —, —, —, —, —, —, —, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| 10k-zero-history-q1 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| 10k-zero-history-q2 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| 10k-first-race-q0 | 15 / 5 / 3 | forecast | 15 → 23.9 | 5, 6, 7, 5, 8, 9, 9, — | 0, 0, 0, 0, 0, 0, 0, 0 |
| 10k-first-race-q1 | 15 / 5 / 3 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| 10k-first-race-q2 | 15 / 5 / 3 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| half-zero-history-q0 | 0 / 0 / 3 | review-required | Unprescribed (timed run/walk) | —, —, —, —, —, —, —, —, —, —, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| half-zero-history-q1 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| half-zero-history-q2 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| half-first-race-q0 | 22 / 6 / 4 | forecast | 22 → 42.6 | 6, 8, 10, 7, 12, 14, 16, 12, 16, 16, 9.6, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| half-first-race-q1 | 22 / 6 / 4 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| half-first-race-q2 | 22 / 6 / 4 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| marathon-zero-history-q0 | 0 / 0 / 3 | review-required | Unprescribed (timed run/walk) | —, —, —, —, —, —, —, —, —, —, —, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| marathon-zero-history-q1 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| marathon-zero-history-q2 | 0 / 0 / 3 | Couch to 5K uses zero speed workouts. Choose zero quality sessions or automatic structure for this beginner course. | — | — | — |
| marathon-first-race-q0 | 30 / 10 / 4 | forecast | 30 → 64 | 10, 12, 14, 10, 16, 18, 20, 15, 23, 26, 29, 21, 32, 24, 32, 24, 19.2, — | 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 |
| marathon-first-race-q1 | 30 / 10 / 4 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |
| marathon-first-race-q2 | 30 / 10 / 4 | The first-race plan has zero speed workouts: all training, including the long run, stays easy. Choose zero or review a standard plan for faster workouts. | — | — | — |

Zero-history lessons prescribe time, not distance. Their internal zero distance placeholders in the JSON trace do not mean zero exercise or a measured zero-kilometre run. The calendar repeats the currently approved beginner stage until a completion review advances it.
