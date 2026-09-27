# Zero-history 5K: research and implementation decisions

Reviewed 24 September 2026. Programme identifier: `nhs-c25k-v1`.

## Primary references

The [NHS Couch to 5K programme](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/) targets beginners through three weekly outings with rest between. Its endpoint is continuous running for thirty minutes. Repeating stages and taking longer are allowed. The [official printable plan](https://digitalcampaignsstorage.blob.core.windows.net/campaigns-cms-prod/documents/c25k_printable_plan.pdf) supplies the specific 27 lessons used here. Each lesson includes five minutes of walking at both ends. The current printed sixth stage's third lesson is 25 minutes running, not the 22-minute variant found elsewhere.

[None to Run](https://www.nonetorun.com/12-week-beginner-running-plan) offers a different twelve-week programme, beginning with shorter running bouts. Its [repeat-week guidance](https://www.nonetorun.com/blog/repeat-weeks) reinforces repeating difficult work and using perceived effort. Its complete intermediate PDF was not retrieved; Stride does not claim to reproduce that schedule.

## What Stride implements

- Automatically select the dedicated course for goal **5K**, experience **new**, and all three declared running-history values equal to **zero**: weekly kilometres, longest run and current running days. Preserve those zeros. Existing runners retain the ordinary road engine.
- Use the NHS 27 timed recipes, conversational effort, walking recovery and explicit walking preparation/cooldown. Do not prescribe pace, estimated kilometres, speed workouts, a special long run, a taper or an automatic 5K race.
- Allow two or three separated running days, including rest across Sunday/Monday. Three outings per week need at least nine weeks. Two require at least fourteen. Shorter blocks can be used for introductory practice but cannot establish the final milestone; they can be extended while retaining progress.
- The overview shows all nine stages. Executable future calendar sessions remain at the approved stage until the runner reviews completed lessons. Calendar time, a download or an imported duration cannot unlock higher stages.
- Review requires each of the three saved lessons in order, distinct actual dates with intervening rest, exact canonical prescriptions, sufficient actual duration, comfortable feedback and explicit confirmation of running the prescribed intervals. Provider duplicates do not count twice. Unknown/partial/substituted execution never certifies the full lesson.
- Review is available after at least seven days at a stage and ignores today's completion until a later day. Evidence is bounded to the preceding 28 days. Fatigue holds progression. These review thresholds are **Stride product heuristics**, not NHS rules or validated individual readiness tests.
- Reserve forty minutes per outing and corresponding daily/weekly capacity so the final stage fits without cutting its walking preparation or cooldown. This admission rule is a product choice. Increasing available time does not increase the recipe.
- A rest review repeats an easier stage from the review date. Its saved break dates remain empty through schedule changes. Only post-break lessons can establish progression; fourteen days away returns to the entry stage. These are conservative product choices, not injury-rehabilitation guidance.
- A person who cannot yet manage a comfortable one-minute jog can walk and record a partial attempt, then repeat. Zero running history does not prove any particular walking tolerance. A separate graded walking or thirty-second entry programme is not implemented by this change.

## Measurement and progression

Thirty minutes running equals five kilometres only at 6:00/km. At 8:00/km it is 3.75 km; at 10:00/km it is 3 km. Completing the course never records an invented distance or a completed race. Walking time is kept separate in the session steps. Workout distances remain unprescribed even when a guessed easy pace or benchmark is entered.

Some total outing durations decrease between stages because the mix of running and walking changes. For example, stage two contains 29-minute outings and stage three contains 25-minute outings while the longest running bout increases from 90 seconds to three minutes. This follows the reference recipes and is not a fractional-kilometre progression bug.

## Scope and validation

The programme is a research-informed software prescription, not evidence that every individual can safely progress on schedule. Synthetic simulations test programme mechanics and invariants; real-world tolerance remains unproven by passing software tests.

See [verification and daily examples](../verification/2026-09-24/beginner-course/README.md). The regression suite also rechecks the established 5K, 10K, half and marathon engines. Zero-history 10K/half/marathon requests still require building and recording a running base first. Low but nonzero beginners continue to use the existing baseline eligibility rules; the new branch specifically handles truthful zero history.
