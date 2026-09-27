# Plan quality review

This review checks whether the emitted running days have distinct purposes, understandable progression and meaningful workout variety. Passing structural validation alone is insufficient.

## Evidence

- [Final verification summary](verification.md): full suite, engine checks, type checking, application lint, production build and edit/export stress results.
- [Research and authored acceptance criteria](research-and-acceptance.md): eight primary coaching references, their differences, and the explicit opening-mileage tradeoff.
- [Final independent audit](quality-final.md) and [machine-readable results](quality-final.json): 160 attempted profiles, 157 generated plans passing all checks, three separately classified constraint rejections, and 2,392 emitted weeks. Each report includes a source fingerprint and confirms whether source files changed during execution.
- [Current day-by-day examples](day-by-day.md) and [full plan JSON](example-plans.json): the 12 reviewed input profiles, with 0, 1 and 2 workouts for each named race distance.
- [Captured earlier observations](baseline-observations.json): partial numerical evidence recorded before the earlier example files were accidentally overwritten. Those observations are not a preserved full-plan snapshot. The provisional `quality-implementation-draft-saved` report must not be cited as a before-change baseline.

Intermediate `quality-current*` and `quality-accepted` reports document development failures and oracle corrections. They are retained as evidence, not silently replaced by green results. The final report also corrects a variety-oracle gap: a separately typed aerobic-padding step is now excluded along with warm-up/cooldown, so changed padding cannot inflate distinct main-set counts. Earlier marathon variety totals are superseded.

## Coverage and interpretation

The 12 exact examples cover 12-week 5K/10K, 16-week half-marathon and 20-week marathon blocks. The wider matrix varies time/distance measurement, time/distance recipe formats, benchmarks versus effort targets, 5 and 7 min/km assumptions, familiar mode, maintained volume and midweek calendars. Six additional road q1/q2 cases combine a 20-minute 5K benchmark with a declared 6 min/km easy pace to catch inconsistent timed-run funding. Four additional marathon profiles stress a support-heavy 45 km weekly baseline with a 12 km long run. Six custom-distance regression companions exercise the marathon rhythm at 31, 42.195 and 45 km; they do not receive the named-distance hierarchy verdict.

For full ordinary and recovery weeks, the independent oracle checks ordinary easy outings against 80% of the designated long run, and short support near the long run or before another running day against 65%. A marathon can contain one explicitly named midweek endurance/medium-long outing, bounded at 90%. The final run checked 3,442 short-support outings. These are declared Stride design bounds, not universal physiological laws. Actual-date mixed taper, partial calendar weeks and race weeks are reported separately.

Quality frequency must match the selected 0/1/2 count during ordinary weeks. Actual main-set/recovery signatures ignore cosmetic titles, warm-up padding and changing pace labels. Default varied plans cannot repeat the identical entire quality prescription for more than two consecutive ordinary weeks; familiar plans may deliberately repeat. Zero-workout plans do not acquire intensity for entertainment. Beginner learning and first-race programmes have separate design contracts and are outside this standard-plan matrix.

The exact examples also check byte-for-byte preservation of completed and delivery-protected sessions during variety refresh, unchanged IDs/dates/session counts, and valid refreshed plans. Eighteen executable regression tests cover these examples, misleading variety labels, non-finite accounting, restored allocation metadata, negative cases that prevent the role exceptions becoming loopholes, and repeated full reviews after JSON restoration that must not ratchet a deliberately reduced forecast into a lower reported training baseline.

The three rejected inputs are the marathon examples changed to `volume: maintain`: their fixed 23 km longest exposure cannot meet the engine's 26 km marathon exposure policy. They are not counted as generated, passing or viable plans. No arbitrary exception allows an unexpected generation error to pass.

The audit checks coherent prescriptions under the declared inputs. It does not demonstrate adherence, individual race readiness, a particular finish time, or real-device export delivery. Separate training and delivery suites cover additional contracts.

## Final result and actual work

All 18 independent regression tests pass; scoped type-aware lint passes. The final matrix has no unexpected generation errors or acceptance failures. Source files were unchanged throughout the run:

`5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea`

Median generation time was 18.222 ms, the 95th percentile 39.982 ms, and the maximum 51.479 ms on this local run; these figures are not a backend load test.

The exact reviewed examples preserve every declared opening long run. Where role limits reduce the opening weekly allocation, the recorded baseline remains unchanged: 5K q0 30→26 km, q1 30→26.8 km and q2 55→54.25 km; 10K q0 36→35.75 km and q1 36→34.45 km. The other seven examples retain their declared opening weekly distance.

Main sets below are read from executable work and recovery steps, excluding warm-up, cooldown and aerobic padding. Rest is between repetitions; the complete sessions remain available in the day-by-day report.

| Example                           | Actual work illustrating the change                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 5K q2, weeks 1→2                  | 8×2 min tempo / 60 sec recovery plus 7×90 sec 5K effort / 75 sec; then 10×200 m 5K effort / 60 sec plus 10×90 sec tempo / 60 sec.   |
| 10K q2, weeks 1→2                 | 8×2 min tempo / 60 sec plus 4×3 min 10K effort / 90 sec; then 10×90 sec tempo / 60 sec plus 7×2 min 10K effort / 75 sec.            |
| Half q2, second workout weeks 1→2 | 5×3 min half-marathon effort / 60 sec; then a 2–3–3–3–2 minute half-marathon-effort pyramid with 90 sec recoveries.                 |
| Marathon q2, weeks 5→6            | 5×1 km threshold / 60 sec plus 4×3 min intervals / 90 sec; then 5×5 min threshold / 60 sec plus 3×1.5 km marathon effort / 120 sec. |

The q1 examples have 6, 6, 8 and 11 distinct ordinary-week main-set signatures for 5K, 10K, half and marathon; q2 has 12, 15, 15 and 21. This is not a requirement to invent a new session every week. The marathon q2 introduction deliberately repeats a six-minute tempo four times across its first two weeks, before its main progression. Its maximum identical **week** streak is two, while its exposure streak is four; both are reported truthfully. Road q1 examples initially alternate 7×2 minutes and 9×90 seconds at tempo with 60-second recoveries before their later progression.

## Reproduce

```sh
node --experimental-strip-types scripts/audit-plan-quality.mjs --tag review-unique-tag
node --experimental-strip-types --test tests/plan-quality-review.test.mjs
npx oxlint --type-aware scripts/audit-plan-quality.mjs tests/plan-quality-review.test.mjs
```

Audit tags must be unique: the script refuses to overwrite prior evidence. Add `--examples-only` for the exact 12 inputs, `--case ID` for a specific reproduction, or `--saved` to inspect the current stored examples without regeneration. A nonzero exit indicates an unexpected rejection, failed acceptance check, or source modification during the run.
