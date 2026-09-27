# Pace editing, persistence and export findings

This audit complements the generation and training-adequacy matrices. It checks executable prescriptions after public edit operations; it does not certify that an athlete is ready for an event.

## Confirmed defects and repairs

1. **Explicit time-to-distance conversion invalidated reviewed estimates.** A 10K runner with 50 km/week, a 14 km long run, five running days, a 20-minute 5K benchmark and timed prescriptions could choose a manual 9:00–10:00/km easy range. The saved 82 minute 22 second long run then correctly estimated about 9.152 km. Converting that estimate to metre endpoints retained the allocation, but validation incorrectly required a fresh whole-kilometre progression target. The original sweep reproduced this across 10K, half, marathon, custom 30K, 50K and base plans.
2. **Pace review invalidated unchanged marathon durations.** Timed marathon plans containing both relaxed long runs and structured long runs can have non-monotonic estimated kilometres after a runner changes only the easy pace range. Their fixed durations and complete work remain unchanged. Validation incorrectly treated those reviewed estimates as newly generated distance targets. Four original marathon edit sequences failed this way.

The repair records `distanceRevision: 'pace-edited-time'` only when reviewing targets changes the estimate of a prescription containing timed endpoints. Explicit measurement conversion retains that provenance. Fresh generation, recipe-only edits and a fully rebuilt forecast do not acquire it. Existing distance prescriptions do not acquire it just because their target pace changes.

Validation continues to check step-derived distance ranges, allocated distance, distance-step time allowances, target ranges and all other structural constraints. Only the fresh-generation whole-kilometre/progression comparison excludes the explicitly revised estimate. Unknown provenance is rejected, including during recovery import. No time or distance endpoint is secretly shortened to satisfy validation.

Six regression tests cover both bugs, JSON/recovery preservation, completed history, malformed estimates, invalid provenance, direct distance edits, generic preference edits and rebuilt forecasts. The canonical prescription test file contains 26 passing tests. The focused pacing/measurement/validation/recovery run before the final two added tests passed 114/114.

## Matrix and rejection accounting

The final matrix has 200 scenarios. It spans 5K, 10K, half marathon, marathon, custom 7.5/15/30/100/160.9344 km, 50/100/160.9344 km ultra, base, positive-base first-race plans and zero-history foundation plans. Standard profiles exercise zero, one and two workouts and both measurement preferences. Benchmarks include 20-, 30- and 40-minute 5K results, with capacity-compatible slower-runner companions. Existing 100K/100-mile routines use consistent declared weekly and longest-run minutes.

Each admitted scenario runs benchmark review, compatible manual ranges, slower manual ranges, effort, heart rate, automatic targets, time/distance conversion, workout variety, JSON serialization and recovery restoration. Every accepted operation checks immutable input, completed history, delivery-protected prescriptions, endpoint ownership, current estimates and weekly totals. A representative future prescription is encoded and decoded as FIT and checked against the app's endpoints and targets. Intervals text is checked where supported; direct absolute-BPM export refusals are recorded separately.

The original corrected-input run is preserved in `before-fixes.json`: 126 complete passes, 18 edit-sequence failures and 26 generation refusals. `results.json` and `README.md` contain the current counts and source hash. Case names and complete original inputs are retained, and every failure/refusal has a reproduction command.

Generation refusals are never counted as passing or viable plans:

- Eight are independently bounded by declared baseline capacity. A 28 km run at the 40-minute 5K benchmark's conservative easy pace requires about 309 minutes, above the supported 300-minute limit. The all-easy 70 km marathon baseline with a fixed 23 km long run exceeds the four supporting 120-minute sessions' capacity.
- Eighteen named probes combine high mileage with bounded complete quality recipes. The engine refuses to inflate warm-up/cooldown time or discard selected workouts to retain that mileage. They are reported as bounded-quality capacity probes, not as a proof of physical impossibility for every coaching approach. Only the reviewed error family for each named fixture is accepted. A different exception or any rejection of an unlisted scenario fails the audit.
- Thirty additional capacity-compatible scenarios are required to generate and complete the edit sequence. Two-workout road companions retain the existing minimum 45 km/week and use six familiar running days. The 50K companions use a 35-minute benchmark and consistent 60/28 km baseline: a 40-minute 5K benchmark cannot fund the policy's required 28 km exposure within 300 minutes.

Target edits that cannot fund an existing distance within the user's time limits must refuse atomically, retaining the original plan. These edit refusals are distinct from generation refusals and from unexpected failures.

## Limits

- This is synthetic engine, restore and encoding evidence. It does not exercise a physical watch, actual third-party synchronization or physiological adaptation.
- Export parity is sampled once per accepted operation, while prescription and history invariants are checked across the entire resulting plan.
- Prescription and history counts include repeated checks after successive operations; they are not counts of unique workouts or runners.
- Viability decisions for constrained and slow-event profiles belong to the accompanying training-adequacy audit. Passing an edit sequence does not establish event readiness.

Reproduce: `node --experimental-strip-types scripts/verify-pace-edit-stress.mjs`. Isolate a case with `--case ID --out /tmp/stride-pace-case`.
