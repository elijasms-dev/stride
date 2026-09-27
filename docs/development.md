# Developing and verifying Stride

Use Node.js 24 and npm. `package-lock.json` is the lockfile used by CI; use `npm ci` for a clean install. The retained pnpm lockfile is not used by this workflow.

## Production training authority

The app imports `lib/engine.ts`, which exposes the production `lib/plan` modules. `lib/trainingEngine.ts` is a separate, unused prototype. Its `npm run test:engine` suite does not verify the app’s training plans or adaptation behavior.

## Release checks

```sh
npm ci
npm run typecheck
npm run lint:app
npm test
npm run verify:training -- --seed 20260919 --report /tmp/stride-training-contracts.json
npm run build
```

`.github/workflows/verify.yml` runs these production checks on pushes and pull requests. It builds the app without deploying it or requiring deployment credentials.

`npm test` covers the production engine, recorded history, API lifecycle, recovery, delivery, preferences and rendered UI contracts. The seeded training gate exercises 5 km, 10 km, half-marathon, marathon, custom 7.5/15/30 km and 50 km ultra profiles across explicit 0/1/2 weekday workouts and time/distance modes. Twelve operations per case mix preference edits, day advancement with synthetic records, variety refreshes, measurement changes and JSON round trips. It preserves a deliberate manual edit in every sequence. Reports include the seed, base Git SHA, dirty-tree flag, engine/policy versions and operation trace. Use `--case ID` to reproduce one scenario.

Assertions distinguish the weekday workout choice from the separate long run. They check declared opening baselines, complete quality sessions in eligible weeks, monotonic ordinary long-run progression, serialization, limits and protected history. Expected contradictory inputs must fail with a controlled explanation. Existing route/recovery tests cover import, undo and account boundaries; those are not simulated as browser journeys by the seeded engine script.

`lint:app` covers shipped application code. The older whole-repository `npm run lint` also visits legacy test harnesses and standalone prototype tests and currently reports pre-existing test-code errors. This release does not disable those rules globally or claim that command passes.

## Browser and delivery checks

Rendered-component tests do not replace browser testing. Before external release, verify onboarding, sequential preference edits, completion, history, undo and account recovery with keyboard navigation and screen readers on small and large screens. Check lazy-dialog loading, errors, focus restoration and refresh behavior. Test a physical watch before advertising a device as supported: provider acceptance, provider readback and runner confirmation on-device are distinct states.

Build chunk measurements are laboratory bundle measurements, not field Core Web Vitals or measured startup latency. Deployment, production identity isolation, backup drills, independent training-policy review and payment lifecycle checks remain separate release requirements.
