# Road-distance simulation audit — approval report

**Do not approve this working tree for push as fully verified yet.** The 12 representative plans meet their baseline, long-run and weekday-frequency contracts, but the broader audit found real configuration/allocation defects and validator gaps. Nothing was pushed, and no production code or saved user plan was changed during this audit.

Only **5K, 10K, half-marathon and marathon** were simulated. Custom events and ultras were excluded. This is a broad, reproducible finite sweep, not proof of every possible combination or independent coaching approval.

## Read every day of every plan

Start with **[the compact week-by-week schedules](WEEK-BY-WEEK.md)**: 144 weekly rows showing all **1,008 calendar days**, including rest days. Each individual plan below adds the exact saved warm-up, work repetitions, recoveries, cooldowns and pace targets. [All exact sessions in one file](ALL-WEEKS.md) is also available.

| Distance      | Starting weekly / long-run distance | Zero weekday workouts        | One weekday workout          | Two weekday workouts         |
| ------------- | ----------------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| 5K            | 50 / 10 km                          | [0 workouts](5k-q0.md)       | [1 workouts](5k-q1.md)       | [2 workouts](5k-q2.md)       |
| 10K           | 50 / 12 km                          | [0 workouts](10k-q0.md)      | [1 workouts](10k-q1.md)      | [2 workouts](10k-q2.md)      |
| Half-marathon | 55 / 16 km                          | [0 workouts](half-q0.md)     | [1 workouts](half-q1.md)     | [2 workouts](half-q2.md)     |
| Marathon      | 70 / 23 km                          | [0 workouts](marathon-q0.md) | [1 workouts](marathon-q1.md) | [2 workouts](marathon-q2.md) |

All representative plans run **21 September–13 December 2026: 12 complete weeks**. They use established five-day runners, a Sunday long run, 120-minute weekday and 300-minute long-run limits, balanced difficulty and gradual volume. The benchmark is 10K in 50:00. A five-run background and at least 45 km/week make the two-workout choice eligible under the current policy, so all three settings can be compared at the same baseline. Lower-mileage and restricted schedules are examined separately in the boundary audit.

The actual saved running days in these examples are Tuesday, Wednesday, Thursday, Friday and Sunday, selected by the existing availability solver. Rest days are Monday and Saturday. The two-workout choice means **two weekday workouts plus the separate long run**, not two total key sessions. Strides are excluded from full-workout counts. Zero-workout examples contain no hidden hard long runs.

For mixed/timed prescriptions, reported kilometres are allocation estimates. The exact saved steps determine whether to stop at a distance or a duration. Weekly training totals exclude the race. Daily easy-run fractions are retained as generated; the whole-kilometre progression contract applies to long runs.

## Long-run progression

These are the **one-workout** examples, in week order 1–12; the individual zero/two-workout reports show their exact values too. The 5K recovery distance in week 8 is 7 km for the one-workout example and 8 km for the zero/two examples.

| Distance      | Long runs, weeks 1–12, km                                |
| ------------- | -------------------------------------------------------- |
| 5K            | 10 → 10 → 10 → 8 → 10 → 10 → 10 → 7 → 11 → 7 → — → —     |
| 10K           | 12 → 12 → 12 → 9 → 14 → 14 → 14 → 11 → 16 → 9 → — → —    |
| Half-marathon | 16 → 16 → 18 → 14 → 18 → 20 → 21 → 15 → 17 → 11 → — → —  |
| Marathon      | 23 → 25 → 27 → 21 → 29 → 31 → 33 → 24 → 35 → 35 → 21 → — |

Weeks 4 and 8 are designated recovery. A dash means no separate long run is scheduled; ordinary short runs still appear in the daily table. Road taper can start on the Sunday of a week still labelled Race preparation: week 10 for 5K/10K, week 9 for half-marathon. Those reductions are governed by the actual date, not an unexplained ordinary build-week dip. The labels need clearer UI explanation.

## Actual weekday workout counts

| Plan                               |  W1 |  W2 |  W3 |  W4 |  W5 |  W6 |  W7 |  W8 |  W9 | W10 | W11 | W12 |
| ---------------------------------- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 5K · 0 weekday workouts            |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |
| 5K · 1 weekday workouts            |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   1 |
| 5K · 2 weekday workouts            |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   1 |
| 10K · 0 weekday workouts           |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |
| 10K · 1 weekday workouts           |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   1 |
| 10K · 2 weekday workouts           |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   1 |
| Half-marathon · 0 weekday workouts |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |
| Half-marathon · 1 weekday workouts |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   1 |
| Half-marathon · 2 weekday workouts |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   1 |
| Marathon · 0 weekday workouts      |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |
| Marathon · 1 weekday workouts      |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   0 |   1 |   1 |   1 |   1 |
| Marathon · 2 weekday workouts      |   2 |   2 |   2 |   0 |   2 |   2 |   2 |   0 |   2 |   2 |   1 |   1 |

Every ordinary week in these 12 examples retains its explicit choice. Recovery/taper exceptions are shown rather than hidden. Independent review checked 84 full ordinary weeks and all 720 session prescriptions, including race sessions.

## What passed and what failed

| Audit                            | Result                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twelve full representative plans | 144 weeks; zero independently detected baseline, progression, frequency, spacing or executable-duration failures                                                                      |
| Fresh generation boundary sweep  | 1,494 inputs: 834 accepted cleanly; **14 accepted with an explicit-setting failure**; 646 controlled rejections; zero unexpected exceptions                                           |
| Boundary rejection review        | 494 inputs independently conflict with documented entry/range rules. **152 capacity/allocation rejections are not certified correct**; concrete defects/conflicts are described below |
| Saved-plan route/edit audit      | 24/24 cases; 864 accepted-operation checks passed; 144 incompatible requests rejected with unchanged saved state                                                                      |
| Deliberately damaged plans       | **8/8 incorrectly accepted by validation**: four missing-session cases and four strides-as-quality cases                                                                              |
| Audit-script lint and diff check | Passed                                                                                                                                                                                |

The boundary sweep examines low/zero/high baselines, fractional anchors, two through six running days, short through 52-week timelines, all race weekdays, constrained time/distance budgets, fast/slow pace inputs, time/distance modes, returning/new runners, finish intent, availability conflicts and day-specific limits. It is not a full Cartesian product. The edit audit covers 0 → 1 → 2 → 0 changes, benchmark performance/context, manual targets, recipe/format changes, logs/corrections, protected manual/history records, preview/save, export and recovery. Sub-metre conversion rounding is explicitly bounded and documented; no cumulative drift was found.

## Defects to resolve before approval

1. **Explicit preferences are silently changed in two-day 5K/10K plans.** Fourteen accepted inputs requested one or two weekday workouts and were saved with zero. Two-day easy-only policy should be explained through a controlled rejection or explicit review, rather than silently rewriting the choice. Source: `lib/plan/profile.ts:568`.
2. **A valid marathon profile hits a rounding-related allocation failure.** At a supported easy pace of 3 min/km, 70 km/week, 23 km long run and one workout, week 6 incorrectly reports insufficient capacity. A 33-metre remainder is applied to a minimum-duration easy run and recalculated below five minutes, despite ample day capacity. Source: `lib/plan/generation-baseline.ts`, `fundWeek`/`assign`; reproduction `marathon-q1-pace-3-distance`.
3. **Finish intent conflicts with an explicit two-workout choice.** Eligible 5K/10K/half inputs with generous capacity reject even though the matching improve-intent profiles pass. Recipe selection chooses economy work before respecting the explicit two-workout branch, then frequency validation fails. This needs a consistent rule and an accurate message.
4. **Validation misses an unmarked deleted workout.** Deleting one week-3 quality session from each otherwise valid two-workout plan leaves one, but validation accepts all four. Incomplete run counts are excluded from the very check intended to detect the disappearance. Source: `lib/plan/generation-rhythm.ts:61`.
5. **Validation can count strides as a full workout.** A real economy/strides recipe retaining a stale `hard: true` flag satisfies the explicit frequency check in all four negative cases. Meaningful recipe content needs to be checked independently of that flag. Source: `lib/plan/generation-rhythm.ts:112`.

Items 4–5 use deliberately damaged copies. They are defensive validation gaps, not a claim that the 12 normal plans actually lost sessions. No fixes have been quietly applied or failures removed from this report.

## Real outputs that deserve allocation/policy review

- **5K workouts can contain 87 minutes of easy running before the first interval.** In the one-workout plan, weeks 7 and 10 have 120-minute sessions with only ten minutes of actual interval work, allocating 18.09 km against 10/7 km designated long runs. Counts and totals pass while the resulting session structure is questionable.
- **The marathon taper redistributes volume onto weekday runs.** In all three marathon examples, every race-week weekday run grows relative to the preceding week. For two workouts, Tuesday/Wednesday/Thursday/Friday change from 44/49/32/49 to 54/60/35/60 minutes. Total training still falls because the long run disappears.
- **All three marathon examples schedule 35 km both 21 and 14 days before race day.** This matches the compact-block policy and is not an arithmetic failure. It remains a policy decision requiring review, especially with the modeled duration of about 3 h 52 min per run.
- **Mixed long-run explanations still say they consume a workout slot.** The explicit setting counts weekday workouts and those remain present. The wording should describe the shared work allowance and separate long run accurately.

These observations are factual outputs; this audit does not establish a medical safety conclusion or certify coaching effectiveness. See the [independent review](independent-review.md) for exact dates and step breakdowns.

## Original half-marathon regression

The exact **30 km/week + 20 km recent long run** case now starts at **30/20 in week 1**, followed by **31.6/20 in week 2**, for both zero and one weekday workout. It does not jump to 44 km or drop the long run to 19.1 km. Selecting two is explicitly rejected by the current 45 km/week eligibility threshold. Full weekly distances, long runs and counts are in [the boundary report](boundaries.md).

## Evidence and reproduction

- [Generation boundaries and rejected-input analysis](boundaries.md) · [exact inputs/results](boundaries.json)
- [Saved-plan edits, logging and recovery](edits.md) · [exact operations/results](edits.json)
- [Negative validator cases](validator.md) · [exact mutations/results](validator.json)
- [Raw representative plans](plans.json) · [weekly totals CSV](weekly-totals.csv)

Run from the repository with Node.js 24:

```sh
node --experimental-strip-types scripts/simulate-road-plans.mjs
node --experimental-strip-types scripts/audit-road-boundaries.mjs
node --experimental-strip-types scripts/audit-road-edits.mjs
node --experimental-strip-types scripts/audit-road-validator.mjs
```

These reporting commands preserve findings in artifacts; a command finishing is not a passing release verdict. Replaying a single boundary case can use `--case CASE_ID --report-dir /private/tmp/stride-boundary-replay` so the full report is retained. The base commit, dirty-tree status, engine/policy version and source fingerprints are in the JSON. Existing app improvements were already uncommitted when this audit began. The production library fingerprint stayed unchanged throughout this audit.
