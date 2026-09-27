# Backend integrity and delivery hardening — 24 September 2026

## Implemented behavior

- Journal actions `freeRun`, `complete`, `correctLog`, `correctExtra`, `attachRecording` and `skip` accept a UUID `mutationId`. The client saves this identifier with the exact command before making the request. Receipts are account-owner/epoch scoped and stored in the same SQLite transaction as the journal mutation. The payload hash covers semantic input; transport `version` is excluded so reviewed retries and sequential outbox saves can use the current revision.
- A retry of the same identifier and payload returns the current authoritative journal with `acknowledgedMutationId`. It preserves the original created record, does not add another revision, and never overwrites a later correction with an old response snapshot. A reused identifier with different input returns HTTP 409 and `MUTATION_CONFLICT`. Existing clients without identifiers remain accepted, but do not gain lost-response deduplication.
- Running summaries with average speed above a deliberately permissive 45 km/h corruption limit are rejected. This is a corruption guard, not a coaching threshold. There is no lower-speed cutoff: walking, slow mountain efforts, unknown distances and multi-day records remain supported within existing journal bounds. Only Run/VirtualRun provider activities are normalized into running evidence. Invalid provider records are excluded from the import review and its existing excluded-record counter reports them. Provider summaries are verified before use; untrusted client copies are replaced, not clipped.
- Imported UTC start, original local start and timezone survive standalone saves, completed logs, recording attachment, corrections, activation, canonical history, and recovery files. The current viewing timezone does not rewrite those source values. Existing date-only records are retained; no missing timestamp is fabricated.
- Full plan revision snapshots are capped at the latest 50 after successful writes and recovery operations. Current and previous snapshots remain available for undo. This prunes old snapshots only; the current journal and its recorded runs remain intact. Recovery export remains complete for the current journal. Account data explains this limit.

## Durable workout delivery

- Explicit send/check operations are saved before provider work. A job captures the exact owner, account epoch, provider athlete, connection generation, plan version, prescription hash and action. Repeated pending enqueue shares one job.
- Workers lease one job per owner for two minutes, use a maximum five-attempt budget, and apply exponential backoff (15, 30, 60, 120 seconds before the final attempt), respecting longer provider cooldowns. At most 20 pending jobs can be queued per account. A resume request attempts at most two jobs, stopping on account-wide authorization failures or throttling.
- A changed plan, prescription, connection or account lifetime blocks saved work for review; it does not silently send a newer workout or use another connected account. The provider adapter rechecks the captured connection at dispatch as well as using its existing delivery fences.
- The existing Intervals.icu read-back and uncertain-upload protections remain authoritative. An unknown POST outcome is reconciled; an empty lookup cannot blindly trigger another create. Jobs do not convert provider acceptance into watch confirmation.
- Connections shows waiting/review states with Resume and Cancel controls. Cancellation stops a pending request; it does not delete a provider calendar entry. Active requests cannot be falsely labelled cancelled.
- This web runtime processes jobs on an authenticated request. No scheduler or detached background promise is represented as deployed. Closing the web app preserves job state but does not guarantee execution; the user resumes in Connections. A future scheduler must call the same account/epoch/connection/prescription-fenced worker path.

## Migration order

Apply normal database migrations before releasing the changed API:

1. `0007_numerous_mariko_yashida.sql`: compact journal mutation receipts.
2. `0008_perfect_blockbuster.sql`: durable delivery jobs and indexes.
3. Subsequent billing migration belongs to its separate release work.

Account deletion/restore/reopen clears the mutation and delivery job ledgers atomically with changing the account epoch. Old offline commands cannot recreate deleted activities.

## Verification

The new `journal-integrity.test.mjs` and `delivery-jobs.test.mjs` exercise the actual API routes, real SQLite migrations and transactions, plus injected provider outcomes for deterministic worker tests. They cover:

- A committed save whose response is lost, replay after simulated restart, concurrent same-body requests, conflicting reuse, rollback, cross-account isolation, and account-epoch changes.
- Actual device outbox replay against the actual journal route before and after plan creation, including sequential version rebasing and exactly one record per accepted command.
- Provider timing through copies/recovery, impossible summaries, truthful fast/slow efforts, missing distances and preserved manual corrections.
- Persisted delivery retry, cooldown, expired leases, concurrent worker exclusion, finite retries, authorization stops, connection changes, cancel, and deletion while work is pending.
- Snapshot compaction, current-history preservation, recovery validation, successful undo and no pruning after a rejected stale write.

Existing delivery, Intervals read-back, provider import, account recovery, operations, measurement and plan-route suites were also rerun. The real adapter tests retain the uncertain-create, ownership, deletion and watch-readback contracts. A small number of legacy tests used `99 km / 99 minutes` as an intentionally untrusted provider payload; that still passes through authoritative provider verification. Five manual-log setup cases now use `9 km` so they test their intended attachment/concurrency/storage paths instead of failing the new corruption guard.

These tests use synthetic accounts and in-memory databases, never saved user journals or production provider writes. They are correctness tests, not a production throughput benchmark. The existing 1.5 MB current-journal limit remains; splitting historical activities from plan documents is separate schema work. Phone GPS, HealthKit/Health Connect and real-device battery validation are not introduced by these changes.
