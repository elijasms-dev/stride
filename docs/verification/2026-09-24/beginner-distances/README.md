# Beginner distance plans — verification

Beginner 5K, 10K, half-marathon and marathon programmes now have an explicit
identity and a separate path from established-runner plans. Select **Beginner ·
build towards a first finish** during plan setup. Selecting **new to running**
also selects that approach for the four named distances.

The implementation is an authored adaptation of [published beginner programmes](../../../research/beginner-distance-plans.md).
Zero-history runners receive the timed NHS foundation regardless of their
longer-term race goal. Runners below a distance block's entry base receive a
clear preparation message; that base is never invented or silently increased.

## Results

| Check | Result |
| --- | --- |
| Full automated test suite | 2,877 passed; 0 failed |
| Strict beginner-distance scenario matrix | 1,266 cases; 0 unexpected outcomes |
| Adequate forecasts under authored preparation criteria | 1,202 |
| Timed foundations | 24 |
| Explicit preparation gaps | 16 |
| Correctly rejected unsupported inputs | 24 |
| Existing established-marathon snapshots | 21 unchanged |
| TypeScript, application lint, production build | Passed |

Every scenario has an expected outcome before generation. An unexpected
`PlanError` fails. A structurally valid plan with inadequate preparation fails
when an adequate forecast was expected. Foundation, preparation gaps and
expected rejection are separate outcomes; they are not race-ready plans.

The matrix varies all seven start weekdays and event weekdays, 5:30/7:00/9:00
planning paces, leap-year and daylight-saving calendars, minimum and fractional
baselines, frequency, tighter caps, short timelines and zero history. Integration
tests exercise missed, partial and tired logs, rest and return reviews, moves,
shortening, preference rebuilds, changed events, pace settings, measurement and
serialized recovery. Actual history remains authoritative.

Preparation assessment examines the emitted long runs and repeated supporting
weeks, time available and recent training interruptions. A future forecast is
conditional on comfortable completion; these software checks are not individual
medical clearance or independent coaching certification.

## Every day of the examples

| Example | Opening weekly / long distance | Runs per week | Calendar | Peak long |
| --- | --- | --- | --- | --- |
| [5K](5k-day-by-day.md) | 8 / 3 km | 3 | 8 weeks | 5 km |
| [10K](10k-day-by-day.md) | 15 / 5 km | 3 | 8 weeks | 9 km |
| [Half marathon](half-day-by-day.md) | 20 / 7 km | 3 | 14 weeks | 16 km |
| [Marathon](marathon-day-by-day.md) | 28 / 10 km | 4 | 20 weeks | 32 km |

Each example includes every prescribed run and rest day. The marathon's final
build uses 32 → 24 (recovery) → 32 km before taper. Speed-session counts are zero;
the easy long run is reported separately. The distance-specific model lengths
are 8/8/12/18 weeks; extra calendar weeks initially hold the actual starting base.

Reproduce with `npm run verify:first-race`, `npm test`, `npm run typecheck`,
`npm run lint:app` and `npm run build`. The matrix and checks JSON files include
the source fingerprint. Nothing was pushed or deployed.

The next [pacing pass](../../../reviews/2026-09-24-pacing-follow-up.md) will align
timed-run estimates, benchmark/manual cues and explanatory copy. New beginner
race plans default to conversational effort; the learning foundation has no
numeric pace targets.
