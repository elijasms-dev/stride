# Declared training baselines

Policy: `provisional-2026-09-16-v32`.

A new, complete, ordinary opening week starts at the runner's declared weekly distance and recent long run. The engine no longer inflates weekly distance to satisfy a generic long-run percentage, reduces fresh mileage because fewer days were selected, or replaces a familiar distance with an event-family starting value. Exact opening distances are funded by executable steps and planning seconds, not just summary fields.

A fractional recent long run is retained for the opening outing. Later generated long runs use whole kilometres, with holds and increases of at most 2 km between ordinary build opportunities. Recovery and taper can reduce distance. A hard ceiling or an already-met event-family forecast between a fractional baseline and the next integer permits a familiar hold. Marathon training still has a 35 km ceiling. The peak is placed on an untapered long-run date; short timelines reach only the target that fits their available build opportunities. The maintain-volume option holds the long-run baseline, including a fractional baseline. Very short base-training recovery outings retain the minimum five-minute session instead of becoming a zero-distance workout.

Explicit easy-pace targets determine the time needed to fund a distance. Session, daily, weekly, and distance ceilings remain hard constraints. A fresh baseline that cannot fit those constraints produces a `PlanError` explaining that the inputs must be reviewed together. The engine does not silently substitute a smaller starting plan. Once a plan exists, explicitly reviewing lower limits can reduce upcoming work.

Partial calendar weeks and starts already inside taper retain their calendar-based reductions. Two-day routines retain their existing two-easy-outing structure. Recorded running, return stages, and deliberate workout edits are not overwritten to recreate an old declaration. Replanning uses recorded evidence where available and preserves an already reviewed lower baseline when no observations have arrived.

Distance conversion keeps funded metre targets stable through target refreshes, variety refreshes, measurement changes, and JSON serialization. Validation checks fresh opening totals, the long-run anchor, whole-kilometre ordinary targets, and unexplained ordinary long-run regressions. These new checks are gated by policy version so older saved plans can still be restored; applying a policy update remains an explicit preference review.

Tests include direct reproductions of the 30 km/week + 20 km half-marathon case, multiple event distances, fractional starting inputs, incompatible ceilings, time/distance round trips, recorded history, and preference updates. Existing tests that deliberately generated a smaller opening plan from contradictory inputs now assert a controlled error or apply lower limits as an explicit review of a feasible plan. The prior refactor snapshot is retained as a record of the previous policy; the new policy has its own serialized regression snapshot.

Standard balanced build weeks in established routines guarantee one complete weekday workout plus one long run. Explicit custom workout counts, base/two-day routines, specialist methods, active return plans and deliberately adjusted or observed history retain their own allocation rules. Generation and validation share the eligibility contract.

Familiar-day duration ceilings apply only during the actual race-relative taper. When a baseline needs additional funding, easy aerobic blocks around intact quality work can use spare declared capacity after easy-day capacity is exhausted. Work repetitions, recoveries, targets and hard limits remain fixed. Capacity forecasts and actual assignment use the same second/metre rounding behavior.

For long ultras, a fresh distance baseline that requires more time than the declared recent weekly or longest-run minutes is rejected explicitly. Time/distance conversion preserves funded endpoints and protected history, extending relaxed running only within real constraints; an incompatible conversion fails atomically. Manual easy-pace targets fund both measurement modes consistently.

See [verification and full example plans](verification/2026-09-18/README.md), including the later 12-week marathon simulation and its documented taper observations.
