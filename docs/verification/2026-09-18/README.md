# Training engine verification — 18 September 2026

Engine `stride-0.10.1`; policy `provisional-2026-09-16-v32`.

This commit includes the declared-baseline refactor, subsequent engine fixes, regression tests and these written reports. The proposed full-plan UI redesign has not been implemented or included.

## Implemented behavior

- A complete fresh ordinary opening week starts at the supplied weekly and long-run distances. Incompatible limits produce a controlled input error.
- Ordinary long-run targets retain the familiar opening baseline and progress on whole kilometres, with recovery/taper exceptions and a 35 km marathon ceiling. A familiar fraction above an event-family forecast or binding ceiling can be held without a false decline.
- Standard established balanced weeks retain one complete weekday quality workout plus the long run. Custom workout counts and specialist/return/history contracts remain supported.
- Pace targets fund both time and distance plans consistently. Measurement changes preserve funded metres and protected history or reject conflicting limits atomically.
- Actual taper dates control familiar-day ceilings. Aerobic time around intact quality recipes can fund baseline distance when easy-day capacity is exhausted, with consistent executable rounding.
- Contradictory long-ultra distance and recent-minute evidence is rejected explicitly.

## Verification

The main suite passes **1,459/1,459** tests, including the current serialized compatibility fixture and new regressions. The standalone engine passes **9/9**. TypeScript and the production build pass. Main tests, standalone tests and typecheck were repeated before this push; the full production build was also repeated.

The expanded audit from 16 September ran **4,119 scenario checks** with no unexpected failures under its declared contracts:

| Matrix | Cases | Results |
|---|---:|---|
| Core generation | 2,592 | 1,979 accepted; 613 controlled rejections; zero independent violations or runtime errors |
| Custom distances and ultra boundaries | 580 | 335 accepted; 245 documented rejections; zero false/unclassified rejections |
| Calendar and constraints | 407 | 285 accepted; 122 controlled rejections; all expectations matched |
| State and preference lifecycle | 525 | All passed |
| Representative progressions | 15 | All accepted and validated |

All 44 original quality-dropout profiles were replayed: 495 ordinary weeks retained the weekday workout plus long run. The original twelve measurement conversion failures also pass. Four calendar expectation mistakes were corrected before the final audit using existing marathon exposure and long-ultra preparation rules. Controlled rejection is the expected result for conflicting baselines/caps, unsupported inputs and existing preparation gates.

[Audit summary and source fingerprint](audit-summary.json). Source fingerprints identify the audited engine content; formatting and documentation packaging may have changed afterward. The 16 September checks concern the stated software contracts and are not a claim that every generated training choice has been independently reviewed.

## Full example plans

- [All fifteen full daily plans](example-plans/ALL-DAILY-PLANS.md): 270 weeks, 1,890 calendar days, 1,338 sessions, 552 rest days and 2,627 ordered steps.
- [Choose a distance](example-plans/README.md), including every preset race distance plus base/custom cases.
- [Compare all opening weeks](example-plans/FIRST-WEEK-CHECK.md).
- [Weekly progression tables](weekly-progressions.md).
- [12-week marathon: all 84 days](marathon-12-week.md) and its [raw saved plan](marathon-12-week.json).

The examples use declared sample profiles and preserve the actual engine output. A distance marked approximately is an estimate for a timed workout; it is not a precise distance stopping condition. Race distance is excluded from weekly training totals. The recent example profiles have no race benchmark, so their prescriptions use saved effort cues rather than invented faster pace targets.

## Known observations from the later 12-week simulation

The 70 km/week, 23 km familiar-long marathon example passes `validatePlan` but schedules 35 km long runs 21 and 14 days before race day. Its final weekday training rises from 26.267 km in taper week 11 to 31.433 km in race week, including a Wednesday increase from 46 to 56 minutes and an 8.3 km Friday run. These outputs were disclosed in the day-by-day review and have not been changed by this documentation/push task. They are outside the six defect categories resolved in the earlier audit.

## Reproduce the repository checks

```sh
npm test
npm run test:engine
npm run typecheck
npm run build
```

Full raw matrices and local HTML report viewers remain generated workspace artifacts outside version control. This archive keeps the final findings, sample prescriptions and compact outcome evidence alongside the implementation.
