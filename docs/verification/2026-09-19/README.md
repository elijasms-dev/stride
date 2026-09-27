# App improvements verification

19 September 2026 · Base commit `f6e80a3352ec8539a98c5dcb7ec1598202e88eaa`, with the local uncommitted changes described below. Engine `stride-0.10.1`; policy `provisional-2026-09-16-v32`. No deployment, commit or push was performed for this implementation.

## Implemented

- **Visible routine and edit comparisons:** running days, explicit weekday workout choice, long-run day, time limits, pace source and benchmark appear beside the plan. Preview shows which preferences change. The separate long run is identified explicitly.
- **Easier benchmark input:** elapsed-time entry, exact race-distance presets, km/mi display and optional date/source/course. Pacing previews identify modeled estimates and manual-target precedence. Metadata-only edits keep prescriptions; future dates are rejected.
- **Detailed change history:** owner-scoped before/after comparisons for saved preferences and individual session prescriptions, bounded pagination, readable labels, date/reason and existing undo limits. Private journal notes and full snapshots are not returned by the comparison endpoint.
- **Weekly evidence review:** planned versus recorded running, actual dates, deduplicated imports, unknown distances, skipped/unlogged sessions and main-set execution evidence. Race aliases do not become ordinary training. Links open the relevant existing recording screens.
- **Current preparation assessment:** expired unlogged runs no longer count as completed evidence. Recorded and remaining planned exposure are separate, date advancement refreshes the assessment without rewriting the plan, and event deferrals survive. Existing exposure scope remains logged planned long runs (easy sessions for two-day plans); extra runs remain visible in weekly totals and Progress.
- **Guided watch setup:** connection, provider delivery/readback and runner confirmation on the device are separate. Stale connection/version receipts cannot show completion. Heart-rate-only workouts use the existing FIT route. No automatic sample upload or physical-watch verification is implied.
- **API reliability:** invalid activity cursor dates are rejected before date arithmetic; a persisted account request budget limits imports before provider calls; raw caught plan errors no longer bypass safe failure handling. No process-global in-flight cache was added to the Worker runtime.
- **Lazy secondary screens:** expensive dialogs, Connections and Plan adjustments load separately, with loading and recoverable failure dialogs.
- **Repeatable verification:** checked-in CI and a seeded production-engine gate, documented in [development instructions](../../development.md).

## Regressions found and fixed during implementation

1. Recipe-only preference edits rebuilt the current mileage baseline. They now replace eligible recipes within existing time, distance and work allowances, preserving past/manual runs, taper anchors and explicit frequency. Cached recipe distance estimates are recalculated from the final steps.
2. Custom-distance Maintenance weeks silently turned the second selected workout into strides. Complete controlled workouts now retain an explicit count, and incompatible allocations fail with a reviewable explanation.
3. The stricter frequency validator initially rejected returning runners’ deliberately easy Foundation openings. Its exception now matches generation; later ordinary weeks still enforce the saved choice.
4. Race activity aliases could leak into weekly training/main-set counts. Canonical race identities are excluded consistently.

## Verification results

| Check                                       | Result                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Complete production test suite (`npm test`) | **1,599 passed; 0 failed, skipped or cancelled**                                                                      |
| Seeded gate                                 | **48 profiles × 4 seeds = 192 sequences; 2,304 operations; 0 failures**                                               |
| Expected contradictory inputs               | 4 per seed rejected as intended                                                                                       |
| Independent recipe review                   | 144 revisions; no stale distance estimates or protected-session, frequency, time, distance or quality-dose violations |
| TypeScript                                  | Passed                                                                                                                |
| Application lint (`npm run lint:app`)       | Passed                                                                                                                |
| Production build                            | Passed                                                                                                                |
| Whitespace/diff check                       | Passed                                                                                                                |

Seeds: `20260919`, `7`, `42`, `20260920`. Events: 5 km, 10 km, half-marathon, marathon, custom 7.5/15/30 km and 50 km ultra. Each combines explicit 0/1/2 weekday workouts with time/distance measurement. Independent assertions cover opening inputs, ordinary-week progression, allocation limits, saved choices, protected history, serialization and changed recipe estimates. The gate uses the actual app engine. It is bounded software-contract evidence, not a coaching-policy or physiological validation.

The [default operation trace](training-contracts.json) and [four-seed summary](seed-summary.json) retain the base SHA and dirty-tree status. The unchanged experimental `lib/trainingEngine.ts` is not the app’s production authority. Legacy whole-repository lint errors in test/prototype code remain; only application lint is claimed as passing. The new GitHub workflow has not yet run remotely.

## Performance and browser checks

Largest generated JavaScript chunk: **774,495 → 388,713 bytes**, gzip **237,952 → 123,431 bytes**. Secondary dialogs have separate chunks. Shared code still contributes to page loading, so this is not a proportional startup-speed or initial-transfer claim. [Bundle measurements](bundle-measurements.json).

Local browser observation confirmed the routine summary, retained 0/1/2 options, benchmark presets/time-entry/pace preview, and lazy preference-dialog heading focus. The weekly-review and preparation disclosures appear in the plan. The synthetic benchmark draft was discarded; the saved user plan was not edited. Temporary viewport override was reset.

Later browser actions timed out before dispatch, so complete history/watch interaction, responsive geometry, keyboard focus restoration, large text and screen-reader journeys are **not signed off**. Rendered-component and route tests cover their data contracts but do not replace those browser checks. Physical-watch delivery and field Core Web Vitals remain unmeasured.

This implements the reliability and first-release app experience from the audit. Later roadmap items—offline access, live calendar subscriptions, durable background delivery, native execution, deployment/business setup and marketing—were not part of this implementation. Independent coaching review and production release checks remain separate work.

Follow-up: [the road-distance simulation audit](road-audit/README.md) found configuration/allocation defects and negative-case validator gaps after these passing tests. Its current approval verdict takes precedence over treating the earlier suite as a complete release check.
