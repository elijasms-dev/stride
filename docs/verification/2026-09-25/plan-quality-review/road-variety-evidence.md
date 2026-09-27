# Road workout variety: evidence and implementation

Primary sources reviewed 25 September 2026. This review informs workout roles and the use of different complete shapes; it does not validate Stride's exact repetition counts, work percentages, progression schedule or a maximum repetition streak as physiological thresholds.

## Primary coaching references

- [Hal Higdon Intermediate 5K](https://www.halhigdon.com/training-programs/5k-training/intermediate-5k/) alternates tempo and interval sessions. It describes tempo as an easy opening, controlled faster middle and easy finish; its track repetitions use a distinct faster effort with generous recovery. This supports separating the session's purpose from its total duration and avoiding one threshold recipe throughout a block. It does not imply that every 400 m repetition has the same intended intensity.
- [Hal Higdon Intermediate 10K](https://www.halhigdon.com/training-programs/10k-training/intermediate-10k/) alternates tempo and 400 m interval sessions. Its faster work uses 5K effort, while easy and long running remain comfortable. Stride retains its existing threshold/race-rhythm role policy; this change does not import Higdon's harder efforts into every existing session.
- [McMillan, The Lost Art of the Fartlek](https://www.mcmillanrunning.com/the-lost-art-of-the-fartlek/) describes short repeated surges, longer controlled efforts, race-effort repetitions and a descending ladder as distinct ways to introduce or maintain faster running. It emphasizes effort control and avoiding attempts to reproduce peak-season speeds too early. Those are examples of meaningful structural variety, not merely changing a title.
- [McMillan, Fun Workout Alternatives](https://mcmillan.helpscoutdocs.com/article/97-fun-workout-alternatives) organizes alternatives by endurance, stamina and speed purpose, recommends familiarity before some swaps, and includes ladders and shorter/longer repetitions. Its multi-effort ladder is not copied here: Stride's new pyramids hold the original session's controlled effort throughout and use individually authored, smaller work shapes within the existing allowance.
- [V.O2 Training Definitions](https://vdoto2.com/learn-more/training-definitions) describes threshold as either sustained running or cruise intervals, separates interval from repetition work, and assigns different recovery intentions to those roles. Stride therefore preserves threshold, race-effort and easy-recovery targets; a varied duration is not authorization to prescribe a faster zone.
- [B.A.A. Half Marathon Level Two](https://www.baa.org/wp-content/uploads/docs/2018-07/2018_BAA_HalfMarathon_Training_Level2.pdf) uses tempo intervals, progression running and race-specific sessions across its schedule. This supports judging a half-marathon block by its mix of purposeful sessions and endurance rather than a long list of differently named copies. Its published schedule and recipes have not been imported.

## Concrete cause

The opening threshold stage allowed at most two-minute bouts and the catalogue contained just one eligible timed threshold recipe. The recent-template exclusion rule could eliminate that recipe, find no remaining candidate, then fall back to it again. In the reviewed 30 km/week, 8 km long-run, four-day 5K profile with a 25-minute benchmark, the first four quality exposures were all seven two-minute threshold repeats.

## Authored changes and limits

`lib/road-workouts.ts` adds 90-second threshold repeats and eleven complete pyramids across threshold, 5K, 10K and half-marathon roles. The pyramids include a rising/level middle and descending work lengths, with the same effort throughout. Each is a complete main set, so it either fits in full or is rejected as a candidate. Existing preparation, recovery and cooldown requirements remain part of its cost.

Selection retains the existing role, background-derived dose, phase progression, longest-bout allowance, controlled-intensity adaptation and time/distance caps. It also checks the allocator's actual available work minutes. Recent template IDs are now a preference among feasible candidates instead of a route to repeatedly forcing the fallback. When alternatives fit, selection compares executable work and recovery steps to avoid repeating the preceding identical main set. Changing a title, easy filler or numerical pace does not count as variety.

The familiar preference retains simple, repeatable prescriptions. Existing taper behavior reduces familiar work; new pyramids are excluded from taper/race-week selection. Saved completed, skipped and past prescriptions remain protected during refresh. The zero-history and first-race branches are unchanged.

The reviewed 5K q1 opening now alternates seven two-minute and nine 90-second threshold repetitions before later race-effort and longer threshold work. Its intended 14-minute opening work allowance is unchanged; the 90-second version fits 13.5 minutes. These are illustrative authored choices, not a universal optimal sequence. Restricted capacity can legitimately reduce the number of suitable shapes.

## Verification

Nine new focused tests in the existing `tests/road-workout-policy.test.mjs` cover the six reviewed road q1/q2 profiles, complete pyramid integrity, familiar-versus-varied behavior and protected history. The file passes all 22 tests. A broader run passes 1,006 road allocation, frequency, taper, pacing, edit, recipe and variety tests. Type checking and scoped lint also pass. No snapshot expectations were refreshed for this change.

The independent review script `scripts/report-road-variety-review.mjs` writes a new labeled artifact under this directory and preserves the preceding day-by-day report. It records actual main sets, signature counts and unchanged history/scheduling identifiers for direct review.
