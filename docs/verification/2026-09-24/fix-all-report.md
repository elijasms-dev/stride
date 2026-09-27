# Stride fixes and remaining release work

24 September 2026. Changes are in the local working tree. No commit, push, production migration, deployment, provider delivery or real payment was performed. Existing uncommitted training-engine work was preserved.

This change fixes the reproduced defects and hardens the existing web planner and journal. Phone recording and a commercial native release still require implementation and external setup; they are not claimed as completed features.

## Implemented

| Issue | Impact addressed | Implementation |
| --- | --- | --- |
| Workout-count controls disagreed with generated plans and changed finish intent. | Users saw the wrong setting and could not faithfully edit their plan. | Controls and weekly rhythm use the engine's resolved count; automatic is selectable; explicit 0/1/2 and finish/improve remain independent. Availability limits appear in the main customization flow. |
| Automatic benchmark targets appeared as an effort override; inverted pace/HR bands passed validation. | Opening settings could change target behavior, and contradictory targets could reach exports. | Honest automatic/benchmark source, explicit reset, meaningful no-op handling, cross-band validation with overlap exceptions. Explicit review repairs legacy steady labels without changing numeric prescriptions or protected history. |
| A lost manual-save response could create duplicates. | A network switch or retry could record the same intent twice. | Account/epoch-scoped UUID receipts commit atomically with journal writes. Same ID/payload replays acknowledge the existing result; changed payloads conflict. The current client journals these IDs before dispatch whenever storage is available. |
| No durable offline plan or log queue. | A closed tab or lost connection could make the plan inaccessible and lose unconfirmed entries. | Opt-in IndexedDB snapshot, public offline shell, manual offline logging, ordered replay, exact acknowledgement, account/epoch isolation, explicit conflict review/export/removal, quota errors, and stale-tab protection. Registration alone does not claim readiness: offline files must finish installing. Private HTML/API responses and credentials never enter the service-worker cache. |
| Feedback/onboarding drafts were volatile. | Closing a tab could discard an unfinished log or setup. | Scoped device drafts with expiry, restoration, successful-save/discard cleanup, storage-failure messaging and account-switch cleanup. Legacy valid onboarding drafts migrate from session storage. |
| Implausible run summaries and discarded activity timing. | Bad data could contaminate history; original timezone context was lost. | Conservative cross-field running-speed validation and preserved source UTC/local time/timezone throughout import, correction, attachment and recovery. Cold offline logging also uses the training timezone. |
| Fresh source recordings could disagree silently with existing logs. | Users could not identify differences or distinguish manual corrections. | Same-ID comparisons show “Differs from saved log,” retain the linked identity, and open the existing log. No automatic overwrite, duplicate import, or deletion inferred from a missing page. |
| Interrupted watch delivery lacked a durable retry record. | Process loss left uncertain work with no reliable resume path. | Durable jobs, expiring leases, exact connection/prescription/version fences, bounded attempts/backoff, provider cooldown and pending quota; resume/cancel/review controls. Processing is request-driven, not a deployed background worker. |
| Full revision snapshots grew without a bound. | Storage and restore costs grew with every edit. | Atomic retention of the latest 50 revision snapshots, preserving current run history and normal undo. The current journal-size limit still applies. |
| Mobile plan hierarchy, long date navigation and hidden logging action. | Daily runs and post-run logging took too much scrolling. | Schedule first, collapsed routine/progression, print in overflow, seven-day rail with full picker and skip control, visible logging footer, larger controls and scrollable instructions. |
| Routine global blocking screens and frequent hidden-tab time polling. | Ordinary reads interrupted navigation and timers did unnecessary work. | Nonblocking delayed progress, guarded atomic actions, contextual lazy-dialog skeletons and recovery, visibility-aware timezone-midnight scheduling. |
| Credential envelopes and diagnostics lacked operational safeguards. | Rotation and incident diagnosis were harder to perform safely. | Versioned AES-GCM envelopes with authenticated key IDs, compatible legacy reads, compare-and-swap rotation, framing protection, local worker/manifest restrictions and sanitized operation/category/latency diagnostics. |
| Billing reducer had no durable processing infrastructure. | Duplicate/out-of-order notifications or worker loss could give stale access decisions. | Sandbox-only signed webhook inbox, per-subscription leases, fenced atomic state/acknowledgement, bounded retries, reconciliation, account/epoch entitlement checks and sandbox account-deletion cleanup. Live checkout remains disabled. |

## Verification

All **2,673 tests passed** (zero failures or skips). TypeScript, application/public-asset lint, production build and both independent training gates passed. Structured results are recorded in [checks.json](checks.json).

- Full production test suite, TypeScript, application lint and production build.
- Independent training gate: 48 accepted sequences, 4 controlled rejections and 576 edit operations, with zero failures.
- Road matrix: 793 scenarios; 733 accepted, 60 correctly rejected; 8,127 weeks and 38,043 runs checked, with zero failures.
- Approved marathon snapshots remain unchanged.
- Actual API plus isolated SQLite tests simulate commit → lost response → restart/replay for plan and pre-plan logging; verify one saved record per intent and safe sequential queue versions.
- Worker tests exercise uncertain provider POST responses, readback, lease expiry, cooldown, stale connections and quota; mocked providers receive no real workouts.
- Billing tests use official signature verification, actual routes and isolated SQLite with intercepted synthetic Stripe responses. No external Stripe transaction occurs.
- Offline shell tests execute its actual JavaScript against a DOM/storage harness, including cold draft restore, malformed/future dates, a date-line timezone change, short intervals, quota failures, repeated submit and stale-account operations. IndexedDB event-order tests cover commit/abort and blocked-open ghost-write prevention. These are not a physical phone airplane-mode test.
- Browser inspection at 390×844 and 320×568 confirmed the schedule hierarchy, seven-day navigation, no horizontal page overflow and a reachable logging action. At 320×568 its bottom was 552 px after layout settled. The offline page without opt-in exposed no saved plan. A limited dark-theme computed-style sample passed normal-text contrast; this is not a complete WCAG or outdoor-legibility certification. No real log, plan or connection was changed during browser inspection.

## Still required before release

| Remaining work | Why it is not marked fixed | Concrete next requirement |
| --- | --- | --- |
| Native GPS recording, drift/gap handling, sensor/battery policy, crash recovery, interval clock/audio, auto-pause, haptics and live-run accessibility. | The product has no iOS/Android recorder. The available machine has command-line developer tools, not a full Xcode installation. Unit tests of the web planner cannot establish native background behavior. | Implement native platform services and a durable local recording journal, then perform screen-off, OS-kill, GPS-gap, Bluetooth/audio, full-offline marathon and battery field tests on supported devices. |
| HealthKit, Health Connect, direct Strava/Garmin authorization and native purchase receipts. | Those provider integrations and native apps do not exist here. Existing Intervals.icu delivery is preserved. | Obtain the required provider/developer access, implement scoped consent/sync/deletion/deduplication and test the real device/provider lifecycles. |
| Granular recording storage, resumable track upload and privacy zones. | There is no route/time-series ingestion or public route-sharing surface. The bounded JSON journal remains the current storage model. | Add private chunked recording storage, checksums and resumable watermarks; separate raw/private and redacted/public geometry, including every export/thumbnail route. Measure real backend bursts before claiming production capacity. |
| Production identity boundary and deployed security headers. | Local Sites development middleware is not evidence that production strips forged identity headers or blocks direct-origin access. | Verify actual gateway/origin isolation and two-account adversarial cases. Do not expose the worker directly with the current gateway-header trust model. See the security procedure below. |
| Paid launch and final public privacy/support terms. | Operator identity, support address, countries, products, price, trial, refund/grace policy and real billing configuration were not supplied. Checkout is intentionally disabled. | Supply the operator/product decisions, provision verified machine ingress and a scheduler, exercise real sandbox deliveries/test clocks, implement the chosen purchase/manage/restore flows and final public notices before live charging. |
| Operational release evidence. | Local tests do not establish production load, physical-watch delivery, backup restoration or VoiceOver/TalkBack behavior. | Complete deployed burst/restore drills, real-device assistive-technology and supported-watch journeys, alerting and an incident/support process. |

## Rollout

Additive migrations `0007_numerous_mariko_yashida.sql`, `0008_perfect_blockbuster.sql` and `0009_greedy_manta.sql` were applied to the **local preview database only**. Apply them in order to the intended deployed database before releasing server code that references the new tables. Do not enable live billing or advertise phone recording from this build.

Operational detail: [backend integrity and delivery](backend-integrity-delivery.md), [security and identity verification](../../security/production-hardening-2026-09-24.md), [sandbox billing setup](../../operations/sandbox-billing.md).
