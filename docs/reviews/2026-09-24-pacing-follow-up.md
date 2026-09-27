# Pacing follow-up after beginner programmes

The new first-race plans default to conversational effort. Existing explicit
pace/heart-rate choices are retained. The zero-history foundation deliberately
has no pace or distance targets.

The next pacing work should address these reproduced issues together:

1. **Timed prescriptions and displayed distance can disagree.** A timed 40-minute
   run funded using an 8 min/km easy pace carries 5 km of planning allocation.
   A fast benchmark can produce an automatic 5:22–5:33/km cue implying a very
   different distance. `withWorkoutTargets` also retains a prior `distanceEstimate`
   after changing timed step targets. Decide the allocation basis explicitly;
   then recompute all displayed ranges and preparation assessments from the
   same executable prescription. Do not add training load merely by editing a
   pace target. First-race defaults now use effort, avoiding automatic race-pace
   prescriptions in completion-focused plans.
2. **Manual-only targets need transparent estimates.** `distanceEstimate` can
   return unknown for a timed workout with a complete manual pace range but no
   separate easy pace or benchmark. Derive a clearly labelled scenario range
   from its step targets; do not turn that scenario into recorded distance.
3. **Priority and explanatory copy disagree.** Manual targets are presented as
   taking priority, while the planning allowance can retain the slower benchmark
   estimate. Some existing descriptions still claim a 7 min/km fallback when
   a benchmark or manual target actually supplies the allowance. Make the rule
   visible and share a single description helper.
4. **Test the full mutation chain.** Benchmark changes, manual pace/heart-rate
   targets, time/distance conversion, preference refresh, saved recovery,
   workout export and recent actual feedback must agree. Preserve historical
   records and re-assess preparation whenever future distance changes.

First-race target/measurement mutations now refresh feasibility. The broader
pace/estimate consistency changes above remain the next work item; they are
not claimed as completed by the beginner-plan verification report.
