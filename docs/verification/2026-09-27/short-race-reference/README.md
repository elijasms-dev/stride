# Short-race reference regression evidence

This audit covers the two properties requested in the [supplied reference](../../../research/TRAINING_REFERENCE.md) and pasted task: preserve at least one weekday quality session every week of eligible standard 5K/10K blocks, remove their automatic full recovery weeks, and distinguish the one-week 5K taper from the two-week 10K taper. It does not reproduce an entire published schedule or certify the suitability of the unchanged plans.

## Final captures

Use [the final three-stage comparison](comparison.md), [the final Bug-1 rows](after-bug1-final.md), and [the final Bug-2 rows](after-bug2-final.md) for the completed implementation. Earlier captures below remain as a transparent diagnostic history.

Both final stages produce **207 plans from 284 attempts**, with **77 explicit incompatible-input refusals**, **2,830 generated weeks**, **90 unchanged protected-family plans**, **42 unchanged protected-family refusals**, and **zero applicable matrix failures**. All **858 weeks across 65 eligible short-race plans** retain actual weekday quality, including race week. All 36 ordinary fourth-week q2 opportunities reduce to one. The 50 standard short-race zero-workout examples plus the two foundation examples retain zero quality.

Final source fingerprints:

- Bug 1: `2699256a1950d24183efa347754106a3cc02d36860b2c595dace5722cbdd398b`
- Bug 2 after policy update: `673de7115adba1dabab90d826020ea955cbcfd098b0743749ced1de2007f5329`

The repository was already on policy v34, despite the supplied task's older v30/v31 wording. The completed change advances it to **v35**, preserving version order. The review status records the narrow reference checks and protected-family regression check without claiming independent coaching approval.

Final verification after the v35 update: **3,223/3,223 full-suite tests pass**, with typecheck, application lint and scoped lint of the new regression scripts/tests also passing. The **179 new regression checks** comprise 24 recovery/reference checks, 22 taper/reference checks, and 133 protected-family checks. The matrix's 77 explicit refusals are counted separately from generated plans and test passes. See [the recorded check summary](checks.txt).

The two individually reviewable code/test changes are [Bug 1: recovery and retained quality](diffs/bug1-recovery.patch) and [Bug 2: taper duration and boundary](diffs/bug2-taper.patch). The captured stage JSON/Markdown provides the independent before/after output evidence for each change.

## Immutable baseline

The baseline was generated before production edits from commit `00416a6355cd6734732eb43b2f7f69bd68bd76ad`. The recursively calculated TypeScript `lib/` fingerprint was identical before and after generation:

`5421e89f012490ef32b09c0e2740f1d79fd21f07d430a0cfbf5eb92656ad1cea`

- [Before: every week](before.md)
- [Before: exact inputs, week rows and canonical prescription hashes](before.json)
- Harness: `scripts/verify-short-race-reference.mjs`

| Family | Generated | Explicit refusals |
| --- | ---: | ---: |
| 5K | 68 | 23 |
| 10K | 46 | 15 |
| Half marathon | 40 | 8 |
| Marathon | 32 | 16 |
| Ultra | 18 | 18 |
| Total | 204 | 80 |

The 284 attempts cover 2,782 generated weeks. Three, four, five and six running days are all attempted. The short races cover 8/10/12/16/20 weeks; half and marathon cover 8/12/16/20; ultra covers 12/16/20. Each ordinary input has matched zero-, one- and two-workout variants with otherwise identical training history and constraints. Thirty additional advanced 5K cases cover the existing two-workout entry requirements without changing the runner between quality choices. Two zero-history foundation cases check the separate introductory pathway.

The 80 refusals are outcomes, not 80 passing plans: 47 violate existing two-workout eligibility; 12 fail marathon starting requirements; nine fail ultra starting requirements; nine lack the five-day ultra availability requirement. Three established 5K three-day one-workout cases (12, 16 and 20 weeks) already fail the prescribed-pace/session-capacity reconciliation before this change. Those are explicitly retained in the report rather than represented as viable generated plans.

## What the baseline demonstrates

Among successfully generated standard plans requesting at least one weekday workout, 5K has 87 weeks without quality across 37 plans, and 10K has 60 across 25 plans. Every one of these 147 missing-quality weeks is marked Recovery. The required eight-week four-day one-workout examples both have quality counts `1, 1, 1, 0, 1, 1, 1, 1`.

The pre-change helper returns two mandatory taper weeks for both short distances. The actual daily taper currently starts seven days before the race for **both** distances. Therefore a test of the helper alone would miss the 10K execution mismatch: the final contract also checks the actual daily taper factors for seven versus fourteen days.

## Regression guard and acceptance

Every generated protected-family plan is hashed in full after sorting object keys, ignoring only `engineVersion` and `policyVersion` metadata. The comparison includes every workout step, pace target, distance, duration, note, identity, feasibility field and profile field. Per-week prescription hashes are also saved. Ninety generated half/marathon/ultra plans must remain identical; all 42 protected-family refusals must also remain identical. Previously generated short-race inputs cannot silently become refusals.

The short-race assertions come from the supplied reference properties, not from the old short-race snapshots: no full Recovery phase; at least one executable non-easy, non-long, non-race quality session in every week when quality was requested; final mandatory and executable daily taper lengths of one versus two weeks. Explicit zero-workout and foundation choices remain zero. Half-marathon cutbacks must still occur at every fourth pre-taper week.

The final daily taper follows whole calendar weeks ending on race day: the 5K taper covers offsets D6 through D0, while D7 (the previous week's Sunday long run in the supplied table) stays ordinary. The 10K taper covers D13 through D0, leaving D14 ordinary. A seven-day numerical offset plus race day would otherwise include eight dates and shorten the previous week's Sunday.

The after-Bug-1 run checks weekly quality/recovery behavior while leaving taper assertions to the separate after-Bug-2 run. The script writes with exclusive creation (`wx`) and refuses to replace earlier evidence. Each capture checks that production sources remained unchanged during the run. Additional repetitions use a unique `verify-<label>` stage.

`tests/short-race-protected-regression.test.mjs` runs the same protected-family guard in the test suite: 90 full prescriptions, 42 refusals and one baseline-provenance check. All 133 tests passed after Bug 1, and the new script/test passed scoped lint.

## First Bug 1 capture

[The first after-Bug-1 capture](after-bug1.md) shows both required eight-week four-day q1 plans retain a quality session every week. The advanced 5K q2 example now has counts `2, 2, 2, 1, 2, 2, 2, 1`; week four retains its 13 km long run instead of reducing it to 9 km. The 12-week six-day 10K q2 plan similarly reduces two weekday workouts to one at weeks four and eight. All 90 protected generated plans and 42 protected refusals are identical to baseline.

That first capture **does not pass the complete matrix**: the previously accepted 10-week three-day 5K q1 case now hits the existing prescribed-pace/session-capacity reconciliation refusal (203 generated instead of 204). The failure is recorded in the JSON and must be resolved or explicitly reported; it is not hidden by the otherwise passing quality properties. The pre-existing 12/16/20-week instances of the same capacity problem remain separately listed. Later captures must use a new stage name, such as `after-bug1-verified`, to retain this evidence.

The subsequent [Bug-1 funding check](verify-bugone.md) corrects the quality-slot funding edge case. It generates 207 plans and explicitly refuses 77 combinations: the new refusal disappears, and the three pre-existing longer three-day 5K capacity refusals are also resolved. Across all 858 generated short-race weeks requesting quality, none is missing quality and none is marked Recovery. All 36 pre-taper fourth-week q2 opportunities contain exactly one weekday workout. Protected-family comparisons still match exactly. This capture was made **before Bug 2** using a `verify-` label, so its final taper assertions correctly remain failing; it is not represented as final acceptance.

## Verified Bug 1 result

The [verified Bug-1 capture](after-bug1-verified.md) passes all applicable assertions with **207 generated plans, 77 explicit refusals, 2,830 weeks, zero failures**. Its production-source fingerprint is `567a6b5d9d857e13293e370db0a10d13bb2862d57c0bce9959fa4fbfae026297`. All 90 protected-family full-output hashes and all 42 protected refusals are unchanged. No previously generated case became a refusal. The three additional accepted cases are `5k-12w-3d-q1`, `5k-16w-3d-q1` and `5k-20w-3d-q1`.

[The reviewed five-goal comparison](comparison-bug1.md) prints each week before/after for one representative of all five goals, plus the additional 5K/10K two-workout examples. All 858 eligible short-race weeks retain quality. All 36 ordinary fourth-week two-workout back-offs reduce to one, and none becomes easy-plus-long only. Half-marathon recovery weeks remain, and marathon/ultra rows are unchanged. Taper behavior is intentionally still the pre-change behavior at this stage, ready for the separate Bug 2 review.

## Verified Bug 2 result

The [Bug-2 capture](after-bug2.md) passes all reference and regression assertions: **207 generated plans, 77 explicit refusals, 2,830 weeks, zero failures**. Its production-source fingerprint is `ca3b3868c93e735474b2d1c56e6c358c47864aacee75a114e427fd5ad0cc2348`. All 90 protected-family generated plans and 42 protected refusals are still identical. All 858 eligible short-race weeks retain quality.

[The complete before → Bug 1 → Bug 2 comparison](comparison.md) shows the actual weeks for all five representative goals and the two additional q2 cases. The eight-week 5K q1 plan now retains its full 10 km long run in week seven and tapers only week eight. The eight-week 10K q1 plan retains its 13 km long run in week six, then tapers weeks seven and eight, with a quality session in each. All final daily taper offsets match the seven/fourteen-day inclusive-race windows.

The existing 0.6 short-race taper allocation multiplier is retained, including across both 10K taper weeks. This percentage is **not** attributed to the supplied external plans: the acceptance property establishes taper duration and retained quality, not an exact 60% mileage rule. Actual weekly totals additionally depend on race-week caps and removal of the long-run outing. Half/marathon/ultra outputs remain protected rather than silently reinterpreted. The subsequent `after-bug2-final` capture includes the policy-version bump and the bounded familiar-workout fallback needed when the new two-week taper leaves only a short race-week dose.

```sh
node --experimental-strip-types scripts/verify-short-race-reference.mjs --stage before
node --experimental-strip-types scripts/verify-short-race-reference.mjs --stage after-bug1
node --experimental-strip-types scripts/verify-short-race-reference.mjs --stage after-bug2
```

`harness-diagnostics/` contains preliminary harness evidence: an initial unsupported 150-minute weekday input rejected every case, followed by a valid but smaller 254-case matrix lacking accepted advanced 5K two-workout examples. Both were captured on the unchanged source fingerprint. The authoritative `before` files use the corrected supported time limits and full 284-case coverage.

## Scope limitations

Matching the supplied short-race structural properties is not equivalent to following the complete Higdon schedules exactly. The generator's existing mileage allocation, workout recipes, progression and protected-family coaching decisions are deliberately outside this two-fix regression. Zero-workout choices, beginner courses and explicitly rejected combinations are not intermediate reference plans and are not forced to contain intervals.

**Unchanged ultra observation, flagged separately:** the protected `ultra-20w-5d-q1` example peaks at 39 km in week 15, cuts back to 27 km in Recovery week 16, then has a 33 km long run in ordinary Race preparation week 17 before taper. The ordinary long run is therefore shorter than the previous ordinary peak, and the peak is below the supplied 40–45 km reference band. The exact same sequence existed before both fixes. It was not changed because the requested scope expressly protects ultra-specific behavior; its unchanged hash is **not** evidence that this sequence is sound coaching.

The previously identified marathon issues are documented in the [earlier marathon derivation audit](../../2026-09-25/plan-derivation-audit/marathon-analysis.md), including measurement-dependent work duration and hard long-run/weekday combinations. This task preserves those outputs rather than presenting them as resolved or externally validated.
