# Final verification — 25 September 2026

These results verify the implemented session balance, workout variety, review baseline preservation and pace-aware distance conversion changes. They supplement the independent plan-quality report; structural test success alone is not evidence of a coherent training plan.

Final library source fingerprint: `5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea`.

| Check | Result |
| --- | --- |
| `npm test` | 3,043 passed; zero failed, skipped or cancelled |
| `npm run test:engine` | 12 passed |
| `npm run typecheck` | Passed |
| `npm run lint:app` | Passed |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| Independent plan-quality matrix | 160 attempted; 157 generated plans passed; three explicit constraint rejections; zero unexpected errors or acceptance failures |
| Independent coverage | 2,392 emitted weeks; 3,442 short-support outings checked |
| Pace/edit/export matrix | 200 attempted; 176 completed sequences; 24 explicitly classified generation rejections; zero failures |
| Accepted edit operations | 1,893, with 172,800 prescription checks and 20,254 completed-history snapshots |
| Export checks | 1,893 FIT exports; 1,797 Intervals exports; 96 expected heart-rate export refusals |

The edit matrix also records 43 capacity refusals during otherwise completed sequences. Refusals are separate outcomes, not passing generated plans. Both final matrices recorded unchanged library source during their runs. Export checks exercise generated files/payloads locally, not live device delivery.

Repository-wide `npm run lint` still reports an existing backlog in tests and scripts. Application lint and scoped lint for the new review tests pass. The production build emits Vinext's route-classification notice; the build completes successfully.

## Reviewable examples

The [day-by-day examples](day-by-day.md) contain 12 complete plans: 5K, 10K, half-marathon and marathon with 0, 1 and 2 weekday workouts. The [main report](README.md) explains research, actual workout main sets, intentional repeats, opening mileage changes and limitations. The [independent matrix](quality-final.md) and [pace/edit matrix](pace-edits-final/README.md) retain detailed outcomes.

The reported weekly and longest-run baselines remain saved. Where the requested weekly total conflicts with shorter supporting outings, the plan explicitly discloses a lower opening allocation. For example, the 30 km/week, 8 km long-run 5K profile opens at 26 km: 5.2, 6.4, 6.4 and 8 km. Repeated reviews must not interpret that deliberate allocation as a progressively lower reported fitness baseline.

No commit or push was performed for this review.
