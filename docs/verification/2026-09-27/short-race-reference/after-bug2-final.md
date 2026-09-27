# Short-race reference regression: after-bug2-final

Synthetic matched inputs; each quality choice retains exactly the same fitness, available time, long run and weekly baseline. Counts exclude race and long outings. Refusals are listed separately and are not passing generated plans. Only metadata engineVersion/policyVersion is excluded from protected full-output hashes. The fixture protects half/marathon/ultra from this scoped change; it does not certify their coaching quality.

```json
{
  "stage": "after-bug2-final",
  "commit": "092cd80cddddfc2ed77d7594971c5a535feb5f3b",
  "sourceSha256": "673de7115adba1dabab90d826020ea955cbcfd098b0743749ced1de2007f5329",
  "cases": 284,
  "generated": 207,
  "rejected": 77,
  "weeks": 2830,
  "protectedCompared": 90,
  "failures": [],
  "goalCounts": {
    "5k": {
      "generated": 71,
      "rejected": 20
    },
    "10k": {
      "generated": 46,
      "rejected": 15
    },
    "half": {
      "generated": 40,
      "rejected": 8
    },
    "marathon": {
      "generated": 32,
      "rejected": 16
    },
    "ultra": {
      "generated": 18,
      "rejected": 18
    }
  }
}
```

## Every generated week

### 5k-8w-3d-q0

Input: 21 km/week, 10 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 0 | easy, easy, long |
| 2 | Foundation | 21.8 | 21.8 | 10 | 0 | easy, easy, long |
| 3 | Build | 22.7 | 22.7 | 10 | 0 | easy, easy, long |
| 4 | Build | 23.7 | 23.7 | 10 | 0 | easy, easy, long |
| 5 | Race preparation | 24.7 | 24.7 | 10 | 0 | easy, easy, long |
| 6 | Race preparation | 25.7 | 25.7 | 10 | 0 | easy, easy, long |
| 7 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 8 | Race week | 8 | 8 | — | 0 | easy, easy, race |

### 5k-8w-3d-q1

Input: 21 km/week, 10 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 1 | tempo, easy, long |
| 2 | Foundation | 21.9 | 21.889 | 10 | 1 | tempo, easy, long |
| 3 | Build | 22.8 | 22.754 | 10 | 1 | fartlek, easy, long |
| 4 | Build | 23.7 | 23.7 | 10 | 1 | tempo, easy, long |
| 5 | Race preparation | 23.7 | 23.7 | 10 | 1 | fartlek, easy, long |
| 6 | Race preparation | 23.9 | 23.9 | 10 | 1 | tempo, easy, long |
| 7 | Race preparation | 24.2 | 24.2 | 10 | 1 | fartlek, easy, long |
| 8 | Race week | 7.2 | 7.193 | — | 1 | fartlek, easy, race |

### 5k-10w-3d-q0

Input: 21 km/week, 10 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 0 | easy, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 3 | Build | 21.8 | 21.8 | 10 | 0 | easy, easy, long |
| 4 | Build | 22.7 | 22.7 | 10 | 0 | easy, easy, long |
| 5 | Build | 23.7 | 23.7 | 10 | 0 | easy, easy, long |
| 6 | Build | 24.7 | 24.7 | 10 | 0 | easy, easy, long |
| 7 | Race preparation | 25.7 | 25.7 | 10 | 0 | easy, easy, long |
| 8 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 9 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 10 | Race week | 8 | 8 | — | 0 | easy, easy, race |

### 5k-10w-3d-q1

Input: 21 km/week, 10 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 1 | tempo, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 3 | Build | 21.9 | 21.89 | 10 | 1 | tempo, easy, long |
| 4 | Build | 22.9 | 22.857 | 10 | 1 | tempo, easy, long |
| 5 | Build | 23.5 | 23.5 | 10 | 1 | fartlek, easy, long |
| 6 | Build | 23.7 | 23.7 | 10 | 1 | tempo, easy, long |
| 7 | Race preparation | 23.7 | 23.7 | 10 | 1 | fartlek, easy, long |
| 8 | Race preparation | 23.9 | 23.9 | 10 | 1 | tempo, easy, long |
| 9 | Race preparation | 24.2 | 24.2 | 10 | 1 | fartlek, easy, long |
| 10 | Race week | 7.2 | 7.193 | — | 1 | fartlek, easy, race |

### 5k-12w-3d-q0

Input: 21 km/week, 10 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 0 | easy, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 3 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 4 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 5 | Build | 21.8 | 21.8 | 10 | 0 | easy, easy, long |
| 6 | Build | 22.7 | 22.7 | 10 | 0 | easy, easy, long |
| 7 | Build | 23.7 | 23.7 | 10 | 0 | easy, easy, long |
| 8 | Build | 24.7 | 24.7 | 10 | 0 | easy, easy, long |
| 9 | Race preparation | 25.7 | 25.7 | 10 | 0 | easy, easy, long |
| 10 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 11 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 12 | Race week | 8 | 8 | — | 0 | easy, easy, race |

### 5k-12w-3d-q1

Input: 21 km/week, 10 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 1 | tempo, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 3 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 4 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 5 | Build | 21.9 | 21.89 | 10 | 1 | tempo, easy, long |
| 6 | Build | 22.9 | 22.857 | 10 | 1 | tempo, easy, long |
| 7 | Build | 23.5 | 23.5 | 10 | 1 | fartlek, easy, long |
| 8 | Build | 23.7 | 23.7 | 10 | 1 | tempo, easy, long |
| 9 | Race preparation | 23.7 | 23.7 | 10 | 1 | fartlek, easy, long |
| 10 | Race preparation | 23.9 | 23.9 | 10 | 1 | tempo, easy, long |
| 11 | Race preparation | 24.2 | 24.2 | 10 | 1 | fartlek, easy, long |
| 12 | Race week | 7.2 | 7.193 | — | 1 | fartlek, easy, race |

### 5k-16w-3d-q0

Input: 21 km/week, 10 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 0 | easy, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 3 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 4 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 5 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 6 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 7 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 8 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 9 | Build | 21.8 | 21.8 | 10 | 0 | easy, easy, long |
| 10 | Build | 22.7 | 22.7 | 10 | 0 | easy, easy, long |
| 11 | Build | 23.7 | 23.7 | 10 | 0 | easy, easy, long |
| 12 | Build | 24.7 | 24.7 | 10 | 0 | easy, easy, long |
| 13 | Race preparation | 25.7 | 25.7 | 10 | 0 | easy, easy, long |
| 14 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 15 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 16 | Race week | 8 | 8 | — | 0 | easy, easy, race |

### 5k-16w-3d-q1

Input: 21 km/week, 10 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 1 | tempo, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 3 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 4 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 5 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 6 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 7 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 8 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 9 | Build | 21.9 | 21.889 | 10 | 1 | tempo, easy, long |
| 10 | Build | 22.9 | 22.857 | 10 | 1 | tempo, easy, long |
| 11 | Build | 23.5 | 23.5 | 10 | 1 | fartlek, easy, long |
| 12 | Build | 23.7 | 23.7 | 10 | 1 | tempo, easy, long |
| 13 | Race preparation | 23.7 | 23.7 | 10 | 1 | fartlek, easy, long |
| 14 | Race preparation | 23.9 | 23.9 | 10 | 1 | tempo, easy, long |
| 15 | Race preparation | 24.2 | 24.2 | 10 | 1 | fartlek, easy, long |
| 16 | Race week | 7.2 | 7.193 | — | 1 | fartlek, easy, race |

### 5k-20w-3d-q0

Input: 21 km/week, 10 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 0 | easy, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 3 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 4 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 5 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 6 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 7 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 8 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 9 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 10 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 11 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 12 | Maintenance | 21 | 21 | 10 | 0 | easy, easy, long |
| 13 | Build | 21.8 | 21.8 | 10 | 0 | easy, easy, long |
| 14 | Build | 22.7 | 22.7 | 10 | 0 | easy, easy, long |
| 15 | Build | 23.7 | 23.7 | 10 | 0 | easy, easy, long |
| 16 | Build | 24.7 | 24.7 | 10 | 0 | easy, easy, long |
| 17 | Race preparation | 25.7 | 25.7 | 10 | 0 | easy, easy, long |
| 18 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 19 | Race preparation | 26 | 26 | 10 | 0 | easy, easy, long |
| 20 | Race week | 8 | 8 | — | 0 | easy, easy, race |

### 5k-20w-3d-q1

Input: 21 km/week, 10 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 21 | 21 | 10 | 1 | tempo, easy, long |
| 2 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 3 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 4 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 5 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 6 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 7 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 8 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 9 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 10 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 11 | Maintenance | 21 | 21 | 10 | 1 | fartlek, easy, long |
| 12 | Maintenance | 21 | 21 | 10 | 1 | tempo, easy, long |
| 13 | Build | 21.9 | 21.89 | 10 | 1 | tempo, easy, long |
| 14 | Build | 22.9 | 22.857 | 10 | 1 | tempo, easy, long |
| 15 | Build | 23.5 | 23.5 | 10 | 1 | fartlek, easy, long |
| 16 | Build | 23.7 | 23.7 | 10 | 1 | tempo, easy, long |
| 17 | Race preparation | 23.7 | 23.7 | 10 | 1 | fartlek, easy, long |
| 18 | Race preparation | 23.9 | 23.9 | 10 | 1 | tempo, easy, long |
| 19 | Race preparation | 24.2 | 24.2 | 10 | 1 | fartlek, easy, long |
| 20 | Race week | 7.2 | 7.193 | — | 1 | fartlek, easy, race |

### 5k-8w-4d-q0

Input: 28 km/week, 10 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 2 | Foundation | 29.1 | 29.1 | 10 | 0 | easy, easy, easy, long |
| 3 | Build | 30.3 | 30.3 | 10 | 0 | easy, easy, easy, long |
| 4 | Build | 31.3 | 31.3 | 10 | 0 | easy, easy, easy, long |
| 5 | Race preparation | 32.1 | 32.1 | 10 | 0 | easy, easy, easy, long |
| 6 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 7 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 8 | Race week | 11.8 | 11.8 | — | 0 | easy, easy, easy, race |

### 5k-8w-4d-q1

Input: 28 km/week, 10 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 29.4 | 29.354 | 10 | 1 | easy, tempo, easy, long |
| 3 | Build | 30.5 | 30.451 | 10 | 1 | easy, fartlek, easy, long |
| 4 | Build | 31.4 | 31.4 | 10 | 1 | easy, tempo, easy, long |
| 5 | Race preparation | 31.4 | 31.4 | 10 | 1 | easy, fartlek, easy, long |
| 6 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, tempo, easy, long |
| 7 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 8 | Race week | 11.6 | 11.622 | — | 1 | easy, fartlek, easy, race |

### 5k-10w-4d-q0

Input: 28 km/week, 10 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 2 | Foundation | 29.1 | 29.1 | 10 | 0 | easy, easy, easy, long |
| 3 | Build | 30.3 | 30.3 | 10 | 0 | easy, easy, easy, long |
| 4 | Build | 31.3 | 31.3 | 10 | 0 | easy, easy, easy, long |
| 5 | Build | 32.1 | 32.1 | 10 | 0 | easy, easy, easy, long |
| 6 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 7 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 8 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 10 | Race week | 11.8 | 11.8 | — | 0 | easy, easy, easy, race |

### 5k-10w-4d-q1

Input: 28 km/week, 10 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 29.4 | 29.354 | 10 | 1 | easy, tempo, easy, long |
| 3 | Build | 30.5 | 30.451 | 10 | 1 | easy, fartlek, easy, long |
| 4 | Build | 31.4 | 31.4 | 10 | 1 | easy, tempo, easy, long |
| 5 | Build | 31.4 | 31.4 | 10 | 1 | easy, fartlek, easy, long |
| 6 | Build | 32.2 | 32.2 | 10 | 1 | easy, tempo, easy, long |
| 7 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 8 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 9 | Race preparation | 32.7 | 32.7 | 10 | 1 | easy, tempo, easy, long |
| 10 | Race week | 12 | 12.048 | — | 1 | easy, tempo, easy, race |

### 5k-12w-4d-q0

Input: 28 km/week, 10 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 3 | Build | 29.1 | 29.1 | 10 | 0 | easy, easy, easy, long |
| 4 | Build | 30.3 | 30.3 | 10 | 0 | easy, easy, easy, long |
| 5 | Build | 31.3 | 31.3 | 10 | 0 | easy, easy, easy, long |
| 6 | Build | 32.1 | 32.1 | 10 | 0 | easy, easy, easy, long |
| 7 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 8 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 10 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 11 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 12 | Race week | 11.8 | 11.8 | — | 0 | easy, easy, easy, race |

### 5k-12w-4d-q1

Input: 28 km/week, 10 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 3 | Build | 29.4 | 29.354 | 10 | 1 | easy, tempo, easy, long |
| 4 | Build | 30.6 | 30.574 | 10 | 1 | easy, tempo, easy, long |
| 5 | Build | 31.3 | 31.28 | 10 | 1 | easy, fartlek, easy, long |
| 6 | Build | 31.4 | 31.4 | 10 | 1 | easy, tempo, easy, long |
| 7 | Build | 31.4 | 31.4 | 10 | 1 | easy, fartlek, easy, long |
| 8 | Build | 32.2 | 32.2 | 10 | 1 | easy, tempo, easy, long |
| 9 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 10 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 11 | Race preparation | 32.7 | 32.7 | 10 | 1 | easy, tempo, easy, long |
| 12 | Race week | 12 | 12.048 | — | 1 | easy, tempo, easy, race |

### 5k-16w-4d-q0

Input: 28 km/week, 10 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 3 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 4 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 5 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 6 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 7 | Build | 29.1 | 29.1 | 10 | 0 | easy, easy, easy, long |
| 8 | Build | 30.3 | 30.3 | 10 | 0 | easy, easy, easy, long |
| 9 | Build | 31.3 | 31.3 | 10 | 0 | easy, easy, easy, long |
| 10 | Build | 32.1 | 32.1 | 10 | 0 | easy, easy, easy, long |
| 11 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 12 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 13 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 14 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 15 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 16 | Race week | 11.8 | 11.8 | — | 0 | easy, easy, easy, race |

### 5k-16w-4d-q1

Input: 28 km/week, 10 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 3 | Maintenance | 28 | 28 | 10 | 1 | easy, fartlek, easy, long |
| 4 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 5 | Maintenance | 28 | 28 | 10 | 1 | easy, fartlek, easy, long |
| 6 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 7 | Build | 29.4 | 29.354 | 10 | 1 | easy, tempo, easy, long |
| 8 | Build | 30.6 | 30.574 | 10 | 1 | easy, tempo, easy, long |
| 9 | Build | 31.3 | 31.28 | 10 | 1 | easy, fartlek, easy, long |
| 10 | Build | 31.4 | 31.4 | 10 | 1 | easy, tempo, easy, long |
| 11 | Build | 31.4 | 31.4 | 10 | 1 | easy, fartlek, easy, long |
| 12 | Build | 32.2 | 32.2 | 10 | 1 | easy, tempo, easy, long |
| 13 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 14 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 15 | Race preparation | 32.7 | 32.7 | 10 | 1 | easy, tempo, easy, long |
| 16 | Race week | 12 | 12.048 | — | 1 | easy, tempo, easy, race |

### 5k-20w-4d-q0

Input: 28 km/week, 10 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 3 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 4 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 5 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 6 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 7 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 8 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 9 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 10 | Maintenance | 28 | 28 | 10 | 0 | easy, easy, easy, long |
| 11 | Build | 29.1 | 29.1 | 10 | 0 | easy, easy, easy, long |
| 12 | Build | 30.3 | 30.3 | 10 | 0 | easy, easy, easy, long |
| 13 | Build | 31.3 | 31.3 | 10 | 0 | easy, easy, easy, long |
| 14 | Build | 32.1 | 32.1 | 10 | 0 | easy, easy, easy, long |
| 15 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 16 | Build | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 17 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 18 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 19 | Race preparation | 32.5 | 32.5 | 10 | 0 | easy, easy, easy, long |
| 20 | Race week | 11.8 | 11.8 | — | 0 | easy, easy, easy, race |

### 5k-20w-4d-q1

Input: 28 km/week, 10 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 3 | Maintenance | 28 | 28 | 10 | 1 | easy, fartlek, easy, long |
| 4 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 5 | Maintenance | 28 | 28 | 10 | 1 | easy, fartlek, easy, long |
| 6 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 7 | Maintenance | 28 | 28 | 10 | 1 | easy, fartlek, easy, long |
| 8 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 9 | Maintenance | 28 | 28 | 10 | 1 | easy, fartlek, easy, long |
| 10 | Maintenance | 28 | 28 | 10 | 1 | easy, tempo, easy, long |
| 11 | Build | 29.4 | 29.354 | 10 | 1 | easy, tempo, easy, long |
| 12 | Build | 30.6 | 30.574 | 10 | 1 | easy, tempo, easy, long |
| 13 | Build | 31.3 | 31.28 | 10 | 1 | easy, fartlek, easy, long |
| 14 | Build | 31.4 | 31.4 | 10 | 1 | easy, tempo, easy, long |
| 15 | Build | 31.4 | 31.4 | 10 | 1 | easy, fartlek, easy, long |
| 16 | Build | 32.2 | 32.2 | 10 | 1 | easy, tempo, easy, long |
| 17 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 18 | Race preparation | 32.2 | 32.2 | 10 | 1 | easy, fartlek, easy, long |
| 19 | Race preparation | 32.7 | 32.7 | 10 | 1 | easy, tempo, easy, long |
| 20 | Race week | 12 | 12.048 | — | 1 | easy, tempo, easy, race |

### 5k-8w-5d-q0

Input: 35 km/week, 10 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 35.9 | 35.9 | 10 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 36.4 | 36.4 | 10 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 36.8 | 36.8 | 10 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 37.1 | 37.1 | 10 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 8 | Race week | 14.8 | 14.8 | — | 0 | easy, easy, easy, easy, race |

### 5k-8w-5d-q1

Input: 35 km/week, 10 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 35.8 | 35.828 | 10 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 36.7 | 36.672 | 10 | 1 | easy, fartlek, easy, easy, long |
| 4 | Build | 37.6 | 37.645 | 10 | 1 | easy, tempo, easy, easy, long |
| 5 | Race preparation | 37.6 | 37.645 | 10 | 1 | easy, fartlek, easy, easy, long |
| 6 | Race preparation | 38.7 | 38.698 | 10 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 8 | Race week | 15.4 | 15.422 | — | 1 | easy, fartlek, easy, easy, race |

### 5k-10w-5d-q0

Input: 35 km/week, 10 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 35.9 | 35.9 | 10 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 36.4 | 36.4 | 10 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 36.8 | 36.8 | 10 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 37.1 | 37.1 | 10 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 8 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 10 | Race week | 14.8 | 14.8 | — | 0 | easy, easy, easy, easy, race |

### 5k-10w-5d-q1

Input: 35 km/week, 10 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 35.8 | 35.828 | 10 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 36.7 | 36.672 | 10 | 1 | easy, fartlek, easy, easy, long |
| 4 | Build | 37.6 | 37.645 | 10 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 37.6 | 37.645 | 10 | 1 | easy, fartlek, easy, easy, long |
| 6 | Build | 38.7 | 38.698 | 10 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 8 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 9 | Race preparation | 39.2 | 39.2 | 10 | 1 | easy, tempo, easy, easy, long |
| 10 | Race week | 15.8 | 15.848 | — | 1 | easy, tempo, easy, easy, race |

### 5k-12w-5d-q0

Input: 35 km/week, 10 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 35.9 | 35.9 | 10 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 36.4 | 36.4 | 10 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 36.8 | 36.8 | 10 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 37.1 | 37.1 | 10 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 8 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 11 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 12 | Race week | 14.8 | 14.8 | — | 0 | easy, easy, easy, easy, race |

### 5k-12w-5d-q1

Input: 35 km/week, 10 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 36 | 36.004 | 10 | 1 | easy, tempo, easy, easy, long |
| 4 | Build | 36.7 | 36.657 | 10 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 37.3 | 37.345 | 10 | 1 | easy, fartlek, easy, easy, long |
| 6 | Build | 37.9 | 37.9 | 10 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 37.9 | 37.9 | 10 | 1 | easy, fartlek, easy, easy, long |
| 8 | Build | 38.7 | 38.7 | 10 | 1 | easy, tempo, easy, easy, long |
| 9 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 10 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 11 | Race preparation | 39.2 | 39.2 | 10 | 1 | easy, tempo, easy, easy, long |
| 12 | Race week | 15.8 | 15.848 | — | 1 | easy, tempo, easy, easy, race |

### 5k-16w-5d-q0

Input: 35 km/week, 10 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 4 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 35.9 | 35.9 | 10 | 0 | easy, easy, easy, easy, long |
| 8 | Build | 36.4 | 36.4 | 10 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 36.8 | 36.8 | 10 | 0 | easy, easy, easy, easy, long |
| 10 | Build | 37.1 | 37.1 | 10 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 12 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 14 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 15 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 16 | Race week | 14.8 | 14.8 | — | 0 | easy, easy, easy, easy, race |

### 5k-16w-5d-q1

Input: 35 km/week, 10 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 35 | 35 | 10 | 1 | easy, fartlek, easy, easy, long |
| 4 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 5 | Maintenance | 35 | 35 | 10 | 1 | easy, fartlek, easy, easy, long |
| 6 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 36 | 36.004 | 10 | 1 | easy, tempo, easy, easy, long |
| 8 | Build | 36.7 | 36.657 | 10 | 1 | easy, tempo, easy, easy, long |
| 9 | Build | 37.3 | 37.345 | 10 | 1 | easy, fartlek, easy, easy, long |
| 10 | Build | 37.9 | 37.9 | 10 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 37.9 | 37.9 | 10 | 1 | easy, fartlek, easy, easy, long |
| 12 | Build | 38.7 | 38.7 | 10 | 1 | easy, tempo, easy, easy, long |
| 13 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 14 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 15 | Race preparation | 39.2 | 39.2 | 10 | 1 | easy, tempo, easy, easy, long |
| 16 | Race week | 15.8 | 15.848 | — | 1 | easy, tempo, easy, easy, race |

### 5k-20w-5d-q0

Input: 35 km/week, 10 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 4 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 7 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 8 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 9 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 10 | Maintenance | 35 | 35 | 10 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 35.9 | 35.9 | 10 | 0 | easy, easy, easy, easy, long |
| 12 | Build | 36.4 | 36.4 | 10 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 36.8 | 36.8 | 10 | 0 | easy, easy, easy, easy, long |
| 14 | Build | 37.1 | 37.1 | 10 | 0 | easy, easy, easy, easy, long |
| 15 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 16 | Build | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 18 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 19 | Race preparation | 37.5 | 37.5 | 10 | 0 | easy, easy, easy, easy, long |
| 20 | Race week | 14.8 | 14.8 | — | 0 | easy, easy, easy, easy, race |

### 5k-20w-5d-q1

Input: 35 km/week, 10 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 35 | 35 | 10 | 1 | easy, fartlek, easy, easy, long |
| 4 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 5 | Maintenance | 35 | 35 | 10 | 1 | easy, fartlek, easy, easy, long |
| 6 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 7 | Maintenance | 35 | 35 | 10 | 1 | easy, fartlek, easy, easy, long |
| 8 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 9 | Maintenance | 35 | 35 | 10 | 1 | easy, fartlek, easy, easy, long |
| 10 | Maintenance | 35 | 35 | 10 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 36 | 36.004 | 10 | 1 | easy, tempo, easy, easy, long |
| 12 | Build | 36.7 | 36.657 | 10 | 1 | easy, tempo, easy, easy, long |
| 13 | Build | 37.3 | 37.345 | 10 | 1 | easy, fartlek, easy, easy, long |
| 14 | Build | 37.9 | 37.9 | 10 | 1 | easy, tempo, easy, easy, long |
| 15 | Build | 37.9 | 37.9 | 10 | 1 | easy, fartlek, easy, easy, long |
| 16 | Build | 38.7 | 38.7 | 10 | 1 | easy, tempo, easy, easy, long |
| 17 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 18 | Race preparation | 38.7 | 38.7 | 10 | 1 | easy, fartlek, easy, easy, long |
| 19 | Race preparation | 39.2 | 39.2 | 10 | 1 | easy, tempo, easy, easy, long |
| 20 | Race week | 15.8 | 15.848 | — | 1 | easy, tempo, easy, easy, race |

### 5k-8w-6d-q0

Input: 42 km/week, 10 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 42.2 | 42.2 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race week | 17.5 | 17.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-8w-6d-q1

Input: 42 km/week, 10 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Build | 42.4 | 42.366 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Race preparation | 42.6 | 42.618 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Race week | 18.2 | 18.187 | — | 1 | easy, fartlek, easy, easy, easy, race |

### 5k-10w-6d-q0

Input: 42 km/week, 10 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 42.2 | 42.2 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race preparation | 42.3 | 42.3 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race week | 17.5 | 17.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-10w-6d-q1

Input: 42 km/week, 10 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Build | 42.4 | 42.366 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 42.6 | 42.618 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Build | 43.7 | 43.7 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 9 | Race preparation | 44.2 | 44.2 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race week | 18.6 | 18.613 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-12w-6d-q0

Input: 42 km/week, 10 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Build | 42.2 | 42.2 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 42.3 | 42.3 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Race week | 17.5 | 17.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-12w-6d-q1

Input: 42 km/week, 10 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Build | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 42.3 | 42.342 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Build | 42.9 | 42.9 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 42.9 | 42.9 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Build | 43.7 | 43.7 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 10 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 11 | Race preparation | 44.2 | 44.2 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Race week | 18.6 | 18.613 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-16w-6d-q0

Input: 42 km/week, 10 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Build | 42.2 | 42.2 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 42.3 | 42.3 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Race week | 17.5 | 17.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-16w-6d-q1

Input: 42 km/week, 10 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Maintenance | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Build | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 42.3 | 42.342 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 10 | Build | 42.9 | 42.9 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 42.9 | 42.9 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 12 | Build | 43.7 | 43.7 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 14 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 15 | Race preparation | 44.2 | 44.2 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Race week | 18.6 | 18.613 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-20w-6d-q0

Input: 42 km/week, 10 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Maintenance | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Build | 42 | 42 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Build | 42.2 | 42.2 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 42.3 | 42.3 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 18 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 19 | Race preparation | 42.5 | 42.5 | 10 | 0 | easy, easy, easy, easy, easy, long |
| 20 | Race week | 17.5 | 17.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-20w-6d-q1

Input: 42 km/week, 10 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Maintenance | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Maintenance | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Maintenance | 42 | 42 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 10 | Maintenance | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Build | 42 | 42 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Build | 42.3 | 42.342 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 14 | Build | 42.9 | 42.9 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Build | 42.9 | 42.9 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 16 | Build | 43.7 | 43.7 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 17 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 18 | Race preparation | 43.7 | 43.7 | 10 | 1 | easy, fartlek, easy, easy, easy, long |
| 19 | Race preparation | 44.2 | 44.2 | 10 | 1 | easy, tempo, easy, easy, easy, long |
| 20 | Race week | 18.6 | 18.613 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-8w-3d-q0

Input: 24 km/week, 12 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 0 | easy, easy, long |
| 2 | Foundation | 25.3 | 25.3 | 12 | 0 | easy, easy, long |
| 3 | Build | 26.8 | 26.8 | 12 | 0 | easy, easy, long |
| 4 | Build | 28.3 | 28.3 | 12 | 0 | easy, easy, long |
| 5 | Race preparation | 29.8 | 29.8 | 12 | 0 | easy, easy, long |
| 6 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 7 | Taper | 17.4 | 17.4 | — | 0 | easy, easy, easy |
| 8 | Race week | 9 | 9 | — | 0 | easy, easy, race |

### 10k-8w-3d-q1

Input: 24 km/week, 12 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 1 | tempo, easy, long |
| 2 | Foundation | 25.4 | 25.41 | 12 | 1 | tempo, easy, long |
| 3 | Build | 26.8 | 26.8 | 12 | 1 | tempo, easy, long |
| 4 | Build | 27.2 | 27.2 | 12 | 1 | tempo, easy, long |
| 5 | Race preparation | 27.2 | 27.2 | 12 | 1 | tempo, easy, long |
| 6 | Race preparation | 27.5 | 27.5 | 12 | 1 | tempo, easy, long |
| 7 | Taper | 15.3 | 15.269 | — | 1 | tempo, easy, easy |
| 8 | Race week | 6.9 | 6.913 | — | 1 | tempo, easy, race |

### 10k-10w-3d-q0

Input: 24 km/week, 12 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 0 | easy, easy, long |
| 2 | Foundation | 25.3 | 25.3 | 12 | 0 | easy, easy, long |
| 3 | Build | 26.8 | 26.8 | 12 | 0 | easy, easy, long |
| 4 | Build | 28.3 | 28.3 | 12 | 0 | easy, easy, long |
| 5 | Build | 29.8 | 29.8 | 12 | 0 | easy, easy, long |
| 6 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 7 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 8 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 9 | Taper | 17.4 | 17.4 | — | 0 | easy, easy, easy |
| 10 | Race week | 9 | 9 | — | 0 | easy, easy, race |

### 10k-10w-3d-q1

Input: 24 km/week, 12 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 1 | tempo, easy, long |
| 2 | Foundation | 25.4 | 25.41 | 12 | 1 | tempo, easy, long |
| 3 | Build | 26.8 | 26.8 | 12 | 1 | tempo, easy, long |
| 4 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 5 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 6 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 7 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 8 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 9 | Taper | 15 | 15.038 | — | 1 | tempo, easy, easy |
| 10 | Race week | 6.6 | 6.631 | — | 1 | tempo, easy, race |

### 10k-12w-3d-q0

Input: 24 km/week, 12 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 0 | easy, easy, long |
| 2 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 3 | Build | 25.3 | 25.3 | 12 | 0 | easy, easy, long |
| 4 | Build | 26.8 | 26.8 | 12 | 0 | easy, easy, long |
| 5 | Build | 28.3 | 28.3 | 12 | 0 | easy, easy, long |
| 6 | Build | 29.8 | 29.8 | 12 | 0 | easy, easy, long |
| 7 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 8 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 9 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 10 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 11 | Taper | 17.4 | 17.4 | — | 0 | easy, easy, easy |
| 12 | Race week | 9 | 9 | — | 0 | easy, easy, race |

### 10k-12w-3d-q1

Input: 24 km/week, 12 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 1 | tempo, easy, long |
| 2 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 3 | Build | 25.4 | 25.41 | 12 | 1 | tempo, easy, long |
| 4 | Build | 26.7 | 26.7 | 12 | 1 | tempo, easy, long |
| 5 | Build | 26.8 | 26.8 | 12 | 1 | tempo, easy, long |
| 6 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 7 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 8 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 9 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 10 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 11 | Taper | 15 | 15.038 | — | 1 | tempo, easy, easy |
| 12 | Race week | 6.6 | 6.641 | — | 1 | tempo, easy, race |

### 10k-16w-3d-q0

Input: 24 km/week, 12 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 0 | easy, easy, long |
| 2 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 3 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 4 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 5 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 6 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 7 | Build | 25.3 | 25.3 | 12 | 0 | easy, easy, long |
| 8 | Build | 26.8 | 26.8 | 12 | 0 | easy, easy, long |
| 9 | Build | 28.3 | 28.3 | 12 | 0 | easy, easy, long |
| 10 | Build | 29.8 | 29.8 | 12 | 0 | easy, easy, long |
| 11 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 12 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 13 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 14 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 15 | Taper | 17.4 | 17.4 | — | 0 | easy, easy, easy |
| 16 | Race week | 9 | 9 | — | 0 | easy, easy, race |

### 10k-16w-3d-q1

Input: 24 km/week, 12 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 1 | tempo, easy, long |
| 2 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 3 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 4 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 5 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 6 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 7 | Build | 25.4 | 25.41 | 12 | 1 | tempo, easy, long |
| 8 | Build | 26.7 | 26.7 | 12 | 1 | tempo, easy, long |
| 9 | Build | 26.8 | 26.8 | 12 | 1 | tempo, easy, long |
| 10 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 11 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 12 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 13 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 14 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 15 | Taper | 15 | 15.038 | — | 1 | tempo, easy, easy |
| 16 | Race week | 6.6 | 6.631 | — | 1 | tempo, easy, race |

### 10k-20w-3d-q0

Input: 24 km/week, 12 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 0 | easy, easy, long |
| 2 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 3 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 4 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 5 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 6 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 7 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 8 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 9 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 10 | Maintenance | 24 | 24 | 12 | 0 | easy, easy, long |
| 11 | Build | 25.3 | 25.3 | 12 | 0 | easy, easy, long |
| 12 | Build | 26.8 | 26.8 | 12 | 0 | easy, easy, long |
| 13 | Build | 28.3 | 28.3 | 12 | 0 | easy, easy, long |
| 14 | Build | 29.8 | 29.8 | 12 | 0 | easy, easy, long |
| 15 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 16 | Build | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 17 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 18 | Race preparation | 31.2 | 31.2 | 12 | 0 | easy, easy, long |
| 19 | Taper | 17.4 | 17.4 | — | 0 | easy, easy, easy |
| 20 | Race week | 9 | 9 | — | 0 | easy, easy, race |

### 10k-20w-3d-q1

Input: 24 km/week, 12 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 24 | 24 | 12 | 1 | tempo, easy, long |
| 2 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 3 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 4 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 5 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 6 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 7 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 8 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 9 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 10 | Maintenance | 24 | 24 | 12 | 1 | tempo, easy, long |
| 11 | Build | 25.4 | 25.41 | 12 | 1 | tempo, easy, long |
| 12 | Build | 26.8 | 26.8 | 12 | 1 | tempo, easy, long |
| 13 | Build | 26.8 | 26.8 | 12 | 1 | tempo, easy, long |
| 14 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 15 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 16 | Build | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 17 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 18 | Race preparation | 27.1 | 27.1 | 12 | 1 | tempo, easy, long |
| 19 | Taper | 15 | 15.038 | — | 1 | tempo, easy, easy |
| 20 | Race week | 6.6 | 6.641 | — | 1 | tempo, easy, race |

### 10k-8w-4d-q0

Input: 32 km/week, 12 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 2 | Foundation | 33.7 | 33.7 | 12 | 0 | easy, easy, easy, long |
| 3 | Build | 35.4 | 35.4 | 12 | 0 | easy, easy, easy, long |
| 4 | Build | 36.8 | 36.8 | 12 | 0 | easy, easy, easy, long |
| 5 | Race preparation | 38.2 | 38.2 | 12 | 0 | easy, easy, easy, long |
| 6 | Race preparation | 40.2 | 40.2 | 13 | 0 | easy, easy, easy, long |
| 7 | Taper | 22.3 | 22.3 | — | 0 | easy, easy, easy, easy |
| 8 | Race week | 13.9 | 13.9 | — | 0 | easy, easy, easy, race |

### 10k-8w-4d-q1

Input: 32 km/week, 12 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 33.8 | 33.774 | 12 | 1 | easy, tempo, easy, long |
| 3 | Build | 35.2 | 35.171 | 12 | 1 | easy, tempo, easy, long |
| 4 | Build | 36.5 | 36.539 | 12 | 1 | easy, tempo, easy, long |
| 5 | Race preparation | 36.8 | 36.8 | 12 | 1 | easy, tempo, easy, long |
| 6 | Race preparation | 38.8 | 38.8 | 13 | 1 | easy, tempo, easy, long |
| 7 | Taper | 21.2 | 21.222 | — | 1 | easy, tempo, easy, easy |
| 8 | Race week | 12.6 | 12.596 | — | 1 | easy, tempo, easy, race |

### 10k-10w-4d-q0

Input: 32 km/week, 12 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 2 | Foundation | 33.7 | 33.7 | 12 | 0 | easy, easy, easy, long |
| 3 | Build | 35.4 | 35.4 | 12 | 0 | easy, easy, easy, long |
| 4 | Build | 36.8 | 36.8 | 12 | 0 | easy, easy, easy, long |
| 5 | Build | 38.2 | 38.2 | 12 | 0 | easy, easy, easy, long |
| 6 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 7 | Race preparation | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 8 | Race preparation | 41 | 41 | 13 | 0 | easy, easy, easy, long |
| 9 | Taper | 22.8 | 22.8 | — | 0 | easy, easy, easy, easy |
| 10 | Race week | 14.1 | 14.1 | — | 0 | easy, easy, easy, race |

### 10k-10w-4d-q1

Input: 32 km/week, 12 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 33.8 | 33.774 | 12 | 1 | easy, tempo, easy, long |
| 3 | Build | 35.2 | 35.171 | 12 | 1 | easy, tempo, easy, long |
| 4 | Build | 36.5 | 36.539 | 12 | 1 | easy, tempo, easy, long |
| 5 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 6 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 7 | Race preparation | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 8 | Race preparation | 38.7 | 38.7 | 13 | 1 | easy, tempo, easy, long |
| 9 | Taper | 21.4 | 21.438 | — | 1 | easy, tempo, easy, easy |
| 10 | Race week | 12.6 | 12.649 | — | 1 | easy, tempo, easy, race |

### 10k-12w-4d-q0

Input: 32 km/week, 12 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 3 | Build | 33.7 | 33.7 | 12 | 0 | easy, easy, easy, long |
| 4 | Build | 35.4 | 35.4 | 12 | 0 | easy, easy, easy, long |
| 5 | Build | 36.8 | 36.8 | 12 | 0 | easy, easy, easy, long |
| 6 | Build | 38.2 | 38.2 | 12 | 0 | easy, easy, easy, long |
| 7 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 8 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 10 | Race preparation | 41 | 41 | 13 | 0 | easy, easy, easy, long |
| 11 | Taper | 22.8 | 22.8 | — | 0 | easy, easy, easy, easy |
| 12 | Race week | 14.1 | 14.1 | — | 0 | easy, easy, easy, race |

### 10k-12w-4d-q1

Input: 32 km/week, 12 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 3 | Build | 33.8 | 33.842 | 12 | 1 | easy, tempo, easy, long |
| 4 | Build | 35.3 | 35.257 | 12 | 1 | easy, tempo, easy, long |
| 5 | Build | 36.2 | 36.2 | 12 | 1 | easy, tempo, easy, long |
| 6 | Build | 36.6 | 36.6 | 12 | 1 | easy, tempo, easy, long |
| 7 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 8 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 9 | Race preparation | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 10 | Race preparation | 38.7 | 38.7 | 13 | 1 | easy, tempo, easy, long |
| 11 | Taper | 21.4 | 21.438 | — | 1 | easy, tempo, easy, easy |
| 12 | Race week | 12.6 | 12.649 | — | 1 | easy, tempo, easy, race |

### 10k-16w-4d-q0

Input: 32 km/week, 12 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 3 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 4 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 5 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 6 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 7 | Build | 33.7 | 33.7 | 12 | 0 | easy, easy, easy, long |
| 8 | Build | 35.4 | 35.4 | 12 | 0 | easy, easy, easy, long |
| 9 | Build | 36.8 | 36.8 | 12 | 0 | easy, easy, easy, long |
| 10 | Build | 38.2 | 38.2 | 12 | 0 | easy, easy, easy, long |
| 11 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 12 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 13 | Race preparation | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 14 | Race preparation | 41 | 41 | 13 | 0 | easy, easy, easy, long |
| 15 | Taper | 22.8 | 22.8 | — | 0 | easy, easy, easy, easy |
| 16 | Race week | 14.1 | 14.1 | — | 0 | easy, easy, easy, race |

### 10k-16w-4d-q1

Input: 32 km/week, 12 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 3 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 4 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 5 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 6 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 7 | Build | 33.8 | 33.842 | 12 | 1 | easy, tempo, easy, long |
| 8 | Build | 35.3 | 35.257 | 12 | 1 | easy, tempo, easy, long |
| 9 | Build | 36.2 | 36.2 | 12 | 1 | easy, tempo, easy, long |
| 10 | Build | 36.6 | 36.6 | 12 | 1 | easy, tempo, easy, long |
| 11 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 12 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 13 | Race preparation | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 14 | Race preparation | 38.7 | 38.7 | 13 | 1 | easy, tempo, easy, long |
| 15 | Taper | 21.4 | 21.438 | — | 1 | easy, tempo, easy, easy |
| 16 | Race week | 12.6 | 12.649 | — | 1 | easy, tempo, easy, race |

### 10k-20w-4d-q0

Input: 32 km/week, 12 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 3 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 4 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 5 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 6 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 7 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 8 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 9 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 10 | Maintenance | 32 | 32 | 12 | 0 | easy, easy, easy, long |
| 11 | Build | 33.7 | 33.7 | 12 | 0 | easy, easy, easy, long |
| 12 | Build | 35.4 | 35.4 | 12 | 0 | easy, easy, easy, long |
| 13 | Build | 36.8 | 36.8 | 12 | 0 | easy, easy, easy, long |
| 14 | Build | 38.2 | 38.2 | 12 | 0 | easy, easy, easy, long |
| 15 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 16 | Build | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 17 | Race preparation | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 18 | Race preparation | 41 | 41 | 13 | 0 | easy, easy, easy, long |
| 19 | Taper | 22.8 | 22.8 | — | 0 | easy, easy, easy, easy |
| 20 | Race week | 14.1 | 14.1 | — | 0 | easy, easy, easy, race |

### 10k-20w-4d-q1

Input: 32 km/week, 12 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 3 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 4 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 5 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 6 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 7 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 8 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 9 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 10 | Maintenance | 32 | 32 | 12 | 1 | easy, tempo, easy, long |
| 11 | Build | 33.8 | 33.842 | 12 | 1 | easy, tempo, easy, long |
| 12 | Build | 35.3 | 35.257 | 12 | 1 | easy, tempo, easy, long |
| 13 | Build | 36.2 | 36.2 | 12 | 1 | easy, tempo, easy, long |
| 14 | Build | 36.6 | 36.6 | 12 | 1 | easy, tempo, easy, long |
| 15 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 16 | Build | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 17 | Race preparation | 36.7 | 36.7 | 12 | 1 | easy, tempo, easy, long |
| 18 | Race preparation | 38.7 | 38.7 | 13 | 1 | easy, tempo, easy, long |
| 19 | Taper | 21.4 | 21.438 | — | 1 | easy, tempo, easy, easy |
| 20 | Race week | 12.6 | 12.649 | — | 1 | easy, tempo, easy, race |

### 10k-8w-5d-q0

Input: 40 km/week, 12 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 41.6 | 41.6 | 12 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 43.2 | 43.2 | 12 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 43.8 | 43.8 | 12 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 44.3 | 44.3 | 12 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 46.3 | 46.3 | 13 | 0 | easy, easy, easy, easy, long |
| 7 | Taper | 25.5 | 25.5 | — | 0 | easy, easy, easy, easy, easy |
| 8 | Race week | 17.1 | 17.1 | — | 0 | easy, easy, easy, easy, race |

### 10k-8w-5d-q1

Input: 40 km/week, 12 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 41.3 | 41.34 | 12 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 42.5 | 42.499 | 12 | 1 | easy, tempo, easy, easy, long |
| 4 | Build | 43.7 | 43.651 | 12 | 1 | easy, tempo, easy, easy, long |
| 5 | Race preparation | 44.3 | 44.265 | 12 | 1 | easy, tempo, easy, easy, long |
| 6 | Race preparation | 46.3 | 46.265 | 13 | 1 | easy, tempo, easy, easy, long |
| 7 | Taper | 25.8 | 25.784 | — | 1 | easy, tempo, easy, easy, easy |
| 8 | Race week | 16.7 | 16.743 | — | 1 | easy, tempo, easy, easy, race |

### 10k-10w-5d-q0

Input: 40 km/week, 12 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 41.6 | 41.6 | 12 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 43.2 | 43.2 | 12 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 43.8 | 43.8 | 12 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 44.3 | 44.3 | 12 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 44.8 | 44.8 | 12 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 8 | Race preparation | 47 | 47 | 13 | 0 | easy, easy, easy, easy, long |
| 9 | Taper | 26.4 | 26.4 | — | 0 | easy, easy, easy, easy, easy |
| 10 | Race week | 17.1 | 17.1 | — | 0 | easy, easy, easy, easy, race |

### 10k-10w-5d-q1

Input: 40 km/week, 12 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 41.3 | 41.34 | 12 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 42.5 | 42.499 | 12 | 1 | easy, tempo, easy, easy, long |
| 4 | Build | 43.7 | 43.651 | 12 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 44.3 | 44.265 | 12 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 8 | Race preparation | 46.5 | 46.5 | 13 | 1 | easy, tempo, easy, easy, long |
| 9 | Taper | 25.9 | 25.938 | — | 1 | easy, tempo, easy, easy, easy |
| 10 | Race week | 16.7 | 16.696 | — | 1 | easy, tempo, easy, easy, race |

### 10k-12w-5d-q0

Input: 40 km/week, 12 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 41.6 | 41.6 | 12 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 43.2 | 43.2 | 12 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 43.8 | 43.8 | 12 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 44.3 | 44.3 | 12 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 44.8 | 44.8 | 12 | 0 | easy, easy, easy, easy, long |
| 8 | Build | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 47 | 47 | 13 | 0 | easy, easy, easy, easy, long |
| 11 | Taper | 25.8 | 25.8 | — | 0 | easy, easy, easy, easy, easy |
| 12 | Race week | 16.9 | 16.9 | — | 0 | easy, easy, easy, easy, race |

### 10k-12w-5d-q1

Input: 40 km/week, 12 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 41.4 | 41.378 | 12 | 1 | easy, tempo, easy, easy, long |
| 4 | Build | 42.6 | 42.583 | 12 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 43.3 | 43.251 | 12 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 44.2 | 44.204 | 12 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 8 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 9 | Race preparation | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation | 46.5 | 46.5 | 13 | 1 | easy, tempo, easy, easy, long |
| 11 | Taper | 25.9 | 25.938 | — | 1 | easy, tempo, easy, easy, easy |
| 12 | Race week | 16.7 | 16.696 | — | 1 | easy, tempo, easy, easy, race |

### 10k-16w-5d-q0

Input: 40 km/week, 12 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 4 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 41.6 | 41.6 | 12 | 0 | easy, easy, easy, easy, long |
| 8 | Build | 43.2 | 43.2 | 12 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 43.8 | 43.8 | 12 | 0 | easy, easy, easy, easy, long |
| 10 | Build | 44.3 | 44.3 | 12 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 44.8 | 44.8 | 12 | 0 | easy, easy, easy, easy, long |
| 12 | Build | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 14 | Race preparation | 47 | 47 | 13 | 0 | easy, easy, easy, easy, long |
| 15 | Taper | 25.8 | 25.8 | — | 0 | easy, easy, easy, easy, easy |
| 16 | Race week | 16.9 | 16.9 | — | 0 | easy, easy, easy, easy, race |

### 10k-16w-5d-q1

Input: 40 km/week, 12 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 4 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 5 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 6 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 41.4 | 41.378 | 12 | 1 | easy, tempo, easy, easy, long |
| 8 | Build | 42.6 | 42.583 | 12 | 1 | easy, tempo, easy, easy, long |
| 9 | Build | 43.3 | 43.251 | 12 | 1 | easy, tempo, easy, easy, long |
| 10 | Build | 44.2 | 44.204 | 12 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 12 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 13 | Race preparation | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 14 | Race preparation | 46.5 | 46.5 | 13 | 1 | easy, tempo, easy, easy, long |
| 15 | Taper | 25.9 | 25.938 | — | 1 | easy, tempo, easy, easy, easy |
| 16 | Race week | 16.7 | 16.696 | — | 1 | easy, tempo, easy, easy, race |

### 10k-20w-5d-q0

Input: 40 km/week, 12 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 4 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 7 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 8 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 9 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 10 | Maintenance | 40 | 40 | 12 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 41.6 | 41.6 | 12 | 0 | easy, easy, easy, easy, long |
| 12 | Build | 43.2 | 43.2 | 12 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 43.8 | 43.8 | 12 | 0 | easy, easy, easy, easy, long |
| 14 | Build | 44.3 | 44.3 | 12 | 0 | easy, easy, easy, easy, long |
| 15 | Build | 44.8 | 44.8 | 12 | 0 | easy, easy, easy, easy, long |
| 16 | Build | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 18 | Race preparation | 47 | 47 | 13 | 0 | easy, easy, easy, easy, long |
| 19 | Taper | 25.8 | 25.8 | — | 0 | easy, easy, easy, easy, easy |
| 20 | Race week | 16.9 | 16.9 | — | 0 | easy, easy, easy, easy, race |

### 10k-20w-5d-q1

Input: 40 km/week, 12 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 4 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 5 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 6 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 7 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 8 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 9 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 10 | Maintenance | 40 | 40 | 12 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 41.4 | 41.378 | 12 | 1 | easy, tempo, easy, easy, long |
| 12 | Build | 42.6 | 42.583 | 12 | 1 | easy, tempo, easy, easy, long |
| 13 | Build | 43.3 | 43.251 | 12 | 1 | easy, tempo, easy, easy, long |
| 14 | Build | 44.2 | 44.204 | 12 | 1 | easy, tempo, easy, easy, long |
| 15 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 16 | Build | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 17 | Race preparation | 44.5 | 44.5 | 12 | 1 | easy, tempo, easy, easy, long |
| 18 | Race preparation | 46.5 | 46.5 | 13 | 1 | easy, tempo, easy, easy, long |
| 19 | Taper | 25.9 | 25.938 | — | 1 | easy, tempo, easy, easy, easy |
| 20 | Race week | 16.7 | 16.696 | — | 1 | easy, tempo, easy, easy, race |

### 10k-8w-6d-q0

Input: 48 km/week, 12 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 49.8 | 49.75 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Race preparation | 51.3 | 51.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 53.3 | 53.3 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 55.4 | 55.432 | 15 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Taper | 29.8 | 29.8 | — | 0 | easy, easy, easy, easy, easy, easy |
| 8 | Race week | 20.7 | 20.7 | — | 0 | easy, easy, easy, easy, easy, race |

### 10k-8w-6d-q1

Input: 48 km/week, 12 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 49.4 | 49.446 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Race preparation | 51.1 | 51.103 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Race preparation | 53.1 | 53.147 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Race preparation | 55.3 | 55.272 | 15 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Taper | 28.6 | 28.561 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 8 | Race week | 19.7 | 19.71 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-8w-6d-q2

Input: 48 km/week, 12 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 49.8 | 49.79 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Race preparation | 51.2 | 51.161 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Race preparation | 53.2 | 53.207 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Race preparation | 55.3 | 55.335 | 15 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Taper | 28.5 | 28.453 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 8 | Race week | 19.8 | 19.827 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-10w-6d-q0

Input: 48 km/week, 12 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 48.8 | 48.8 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 50.8 | 50.752 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 52.7 | 52.7 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 54.8 | 54.808 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 57 | 57 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race preparation | 59.3 | 59.28 | 15 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Taper | 32.3 | 32.3 | — | 0 | easy, easy, easy, easy, easy, easy |
| 10 | Race week | 21.5 | 21.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 10k-10w-6d-q1

Input: 48 km/week, 12 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 48.4 | 48.406 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Build | 50.3 | 50.342 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 52.4 | 52.355 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Race preparation | 54.4 | 54.449 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 56.1 | 56.074 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Race preparation | 58.3 | 58.316 | 15 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Taper | 30.9 | 30.894 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 10 | Race week | 20.5 | 20.476 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-10w-6d-q2

Input: 48 km/week, 12 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 49 | 48.97 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Build | 50.9 | 50.928 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 52.5 | 52.545 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Race preparation | 54.6 | 54.646 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Race preparation | 56.5 | 56.486 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Race preparation | 58.7 | 58.745 | 15 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Taper | 30.7 | 30.653 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 10 | Race week | 20.3 | 20.346 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-12w-6d-q0

Input: 48 km/week, 12 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 48.8 | 48.8 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 50.8 | 50.752 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 52.7 | 52.7 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 53.1 | 53.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 55.2 | 55.224 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race preparation | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 59.4 | 59.35 | 15 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Taper | 32.3 | 32.3 | — | 0 | easy, easy, easy, easy, easy, easy |
| 12 | Race week | 21.5 | 21.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 10k-12w-6d-q1

Input: 48 km/week, 12 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 48.4 | 48.406 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Build | 50.3 | 50.342 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 52.4 | 52.355 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 53.4 | 53.386 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 55.5 | 55.521 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Race preparation | 56.7 | 56.651 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Race preparation | 57.3 | 57.251 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race preparation | 59 | 59.035 | 15 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Taper | 31.1 | 31.145 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 12 | Race week | 20.6 | 20.645 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-12w-6d-q2

Input: 48 km/week, 12 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 49 | 48.97 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Build | 50.9 | 50.928 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 52.5 | 52.545 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build | 53.9 | 53.883 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build | 56 | 56.038 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Race preparation | 57 | 56.951 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Race preparation | 57.7 | 57.668 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Race preparation | 59.1 | 59.105 | 15 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Taper | 30.9 | 30.852 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 12 | Race week | 20.1 | 20.068 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-16w-6d-q0

Input: 48 km/week, 12 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 49.8 | 49.75 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 51.3 | 51.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Build | 52.7 | 52.7 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 53.1 | 53.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 55.2 | 55.224 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Race preparation | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Race preparation | 59.4 | 59.35 | 15 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Taper | 32.3 | 32.3 | — | 0 | easy, easy, easy, easy, easy, easy |
| 16 | Race week | 21.5 | 21.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 10k-16w-6d-q1

Input: 48 km/week, 12 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 49.9 | 49.92 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 50.8 | 50.828 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Build | 52.6 | 52.572 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 53.1 | 53.086 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Build | 55.2 | 55.209 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 56.5 | 56.489 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Race preparation | 56.7 | 56.651 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Race preparation | 57.3 | 57.251 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Race preparation | 59 | 59.035 | 15 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Taper | 31.1 | 31.145 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 16 | Race week | 20.6 | 20.645 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-16w-6d-q2

Input: 48 km/week, 12 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Maintenance | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Maintenance | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build | 49.9 | 49.92 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build | 51 | 51.035 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Build | 52.6 | 52.572 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 53.8 | 53.789 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Build | 55.9 | 55.94 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Build | 57.5 | 57.454 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Race preparation | 57.5 | 57.454 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Race preparation | 57.7 | 57.668 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 14 | Race preparation | 59.1 | 59.105 | 15 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Taper | 30.9 | 30.852 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 16 | Race week | 20.1 | 20.068 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-20w-6d-q0

Input: 48 km/week, 12 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Maintenance | 48 | 48 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Maintenance | 48 | 48 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Maintenance | 48 | 48 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 48.2 | 48.15 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 49.8 | 49.75 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 51.3 | 51.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Build | 52.7 | 52.7 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 54.8 | 54.808 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Build | 57 | 57 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Build | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Race preparation | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 57.1 | 57.1 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 18 | Race preparation | 59.4 | 59.35 | 15 | 0 | easy, easy, easy, easy, easy, long |
| 19 | Taper | 32.3 | 32.3 | — | 0 | easy, easy, easy, easy, easy, easy |
| 20 | Race week | 21.5 | 21.5 | — | 0 | easy, easy, easy, easy, easy, race |

### 10k-20w-6d-q1

Input: 48 km/week, 12 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Maintenance | 48 | 48 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Maintenance | 48 | 48 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 48.7 | 48.685 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Build | 49.9 | 49.929 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 50.8 | 50.828 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Build | 52.6 | 52.572 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Build | 54.7 | 54.674 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Build | 56.4 | 56.393 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Build | 56.5 | 56.489 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Race preparation | 56.7 | 56.651 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 17 | Race preparation | 57.3 | 57.251 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 18 | Race preparation | 59 | 59.035 | 15 | 1 | easy, tempo, easy, easy, easy, long |
| 19 | Taper | 31.1 | 31.145 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 20 | Race week | 20.6 | 20.645 | — | 1 | easy, tempo, easy, easy, easy, race |

### 10k-20w-6d-q2

Input: 48 km/week, 12 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Maintenance | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Maintenance | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Maintenance | 48 | 48 | 12 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Maintenance | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Maintenance | 48 | 48 | 12 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Maintenance | 48 | 48 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Maintenance | 48 | 48 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 48.5 | 48.478 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Build | 50 | 49.998 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Build | 51 | 51.035 | 13 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Build | 52.6 | 52.572 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Build | 54.7 | 54.674 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 14 | Build | 56.4 | 56.362 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Build | 57.5 | 57.454 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 16 | Race preparation | 57.5 | 57.454 | 14 | 1 | easy, tempo, easy, easy, easy, long |
| 17 | Race preparation | 57.7 | 57.668 | 14 | 2 | easy, tempo, easy, tempo, easy, long |
| 18 | Race preparation | 59.1 | 59.105 | 15 | 2 | easy, tempo, easy, tempo, easy, long |
| 19 | Taper | 30.9 | 30.852 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 20 | Race week | 20.1 | 20.068 | — | 1 | easy, tempo, easy, easy, easy, race |

### half-8w-3d-q0

Input: 30 km/week, 16 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 0 | easy, easy, long |
| 2 | Foundation | 31.8 | 31.8 | 16 | 0 | easy, easy, long |
| 3 | Build | 33.7 | 33.7 | 16 | 0 | easy, easy, long |
| 4 | Recovery | 26.6 | 26.6 | 11 | 0 | easy, easy, long |
| 5 | Race preparation | 35.7 | 35.7 | 16 | 0 | easy, easy, long |
| 6 | Race preparation | 33.4 | 33.4 | 12 | 0 | easy, easy, long |
| 7 | Taper | 21.8 | 21.8 | — | 0 | easy, easy, easy |
| 8 | Race week | 8.3 | 8.3 | — | 0 | easy, easy, race |

### half-8w-3d-q1

Input: 30 km/week, 16 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 1 | tempo, easy, long |
| 2 | Foundation | 31.9 | 31.898 | 16 | 1 | tempo, easy, long |
| 3 | Build | 33.8 | 33.834 | 16 | 1 | tempo, easy, long |
| 4 | Recovery | 26.6 | 26.6 | 11 | 0 | easy, easy, long |
| 5 | Race preparation | 34.7 | 34.7 | 16 | 1 | tempo, easy, long |
| 6 | Race preparation | 28.9 | 28.866 | 12 | 1 | tempo, easy, long |
| 7 | Taper | 19.7 | 19.721 | — | 1 | tempo, easy, easy |
| 8 | Race week | 6.3 | 6.3 | — | 0 | easy, easy, race |

### half-12w-3d-q0

Input: 30 km/week, 16 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 0 | easy, easy, long |
| 2 | Foundation | 31.8 | 31.8 | 16 | 0 | easy, easy, long |
| 3 | Build | 33.7 | 33.7 | 16 | 0 | easy, easy, long |
| 4 | Recovery | 26.6 | 26.6 | 11 | 0 | easy, easy, long |
| 5 | Build | 35.7 | 35.7 | 16 | 0 | easy, easy, long |
| 6 | Build | 37.7 | 37.7 | 16 | 0 | easy, easy, long |
| 7 | Build | 39.7 | 39.7 | 16 | 0 | easy, easy, long |
| 8 | Recovery | 28.6 | 28.6 | 11 | 0 | easy, easy, long |
| 9 | Race preparation | 41.6 | 41.6 | 16 | 0 | easy, easy, long |
| 10 | Race preparation | 35.6 | 35.6 | 12 | 0 | easy, easy, long |
| 11 | Taper | 25.4 | 25.4 | — | 0 | easy, easy, easy |
| 12 | Race week | 9.6 | 9.6 | — | 0 | easy, easy, race |

### half-12w-3d-q1

Input: 30 km/week, 16 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 1 | tempo, easy, long |
| 2 | Foundation | 31.9 | 31.898 | 16 | 1 | tempo, easy, long |
| 3 | Build | 33.8 | 33.834 | 16 | 1 | tempo, easy, long |
| 4 | Recovery | 26.6 | 26.6 | 11 | 0 | easy, easy, long |
| 5 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 6 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 7 | Build | 34.5 | 34.5 | 16 | 1 | tempo, easy, long |
| 8 | Recovery | 27.8 | 27.8 | 11 | 0 | easy, easy, long |
| 9 | Race preparation | 34.5 | 34.5 | 16 | 1 | tempo, easy, long |
| 10 | Race preparation | 29.4 | 29.419 | 12 | 1 | tempo, easy, long |
| 11 | Taper | 20.3 | 20.321 | — | 1 | tempo, easy, easy |
| 12 | Race week | 6.2 | 6.23 | — | 1 | tempo, easy, race |

### half-16w-3d-q0

Input: 30 km/week, 16 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 0 | easy, easy, long |
| 2 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 3 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 4 | Recovery | 24.4 | 24.4 | 12 | 0 | easy, easy, long |
| 5 | Build | 31.8 | 31.8 | 16 | 0 | easy, easy, long |
| 6 | Build | 33.7 | 33.7 | 16 | 0 | easy, easy, long |
| 7 | Build | 35.7 | 35.7 | 16 | 0 | easy, easy, long |
| 8 | Recovery | 28 | 28 | 11 | 0 | easy, easy, long |
| 9 | Build | 37.7 | 37.7 | 16 | 0 | easy, easy, long |
| 10 | Build | 39.7 | 39.7 | 16 | 0 | easy, easy, long |
| 11 | Build | 41.6 | 41.6 | 16 | 0 | easy, easy, long |
| 12 | Recovery | 28.6 | 28.6 | 11 | 0 | easy, easy, long |
| 13 | Race preparation | 41.6 | 41.6 | 16 | 0 | easy, easy, long |
| 14 | Race preparation | 35.6 | 35.6 | 12 | 0 | easy, easy, long |
| 15 | Taper | 25.4 | 25.4 | — | 0 | easy, easy, easy |
| 16 | Race week | 9.6 | 9.6 | — | 0 | easy, easy, race |

### half-16w-3d-q1

Input: 30 km/week, 16 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 1 | tempo, easy, long |
| 2 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 3 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 4 | Recovery | 24.4 | 24.4 | 12 | 0 | easy, easy, long |
| 5 | Build | 31.9 | 31.899 | 16 | 1 | tempo, easy, long |
| 6 | Build | 33.8 | 33.834 | 16 | 1 | tempo, easy, long |
| 7 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 8 | Recovery | 26 | 26 | 10 | 0 | easy, easy, long |
| 9 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 10 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 11 | Build | 34.5 | 34.5 | 16 | 1 | tempo, easy, long |
| 12 | Recovery | 27.8 | 27.8 | 11 | 0 | easy, easy, long |
| 13 | Race preparation | 34.5 | 34.5 | 16 | 1 | tempo, easy, long |
| 14 | Race preparation | 29.4 | 29.419 | 12 | 1 | tempo, easy, long |
| 15 | Taper | 20.3 | 20.321 | — | 1 | tempo, easy, easy |
| 16 | Race week | 6.2 | 6.23 | — | 1 | tempo, easy, race |

### half-20w-3d-q0

Input: 30 km/week, 16 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 0 | easy, easy, long |
| 2 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 3 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 4 | Recovery | 24.4 | 24.4 | 12 | 0 | easy, easy, long |
| 5 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 6 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 7 | Maintenance | 30 | 30 | 16 | 0 | easy, easy, long |
| 8 | Recovery | 24.4 | 24.4 | 12 | 0 | easy, easy, long |
| 9 | Build | 31.8 | 31.8 | 16 | 0 | easy, easy, long |
| 10 | Build | 33.7 | 33.7 | 16 | 0 | easy, easy, long |
| 11 | Build | 35.7 | 35.7 | 16 | 0 | easy, easy, long |
| 12 | Recovery | 28 | 28 | 11 | 0 | easy, easy, long |
| 13 | Build | 37.7 | 37.7 | 16 | 0 | easy, easy, long |
| 14 | Build | 39.7 | 39.7 | 16 | 0 | easy, easy, long |
| 15 | Build | 41.6 | 41.6 | 16 | 0 | easy, easy, long |
| 16 | Recovery | 28.6 | 28.6 | 11 | 0 | easy, easy, long |
| 17 | Race preparation | 41.6 | 41.6 | 16 | 0 | easy, easy, long |
| 18 | Race preparation | 35.6 | 35.6 | 12 | 0 | easy, easy, long |
| 19 | Taper | 25.4 | 25.4 | — | 0 | easy, easy, easy |
| 20 | Race week | 9.6 | 9.6 | — | 0 | easy, easy, race |

### half-20w-3d-q1

Input: 30 km/week, 16 km long, 3 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 30 | 30 | 16 | 1 | tempo, easy, long |
| 2 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 3 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 4 | Recovery | 24.4 | 24.4 | 12 | 0 | easy, easy, long |
| 5 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 6 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 7 | Maintenance | 30 | 30 | 16 | 1 | tempo, easy, long |
| 8 | Recovery | 24.4 | 24.4 | 12 | 0 | easy, easy, long |
| 9 | Build | 31.9 | 31.899 | 16 | 1 | tempo, easy, long |
| 10 | Build | 33.8 | 33.834 | 16 | 1 | tempo, easy, long |
| 11 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 12 | Recovery | 26 | 26 | 10 | 0 | easy, easy, long |
| 13 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 14 | Build | 33.9 | 33.9 | 16 | 1 | tempo, easy, long |
| 15 | Build | 34.5 | 34.5 | 16 | 1 | tempo, easy, long |
| 16 | Recovery | 27.8 | 27.8 | 11 | 0 | easy, easy, long |
| 17 | Race preparation | 34.5 | 34.5 | 16 | 1 | tempo, easy, long |
| 18 | Race preparation | 29.4 | 29.419 | 12 | 1 | tempo, easy, long |
| 19 | Taper | 20.3 | 20.321 | — | 1 | tempo, easy, easy |
| 20 | Race week | 6.2 | 6.23 | — | 1 | tempo, easy, race |

### half-8w-4d-q0

Input: 40 km/week, 16 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 2 | Foundation | 42.2 | 42.2 | 16 | 0 | easy, easy, easy, long |
| 3 | Race preparation | 44.6 | 44.6 | 16 | 0 | easy, easy, easy, long |
| 4 | Recovery | 34.5 | 34.45 | 11 | 0 | easy, easy, easy, long |
| 5 | Race preparation | 47 | 47 | 18 | 0 | easy, easy, easy, long |
| 6 | Race preparation | 44.7 | 44.7 | 14 | 0 | easy, easy, easy, long |
| 7 | Taper | 29.1 | 29.1 | — | 0 | easy, easy, easy, easy |
| 8 | Race week | 13 | 13 | — | 0 | easy, easy, easy, race |

### half-8w-4d-q1

Input: 40 km/week, 16 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 42.2 | 42.198 | 16 | 1 | easy, tempo, easy, long |
| 3 | Race preparation | 44.1 | 44.098 | 16 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 34.7 | 34.65 | 11 | 0 | easy, easy, easy, long |
| 5 | Race preparation | 46.6 | 46.598 | 18 | 1 | easy, tempo, easy, long |
| 6 | Race preparation | 40.7 | 40.682 | 14 | 1 | easy, tempo, easy, long |
| 7 | Taper | 28.4 | 28.421 | — | 1 | easy, tempo, easy, easy |
| 8 | Race week | 11.9 | 11.9 | — | 0 | easy, easy, easy, race |

### half-12w-4d-q0

Input: 40 km/week, 16 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 2 | Foundation | 42.2 | 42.2 | 16 | 0 | easy, easy, easy, long |
| 3 | Build | 44.6 | 44.6 | 16 | 0 | easy, easy, easy, long |
| 4 | Recovery | 34.5 | 34.45 | 11 | 0 | easy, easy, easy, long |
| 5 | Build | 47 | 47 | 16 | 0 | easy, easy, easy, long |
| 6 | Build | 48.6 | 48.6 | 16 | 0 | easy, easy, easy, long |
| 7 | Race preparation | 50.5 | 50.5 | 16 | 0 | easy, easy, easy, long |
| 8 | Recovery | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 53 | 53 | 18 | 0 | easy, easy, easy, long |
| 10 | Race preparation | 51.9 | 51.9 | 14 | 0 | easy, easy, easy, long |
| 11 | Taper | 33.9 | 33.9 | — | 0 | easy, easy, easy, easy |
| 12 | Race week | 14.9 | 14.9 | — | 0 | easy, easy, easy, race |

### half-12w-4d-q1

Input: 40 km/week, 16 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 42.2 | 42.198 | 16 | 1 | easy, tempo, easy, long |
| 3 | Build | 44.1 | 44.098 | 16 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 34.7 | 34.65 | 11 | 0 | easy, easy, easy, long |
| 5 | Build | 45.8 | 45.766 | 16 | 1 | easy, tempo, easy, long |
| 6 | Build | 46.2 | 46.2 | 16 | 1 | easy, tempo, easy, long |
| 7 | Race preparation | 46.9 | 46.9 | 16 | 1 | easy, tempo, easy, long |
| 8 | Recovery | 35.8 | 35.75 | 11 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 49.4 | 49.4 | 18 | 1 | easy, tempo, easy, long |
| 10 | Race preparation | 48.6 | 48.562 | 14 | 1 | easy, tempo, easy, long |
| 11 | Taper | 31.1 | 31.102 | — | 1 | easy, tempo, easy, easy |
| 12 | Race week | 12.5 | 12.468 | — | 1 | easy, tempo, easy, race |

### half-16w-4d-q0

Input: 40 km/week, 16 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 3 | Build | 42.2 | 42.2 | 16 | 0 | easy, easy, easy, long |
| 4 | Recovery | 33.2 | 33.15 | 11 | 0 | easy, easy, easy, long |
| 5 | Build | 44.6 | 44.6 | 16 | 0 | easy, easy, easy, long |
| 6 | Build | 47 | 47 | 16 | 0 | easy, easy, easy, long |
| 7 | Build | 48.6 | 48.6 | 16 | 0 | easy, easy, easy, long |
| 8 | Recovery | 38.8 | 38.8 | 12 | 0 | easy, easy, easy, long |
| 9 | Build | 50.5 | 50.5 | 16 | 0 | easy, easy, easy, long |
| 10 | Build | 52 | 52 | 16 | 0 | easy, easy, easy, long |
| 11 | Race preparation | 52 | 52 | 16 | 0 | easy, easy, easy, long |
| 12 | Recovery | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 13 | Race preparation | 54.5 | 54.5 | 18 | 0 | easy, easy, easy, long |
| 14 | Race preparation | 54.7 | 54.7 | 14 | 0 | easy, easy, easy, long |
| 15 | Taper | 35 | 35 | — | 0 | easy, easy, easy, easy |
| 16 | Race week | 15.1 | 15.1 | — | 0 | easy, easy, easy, race |

### half-16w-4d-q1

Input: 40 km/week, 16 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 3 | Build | 42.3 | 42.266 | 16 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 33.3 | 33.25 | 11 | 0 | easy, easy, easy, long |
| 5 | Build | 44.5 | 44.483 | 16 | 1 | easy, tempo, easy, long |
| 6 | Build | 45.3 | 45.342 | 16 | 1 | easy, tempo, easy, long |
| 7 | Build | 46.2 | 46.2 | 16 | 1 | easy, tempo, easy, long |
| 8 | Recovery | 35.8 | 35.75 | 11 | 0 | easy, easy, easy, long |
| 9 | Build | 46.2 | 46.2 | 16 | 1 | easy, tempo, easy, long |
| 10 | Build | 46.9 | 46.9 | 16 | 1 | easy, tempo, easy, long |
| 11 | Race preparation | 47.1 | 47.1 | 16 | 1 | easy, tempo, easy, long |
| 12 | Recovery | 35.8 | 35.75 | 11 | 0 | easy, easy, easy, long |
| 13 | Race preparation | 49.6 | 49.6 | 18 | 1 | easy, tempo, easy, long |
| 14 | Race preparation | 48.9 | 48.908 | 14 | 1 | easy, tempo, easy, long |
| 15 | Taper | 30.3 | 30.321 | — | 1 | easy, tempo, easy, easy |
| 16 | Race week | 12.3 | 12.32 | — | 1 | easy, tempo, easy, race |

### half-20w-4d-q0

Input: 40 km/week, 16 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 3 | Maintenance | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 4 | Recovery | 31.7 | 31.7 | 11 | 0 | easy, easy, easy, long |
| 5 | Maintenance | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 6 | Maintenance | 40 | 40 | 16 | 0 | easy, easy, easy, long |
| 7 | Build | 42.2 | 42.2 | 16 | 0 | easy, easy, easy, long |
| 8 | Recovery | 33.2 | 33.15 | 11 | 0 | easy, easy, easy, long |
| 9 | Build | 44.6 | 44.6 | 16 | 0 | easy, easy, easy, long |
| 10 | Build | 47 | 47 | 16 | 0 | easy, easy, easy, long |
| 11 | Build | 48.6 | 48.6 | 16 | 0 | easy, easy, easy, long |
| 12 | Recovery | 38.8 | 38.8 | 12 | 0 | easy, easy, easy, long |
| 13 | Build | 50.5 | 50.5 | 16 | 0 | easy, easy, easy, long |
| 14 | Build | 52 | 52 | 16 | 0 | easy, easy, easy, long |
| 15 | Race preparation | 52 | 52 | 16 | 0 | easy, easy, easy, long |
| 16 | Recovery | 39 | 39 | 12 | 0 | easy, easy, easy, long |
| 17 | Race preparation | 54.5 | 54.5 | 18 | 0 | easy, easy, easy, long |
| 18 | Race preparation | 54.7 | 54.7 | 14 | 0 | easy, easy, easy, long |
| 19 | Taper | 35 | 35 | — | 0 | easy, easy, easy, easy |
| 20 | Race week | 15.1 | 15.1 | — | 0 | easy, easy, easy, race |

### half-20w-4d-q1

Input: 40 km/week, 16 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 3 | Maintenance | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 31.6 | 31.6 | 11 | 0 | easy, easy, easy, long |
| 5 | Maintenance | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 6 | Maintenance | 40 | 40 | 16 | 1 | easy, tempo, easy, long |
| 7 | Build | 42.3 | 42.266 | 16 | 1 | easy, tempo, easy, long |
| 8 | Recovery | 33.3 | 33.25 | 11 | 0 | easy, easy, easy, long |
| 9 | Build | 44.5 | 44.483 | 16 | 1 | easy, tempo, easy, long |
| 10 | Build | 45.3 | 45.342 | 16 | 1 | easy, tempo, easy, long |
| 11 | Build | 46.2 | 46.2 | 16 | 1 | easy, tempo, easy, long |
| 12 | Recovery | 35.8 | 35.75 | 11 | 0 | easy, easy, easy, long |
| 13 | Build | 46.2 | 46.2 | 16 | 1 | easy, tempo, easy, long |
| 14 | Build | 46.9 | 46.9 | 16 | 1 | easy, tempo, easy, long |
| 15 | Race preparation | 47.1 | 47.1 | 16 | 1 | easy, tempo, easy, long |
| 16 | Recovery | 35.8 | 35.75 | 11 | 0 | easy, easy, easy, long |
| 17 | Race preparation | 49.6 | 49.6 | 18 | 1 | easy, tempo, easy, long |
| 18 | Race preparation | 48.9 | 48.908 | 14 | 1 | easy, tempo, easy, long |
| 19 | Taper | 30.3 | 30.321 | — | 1 | easy, tempo, easy, easy |
| 20 | Race week | 12.3 | 12.32 | — | 1 | easy, tempo, easy, race |

### half-8w-5d-q0

Input: 50 km/week, 16 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 52.2 | 52.2 | 16 | 0 | easy, easy, easy, easy, long |
| 3 | Race preparation | 54.6 | 54.6 | 16 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 40.6 | 40.55 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 57.1 | 57.1 | 18 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 54.9 | 54.9 | 14 | 0 | easy, easy, easy, easy, long |
| 7 | Taper | 37 | 37 | — | 0 | easy, easy, easy, easy, easy |
| 8 | Race week | 17.1 | 17.1 | — | 0 | easy, easy, easy, easy, race |

### half-8w-5d-q1

Input: 50 km/week, 16 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 52.1 | 52.087 | 16 | 1 | easy, tempo, easy, easy, long |
| 3 | Race preparation | 53.5 | 53.499 | 16 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 40 | 40 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 56 | 55.999 | 18 | 1 | easy, tempo, easy, easy, long |
| 6 | Race preparation | 50.8 | 50.774 | 14 | 1 | easy, tempo, easy, easy, long |
| 7 | Taper | 35.8 | 35.821 | — | 1 | easy, tempo, easy, easy, easy |
| 8 | Race week | 16.2 | 16.2 | — | 0 | easy, easy, easy, easy, race |

### half-8w-5d-q2

Input: 50 km/week, 16 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 2 | Foundation | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 3 | Race preparation | 51.6 | 51.592 | 16 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 40.1 | 40.1 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 54.1 | 54.092 | 18 | 2 | easy, tempo, easy, tempo, long |
| 6 | Race preparation | 47.6 | 47.595 | 14 | 2 | easy, tempo, easy, tempo, long |
| 7 | Taper | 31.5 | 31.457 | — | 2 | easy, tempo, easy, tempo, easy |
| 8 | Race week | 16.5 | 16.5 | — | 0 | easy, easy, easy, easy, race |

### half-12w-5d-q0

Input: 50 km/week, 16 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 52.2 | 52.2 | 16 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 54.6 | 54.6 | 16 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 40.6 | 40.55 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 57.1 | 57.1 | 16 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 58.1 | 58.1 | 16 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 58.8 | 58.8 | 16 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 61.3 | 61.3 | 18 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 62.1 | 62.1 | 14 | 0 | easy, easy, easy, easy, long |
| 11 | Taper | 40.2 | 40.2 | — | 0 | easy, easy, easy, easy, easy |
| 12 | Race week | 18.1 | 18.1 | — | 0 | easy, easy, easy, easy, race |

### half-12w-5d-q1

Input: 50 km/week, 16 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 52.1 | 52.087 | 16 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 53.5 | 53.499 | 16 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 40 | 40 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 55.3 | 55.305 | 16 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 55.9 | 55.877 | 16 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 57 | 56.992 | 16 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 41.3 | 41.25 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 59.5 | 59.492 | 18 | 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation | 58.8 | 58.793 | 14 | 1 | easy, tempo, easy, easy, long |
| 11 | Taper | 38.9 | 38.902 | — | 1 | easy, tempo, easy, easy, easy |
| 12 | Race week | 16.7 | 16.715 | — | 1 | easy, tempo, easy, easy, race |

### half-12w-5d-q2

Input: 50 km/week, 16 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 2 | Foundation | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 3 | Build | 51.6 | 51.592 | 16 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 40.1 | 40.1 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 51.9 | 51.9 | 16 | 2 | easy, tempo, easy, tempo, long |
| 6 | Build | 52.6 | 52.6 | 16 | 2 | easy, tempo, easy, tempo, long |
| 7 | Race preparation | 52.7 | 52.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 41.3 | 41.25 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 55.2 | 55.2 | 18 | 2 | easy, tempo, easy, tempo, long |
| 10 | Race preparation | 55.8 | 55.814 | 14 | 2 | easy, tempo, easy, tempo, long |
| 11 | Taper | 33.5 | 33.521 | — | 2 | easy, tempo, easy, tempo, easy |
| 12 | Race week | 16.1 | 16.1 | — | 0 | easy, easy, easy, easy, race |

### half-16w-5d-q0

Input: 50 km/week, 16 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 52.2 | 52.2 | 16 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 40.2 | 40.15 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 54.6 | 54.6 | 16 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 57.1 | 57.1 | 16 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 58.1 | 58.1 | 16 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 44.6 | 44.6 | 12 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 58.8 | 58.8 | 16 | 0 | easy, easy, easy, easy, long |
| 10 | Build | 59.3 | 59.3 | 16 | 0 | easy, easy, easy, easy, long |
| 11 | Race preparation | 60 | 60 | 16 | 0 | easy, easy, easy, easy, long |
| 12 | Recovery | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 62.5 | 62.5 | 18 | 0 | easy, easy, easy, easy, long |
| 14 | Race preparation | 66.8 | 66.8 | 14 | 0 | easy, easy, easy, easy, long |
| 15 | Taper | 41.2 | 41.2 | — | 0 | easy, easy, easy, easy, easy |
| 16 | Race week | 18.1 | 18.1 | — | 0 | easy, easy, easy, easy, race |

### half-16w-5d-q1

Input: 50 km/week, 16 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 52.1 | 52.126 | 16 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 39.1 | 39.1 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 53.6 | 53.608 | 16 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 54.8 | 54.824 | 16 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 56.1 | 56.077 | 16 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 41 | 41 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 56.6 | 56.569 | 16 | 1 | easy, tempo, easy, easy, long |
| 10 | Build | 57.3 | 57.3 | 16 | 1 | easy, tempo, easy, easy, long |
| 11 | Race preparation | 57.5 | 57.5 | 16 | 1 | easy, tempo, easy, easy, long |
| 12 | Recovery | 41.3 | 41.25 | 11 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 60 | 60 | 18 | 1 | easy, tempo, easy, easy, long |
| 14 | Race preparation | 62.9 | 62.871 | 14 | 1 | easy, tempo, easy, easy, long |
| 15 | Taper | 38.4 | 38.421 | — | 1 | easy, tempo, easy, easy, easy |
| 16 | Race week | 16.6 | 16.567 | — | 1 | easy, tempo, easy, easy, race |

### half-16w-5d-q2

Input: 50 km/week, 16 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 2 | Maintenance | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 3 | Build | 50 | 50 | 16 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 39.4 | 39.4 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 50.9 | 50.93 | 16 | 2 | easy, tempo, easy, tempo, long |
| 6 | Build | 51.9 | 51.9 | 16 | 2 | easy, tempo, easy, tempo, long |
| 7 | Build | 51.9 | 51.9 | 16 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 40.8 | 40.8 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 52.6 | 52.6 | 16 | 2 | easy, tempo, easy, tempo, long |
| 10 | Build | 52.7 | 52.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 11 | Race preparation | 53.8 | 53.8 | 16 | 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery | 41.3 | 41.25 | 11 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 56.3 | 56.3 | 18 | 2 | easy, tempo, easy, tempo, long |
| 14 | Race preparation | 58.2 | 58.239 | 14 | 2 | easy, tempo, easy, tempo, long |
| 15 | Taper | 35.5 | 35.533 | — | 2 | easy, tempo, easy, tempo, easy |
| 16 | Race week | 16.7 | 16.706 | — | 1 | easy, tempo, easy, easy, race |

### half-20w-5d-q0

Input: 50 km/week, 16 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 40.6 | 40.6 | 12 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 50 | 50 | 16 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 52.2 | 52.2 | 16 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 40.2 | 40.15 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 54.6 | 54.6 | 16 | 0 | easy, easy, easy, easy, long |
| 10 | Build | 57.1 | 57.1 | 16 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 58.1 | 58.1 | 16 | 0 | easy, easy, easy, easy, long |
| 12 | Recovery | 44.6 | 44.6 | 12 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 58.8 | 58.8 | 16 | 0 | easy, easy, easy, easy, long |
| 14 | Build | 59.3 | 59.3 | 16 | 0 | easy, easy, easy, easy, long |
| 15 | Race preparation | 60 | 60 | 16 | 0 | easy, easy, easy, easy, long |
| 16 | Recovery | 45 | 45 | 12 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 62.5 | 62.5 | 18 | 0 | easy, easy, easy, easy, long |
| 18 | Race preparation | 66.8 | 66.8 | 14 | 0 | easy, easy, easy, easy, long |
| 19 | Taper | 41.2 | 41.2 | — | 0 | easy, easy, easy, easy, easy |
| 20 | Race week | 18.1 | 18.1 | — | 0 | easy, easy, easy, easy, race |

### half-20w-5d-q1

Input: 50 km/week, 16 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 38.2 | 38.2 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 6 | Maintenance | 50 | 50 | 16 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 52.1 | 52.126 | 16 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 39.1 | 39.1 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 53.6 | 53.608 | 16 | 1 | easy, tempo, easy, easy, long |
| 10 | Build | 54.8 | 54.824 | 16 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 56.1 | 56.077 | 16 | 1 | easy, tempo, easy, easy, long |
| 12 | Recovery | 41 | 41 | 11 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 56.6 | 56.569 | 16 | 1 | easy, tempo, easy, easy, long |
| 14 | Build | 57.3 | 57.3 | 16 | 1 | easy, tempo, easy, easy, long |
| 15 | Race preparation | 57.5 | 57.5 | 16 | 1 | easy, tempo, easy, easy, long |
| 16 | Recovery | 41.3 | 41.25 | 11 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 60 | 60 | 18 | 1 | easy, tempo, easy, easy, long |
| 18 | Race preparation | 62.9 | 62.871 | 14 | 1 | easy, tempo, easy, easy, long |
| 19 | Taper | 38.4 | 38.421 | — | 1 | easy, tempo, easy, easy, easy |
| 20 | Race week | 16.6 | 16.567 | — | 1 | easy, tempo, easy, easy, race |

### half-20w-5d-q2

Input: 50 km/week, 16 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 49.7 | 49.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 2 | Maintenance | 49.7 | 49.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 3 | Maintenance | 49.7 | 49.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 38.5 | 38.45 | 11 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 49.7 | 49.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 6 | Maintenance | 49.7 | 49.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 7 | Build | 50 | 50.001 | 16 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 39.4 | 39.4 | 11 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 50.6 | 50.6 | 16 | 2 | easy, tempo, easy, tempo, long |
| 10 | Build | 51.9 | 51.9 | 16 | 2 | easy, tempo, easy, tempo, long |
| 11 | Build | 51.9 | 51.9 | 16 | 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery | 40.8 | 40.8 | 11 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 52.6 | 52.6 | 16 | 2 | easy, tempo, easy, tempo, long |
| 14 | Build | 52.7 | 52.7 | 16 | 2 | easy, tempo, easy, tempo, long |
| 15 | Race preparation | 53.8 | 53.8 | 16 | 2 | easy, tempo, easy, tempo, long |
| 16 | Recovery | 41.3 | 41.25 | 11 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 56.3 | 56.3 | 18 | 2 | easy, tempo, easy, tempo, long |
| 18 | Race preparation | 58.2 | 58.239 | 14 | 2 | easy, tempo, easy, tempo, long |
| 19 | Taper | 35.5 | 35.533 | — | 2 | easy, tempo, easy, tempo, easy |
| 20 | Race week | 16.7 | 16.706 | — | 1 | easy, tempo, easy, easy, race |

### half-8w-6d-q0

Input: 60 km/week, 16 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 60.1 | 60.1 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Race preparation | 62.5 | 62.504 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 50.6 | 50.6 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 65 | 65.004 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 64.8 | 64.8 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Taper | 41.7 | 41.7 | — | 0 | easy, easy, easy, easy, easy, easy |
| 8 | Race week | 20.5 | 20.5 | — | 0 | easy, easy, easy, easy, easy, race |

### half-8w-6d-q1

Input: 60 km/week, 16 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Race preparation | 62.4 | 62.4 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 50.3 | 50.35 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 64.9 | 64.896 | 20 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Race preparation | 60.7 | 60.654 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Taper | 37.9 | 37.933 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 8 | Race week | 18.3 | 18.3 | — | 0 | easy, easy, easy, easy, easy, race |

### half-8w-6d-q2

Input: 60 km/week, 16 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Race preparation | 62.4 | 62.4 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 50 | 50 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 64.9 | 64.896 | 20 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Race preparation | 58.9 | 58.927 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Taper | 37.8 | 37.767 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 8 | Race week | 18.4 | 18.4 | — | 0 | easy, easy, easy, easy, easy, race |

### half-12w-6d-q0

Input: 60 km/week, 16 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 60.1 | 60.1 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 62 | 62 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 49.4 | 49.4 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 64.5 | 64.48 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 67.1 | 67.059 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 69.7 | 69.7 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 53.5 | 53.5 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 72.5 | 72.488 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 72.9 | 72.9 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Taper | 47.7 | 47.7 | — | 0 | easy, easy, easy, easy, easy, easy |
| 12 | Race week | 21.7 | 21.7 | — | 0 | easy, easy, easy, easy, easy, race |

### half-12w-6d-q1

Input: 60 km/week, 16 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 61.4 | 61.376 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 45.3 | 45.25 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 63.8 | 63.831 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 66.4 | 66.384 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 68.8 | 68.825 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 52.6 | 52.55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 71.6 | 71.578 | 20 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race preparation | 68.4 | 68.395 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Taper | 44.8 | 44.837 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 12 | Race week | 19.8 | 19.758 | — | 1 | easy, tempo, easy, easy, easy, race |

### half-12w-6d-q2

Input: 60 km/week, 16 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 60.8 | 60.824 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 45.1 | 45.05 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 63.3 | 63.256 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build | 65.8 | 65.786 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Race preparation | 68 | 67.975 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 52.4 | 52.35 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 70.7 | 70.694 | 20 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Race preparation | 65 | 65.009 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Taper | 42.3 | 42.27 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 12 | Race week | 19.8 | 19.8 | — | 0 | easy, easy, easy, easy, easy, race |

### half-16w-6d-q0

Input: 60 km/week, 16 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 60.1 | 60.1 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 45.5 | 45.5 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 62 | 62 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 63.9 | 63.9 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 66.5 | 66.456 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 53.4 | 53.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 69.1 | 69.114 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 71.9 | 71.878 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Race preparation | 73.2 | 73.2 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Recovery | 57.8 | 57.8 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 75.3 | 75.3 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Race preparation | 74.9 | 74.9 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Taper | 50.3 | 50.3 | — | 0 | easy, easy, easy, easy, easy, easy |
| 16 | Race week | 22 | 22 | — | 0 | easy, easy, easy, easy, easy, race |

### half-16w-6d-q1

Input: 60 km/week, 16 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 44.9 | 44.85 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 61.7 | 61.654 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 62.8 | 62.79 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 65.3 | 65.301 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 51.8 | 51.75 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 67.9 | 67.913 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Build | 70.2 | 70.21 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Race preparation | 70.8 | 70.824 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Recovery | 54 | 53.95 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 73.7 | 73.656 | 20 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Race preparation | 70.6 | 70.607 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Taper | 46.7 | 46.728 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 16 | Race week | 20.2 | 20.199 | — | 1 | easy, tempo, easy, easy, easy, race |

### half-16w-6d-q2

Input: 60 km/week, 16 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Maintenance | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 44.5 | 44.45 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 60.5 | 60.547 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build | 62.2 | 62.157 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build | 64.6 | 64.643 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 51.6 | 51.55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 67.2 | 67.228 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Build | 69.5 | 69.454 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Race preparation | 71.3 | 71.307 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Recovery | 53.6 | 53.55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 74.2 | 74.159 | 20 | 2 | easy, tempo, easy, tempo, easy, long |
| 14 | Race preparation | 67.1 | 67.083 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Taper | 45.2 | 45.208 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 16 | Race week | 20.6 | 20.552 | — | 1 | easy, tempo, easy, easy, easy, race |

### half-20w-6d-q0

Input: 60 km/week, 16 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 48.7 | 48.7 | 12 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Maintenance | 60 | 60 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 60.1 | 60.1 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 45.5 | 45.5 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 62.5 | 62.504 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 65 | 65.004 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 67.6 | 67.604 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Recovery | 53.4 | 53.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 69.7 | 69.7 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Build | 71.9 | 71.9 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Race preparation | 73.2 | 73.2 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Recovery | 57.8 | 57.8 | 14 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 75.3 | 75.3 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 18 | Race preparation | 74.9 | 74.9 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 19 | Taper | 50.3 | 50.3 | — | 0 | easy, easy, easy, easy, easy, easy |
| 20 | Race week | 22 | 22 | — | 0 | easy, easy, easy, easy, easy, race |

### half-20w-6d-q1

Input: 60 km/week, 16 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 44.1 | 44.05 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Maintenance | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 60 | 60 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 44.9 | 44.85 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 62.4 | 62.4 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Build | 64.9 | 64.896 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 66.9 | 66.888 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Recovery | 51.8 | 51.75 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 68.7 | 68.686 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Build | 70.2 | 70.21 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Race preparation | 70.8 | 70.824 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Recovery | 54 | 53.95 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 73.7 | 73.656 | 20 | 1 | easy, tempo, easy, easy, easy, long |
| 18 | Race preparation | 70.6 | 70.607 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 19 | Taper | 46.7 | 46.728 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 20 | Race week | 20.2 | 20.199 | — | 1 | easy, tempo, easy, easy, easy, race |

### half-20w-6d-q2

Input: 60 km/week, 16 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Maintenance | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Maintenance | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 43.7 | 43.65 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Maintenance | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build | 60 | 60 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 44.5 | 44.45 | 11 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 62.4 | 62.4 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Build | 64.4 | 64.4 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Build | 65.9 | 65.921 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Recovery | 51.6 | 51.55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 67.9 | 67.926 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 14 | Build | 69.5 | 69.454 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Race preparation | 71.3 | 71.307 | 18 | 2 | easy, tempo, easy, tempo, easy, long |
| 16 | Recovery | 53.6 | 53.55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 74.2 | 74.159 | 20 | 2 | easy, tempo, easy, tempo, easy, long |
| 18 | Race preparation | 67.1 | 67.083 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 19 | Taper | 45.2 | 45.208 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 20 | Race week | 20.6 | 20.552 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-8w-4d-q0

Input: 52 km/week, 23 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 2 | Build | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 3 | Build | 54.6 | 54.6 | 24 | 0 | easy, easy, easy, long |
| 4 | Recovery | 37.2 | 37.2 | 16 | 0 | easy, easy, easy, long |
| 5 | Race preparation | 54.6 | 54.6 | 24 | 0 | easy, easy, easy, long |
| 6 | Race preparation | 54.6 | 54.6 | 24 | 0 | easy, easy, easy, long |
| 7 | Taper | 32.7 | 32.7 | 14 | 0 | easy, easy, easy, long |
| 8 | Race week | 21.3 | 21.3 | — | 0 | easy, easy, easy, race |

### marathon-8w-4d-q1

Input: 52 km/week, 23 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 2 | Build | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 3 | Build | 54.7 | 54.743 | 24 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 35.8 | 35.8 | 15 | 0 | easy, easy, easy, long |
| 5 | Race preparation | 54.7 | 54.743 | 24 | 1 | easy, tempo, easy, long |
| 6 | Race preparation | 54.7 | 54.743 | 24 | 1 | easy, tempo, easy, long |
| 7 | Taper | 32.6 | 32.636 | 14 | 1 | easy, tempo, easy, long |
| 8 | Race week | 21.5 | 21.542 | — | 1 | easy, tempo, easy, race |

### marathon-12w-4d-q0

Input: 52 km/week, 23 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 2 | Foundation | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 3 | Foundation | 54.6 | 54.6 | 24 | 0 | easy, easy, easy, long |
| 4 | Recovery | 37.2 | 37.2 | 16 | 0 | easy, easy, easy, long |
| 5 | Build | 56.7 | 56.7 | 25 | 0 | easy, easy, easy, long |
| 6 | Build | 56.7 | 56.7 | 25 | 0 | easy, easy, easy, long |
| 7 | Build | 60.8 | 60.8 | 27 | 0 | easy, easy, easy, long |
| 8 | Recovery | 42.3 | 42.3 | 19 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 60.8 | 60.8 | 27 | 0 | easy, easy, easy, long |
| 10 | Race preparation | 60.8 | 60.8 | 27 | 0 | easy, easy, easy, long |
| 11 | Taper | 36.3 | 36.3 | 16 | 0 | easy, easy, easy, long |
| 12 | Race week | 24.2 | 24.2 | — | 0 | easy, easy, easy, race |

### marathon-12w-4d-q1

Input: 52 km/week, 23 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 3 | Foundation | 54.7 | 54.743 | 24 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 37.4 | 37.4 | 16 | 0 | easy, easy, easy, long |
| 5 | Build | 56.7 | 56.719 | 25 | 1 | easy, tempo, easy, long |
| 6 | Build | 56.7 | 56.719 | 25 | 1 | easy, tempo, easy, long |
| 7 | Build | 59.9 | 59.864 | 26 | 1 | easy, tempo, easy, long |
| 8 | Recovery | 40.8 | 40.8 | 18 | 0 | easy, easy, easy, long |
| 9 | Race preparation | 59.9 | 59.864 | 26 | 1 | easy, tempo, easy, long |
| 10 | Race preparation | 59.9 | 59.864 | 26 | 1 | easy, tempo, easy, long |
| 11 | Taper | 34.8 | 34.84 | 15 | 1 | easy, tempo, easy, long |
| 12 | Race week | 23.5 | 23.488 | — | 1 | easy, tempo, easy, race |

### marathon-16w-4d-q0

Input: 52 km/week, 23 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 2 | Foundation | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 3 | Foundation | 54.6 | 54.6 | 24 | 0 | easy, easy, easy, long |
| 4 | Recovery | 37.2 | 37.2 | 16 | 0 | easy, easy, easy, long |
| 5 | Build | 56.7 | 56.7 | 25 | 0 | easy, easy, easy, long |
| 6 | Build | 56.7 | 56.7 | 25 | 0 | easy, easy, easy, long |
| 7 | Build | 60.8 | 60.8 | 27 | 0 | easy, easy, easy, long |
| 8 | Recovery | 42.3 | 42.3 | 19 | 0 | easy, easy, easy, long |
| 9 | Build | 63.6 | 63.6 | 28 | 0 | easy, easy, easy, long |
| 10 | Race preparation | 63.6 | 63.6 | 28 | 0 | easy, easy, easy, long |
| 11 | Race preparation | 63.6 | 63.6 | 28 | 0 | easy, easy, easy, long |
| 12 | Recovery | 43.5 | 43.5 | 19 | 0 | easy, easy, easy, long |
| 13 | Race preparation | 63.6 | 63.6 | 28 | 0 | easy, easy, easy, long |
| 14 | Taper | 46.4 | 46.4 | 20 | 0 | easy, easy, easy, long |
| 15 | Taper | 36.8 | 36.8 | 16 | 0 | easy, easy, easy, long |
| 16 | Race week | 25 | 25 | — | 0 | easy, easy, easy, race |

### marathon-16w-4d-q1

Input: 52 km/week, 23 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 2 | Foundation | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 3 | Foundation | 54.7 | 54.743 | 24 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 37.4 | 37.4 | 16 | 0 | easy, easy, easy, long |
| 5 | Build | 56.7 | 56.719 | 25 | 1 | easy, tempo, easy, long |
| 6 | Build | 56.7 | 56.719 | 25 | 1 | easy, tempo, easy, long |
| 7 | Build | 60.9 | 60.864 | 27 | 1 | easy, tempo, easy, long |
| 8 | Recovery | 42.4 | 42.4 | 19 | 0 | easy, easy, easy, long |
| 9 | Build | 62.7 | 62.708 | 27 | 1 | easy, tempo, easy, long |
| 10 | Race preparation | 62.7 | 62.708 | 27 | 1 | easy, tempo, easy, long |
| 11 | Race preparation | 62.7 | 62.708 | 27 | 1 | easy, tempo, easy, long |
| 12 | Recovery | 42.1 | 42.1 | 18 | 0 | easy, easy, easy, long |
| 13 | Race preparation | 62.7 | 62.708 | 27 | 1 | easy, tempo, easy, long |
| 14 | Taper | 46.1 | 46.109 | 20 | 1 | easy, tempo, easy, long |
| 15 | Taper | 36.7 | 36.727 | 16 | 1 | easy, tempo, easy, long |
| 16 | Race week | 24.7 | 24.7 | — | 1 | easy, tempo, easy, race |

### marathon-20w-4d-q0

Input: 52 km/week, 23 km long, 4 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 2 | Maintenance | 52 | 52 | 23 | 0 | easy, easy, easy, long |
| 3 | Foundation | 54.6 | 54.6 | 23 | 0 | easy, easy, easy, long |
| 4 | Recovery | 37.2 | 37.2 | 16 | 0 | easy, easy, easy, long |
| 5 | Foundation | 57.7 | 57.7 | 23 | 0 | easy, easy, easy, long |
| 6 | Foundation | 57.7 | 57.7 | 25 | 0 | easy, easy, easy, long |
| 7 | Foundation | 60.8 | 60.8 | 25 | 0 | easy, easy, easy, long |
| 8 | Recovery | 42.3 | 42.3 | 19 | 0 | easy, easy, easy, long |
| 9 | Build | 63.6 | 63.6 | 27 | 0 | easy, easy, easy, long |
| 10 | Build | 63.6 | 63.6 | 28 | 0 | easy, easy, easy, long |
| 11 | Build | 66.6 | 66.6 | 28 | 0 | easy, easy, easy, long |
| 12 | Recovery | 45.7 | 45.7 | 20 | 0 | easy, easy, easy, long |
| 13 | Build | 69.8 | 69.8 | 30 | 0 | easy, easy, easy, long |
| 14 | Race preparation | 70 | 69.954 | 31 | 0 | easy, easy, easy, long |
| 15 | Race preparation | 70 | 69.954 | 31 | 0 | easy, easy, easy, long |
| 16 | Recovery | 47.6 | 47.6 | 21 | 0 | easy, easy, easy, long |
| 17 | Race preparation | 70 | 69.954 | 31 | 0 | easy, easy, easy, long |
| 18 | Taper | 52.2 | 52.2 | 23 | 0 | easy, easy, easy, long |
| 19 | Taper | 41.6 | 41.6 | 18 | 0 | easy, easy, easy, long |
| 20 | Race week | 27.8 | 27.8 | — | 0 | easy, easy, easy, race |

### marathon-20w-4d-q1

Input: 52 km/week, 23 km long, 4 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 2 | Maintenance | 52 | 52 | 23 | 1 | easy, tempo, easy, long |
| 3 | Foundation | 54.7 | 54.71 | 23 | 1 | easy, tempo, easy, long |
| 4 | Recovery | 37.4 | 37.4 | 16 | 0 | easy, easy, easy, long |
| 5 | Foundation | 57.8 | 57.76 | 23 | 1 | easy, tempo, easy, long |
| 6 | Foundation | 57.8 | 57.825 | 25 | 1 | easy, tempo, easy, long |
| 7 | Foundation | 60.9 | 60.938 | 25 | 1 | easy, tempo, easy, long |
| 8 | Recovery | 40.9 | 40.9 | 18 | 0 | easy, easy, easy, long |
| 9 | Build | 63.7 | 63.676 | 27 | 1 | easy, tempo, easy, long |
| 10 | Build | 63.7 | 63.708 | 28 | 1 | easy, tempo, easy, long |
| 11 | Build | 66.8 | 66.758 | 28 | 1 | easy, tempo, easy, long |
| 12 | Recovery | 45.6 | 45.6 | 20 | 0 | easy, easy, easy, long |
| 13 | Build | 69.9 | 69.864 | 30 | 1 | easy, tempo, easy, long |
| 14 | Race preparation | 70 | 69.954 | 31 | 1 | easy, tempo, easy, long |
| 15 | Race preparation | 70 | 69.954 | 31 | 1 | easy, tempo, easy, long |
| 16 | Recovery | 46.3 | 46.3 | 20 | 0 | easy, easy, easy, long |
| 17 | Race preparation | 70 | 69.954 | 31 | 1 | easy, tempo, easy, long |
| 18 | Taper | 52.3 | 52.269 | 23 | 1 | easy, tempo, easy, long |
| 19 | Taper | 41.7 | 41.733 | 18 | 1 | easy, tempo, easy, long |
| 20 | Race week | 27.8 | 27.83 | — | 1 | easy, tempo, easy, race |

### marathon-8w-5d-q0

Input: 65 km/week, 23 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 65 | 65 | 23 | 0 | easy, easy, easy, easy, long |
| 2 | Build | 65 | 65 | 25 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 67.6 | 67.6 | 27 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 46.4 | 46.4 | 20 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 67.6 | 67.6 | 29 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 67.6 | 67.6 | 30 | 0 | easy, easy, easy, easy, long |
| 7 | Taper | 40.4 | 40.4 | 18 | 0 | easy, easy, easy, easy, long |
| 8 | Race week | 26.8 | 26.8 | — | 0 | easy, easy, easy, easy, race |

### marathon-8w-5d-q1

Input: 65 km/week, 23 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 65 | 65 | 23 | 1 | easy, tempo, easy, easy, long |
| 2 | Build | 65 | 65 | 25 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 67.7 | 67.651 | 27 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 44.8 | 44.8 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 67.7 | 67.669 | 29 | 1 | easy, tempo, easy, easy, long |
| 6 | Race preparation | 67.8 | 67.778 | 30 | 1 | easy, tempo, easy, easy, long |
| 7 | Taper | 40.5 | 40.498 | 18 | 1 | easy, tempo, easy, easy, long |
| 8 | Race week | 25.6 | 25.558 | — | 1 | easy, tempo, easy, easy, race |

### marathon-8w-5d-q2

Input: 65 km/week, 23 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 65 | 65 | 23 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Build | 65 | 65 | 25 | 2 | easy, tempo, easy, intervals, long |
| 3 | Build | 67.7 | 67.719 | 27 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 46.3 | 46.3 | 20 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 67.8 | 67.798 | 29 | 2 | easy, tempo, easy, intervals, long |
| 6 | Race preparation | 67.9 | 67.867 | 30 | 2 | easy, tempo, easy, intervals, long |
| 7 | Taper | 40.6 | 40.559 | 18 | 1 | easy, intervals, easy, easy, long |
| 8 | Race week | 26.9 | 26.942 | — | 1 | easy, tempo, easy, easy, race |

### marathon-12w-5d-q0

Input: 65 km/week, 23 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 65 | 65 | 23 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 65 | 65 | 25 | 0 | easy, easy, easy, easy, long |
| 3 | Foundation | 67.6 | 67.6 | 27 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 46.4 | 46.4 | 20 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 70.7 | 70.7 | 29 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 70.9 | 70.889 | 31 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 73.7 | 73.7 | 33 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 51.3 | 51.3 | 23 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 73.7 | 73.7 | 33 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 73.7 | 73.7 | 33 | 0 | easy, easy, easy, easy, long |
| 11 | Taper | 44.1 | 44.1 | 19 | 0 | easy, easy, easy, easy, long |
| 12 | Race week | 28.8 | 28.8 | — | 0 | easy, easy, easy, easy, race |

### marathon-12w-5d-q1

Input: 65 km/week, 23 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 65 | 65 | 23 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 65 | 65 | 25 | 1 | easy, tempo, easy, easy, long |
| 3 | Foundation | 67.7 | 67.651 | 27 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 46.4 | 46.4 | 20 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 70.7 | 70.743 | 29 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 70.9 | 70.89 | 31 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 71.8 | 71.751 | 31 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 48.3 | 48.3 | 21 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 71.8 | 71.751 | 31 | 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation | 72.8 | 72.751 | 32 | 1 | easy, tempo, easy, easy, long |
| 11 | Taper | 42.2 | 42.24 | 18 | 1 | easy, tempo, easy, easy, long |
| 12 | Race week | 27.8 | 27.762 | — | 1 | easy, tempo, easy, easy, race |

### marathon-12w-5d-q2

Input: 65 km/week, 23 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 65 | 65 | 23 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation | 65 | 65 | 25 | 2 | easy, tempo, easy, intervals, long |
| 3 | Foundation | 67.7 | 67.719 | 27 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 46.3 | 46.3 | 20 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 70.9 | 70.885 | 29 | 2 | easy, tempo, easy, intervals, long |
| 6 | Build | 70.9 | 70.889 | 31 | 2 | easy, tempo, easy, intervals, long |
| 7 | Build | 72.9 | 72.857 | 32 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 49.8 | 49.8 | 22 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 72.9 | 72.857 | 32 | 2 | easy, tempo, easy, intervals, long |
| 10 | Race preparation | 72.9 | 72.857 | 32 | 2 | easy, tempo, easy, fartlek, long |
| 11 | Taper | 42.3 | 42.313 | 18 | 1 | easy, fartlek, easy, easy, long |
| 12 | Race week | 28.9 | 28.933 | — | 1 | easy, tempo, easy, easy, race |

### marathon-16w-5d-q0

Input: 65 km/week, 23 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 65 | 65 | 23 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 65 | 65 | 23 | 0 | easy, easy, easy, easy, long |
| 3 | Foundation | 67.7 | 67.7 | 25 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 46.4 | 46.4 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 70.6 | 70.6 | 27 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 70.6 | 70.6 | 27 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 73.7 | 73.7 | 28 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 51.4 | 51.4 | 22 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 76.5 | 76.5 | 30 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 76.9 | 76.866 | 31 | 0 | easy, easy, easy, easy, long |
| 11 | Race preparation | 76.9 | 76.866 | 33 | 0 | easy, easy, easy, easy, long |
| 12 | Recovery | 53.5 | 53.5 | 24 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 76.9 | 76.866 | 34 | 0 | easy, easy, easy, easy, long |
| 14 | Taper | 57.4 | 57.4 | 25 | 0 | easy, easy, easy, easy, long |
| 15 | Taper | 44.3 | 44.3 | 19 | 0 | easy, easy, easy, easy, long |
| 16 | Race week | 30.6 | 30.6 | — | 0 | easy, easy, easy, easy, race |

### marathon-16w-5d-q1

Input: 65 km/week, 23 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 65 | 65 | 23 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 65 | 65 | 23 | 1 | easy, tempo, easy, easy, long |
| 3 | Foundation | 67.7 | 67.734 | 25 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 46.3 | 46.3 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 70.7 | 70.725 | 27 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 70.7 | 70.725 | 27 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 73.8 | 73.808 | 28 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 51.4 | 51.4 | 22 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 76.7 | 76.699 | 30 | 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation | 76.9 | 76.866 | 31 | 1 | easy, tempo, easy, easy, long |
| 11 | Race preparation | 76.9 | 76.866 | 33 | 1 | easy, tempo, easy, easy, long |
| 12 | Recovery | 52 | 52 | 23 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 76.9 | 76.866 | 33 | 1 | easy, tempo, easy, easy, long |
| 14 | Taper | 54.9 | 54.897 | 24 | 1 | easy, tempo, easy, easy, long |
| 15 | Taper | 44.4 | 44.427 | 19 | 1 | easy, tempo, easy, easy, long |
| 16 | Race week | 29.6 | 29.614 | — | 1 | easy, tempo, easy, easy, race |

### marathon-16w-5d-q2

Input: 65 km/week, 23 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 65 | 65 | 23 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation | 65 | 65 | 23 | 2 | easy, tempo, easy, intervals, long |
| 3 | Foundation | 67.8 | 67.778 | 25 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 46.4 | 46.4 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 70.8 | 70.806 | 27 | 2 | easy, tempo, easy, intervals, long |
| 6 | Build | 70.8 | 70.806 | 27 | 2 | easy, tempo, easy, intervals, long |
| 7 | Build | 73.8 | 73.803 | 28 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 51.3 | 51.3 | 22 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 76.8 | 76.772 | 30 | 2 | easy, tempo, easy, intervals, long |
| 10 | Race preparation | 76.9 | 76.867 | 31 | 2 | easy, tempo, easy, fartlek, long |
| 11 | Race preparation | 76.9 | 76.867 | 33 | 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery | 51.9 | 51.9 | 23 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 76.9 | 76.867 | 33 | 2 | easy, tempo, easy, intervals, long |
| 14 | Taper | 55.6 | 55.586 | 24 | 1 | easy, intervals, easy, easy, long |
| 15 | Taper | 44.4 | 44.389 | 19 | 1 | easy, intervals, easy, easy, long |
| 16 | Race week | 30.5 | 30.486 | — | 1 | easy, tempo, easy, easy, race |

### marathon-20w-5d-q0

Input: 65 km/week, 23 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 65 | 65 | 23 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 65 | 65 | 23 | 0 | easy, easy, easy, easy, long |
| 3 | Foundation | 67.7 | 67.7 | 23 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 47.3 | 47.3 | 18 | 0 | easy, easy, easy, easy, long |
| 5 | Foundation | 70.6 | 70.6 | 23 | 0 | easy, easy, easy, easy, long |
| 6 | Foundation | 70.7 | 70.7 | 25 | 0 | easy, easy, easy, easy, long |
| 7 | Foundation | 73.6 | 73.6 | 25 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 51.4 | 51.4 | 20 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 76.5 | 76.5 | 27 | 0 | easy, easy, easy, easy, long |
| 10 | Build | 76.5 | 76.5 | 28 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 79.6 | 79.6 | 28 | 0 | easy, easy, easy, easy, long |
| 12 | Recovery | 55.7 | 55.7 | 22 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 82.7 | 82.7 | 30 | 0 | easy, easy, easy, easy, long |
| 14 | Race preparation | 82.9 | 82.95 | 31 | 0 | easy, easy, easy, easy, long |
| 15 | Race preparation | 83 | 82.95 | 33 | 0 | easy, easy, easy, easy, long |
| 16 | Recovery | 57.8 | 57.8 | 26 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 83 | 82.95 | 35 | 0 | easy, easy, easy, easy, long |
| 18 | Taper | 61.8 | 61.8 | 26 | 0 | easy, easy, easy, easy, long |
| 19 | Taper | 49.4 | 49.4 | 21 | 0 | easy, easy, easy, easy, long |
| 20 | Race week | 32.8 | 32.8 | — | 0 | easy, easy, easy, easy, race |

### marathon-20w-5d-q1

Input: 65 km/week, 23 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 65 | 65 | 23 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 65 | 65 | 23 | 1 | easy, tempo, easy, easy, long |
| 3 | Foundation | 67.7 | 67.678 | 23 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 45.7 | 45.7 | 17 | 0 | easy, easy, easy, easy, long |
| 5 | Foundation | 70.7 | 70.652 | 23 | 1 | easy, tempo, easy, easy, long |
| 6 | Foundation | 70.8 | 70.808 | 25 | 1 | easy, tempo, easy, easy, long |
| 7 | Foundation | 73.8 | 73.782 | 25 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 49.9 | 49.9 | 19 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 76.6 | 76.634 | 27 | 1 | easy, tempo, easy, easy, long |
| 10 | Build | 76.6 | 76.644 | 28 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 79.7 | 79.717 | 28 | 1 | easy, tempo, easy, easy, long |
| 12 | Recovery | 54.2 | 54.2 | 21 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 82.8 | 82.808 | 30 | 1 | easy, tempo, easy, easy, long |
| 14 | Race preparation | 82.9 | 82.949 | 31 | 1 | easy, tempo, easy, easy, long |
| 15 | Race preparation | 82.9 | 82.949 | 33 | 1 | easy, tempo, easy, easy, long |
| 16 | Recovery | 54.9 | 54.9 | 24 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 82.9 | 82.949 | 35 | 1 | easy, tempo, easy, easy, long |
| 18 | Taper | 62 | 61.969 | 26 | 1 | easy, tempo, easy, easy, long |
| 19 | Taper | 49.6 | 49.595 | 21 | 1 | easy, tempo, easy, easy, long |
| 20 | Race week | 33 | 32.992 | — | 1 | easy, tempo, easy, easy, race |

### marathon-20w-5d-q2

Input: 65 km/week, 23 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 65 | 65 | 23 | 2 | easy, tempo, easy, tempo, long |
| 2 | Maintenance | 65 | 65 | 23 | 2 | easy, tempo, easy, tempo, long |
| 3 | Foundation | 67.7 | 67.737 | 23 | 2 | easy, tempo, easy, fartlek, long |
| 4 | Recovery | 45.7 | 45.7 | 17 | 0 | easy, easy, easy, easy, long |
| 5 | Foundation | 70.7 | 70.738 | 23 | 2 | easy, tempo, easy, intervals, long |
| 6 | Foundation | 70.8 | 70.803 | 25 | 2 | easy, tempo, easy, tempo, long |
| 7 | Foundation | 73.8 | 73.845 | 25 | 2 | easy, tempo, easy, intervals, long |
| 8 | Recovery | 50 | 50 | 19 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 76.7 | 76.675 | 27 | 2 | easy, tempo, easy, intervals, long |
| 10 | Build | 76.7 | 76.707 | 28 | 2 | easy, tempo, easy, tempo, long |
| 11 | Build | 79.7 | 79.749 | 28 | 2 | easy, tempo, easy, intervals, long |
| 12 | Recovery | 54.2 | 54.2 | 21 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 82.9 | 82.855 | 30 | 2 | easy, tempo, easy, fartlek, long |
| 14 | Race preparation | 82.9 | 82.95 | 31 | 2 | easy, tempo, easy, tempo, long |
| 15 | Race preparation | 83 | 82.95 | 33 | 2 | easy, tempo, easy, intervals, long |
| 16 | Recovery | 55 | 55 | 24 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 83 | 82.95 | 35 | 2 | easy, tempo, easy, intervals, long |
| 18 | Taper | 61.9 | 61.892 | 26 | 1 | easy, intervals, easy, easy, long |
| 19 | Taper | 49.7 | 49.657 | 21 | 1 | easy, intervals, easy, easy, long |
| 20 | Race week | 33 | 32.992 | — | 1 | easy, tempo, easy, easy, race |

### marathon-8w-6d-q0

Input: 78 km/week, 23 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 78 | 78 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Build | 78 | 78 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 80.4 | 80.4 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 55.5 | 55.5 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 80.6 | 80.6 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 80.8 | 80.843 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Taper | 48.1 | 48.1 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race week | 31.4 | 31.4 | — | 0 | easy, easy, easy, easy, easy, race |

### marathon-8w-6d-q1

Input: 78 km/week, 23 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 78 | 78 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Build | 78 | 78 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 80.6 | 80.599 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 55.3 | 55.3 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 80.7 | 80.655 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Race preparation | 80.8 | 80.844 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Taper | 48.2 | 48.227 | 18 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Race week | 31.6 | 31.557 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-8w-6d-q2

Input: 78 km/week, 23 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Build | 78 | 78 | 23 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Build | 78 | 78 | 25 | 2 | easy, tempo, easy, intervals, easy, long |
| 3 | Build | 80.6 | 80.589 | 27 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 53.6 | 53.6 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 80.8 | 80.806 | 29 | 2 | easy, tempo, easy, intervals, easy, long |
| 6 | Race preparation | 80.8 | 80.842 | 31 | 2 | easy, tempo, easy, intervals, easy, long |
| 7 | Taper | 48.3 | 48.289 | 18 | 1 | easy, intervals, easy, easy, easy, long |
| 8 | Race week | 31.5 | 31.48 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-12w-6d-q0

Input: 78 km/week, 23 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 78 | 78 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 78 | 78 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Foundation | 80.4 | 80.4 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 55.5 | 55.5 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 83.6 | 83.6 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 83.9 | 83.885 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 86.5 | 86.5 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 60.5 | 60.5 | 24 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 86.8 | 86.8 | 34 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 86.8 | 86.8 | 34 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Taper | 51.8 | 51.8 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Race week | 34.4 | 34.4 | — | 0 | easy, easy, easy, easy, easy, race |

### marathon-12w-6d-q1

Input: 78 km/week, 23 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 78 | 78 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 78 | 78 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Foundation | 80.6 | 80.599 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 55.3 | 55.3 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 83.7 | 83.652 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 83.9 | 83.885 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 86.7 | 86.699 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 58.9 | 58.9 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 86.7 | 86.746 | 34 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race preparation | 86.7 | 86.746 | 34 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Taper | 50.2 | 50.194 | 19 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Race week | 33.7 | 33.701 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-12w-6d-q2

Input: 78 km/week, 23 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 78 | 78 | 23 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Foundation | 78 | 78 | 25 | 2 | easy, tempo, easy, intervals, easy, long |
| 3 | Foundation | 80.6 | 80.589 | 27 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 55.5 | 55.5 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 83.7 | 83.696 | 29 | 2 | easy, tempo, easy, intervals, easy, long |
| 6 | Build | 83.9 | 83.886 | 31 | 2 | easy, tempo, easy, intervals, easy, long |
| 7 | Build | 86.7 | 86.727 | 33 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 58.8 | 58.8 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 86.8 | 86.837 | 34 | 2 | easy, tempo, easy, intervals, easy, long |
| 10 | Race preparation | 86.8 | 86.837 | 34 | 2 | easy, tempo, easy, fartlek, easy, long |
| 11 | Taper | 49.8 | 49.766 | 19 | 1 | easy, fartlek, easy, easy, easy, long |
| 12 | Race week | 34.5 | 34.51 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-16w-6d-q0

Input: 78 km/week, 23 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 78 | 78 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 78 | 78 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Foundation | 80.6 | 80.6 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 55.4 | 55.4 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 83.5 | 83.5 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 83.5 | 83.5 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 86.6 | 86.6 | 28 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 60.4 | 60.4 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 89.7 | 89.7 | 30 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 90 | 90 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Race preparation | 90 | 90 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Recovery | 62.8 | 62.8 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 90 | 90 | 35 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Taper | 67.2 | 67.2 | 26 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Taper | 53.7 | 53.7 | 21 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Race week | 35.7 | 35.7 | — | 0 | easy, easy, easy, easy, easy, race |

### marathon-16w-6d-q1

Input: 78 km/week, 23 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 78 | 78 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 78 | 78 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Foundation | 80.7 | 80.705 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 55.5 | 55.5 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 83.7 | 83.658 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 83.7 | 83.658 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 86.7 | 86.664 | 28 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 60.4 | 60.4 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 89.8 | 89.817 | 30 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race preparation | 90 | 90 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Race preparation | 90 | 90 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Recovery | 61 | 61 | 24 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 90 | 90 | 35 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Taper | 65.1 | 65.071 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Taper | 52.1 | 52.072 | 20 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Race week | 35.7 | 35.663 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-16w-6d-q2

Input: 78 km/week, 23 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 78 | 78 | 23 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Foundation | 78 | 78 | 23 | 2 | easy, tempo, easy, intervals, easy, long |
| 3 | Foundation | 80.7 | 80.662 | 25 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 55.4 | 55.4 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 83.6 | 83.631 | 27 | 2 | easy, tempo, easy, intervals, easy, long |
| 6 | Build | 83.6 | 83.631 | 27 | 2 | easy, tempo, easy, intervals, easy, long |
| 7 | Build | 86.7 | 86.704 | 28 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 60.4 | 60.4 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 89.8 | 89.81 | 30 | 2 | easy, tempo, easy, intervals, easy, long |
| 10 | Race preparation | 90 | 90 | 31 | 2 | easy, tempo, easy, fartlek, easy, long |
| 11 | Race preparation | 90 | 90 | 33 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Recovery | 60.9 | 60.9 | 24 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 90 | 90 | 35 | 2 | easy, tempo, easy, intervals, easy, long |
| 14 | Taper | 65.4 | 65.378 | 25 | 1 | easy, intervals, easy, easy, easy, long |
| 15 | Taper | 51.6 | 51.642 | 20 | 1 | easy, intervals, easy, easy, easy, long |
| 16 | Race week | 35.7 | 35.663 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-20w-6d-q0

Input: 78 km/week, 23 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 78 | 78 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 78 | 78 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Foundation | 80.4 | 80.4 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 55.3 | 55.3 | 17 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Foundation | 83.5 | 83.5 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Foundation | 83.6 | 83.6 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Foundation | 86.7 | 86.7 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 60.6 | 60.6 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 89.6 | 89.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 89.7 | 89.7 | 28 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 92.5 | 92.5 | 28 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Recovery | 64.6 | 64.6 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 95.5 | 95.5 | 30 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Race preparation | 95.9 | 95.946 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Race preparation | 95.9 | 95.946 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Recovery | 67 | 67 | 26 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 95.9 | 95.946 | 35 | 0 | easy, easy, easy, easy, easy, long |
| 18 | Taper | 71.5 | 71.5 | 26 | 0 | easy, easy, easy, easy, easy, long |
| 19 | Taper | 57.3 | 57.3 | 21 | 0 | easy, easy, easy, easy, easy, long |
| 20 | Race week | 37.9 | 37.9 | — | 0 | easy, easy, easy, easy, easy, race |

### marathon-20w-6d-q1

Input: 78 km/week, 23 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 78 | 78 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 78 | 78 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Foundation | 80.6 | 80.572 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 55.3 | 55.3 | 17 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Foundation | 83.6 | 83.632 | 23 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Foundation | 83.7 | 83.664 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Foundation | 86.7 | 86.662 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 58.8 | 58.8 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 89.7 | 89.714 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Build | 89.7 | 89.714 | 28 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 92.6 | 92.597 | 28 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Recovery | 63.2 | 63.2 | 21 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 95.7 | 95.688 | 30 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Race preparation | 95.9 | 95.945 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Race preparation | 95.9 | 95.945 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Recovery | 63.8 | 63.8 | 24 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 95.9 | 95.945 | 35 | 1 | easy, tempo, easy, easy, easy, long |
| 18 | Taper | 71.4 | 71.398 | 26 | 1 | easy, tempo, easy, easy, easy, long |
| 19 | Taper | 57.4 | 57.448 | 21 | 1 | easy, tempo, easy, easy, easy, long |
| 20 | Race week | 38 | 37.992 | — | 1 | easy, tempo, easy, easy, easy, race |

### marathon-20w-6d-q2

Input: 78 km/week, 23 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Maintenance | 78 | 78 | 23 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Maintenance | 78 | 78 | 23 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Foundation | 80.6 | 80.598 | 23 | 2 | easy, tempo, easy, fartlek, easy, long |
| 4 | Recovery | 55.3 | 55.3 | 17 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Foundation | 83.6 | 83.639 | 23 | 2 | easy, tempo, easy, intervals, easy, long |
| 6 | Foundation | 83.7 | 83.704 | 25 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Foundation | 86.7 | 86.745 | 25 | 2 | easy, tempo, easy, intervals, easy, long |
| 8 | Recovery | 58.9 | 58.9 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 89.7 | 89.714 | 27 | 2 | easy, tempo, easy, intervals, easy, long |
| 10 | Build | 89.7 | 89.745 | 28 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Build | 92.6 | 92.649 | 28 | 2 | easy, tempo, easy, intervals, easy, long |
| 12 | Recovery | 62.8 | 62.8 | 21 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 95.8 | 95.755 | 30 | 2 | easy, tempo, easy, fartlek, easy, long |
| 14 | Race preparation | 95.9 | 95.945 | 31 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Race preparation | 95.9 | 95.945 | 33 | 2 | easy, tempo, easy, intervals, easy, long |
| 16 | Recovery | 64.7 | 64.7 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 95.9 | 95.945 | 35 | 2 | easy, tempo, easy, intervals, easy, long |
| 18 | Taper | 71.6 | 71.622 | 26 | 1 | easy, intervals, easy, easy, easy, long |
| 19 | Taper | 57.2 | 57.21 | 21 | 1 | easy, intervals, easy, easy, easy, long |
| 20 | Race week | 38 | 37.992 | — | 1 | easy, tempo, easy, easy, easy, race |

### ultra-12w-5d-q0

Input: 75 km/week, 25 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Race preparation | 75 | 75 | 25 | 0 | easy, easy, easy, easy, long |
| 2 | Race preparation | 77.8 | 77.8 | 27 | 0 | easy, easy, easy, easy, long |
| 3 | Race preparation | 80.5 | 80.5 | 29 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 66 | 66 | 23 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 83.6 | 83.6 | 31 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 86.8 | 86.8 | 33 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 89.6 | 89.6 | 35 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 73.4 | 73.4 | 28 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 87.1 | 87.1 | 29 | 0 | easy, easy, easy, easy, long |
| 10 | Taper | 61.9 | 61.9 | 16 | 0 | easy, easy, easy, easy, long |
| 11 | Taper | 41.5 | 41.5 | — | 0 | easy, easy, easy, easy, easy |
| 12 | Race week | 18.3 | 18.3 | — | 0 | easy, easy, easy, easy, race |

### ultra-12w-5d-q1

Input: 75 km/week, 25 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Race preparation | 75 | 75 | 25 | 1 | easy, tempo, easy, easy, long |
| 2 | Race preparation | 75.5 | 75.527 | 27 | 1 | easy, tempo, easy, easy, long |
| 3 | Race preparation | 77.5 | 77.527 | 29 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 62.6 | 62.6 | 21 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 79.5 | 79.527 | 31 | 1 | easy, tempo, easy, easy, long |
| 6 | Race preparation | 81.5 | 81.527 | 33 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 83.5 | 83.527 | 35 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 68 | 68 | 25 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 77.5 | 77.527 | 29 | 1 | easy, tempo, easy, easy, long |
| 10 | Taper | 56.2 | 56.23 | 16 | 1 | easy, tempo, easy, easy, long |
| 11 | Taper | 37.6 | 37.6 | — | 1 | easy, tempo, easy, easy, easy |
| 12 | Race week | 15.6 | 15.6 | — | 0 | easy, easy, easy, easy, race |

### ultra-12w-5d-q2

Input: 75 km/week, 25 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Race preparation | 75 | 75 | 25 | 2 | easy, tempo, easy, tempo, long |
| 2 | Race preparation | 75 | 75 | 27 | 2 | easy, tempo, easy, tempo, long |
| 3 | Race preparation | 75 | 75 | 29 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 55.7 | 55.7 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 75 | 75 | 31 | 2 | easy, tempo, easy, tempo, long |
| 6 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 7 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 57.9 | 57.9 | 21 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 66.4 | 66.354 | 27 | 2 | easy, tempo, easy, tempo, long |
| 10 | Taper | 48.2 | 48.16 | 16 | 2 | easy, tempo, easy, tempo, long |
| 11 | Taper | 31.6 | 31.601 | — | 2 | easy, tempo, easy, tempo, easy |
| 12 | Race week | 15.3 | 15.3 | — | 0 | easy, easy, easy, easy, race |

### ultra-16w-5d-q0

Input: 75 km/week, 25 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 75 | 75 | 25 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 77.8 | 77.8 | 27 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 80.5 | 80.5 | 29 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 66 | 66 | 23 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 83.6 | 83.6 | 31 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 86.8 | 86.8 | 33 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 89.6 | 89.6 | 35 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 73.4 | 73.4 | 28 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 92.6 | 92.6 | 37 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 95.7 | 95.7 | 39 | 0 | easy, easy, easy, easy, long |
| 11 | Race preparation | 98.8 | 98.8 | 41 | 0 | easy, easy, easy, easy, long |
| 12 | Recovery | 81 | 81 | 32 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 95.6 | 95.6 | 34 | 0 | easy, easy, easy, easy, long |
| 14 | Taper | 65 | 65 | 16 | 0 | easy, easy, easy, easy, long |
| 15 | Taper | 43.6 | 43.6 | — | 0 | easy, easy, easy, easy, easy |
| 16 | Race week | 18.7 | 18.7 | — | 0 | easy, easy, easy, easy, race |

### ultra-16w-5d-q1

Input: 75 km/week, 25 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 75 | 75 | 25 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 75 | 75 | 27 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 77.5 | 77.527 | 29 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 62.6 | 62.6 | 21 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 79.5 | 79.527 | 31 | 1 | easy, tempo, easy, easy, long |
| 6 | Race preparation | 81.5 | 81.527 | 33 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 83.5 | 83.527 | 35 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 68 | 68 | 25 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 85.5 | 85.527 | 37 | 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation | 87.5 | 87.527 | 39 | 1 | easy, tempo, easy, easy, long |
| 11 | Race preparation | 87.5 | 87.527 | 39 | 1 | easy, tempo, easy, easy, long |
| 12 | Recovery | 70.6 | 70.6 | 27 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 81.5 | 81.527 | 33 | 1 | easy, tempo, easy, easy, long |
| 14 | Taper | 56.2 | 56.23 | 16 | 1 | easy, tempo, easy, easy, long |
| 15 | Taper | 37.6 | 37.6 | — | 1 | easy, tempo, easy, easy, easy |
| 16 | Race week | 15.6 | 15.6 | — | 0 | easy, easy, easy, easy, race |

### ultra-16w-5d-q2

Input: 75 km/week, 25 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 75 | 75 | 25 | 2 | easy, tempo, easy, tempo, long |
| 2 | Foundation | 75 | 75 | 27 | 2 | easy, tempo, easy, tempo, long |
| 3 | Build | 75 | 75 | 29 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 55.7 | 55.7 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 75 | 75 | 31 | 2 | easy, tempo, easy, tempo, long |
| 6 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 7 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 57.9 | 57.9 | 21 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 10 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 11 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery | 57.9 | 57.9 | 22 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 66.4 | 66.354 | 27 | 2 | easy, tempo, easy, tempo, long |
| 14 | Taper | 48.2 | 48.16 | 16 | 2 | easy, tempo, easy, tempo, long |
| 15 | Taper | 31.6 | 31.601 | — | 2 | easy, tempo, easy, tempo, easy |
| 16 | Race week | 15.3 | 15.3 | — | 0 | easy, easy, easy, easy, race |

### ultra-20w-5d-q0

Input: 75 km/week, 25 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 75 | 75 | 25 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 77.7 | 77.7 | 25 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 80.7 | 80.7 | 27 | 0 | easy, easy, easy, easy, long |
| 4 | Recovery | 65.2 | 65.2 | 20 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 83.6 | 83.6 | 29 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 86.8 | 86.8 | 29 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 89.6 | 89.6 | 31 | 0 | easy, easy, easy, easy, long |
| 8 | Recovery | 72 | 72 | 23 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 92.7 | 92.7 | 33 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 95.8 | 95.8 | 35 | 0 | easy, easy, easy, easy, long |
| 11 | Race preparation | 98.6 | 98.6 | 35 | 0 | easy, easy, easy, easy, long |
| 12 | Recovery | 79.8 | 79.8 | 27 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 99.7 | 99.7 | 37 | 0 | easy, easy, easy, easy, long |
| 14 | Race preparation | 99.9 | 99.902 | 39 | 0 | easy, easy, easy, easy, long |
| 15 | Race preparation | 99.9 | 99.902 | 41 | 0 | easy, easy, easy, easy, long |
| 16 | Recovery | 81.7 | 81.7 | 32 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 96.7 | 96.7 | 34 | 0 | easy, easy, easy, easy, long |
| 18 | Taper | 65.6 | 65.6 | 16 | 0 | easy, easy, easy, easy, long |
| 19 | Taper | 44 | 44 | — | 0 | easy, easy, easy, easy, easy |
| 20 | Race week | 19.1 | 19.1 | — | 0 | easy, easy, easy, easy, race |

### ultra-20w-5d-q1

Input: 75 km/week, 25 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 75 | 75 | 25 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 75 | 75 | 25 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 75.5 | 75.527 | 27 | 1 | easy, tempo, easy, easy, long |
| 4 | Recovery | 61.4 | 61.4 | 19 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 77.5 | 77.527 | 29 | 1 | easy, tempo, easy, easy, long |
| 6 | Build | 77.5 | 77.527 | 29 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 79.5 | 79.527 | 31 | 1 | easy, tempo, easy, easy, long |
| 8 | Recovery | 65 | 65 | 21 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 81.5 | 81.527 | 33 | 1 | easy, tempo, easy, easy, long |
| 10 | Race preparation | 83.5 | 83.527 | 35 | 1 | easy, tempo, easy, easy, long |
| 11 | Race preparation | 83.5 | 83.527 | 35 | 1 | easy, tempo, easy, easy, long |
| 12 | Recovery | 68.1 | 68.1 | 23 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 85.5 | 85.527 | 37 | 1 | easy, tempo, easy, easy, long |
| 14 | Race preparation | 87.5 | 87.527 | 39 | 1 | easy, tempo, easy, easy, long |
| 15 | Race preparation | 87.5 | 87.527 | 39 | 1 | easy, tempo, easy, easy, long |
| 16 | Recovery | 70.7 | 70.7 | 27 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 81.5 | 81.527 | 33 | 1 | easy, tempo, easy, easy, long |
| 18 | Taper | 56.2 | 56.23 | 16 | 1 | easy, tempo, easy, easy, long |
| 19 | Taper | 37.6 | 37.6 | — | 1 | easy, tempo, easy, easy, easy |
| 20 | Race week | 15.6 | 15.6 | — | 0 | easy, easy, easy, easy, race |

### ultra-20w-5d-q2

Input: 75 km/week, 25 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 75 | 75 | 25 | 2 | easy, tempo, easy, tempo, long |
| 2 | Foundation | 75 | 75 | 25 | 2 | easy, tempo, easy, tempo, long |
| 3 | Build | 75 | 75 | 27 | 2 | easy, tempo, easy, tempo, long |
| 4 | Recovery | 54.1 | 54.1 | 17 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 75 | 75 | 29 | 2 | easy, tempo, easy, tempo, long |
| 6 | Build | 75 | 75 | 29 | 2 | easy, tempo, easy, tempo, long |
| 7 | Build | 75 | 75 | 31 | 2 | easy, tempo, easy, tempo, long |
| 8 | Recovery | 56.9 | 56.9 | 18 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 10 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 11 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 12 | Recovery | 58.6 | 58.6 | 20 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 14 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 15 | Race preparation | 75 | 75 | 32 | 2 | easy, tempo, easy, tempo, long |
| 16 | Recovery | 58.1 | 58.1 | 22 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 66.4 | 66.354 | 27 | 2 | easy, tempo, easy, tempo, long |
| 18 | Taper | 48.2 | 48.16 | 16 | 2 | easy, tempo, easy, tempo, long |
| 19 | Taper | 31.6 | 31.601 | — | 2 | easy, tempo, easy, tempo, easy |
| 20 | Race week | 15.3 | 15.3 | — | 0 | easy, easy, easy, easy, race |

### ultra-12w-6d-q0

Input: 90 km/week, 25 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Race preparation | 90 | 90 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Race preparation | 92.4 | 92.4 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Race preparation | 95.6 | 95.6 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 78.2 | 78.2 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 98.5 | 98.5 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 99.6 | 99.6 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 99.9 | 99.912 | 35 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 80.6 | 80.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 97.1 | 97.1 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Taper | 70.6 | 70.6 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Taper | 47.9 | 47.9 | — | 0 | easy, easy, easy, easy, easy, easy |
| 12 | Race week | 21.6 | 21.6 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-12w-6d-q1

Input: 90 km/week, 25 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Race preparation | 90 | 90 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Race preparation | 92 | 92.027 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Race preparation | 94 | 94.027 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 76.5 | 76.5 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 96 | 96.027 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Race preparation | 98 | 98.027 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 99.6 | 99.627 | 35 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 80.6 | 80.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 85.7 | 85.727 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Taper | 64.2 | 64.23 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Taper | 45.4 | 45.401 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 12 | Race week | 19.3 | 19.3 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-12w-6d-q2

Input: 90 km/week, 25 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Race preparation | 90 | 90 | 25 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Race preparation | 90 | 90 | 27 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Race preparation | 90 | 90 | 29 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 69.3 | 69.3 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 90 | 90 | 31 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Race preparation | 90 | 90 | 33 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Race preparation | 90.9 | 90.854 | 35 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 74.4 | 74.4 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 76.6 | 76.554 | 29 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Taper | 56.1 | 56.06 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Taper | 39.8 | 39.801 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 12 | Race week | 18.8 | 18.8 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-16w-6d-q0

Input: 90 km/week, 25 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 90 | 90 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 92.4 | 92.4 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 95.6 | 95.6 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 78.2 | 78.2 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 98.5 | 98.5 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 99.6 | 99.6 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 99.9 | 99.912 | 35 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 80.6 | 80.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 99.9 | 99.912 | 37 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 99.9 | 99.912 | 39 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Race preparation | 99.9 | 99.912 | 39 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Recovery | 80.8 | 80.8 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 96.2 | 96.2 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Taper | 66.4 | 66.4 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Taper | 44.5 | 44.5 | — | 0 | easy, easy, easy, easy, easy, easy |
| 16 | Race week | 21.1 | 21.1 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-16w-6d-q1

Input: 90 km/week, 25 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 90 | 90 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 90.2 | 90.23 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 94 | 94.027 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 76.5 | 76.5 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 96 | 96.027 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Race preparation | 98 | 98.027 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 99.6 | 99.627 | 35 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 80.6 | 80.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 99.6 | 99.627 | 37 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race preparation | 99.9 | 99.904 | 39 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Race preparation | 99.9 | 99.904 | 39 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Recovery | 80.6 | 80.6 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 86.9 | 86.927 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Taper | 60.1 | 60.13 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Taper | 42.2 | 42.2 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 16 | Race week | 18.6 | 18.6 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-16w-6d-q2

Input: 90 km/week, 25 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 90 | 90 | 25 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 90 | 90 | 27 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 90 | 90 | 29 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 69.3 | 69.3 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 90 | 90 | 31 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Race preparation | 90 | 90 | 33 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Race preparation | 90.9 | 90.854 | 35 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 74.4 | 74.4 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 92.9 | 92.854 | 37 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Race preparation | 92.9 | 92.854 | 37 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Race preparation | 92.9 | 92.854 | 37 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Recovery | 75.9 | 75.9 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 75.7 | 75.654 | 30 | 2 | easy, tempo, easy, tempo, easy, long |
| 14 | Taper | 56.1 | 56.06 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Taper | 39.8 | 39.801 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 16 | Race week | 18.8 | 18.8 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-20w-6d-q0

Input: 90 km/week, 25 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 90 | 90 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 92.5 | 92.5 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 95.5 | 95.5 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Recovery | 77.5 | 77.5 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 98.6 | 98.6 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 99.6 | 99.6 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 99.9 | 99.923 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Recovery | 80.7 | 80.7 | 23 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 99.9 | 99.923 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 99.9 | 99.923 | 35 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Race preparation | 99.9 | 99.923 | 35 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Recovery | 80.6 | 80.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 99.9 | 99.923 | 37 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Race preparation | 99.9 | 99.923 | 39 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Race preparation | 99.9 | 99.923 | 39 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Recovery | 80.8 | 80.8 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 96.2 | 96.2 | 33 | 0 | easy, easy, easy, easy, easy, long |
| 18 | Taper | 66.4 | 66.4 | 16 | 0 | easy, easy, easy, easy, easy, long |
| 19 | Taper | 44.5 | 44.5 | — | 0 | easy, easy, easy, easy, easy, easy |
| 20 | Race week | 21.1 | 21.1 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-20w-6d-q1

Input: 90 km/week, 25 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 90 | 90 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 90 | 90 | 25 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 92 | 92.027 | 27 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Recovery | 73.8 | 73.8 | 19 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 94 | 94.027 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 6 | Build | 94 | 94.027 | 29 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 96 | 96.027 | 31 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Recovery | 77.8 | 77.8 | 22 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 98 | 98.027 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race preparation | 99.6 | 99.627 | 35 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Race preparation | 99.6 | 99.627 | 35 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Recovery | 80.6 | 80.6 | 27 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 99.6 | 99.627 | 37 | 1 | easy, tempo, easy, easy, easy, long |
| 14 | Race preparation | 99.9 | 99.904 | 39 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Race preparation | 99.9 | 99.904 | 39 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Recovery | 80.6 | 80.6 | 31 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 86.9 | 86.927 | 33 | 1 | easy, tempo, easy, easy, easy, long |
| 18 | Taper | 60.1 | 60.13 | 16 | 1 | easy, tempo, easy, easy, easy, long |
| 19 | Taper | 42.2 | 42.2 | — | 1 | easy, tempo, easy, easy, easy, easy |
| 20 | Race week | 18.6 | 18.6 | — | 0 | easy, easy, easy, easy, easy, race |

### ultra-20w-6d-q2

Input: 90 km/week, 25 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 3 week(s). Daily taper offsets: 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 90 | 90 | 25 | 2 | easy, tempo, easy, tempo, easy, long |
| 2 | Foundation | 90 | 90 | 25 | 2 | easy, tempo, easy, tempo, easy, long |
| 3 | Build | 90 | 90 | 27 | 2 | easy, tempo, easy, tempo, easy, long |
| 4 | Recovery | 67.8 | 67.8 | 18 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 90 | 90 | 29 | 2 | easy, tempo, easy, tempo, easy, long |
| 6 | Build | 90 | 90 | 29 | 2 | easy, tempo, easy, tempo, easy, long |
| 7 | Build | 90 | 90 | 31 | 2 | easy, tempo, easy, tempo, easy, long |
| 8 | Recovery | 70.5 | 70.5 | 20 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 90 | 90 | 33 | 2 | easy, tempo, easy, tempo, easy, long |
| 10 | Race preparation | 90.9 | 90.854 | 35 | 2 | easy, tempo, easy, tempo, easy, long |
| 11 | Race preparation | 90.9 | 90.854 | 35 | 2 | easy, tempo, easy, tempo, easy, long |
| 12 | Recovery | 74.4 | 74.4 | 25 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 92.9 | 92.854 | 37 | 2 | easy, tempo, easy, tempo, easy, long |
| 14 | Race preparation | 92.9 | 92.854 | 37 | 2 | easy, tempo, easy, tempo, easy, long |
| 15 | Race preparation | 92.9 | 92.854 | 37 | 2 | easy, tempo, easy, tempo, easy, long |
| 16 | Recovery | 75.9 | 75.9 | 29 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 75.7 | 75.654 | 30 | 2 | easy, tempo, easy, tempo, easy, long |
| 18 | Taper | 56.1 | 56.06 | 16 | 2 | easy, tempo, easy, tempo, easy, long |
| 19 | Taper | 39.8 | 39.801 | — | 2 | easy, tempo, easy, tempo, easy, easy |
| 20 | Race week | 18.8 | 18.8 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-8w-5d-q0-advanced

Input: 45 km/week, 13 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 46.4 | 46.4 | 13 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 47.2 | 47.15 | 13 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 47.6 | 47.55 | 13 | 0 | easy, easy, easy, easy, long |
| 5 | Race preparation | 48.2 | 48.15 | 13 | 0 | easy, easy, easy, easy, long |
| 6 | Race preparation | 48.7 | 48.65 | 13 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 8 | Race week | 17.3 | 17.3 | — | 0 | easy, easy, easy, easy, race |

### 5k-8w-5d-q1-advanced

Input: 45 km/week, 13 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 45.7 | 45.749 | 13 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 46.6 | 46.646 | 13 | 1 | easy, fartlek, easy, easy, long |
| 4 | Build | 47.9 | 47.9 | 13 | 1 | easy, tempo, easy, easy, long |
| 5 | Race preparation | 47.9 | 47.9 | 13 | 1 | easy, fartlek, easy, easy, long |
| 6 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 8 | Race week | 17.3 | 17.288 | — | 1 | easy, fartlek, easy, easy, race |

### 5k-8w-5d-q2-advanced

Input: 45 km/week, 13 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation | 45 | 45 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 3 | Build | 46.5 | 46.468 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 4 | Build | 46.8 | 46.8 | 13 | 1 | easy, fartlek, easy, easy, long |
| 5 | Race preparation | 46.8 | 46.8 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 6 | Race preparation | 48.2 | 48.2 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 7 | Race preparation | 48.7 | 48.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 8 | Race week | 18.4 | 18.383 | — | 1 | easy, tempo, easy, easy, race |

### 5k-10w-5d-q0-advanced

Input: 45 km/week, 13 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 2 | Foundation | 46.4 | 46.4 | 13 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 47.2 | 47.15 | 13 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 47.6 | 47.55 | 13 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 48.2 | 48.15 | 13 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 48.7 | 48.65 | 13 | 0 | easy, easy, easy, easy, long |
| 7 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 8 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 10 | Race week | 17.3 | 17.3 | — | 0 | easy, easy, easy, easy, race |

### 5k-10w-5d-q1-advanced

Input: 45 km/week, 13 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 2 | Foundation | 45.7 | 45.749 | 13 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 46.6 | 46.646 | 13 | 1 | easy, fartlek, easy, easy, long |
| 4 | Build | 47.9 | 47.9 | 13 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 47.9 | 47.9 | 13 | 1 | easy, fartlek, easy, easy, long |
| 6 | Build | 48.7 | 48.7 | 13 | 1 | easy, tempo, easy, easy, long |
| 7 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 8 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 9 | Race preparation | 49.2 | 49.2 | 13 | 1 | easy, tempo, easy, easy, long |
| 10 | Race week | 17.7 | 17.71 | — | 1 | easy, tempo, easy, easy, race |

### 5k-10w-5d-q2-advanced

Input: 45 km/week, 13 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Foundation | 45 | 45 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 3 | Build | 46.5 | 46.468 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 4 | Build | 46.8 | 46.8 | 13 | 1 | easy, fartlek, easy, easy, long |
| 5 | Build | 46.8 | 46.8 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 6 | Build | 48.2 | 48.2 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 7 | Race preparation | 48.7 | 48.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 8 | Race preparation | 49.3 | 49.3 | 13 | 1 | easy, fartlek, easy, easy, long |
| 9 | Race preparation | 49.8 | 49.8 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 10 | Race week | 18.4 | 18.37 | — | 1 | easy, tempo, easy, easy, race |

### 5k-12w-5d-q0-advanced

Input: 45 km/week, 13 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 3 | Build | 46.4 | 46.4 | 13 | 0 | easy, easy, easy, easy, long |
| 4 | Build | 47.2 | 47.15 | 13 | 0 | easy, easy, easy, easy, long |
| 5 | Build | 47.6 | 47.55 | 13 | 0 | easy, easy, easy, easy, long |
| 6 | Build | 48.2 | 48.15 | 13 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 48.7 | 48.65 | 13 | 0 | easy, easy, easy, easy, long |
| 8 | Build | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 9 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 10 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 11 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 12 | Race week | 17.3 | 17.3 | — | 0 | easy, easy, easy, easy, race |

### 5k-12w-5d-q1-advanced

Input: 45 km/week, 13 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 3 | Build | 45.9 | 45.887 | 13 | 1 | easy, tempo, easy, easy, long |
| 4 | Build | 47 | 46.993 | 13 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 47.2 | 47.23 | 13 | 1 | easy, fartlek, easy, easy, long |
| 6 | Build | 47.9 | 47.9 | 13 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 47.9 | 47.9 | 13 | 1 | easy, fartlek, easy, easy, long |
| 8 | Build | 48.7 | 48.7 | 13 | 1 | easy, tempo, easy, easy, long |
| 9 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 10 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 11 | Race preparation | 49.2 | 49.2 | 13 | 1 | easy, tempo, easy, easy, long |
| 12 | Race week | 17.7 | 17.71 | — | 1 | easy, tempo, easy, easy, race |

### 5k-12w-5d-q2-advanced

Input: 45 km/week, 13 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Maintenance | 45 | 45 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 3 | Build | 45.2 | 45.215 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 4 | Build | 46 | 46 | 13 | 1 | easy, tempo, easy, easy, long |
| 5 | Build | 46 | 46 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 6 | Build | 46.7 | 46.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 7 | Build | 47.3 | 47.3 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 8 | Build | 47.7 | 47.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 9 | Race preparation | 47.7 | 47.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 10 | Race preparation | 48.5 | 48.5 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 11 | Race preparation | 48.5 | 48.5 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 12 | Race week | 18.1 | 18.143 | — | 1 | easy, tempo, easy, easy, race |

### 5k-16w-5d-q0-advanced

Input: 45 km/week, 13 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 4 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 7 | Build | 46.4 | 46.4 | 13 | 0 | easy, easy, easy, easy, long |
| 8 | Build | 47.2 | 47.15 | 13 | 0 | easy, easy, easy, easy, long |
| 9 | Build | 47.6 | 47.55 | 13 | 0 | easy, easy, easy, easy, long |
| 10 | Build | 48.2 | 48.15 | 13 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 48.7 | 48.65 | 13 | 0 | easy, easy, easy, easy, long |
| 12 | Build | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 13 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 14 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 15 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 16 | Race week | 17.3 | 17.3 | — | 0 | easy, easy, easy, easy, race |

### 5k-16w-5d-q1-advanced

Input: 45 km/week, 13 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 45 | 45 | 13 | 1 | easy, fartlek, easy, easy, long |
| 4 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 5 | Maintenance | 45 | 45 | 13 | 1 | easy, fartlek, easy, easy, long |
| 6 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 7 | Build | 45.9 | 45.887 | 13 | 1 | easy, tempo, easy, easy, long |
| 8 | Build | 47 | 46.993 | 13 | 1 | easy, tempo, easy, easy, long |
| 9 | Build | 47.2 | 47.23 | 13 | 1 | easy, fartlek, easy, easy, long |
| 10 | Build | 47.9 | 47.9 | 13 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 47.9 | 47.9 | 13 | 1 | easy, fartlek, easy, easy, long |
| 12 | Build | 48.7 | 48.7 | 13 | 1 | easy, tempo, easy, easy, long |
| 13 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 14 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 15 | Race preparation | 49.2 | 49.2 | 13 | 1 | easy, tempo, easy, easy, long |
| 16 | Race week | 17.7 | 17.71 | — | 1 | easy, tempo, easy, easy, race |

### 5k-16w-5d-q2-advanced

Input: 45 km/week, 13 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 44.7 | 44.7 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Maintenance | 44.7 | 44.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 3 | Maintenance | 44.7 | 44.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 4 | Maintenance | 44.7 | 44.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 5 | Maintenance | 44.7 | 44.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 6 | Maintenance | 44.7 | 44.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 7 | Build | 45 | 44.954 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 8 | Build | 46.4 | 46.4 | 13 | 1 | easy, tempo, easy, easy, long |
| 9 | Build | 46.4 | 46.4 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 10 | Build | 46.7 | 46.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 11 | Build | 47.3 | 47.3 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 12 | Build | 47.7 | 47.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 13 | Race preparation | 47.7 | 47.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 14 | Race preparation | 48.5 | 48.5 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 15 | Race preparation | 48.5 | 48.5 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 16 | Race week | 18.1 | 18.143 | — | 1 | easy, tempo, easy, easy, race |

### 5k-20w-5d-q0-advanced

Input: 45 km/week, 13 km long, 5 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 2 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 3 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 4 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 5 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 6 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 7 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 8 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 9 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 10 | Maintenance | 45 | 45 | 13 | 0 | easy, easy, easy, easy, long |
| 11 | Build | 46.4 | 46.4 | 13 | 0 | easy, easy, easy, easy, long |
| 12 | Build | 47.2 | 47.15 | 13 | 0 | easy, easy, easy, easy, long |
| 13 | Build | 47.6 | 47.55 | 13 | 0 | easy, easy, easy, easy, long |
| 14 | Build | 48.2 | 48.15 | 13 | 0 | easy, easy, easy, easy, long |
| 15 | Build | 48.7 | 48.65 | 13 | 0 | easy, easy, easy, easy, long |
| 16 | Build | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 17 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 18 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 19 | Race preparation | 48.8 | 48.75 | 13 | 0 | easy, easy, easy, easy, long |
| 20 | Race week | 17.3 | 17.3 | — | 0 | easy, easy, easy, easy, race |

### 5k-20w-5d-q1-advanced

Input: 45 km/week, 13 km long, 5 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 2 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 3 | Maintenance | 45 | 45 | 13 | 1 | easy, fartlek, easy, easy, long |
| 4 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 5 | Maintenance | 45 | 45 | 13 | 1 | easy, fartlek, easy, easy, long |
| 6 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 7 | Maintenance | 45 | 45 | 13 | 1 | easy, fartlek, easy, easy, long |
| 8 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 9 | Maintenance | 45 | 45 | 13 | 1 | easy, fartlek, easy, easy, long |
| 10 | Maintenance | 45 | 45 | 13 | 1 | easy, tempo, easy, easy, long |
| 11 | Build | 45.9 | 45.887 | 13 | 1 | easy, tempo, easy, easy, long |
| 12 | Build | 47 | 46.993 | 13 | 1 | easy, tempo, easy, easy, long |
| 13 | Build | 47.2 | 47.23 | 13 | 1 | easy, fartlek, easy, easy, long |
| 14 | Build | 47.9 | 47.9 | 13 | 1 | easy, tempo, easy, easy, long |
| 15 | Build | 47.9 | 47.9 | 13 | 1 | easy, fartlek, easy, easy, long |
| 16 | Build | 48.7 | 48.7 | 13 | 1 | easy, tempo, easy, easy, long |
| 17 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 18 | Race preparation | 48.7 | 48.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 19 | Race preparation | 49.2 | 49.2 | 13 | 1 | easy, tempo, easy, easy, long |
| 20 | Race week | 17.7 | 17.71 | — | 1 | easy, tempo, easy, easy, race |

### 5k-20w-5d-q2-advanced

Input: 45 km/week, 13 km long, 5 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 44.6 | 44.6 | 13 | 2 | easy, tempo, easy, fartlek, long |
| 2 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 3 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 4 | Maintenance | 44.6 | 44.6 | 13 | 1 | easy, fartlek, easy, easy, long |
| 5 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 6 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 7 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 8 | Maintenance | 44.6 | 44.6 | 13 | 1 | easy, fartlek, easy, easy, long |
| 9 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 10 | Maintenance | 44.6 | 44.6 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 11 | Build | 45 | 44.954 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 12 | Build | 46.4 | 46.4 | 13 | 1 | easy, tempo, easy, easy, long |
| 13 | Build | 46.4 | 46.4 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 14 | Build | 46.7 | 46.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 15 | Build | 47.3 | 47.3 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 16 | Build | 47.7 | 47.7 | 13 | 1 | easy, fartlek, easy, easy, long |
| 17 | Race preparation | 47.7 | 47.7 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 18 | Race preparation | 48.5 | 48.5 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 19 | Race preparation | 48.5 | 48.5 | 13 | 2 | easy, fartlek, easy, tempo, long |
| 20 | Race week | 18.1 | 18.143 | — | 1 | easy, tempo, easy, easy, race |

### 5k-8w-6d-q0-advanced

Input: 54 km/week, 13 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Race preparation | 54.1 | 54.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Race preparation | 54.4 | 54.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 54.8 | 54.8 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race week | 20 | 20 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-8w-6d-q1-advanced

Input: 54 km/week, 13 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Build | 54.4 | 54.4 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Race preparation | 54.4 | 54.4 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Race week | 20.1 | 20.053 | — | 1 | easy, fartlek, easy, easy, easy, race |

### 5k-8w-6d-q2-advanced

Input: 54 km/week, 13 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Foundation | 54 | 54 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 3 | Build | 55.3 | 55.25 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 4 | Build | 55.3 | 55.25 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 5 | Race preparation | 55.3 | 55.25 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 6 | Race preparation | 56.7 | 56.65 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 7 | Race preparation | 57.2 | 57.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 8 | Race week | 21.1 | 21.148 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-10w-6d-q0-advanced

Input: 54 km/week, 13 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 54.1 | 54.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 54.4 | 54.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Race preparation | 54.8 | 54.8 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Race preparation | 55 | 55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race week | 20 | 20 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-10w-6d-q1-advanced

Input: 54 km/week, 13 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Build | 54.4 | 54.4 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 54.4 | 54.4 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Build | 55.2 | 55.2 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 9 | Race preparation | 55.7 | 55.7 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 10 | Race week | 20.5 | 20.475 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-10w-6d-q2-advanced

Input: 54 km/week, 13 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Foundation | 54 | 54 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 3 | Build | 55.3 | 55.25 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 4 | Build | 55.3 | 55.25 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 5 | Build | 55.3 | 55.25 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 6 | Build | 55.8 | 55.8 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 7 | Race preparation | 55.8 | 55.8 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 8 | Race preparation | 55.8 | 55.8 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 9 | Race preparation | 57.8 | 57.8 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 10 | Race week | 21.1 | 21.135 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-12w-6d-q0-advanced

Input: 54 km/week, 13 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Build | 54.1 | 54.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 54.4 | 54.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Build | 54.8 | 54.8 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Race preparation | 55 | 55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Race week | 20 | 20 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-12w-6d-q1-advanced

Input: 54 km/week, 13 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 4 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Build | 54.4 | 54.4 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 54.4 | 54.4 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Build | 55.2 | 55.2 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 10 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 11 | Race preparation | 55.7 | 55.7 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Race week | 20.5 | 20.475 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-12w-6d-q2-advanced

Input: 54 km/week, 13 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 3 | Build | 54 | 54 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 4 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Build | 54.5 | 54.45 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 6 | Build | 55.2 | 55.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 7 | Build | 55.3 | 55.3 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 8 | Build | 55.3 | 55.3 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 9 | Race preparation | 56.2 | 56.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 10 | Race preparation | 57 | 56.95 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 11 | Race preparation | 57 | 56.95 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 12 | Race week | 20.9 | 20.908 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-16w-6d-q0-advanced

Input: 54 km/week, 13 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Build | 54.1 | 54.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 54.4 | 54.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Build | 54.8 | 54.8 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Race preparation | 55 | 55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Race week | 20 | 20 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-16w-6d-q1-advanced

Input: 54 km/week, 13 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Maintenance | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 8 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 10 | Build | 54.4 | 54.4 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 54.4 | 54.4 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 12 | Build | 55.2 | 55.2 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 14 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 15 | Race preparation | 55.7 | 55.7 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 16 | Race week | 20.5 | 20.475 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-16w-6d-q2-advanced

Input: 54 km/week, 13 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 53.2 | 53.15 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Maintenance | 53.2 | 53.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 3 | Maintenance | 53.2 | 53.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 4 | Maintenance | 53.2 | 53.15 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 5 | Maintenance | 53.1 | 53.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 6 | Maintenance | 53.2 | 53.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 7 | Build | 53.4 | 53.386 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 8 | Build | 53.5 | 53.508 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Build | 54.9 | 54.85 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 10 | Build | 55.2 | 55.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 11 | Build | 55.3 | 55.3 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 12 | Build | 55.3 | 55.3 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 13 | Race preparation | 56.2 | 56.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 14 | Race preparation | 57 | 56.95 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 15 | Race preparation | 57 | 56.95 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 16 | Race week | 20.9 | 20.908 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-20w-6d-q0-advanced

Input: 54 km/week, 13 km long, 6 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 3 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 4 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 5 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 6 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 7 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 8 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 9 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 10 | Maintenance | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 11 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 12 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 13 | Build | 54 | 54 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 14 | Build | 54.1 | 54.1 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 15 | Build | 54.4 | 54.4 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 16 | Build | 54.8 | 54.8 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 17 | Race preparation | 55 | 55 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 18 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 19 | Race preparation | 55.3 | 55.25 | 13 | 0 | easy, easy, easy, easy, easy, long |
| 20 | Race week | 20 | 20 | — | 0 | easy, easy, easy, easy, easy, race |

### 5k-20w-6d-q1-advanced

Input: 54 km/week, 13 km long, 6 days; 1 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 2 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 3 | Maintenance | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 4 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 5 | Maintenance | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 6 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 7 | Maintenance | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 8 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 9 | Maintenance | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 10 | Maintenance | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 11 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 12 | Build | 54 | 54 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Build | 54 | 54 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 14 | Build | 54.4 | 54.4 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 15 | Build | 54.4 | 54.4 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 16 | Build | 55.2 | 55.2 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 17 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 18 | Race preparation | 55.2 | 55.2 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 19 | Race preparation | 55.7 | 55.7 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 20 | Race week | 20.5 | 20.475 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-20w-6d-q2-advanced

Input: 54 km/week, 13 km long, 6 days; 2 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 53.1 | 53.05 | 13 | 2 | easy, tempo, easy, fartlek, easy, long |
| 2 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 3 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 4 | Maintenance | 53.1 | 53.05 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 5 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 6 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 7 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 8 | Maintenance | 53.1 | 53.05 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 9 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 10 | Maintenance | 53.1 | 53.05 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 11 | Build | 53.4 | 53.386 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 12 | Build | 53.5 | 53.508 | 13 | 1 | easy, tempo, easy, easy, easy, long |
| 13 | Build | 54.9 | 54.85 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 14 | Build | 55.2 | 55.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 15 | Build | 55.3 | 55.3 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 16 | Build | 55.3 | 55.3 | 13 | 1 | easy, fartlek, easy, easy, easy, long |
| 17 | Race preparation | 56.2 | 56.15 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 18 | Race preparation | 57 | 56.95 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 19 | Race preparation | 57 | 56.95 | 13 | 2 | easy, fartlek, easy, tempo, easy, long |
| 20 | Race week | 20.9 | 20.908 | — | 1 | easy, tempo, easy, easy, easy, race |

### 5k-8w-foundation

Input: 0 km/week, 0 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 1 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 2 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 3 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 4 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 5 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 6 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 7 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 8 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |

### 10k-8w-foundation

Input: 0 km/week, 0 km long, 3 days; 0 requested weekday workouts. Mandatory taper: 2 week(s). Daily taper offsets: 6, 5, 4, 3, 2, 1, 0 days before race.

| Week | Phase | Target km | Actual training km | Long km | Weekday Q | Kinds |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 2 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 3 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 4 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 5 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 6 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 7 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |
| 8 | Foundation | 0 | 0 | — | 0 | easy, easy, easy |

## Explicit refusals

| Case | Refusal |
| --- | --- |
| 5k-8w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-10w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-12w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-16w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-20w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-8w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-10w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-12w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-16w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-20w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-8w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-10w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-12w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-16w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-20w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-8w-6d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-10w-6d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-12w-6d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-16w-6d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 5k-20w-6d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-8w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-10w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-12w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-16w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-20w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-8w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-10w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-12w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-16w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-20w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-8w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-10w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-12w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-16w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| 10k-20w-5d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-8w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-12w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-16w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-20w-3d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-8w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-12w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-16w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| half-20w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| marathon-8w-3d-q0 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-8w-3d-q1 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-8w-3d-q2 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-12w-3d-q0 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-12w-3d-q1 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-12w-3d-q2 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-16w-3d-q0 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-16w-3d-q1 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-16w-3d-q2 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-20w-3d-q0 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-20w-3d-q1 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-20w-3d-q2 | PlanError: This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| marathon-8w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| marathon-12w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| marathon-16w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| marathon-20w-4d-q2 | PlanError: Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |
| ultra-12w-3d-q0 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-12w-3d-q1 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-12w-3d-q2 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-16w-3d-q0 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-16w-3d-q1 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-16w-3d-q2 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-20w-3d-q0 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-20w-3d-q1 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-20w-3d-q2 | PlanError: This block needs a recent baseline of 40 km per week, a 16 km longest run and 4 running days. Build a base or choose a shorter distance first. |
| ultra-12w-4d-q0 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-12w-4d-q1 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-12w-4d-q2 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-16w-4d-q0 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-16w-4d-q1 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-16w-4d-q2 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-20w-4d-q0 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-20w-4d-q1 | PlanError: Ultra preparation needs five available running days in this first policy. |
| ultra-20w-4d-q2 | PlanError: Ultra preparation needs five available running days in this first policy. |
