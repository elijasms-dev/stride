# Road-plan validator negative-case audit

Run: `node --experimental-strip-types scripts/audit-road-validator.mjs` after generating `plans.json`.

**These are deliberately mutated copies, not generated-plan failures.** All 4 untouched road plans pass validation. The audit then damages each plan in two ways. Current validation incorrectly accepts 8/8 negative cases. No production code, app data or normal CI tests are changed.

| Case | Meaningful weekday workouts | Running sessions | Validator result |
| --- | --- | --- | --- |
| 5k-q2-missing-session | 2 → 1 | 5 → 4 | Incorrectly accepted |
| 5k-q2-strides-stale-hard-flag | 2 → 1 | 5 → 5 | Incorrectly accepted |
| 10k-q2-missing-session | 2 → 1 | 5 → 4 | Incorrectly accepted |
| 10k-q2-strides-stale-hard-flag | 2 → 1 | 5 → 5 | Incorrectly accepted |
| half-q2-missing-session | 2 → 1 | 5 → 4 | Incorrectly accepted |
| half-q2-strides-stale-hard-flag | 2 → 1 | 5 → 5 | Incorrectly accepted |
| marathon-q2-missing-session | 2 → 1 | 5 → 4 | Incorrectly accepted |
| marathon-q2-strides-stale-hard-flag | 2 → 1 | 5 → 5 | Incorrectly accepted |

## P2: Unmarked disappearance bypasses the explicit frequency guard

Removing one weekday quality session leaves only one of the selected two workouts. `eligibleWeeks()` excludes weeks whose run count differs from `profile.days.length`, and the weekly progression validator similarly skips incomplete schedules. There is no recorded skip, manual change or taper/recovery exception here.

Practical scope: this does not show the current generator removing sessions. It shows that a future generation/editing regression can remove a workout and still pass the production validator. Deliberate skip/move/partial-week behavior must remain allowed, but an untouched complete week with an unmarked missing session needs a validation error.

## P2: A stale hard flag lets strides satisfy the selected workout count

The second mutation uses the actual `economy-relaxed` library recipe, containing two minutes of strides, while retaining the previous `hard: true` flag. The explicit validator counts non-long hard sessions with positive work; it does not exclude the economy stimulus. An independent recipe-aware count correctly finds one meaningful weekday workout.

Practical scope: current generated examples do not contain this mislabeled recipe. The gap matters if a future substitution or recipe edit forgets to clear its old classifier. Exclude economy/strides explicitly when certifying the selected workout count; keep brief taper efforts separate from the ordinary build-week guarantee.

## Interpretation

Neither finding establishes unsafe training or a live user-data incident. Both weaken the software guard intended to stop the recurring missing-workout regression. Source-level evidence is in `lib/plan/generation-rhythm.ts` and `lib/plan/validate.ts`; exact inputs, mutations and validator outputs are in [validator.json](validator.json). This audit exits successfully after recording findings; it is not a passing release-gate assertion.
