# Implemented 5K, 10K and half-marathon policy

Implemented 23 September 2026 as training policy v33. Scope is the exact named 5K, 10K and half-marathon goals. Marathon, custom, ultra and base prescriptions retain their existing policy; 21 saved marathon scenarios and the historical non-road compatibility cases protect that boundary.

## Research and design

The original prescriptions synthesize [18 short-road plans](short-road-plans-2026-09-23.md) and [13 half-marathon plans](half-road-plans-2026-09-23.md). Published plans inform workout roles, experience distinctions and recovery patterns. The numerical bands below are Stride engineering choices, not claims of universal physiological thresholds.

| Goal | Developing / established / advanced long-run reference | Ordinary increase | Taper |
| --- | --- | --- | --- |
| 5K | 6 / 10 / 14 km | Hold or 1 km | Final 7 days |
| 10K | 9 / 13 / 16 km | Hold or 1 km | Final 7 days |
| Half marathon | 16 / 19 / 23 km | Hold or 1 km; up to 2 km from a baseline of at least 12 km | Final 14 days |

These references are ceilings for development, not mandatory targets. Time limits, available weekly distance and preparation time may produce a lower peak. An accepted longer existing baseline is retained rather than cut down to the reference. A fractional opening anchor is preserved; subsequent increases use whole kilometres. Marked recovery and date-based taper reductions are deliberate exceptions to ordinary progression.

Ability uses established running, current weekly volume, recent long run and current running frequency. Pace is used for workout targets and time cost. Recent workout history independently limits the opening quality dose. Low-frequency routines use the conservative developing band even when their existing long run is retained.

## Observable behaviour

- A complete opening training week preserves the entered weekly distance and recent long run when the selected schedule can support both. Partial entry, active taper and replanning from recorded history have separate constraints. Conflicting input returns a descriptive error rather than silently inflating the baseline or removing a requested workout.
- Explicit 0, 1 or 2 weekday workouts remain distinct from the easy long run. Automatic mode resolves to zero for developing runners and to one for established runners, subject to completion intent and recent quality history. Two total running days cannot accommodate a separate long run and an explicit quality slot under the spacing rules.
- 5K sessions develop short race-effort repetitions and threshold work. 10K sessions develop longer race-effort blocks and threshold work. Half-marathon sessions develop sustained race-effort endurance and threshold work. Developing, gentle and completion-oriented profiles use controlled intensity.
- Planned repetition exposures progress the forecast, while completed-work evidence is separately checked for execution, actual date and duplicate provider identity. Unknown execution is not successful training evidence.
- Main-set duration, total session duration and optional easy padding have separate limits. Extra weekly volume goes to easy days within their limits. It cannot turn a short interval set into an arbitrarily long workout.
- Validation inspects saved step content and actual counts. Missing runs, strides presented as full workouts, hidden hard long runs and lost weekday sessions are rejected. Recorded-history exceptions apply only to the affected weeks.
- Preference edits, workout variety, resizing, backup serialization and policy upgrades use the same rules. An existing plan is rebuilt under the new policy through its normal preference/replan path; history is preserved.

## Verification

The [generated report](../verification/2026-09-23/road-overhaul/README.md) records its source hash, 793 input scenarios, rejection reasons, weekly progression and 21 complete twelve-week daily examples. It independently checks saved prescriptions rather than relying solely on the engine validator. Reproduce it with `npm run verify:road`.

The test suite also covers adversarial plan corruption, actual-training history, preference changes, format changes, compatibility and unchanged marathon prescriptions. Passing these software checks establishes the tested contracts; it does not establish that every possible runner or input has been covered.

Final local checks: 2,518/2,518 main-suite tests and 9/9 legacy-engine tests passed. Type checking, application lint, production build and tracked diff whitespace checks passed. The 21 marathon snapshots passed without changing their expected prescriptions. No push or deployment was performed.
