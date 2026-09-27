# Road-event generation boundary audit

Read-only working-tree audit generated 2026-09-19T19:22:11.620Z. Base Git SHA: `f6e80a3352ec8539a98c5dcb7ec1598202e88eaa`; dirty working tree: **true**. Engine `stride-0.10.1`, policy `provisional-2026-09-16-v32`. No account data, network, custom events or ultras were used. No production code was changed by this audit.

## Result

1494 distinct inputs: **834 accepted without an audited invariant failure**, **14 accepted with a failure**, **646 controlled PlanError rejections**, **0 unexpected exceptions**. 5985 ordinary weeks were examined.

| Event | Inputs | Accepted pass | Accepted failure | Controlled rejection | Unexpected exception |
|---|---:|---:|---:|---:|---:|
| 5k | 375 | 234 | 8 | 133 | 0 |
| 10k | 375 | 228 | 6 | 141 | 0 |
| half | 372 | 202 | 0 | 170 | 0 |
| marathon | 372 | 170 | 0 | 202 | 0 |

## What was checked

- Explicit 0/1/2 weekday-workout choices retained in the saved profile; eligible full ordinary weeks deliver that count separately from long runs. Introductory/return Foundation and run-walk weeks are labelled separately, as are two-day easy-only routines. Recovery and race-relative taper weeks have no ordinary-frequency requirement.
- Exact positive declared opening weekly and long-run distance on complete ordinary opening weeks; JSON round-trip; finite positive prescriptions; unique workout/date identities; race date and exact race distance; step-duration sums; running-day/session/weekly time caps.
- Ordinary long runs stay level or increase, with whole kilometres except an unchanged declared fractional anchor; ordinary increases stay within 2 km; ordinary weekly distance does not regress; demanding outings retain an easy/rest day between them; marathon long runs do not exceed 35 km. Taper boundaries are independently interpreted from the documented date rules, not through the production taper helper.
- Production validatePlan was also run, but its acceptance alone is not treated as independent proof. Every accepted case includes week-by-week totals/counts in boundaries.json.

## Half-marathon 30 km/week + 20 km long-run regression

These exact inputs use five running days, a 12-week block, easy pace 6 min/km, and 120/300-minute weekday/long-run limits. Existing recent quality history matches the explicit choice. Each input is retained verbatim in JSON.

| Requested weekday workouts | Result | Week 1 total / long km | Week 2 total / long km | Long-run km, weeks 1–12 (or rejection) |
|---:|---|---|---|---|
| 0 | accepted-pass | 30 / 20 | 31.6 / 20 | 20 → 20 → 20 → 16 → 20 → 20 → 21 → 15 → 17 → 12 → — → — |
| 1 | accepted-pass | 30 / 20 | 31.6 / 20 | 20 → 20 → 20 → 16 → 20 → 20 → 21 → 15 → 17 → 12 → — → — |
| 2 | controlled-rejection | — | — | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. |

- **0 workouts:** weekly training km [30, 31.6, 33.6, 27.4, 35.6, 37.8, 39.8, 31.6, 38.8, 27.6, 16.2, 7.2]; weekday-workout counts [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].
- **1 workouts:** weekly training km [30, 31.6, 33.6, 27.4, 35.6, 37.7, 39.933, 31.7, 38.633, 27.6, 16.8, 7.1]; weekday-workout counts [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0].

The accepted 0/1 choices retain **30 km total and 20 km long run in week 1**, then **31.6 km total and 20 km long run in week 2**. Weeks 4 and 8 are recovery. Week 9 enters the race-relative taper on its Sunday long-run date even though its weekly phase still reads Race preparation; weeks 10–12 are taper/race weeks. “—” means no separate training long run, with the race excluded from these totals. The explicit 2 choice is rejected by the existing **45 km/week minimum**, not silently reduced to 1.

## Coverage

Four road events and all three explicit counts; starting distances including 30 km/week with a 20 km long run, zero and low baselines, fractional weekly and long anchors, 2–6 running days, constrained/generous session and weekly limits, 1–364-day blocks, supported pace values 3–15 min/km plus an invalid 20 min/km boundary, both time/distance modes, returning/new/gentle/finish runners, every race weekday in 4-, 12- and 20-week spans, consecutive/separated three-day availability, compressed five-day availability, preferred hard days with per-day caps, and cross-training conflicting with the long day. Inputs are a bounded orthogonal sweep, not the full Cartesian product.

## Accepted-case findings

### explicit-setting-changed: 14 accepted inputs

- `5k-q1-baseline-15-5-2days`: Requested 1; saved 0 (custom).
  Replay: `node --experimental-strip-types scripts/audit-road-boundaries.mjs --case 5k-q1-baseline-15-5-2days --report-dir /private/tmp/stride-boundary-replay`
- `5k-q1-baseline-30-10-2days`: Requested 1; saved 0 (custom).
  Replay: `node --experimental-strip-types scripts/audit-road-boundaries.mjs --case 5k-q1-baseline-30-10-2days --report-dir /private/tmp/stride-boundary-replay`
- `5k-q1-baseline-30-20-2days`: Requested 1; saved 0 (custom).
  Replay: `node --experimental-strip-types scripts/audit-road-boundaries.mjs --case 5k-q1-baseline-30-20-2days --report-dir /private/tmp/stride-boundary-replay`


The accepted setting failures are a real configuration defect: two-day 5K/10K routines silently rewrite an explicit 1/2 selection to 0. The two-easy-outing policy can justify rejecting the incompatible input, but does not justify silently saving a different explicit choice. The normalization occurs before explicit-two eligibility in `lib/plan/profile.ts`. No production fix was made during this audit.

## Rejections require interpretation

494 rejections coincide with an independently checked conflict against the literal named-event entry table and declared input bounds (`lib/plan/policy.ts`, `lib/plan/policy-constants.ts`). This confirms an input conflict exists, not that each coaching threshold is scientifically validated or that the returned message explains every conflict. The other **152 controlled rejections remain product-review cases**, not automatically correct outcomes. The complete input and message for every rejection are in boundaries.json. A controlled error prevents a broken plan being silently accepted, but can still reveal an unnecessarily restrictive rule.

Most frequent messages:

| Count | Message | Example input |
|---:|---|---|
| 145 | Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. | `5k-q0-baseline-45-16-2days` |
| 135 | This block needs a recent baseline of 32 km per week, a 12 km longest run and 4 running days. Build a base or choose a shorter distance first. | `marathon-q0-baseline-0-0-2days` |
| 75 | This block needs a recent baseline of 24 km per week, a 8 km longest run and 3 running days. Build a base or choose a shorter distance first. | `half-q0-baseline-0-0-2days` |
| 70 | Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now. | `5k-q2-baseline-15-5-3days` |
| 60 | This block needs a recent baseline of 18 km per week, a 5 km longest run and 2 running days. Build a base or choose a shorter distance first. | `10k-q0-baseline-0-0-2days` |
| 42 | This block needs a recent baseline of 10 km per week, a 3 km longest run and 2 running days. Build a base or choose a shorter distance first. | `5k-q0-baseline-0-0-2days` |
| 30 | This policy supports a baseline up to 80 km per week. Higher-volume plans need an individually reviewed policy. | `5k-q0-baseline-90-28-2days` |
| 24 | Check your weekday time limit; enter a number between 20 and 120. | `5k-q0-limit-weekday10` |
| 24 | Easy pace must be between 3 and 15 minutes per kilometre, or left blank. | `5k-q0-pace-20-distance` |
| 12 | Check your long-run time limit; enter a number between 30 and 300. | `5k-q0-limit-long20` |
| 12 | Keep cross-training days separate from your long run and paired running day. | `5k-q0-schedule-cross-training-long-conflict` |
| 11 | Week 1 cannot retain your selected 2 weekday workouts within the current allocation. Review the workout count, running days and session limits together. | `5k-q2-limit-quality1km` |
| 4 | Week 1 cannot fit a 30-minute quality workout within the selected time and distance limits. | `5k-q1-limit-quality1km` |
| 1 | Week 6 cannot retain your selected 2 weekday workouts within the current allocation. Review the workout count, running days and session limits together. | `half-q2-limit-quality5km` |
| 1 | Week 6 cannot maintain 75.933 km within the selected running days, session limits and weekly time ceiling. Review these limits together. | `marathon-q1-pace-3-distance` |

## Concrete allocation findings among controlled rejections

- **Confirmed numerical allocation defect:** `marathon-q1-pace-3-distance` declares 70 km/week, 23 km long run, five runs, one weekday workout, easy pace 3 min/km, and generous 120/300-minute limits. Week 6 rejects maintaining 75.933 km. A separate read-only loader trace (no production file edit) found `fundWeek` adding a 33 m remainder to a displayed 1.600 km / 300-second easy run. It tries 1.633 km / 294 seconds, then fails the five-minute minimum despite a 7,200-second day cap. The inconsistency is between rounded distance and minimum duration, not an exhausted time ceiling. Source: `lib/plan/generation-baseline.ts`, `fundWeek` / `assign`. Full input is in JSON; replay the case to reproduce the controlled error.
- **Explicit-two/finish-intent conflict needs resolution:** `5k-q2-experience-finish`, `10k-q2-experience-finish`, and `half-q2-experience-finish` meet the explicit-two entry prerequisites and reject in week 1 with generous caps. Their corresponding improve-intent reference profiles pass. Recipe selection still sends finish intent to `economy-relaxed` before the explicit-two recipe branch (`lib/workout-library.ts`), while the new frequency contract refuses to accept fewer workouts. This exposes a policy/implementation conflict; the engine should either support the explicit choice or reject the incompatible preference directly with an accurate reason.

These are included among the 152 allocation/capacity review cases above, not counted as accepted plans or successful rejections. No fix was applied during this audit.

## Reproduction and limitations

Run `node --experimental-strip-types scripts/audit-road-boundaries.mjs`; use `--case CASE_ID --report-dir /private/tmp/stride-boundary-replay` to replay an exact input without overwriting the full report. The script calls production `makePlan(profile, referenceDate, false)`: alternative-date search is disabled to keep rejection runs bounded; the training generation and validation paths are unchanged.

This audit concerns fresh generation, not server concurrency, saved-plan edits, watch delivery or coaching effectiveness. The root report covers representative daily plans and separate lifecycle checks. Passing assertions is not independent coaching approval. Very short/race-week starts intentionally do not force a full declared opening week; two-day routines have no separately labelled long run. All such scope distinctions are visible in JSON rather than counted as ordinary-week successes.
