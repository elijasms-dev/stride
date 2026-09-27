import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessFeasibility,
  withCurrentFeasibility,
  refreshFeasibility,
} from '../lib/plan/feasibility.ts';
const fixture = JSON.parse(
  readFileSync(
    new URL(
      '../docs/verification/2026-09-18/marathon-12-week.json',
      import.meta.url,
    ),
    'utf8',
  ),
).plan;
const asOf = '2026-12-01';
const plan = () => structuredClone(fixture);
function completed(w, values = {}) {
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: 180,
    actualKm: 30,
    effort: 3,
    feeling: 'good',
    note: '',
    recordedAt: asOf + 'T12:00:00Z',
    ...values,
  };
  return w;
}
const oldLong = (p) =>
  p.workouts.findLast((w) => w.kind === 'long' && w.date < asOf);

test('elapsed unlogged prescriptions do not establish road preparation', () => {
  const p = plan();
  const before = JSON.stringify(p);
  const result = assessFeasibility(p, asOf);
  assert.equal(result.status, 'review-required');
  assert.equal(result.asOf, asOf);
  assert.equal(result.evidence.recorded.sessions, 0);
  assert.equal(result.evidence.remaining.longest, 21);
  assert.equal(result.evidence.unresolved.sessions, 10);
  assert.match(result.reasons[0], /unlogged.*unknown/);
  assert.equal(JSON.stringify(p), before);
  for (const w of p.workouts.filter((w) => w.date < asOf)) w.status = 'skipped';
  const skipped = assessFeasibility(p, asOf);
  assert.equal(skipped.status, result.status);
  assert.equal(skipped.evidence.unresolved.sessions, 0);
});

test('calendar advance alone expires forecasts without changing sessions or preferences', () => {
  const p = plan();
  const before = JSON.stringify(p);
  const early = withCurrentFeasibility(p, p.profile.startDate);
  const late = withCurrentFeasibility(p, asOf);
  assert.equal(early.feasibility.status, 'forecast');
  assert.equal(late.feasibility.status, 'review-required');
  assert.equal(late.workouts, p.workouts);
  assert.equal(late.profile, p.profile);
  assert.equal(JSON.stringify(p), before);
});

test('recorded exposure follows actual dates, not scheduled dates', () => {
  const p = plan();
  const w = completed(oldLong(p), { actualDate: '2026-12-02' });
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.sessions, 0);
  assert.equal(assessFeasibility(p, asOf).status, 'review-required');
  w.feedback.actualDate = asOf;
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.longest, 30);
  assert.equal(assessFeasibility(p, asOf).status, 'forecast');
  w.date = '2026-12-06';
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.longest, 30);
});

test('corrections and canonical provider identity cannot preserve superseded exposure', () => {
  const p = plan();
  const w = completed(oldLong(p), { activityId: 'provider:one' });
  p.workouts.push({ ...structuredClone(w), id: 'archived-copy', week: -1 });
  p.extraRuns = [
    {
      id: 'extra-copy',
      date: w.date,
      minutes: 180,
      km: 35,
      activityId: 'provider:one',
    },
  ];
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.sessions, 1);
  w.feedback.actualKm = 10;
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.longest, 10);
  assert.equal(assessFeasibility(p, asOf).status, 'review-required');
  w.feedback.actualDate = '2026-12-02';
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.sessions, 0);
  p.workouts = p.workouts.filter(
    (s) => s.feedback?.activityId !== 'provider:one',
  );
  p.extraRuns = [];
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.sessions, 0);
});

test('a retained race recording cannot become preparation through a duplicate long-run link', () => {
  const p = plan();
  const w = completed(oldLong(p), { activityId: 'provider:race' });
  // Retained event history may precede the current event. Canonical deduplication
  // sees the long-run link first, but the activity remains a race recording.
  p.workouts.push({
    ...structuredClone(w),
    id: 'older-race',
    kind: 'race',
    week: -1,
  });
  const result = assessFeasibility(p, asOf);
  assert.equal(result.evidence.recorded.sessions, 0);
  assert.equal(result.evidence.recorded.longest, 0);
  assert.equal(result.status, 'review-required');
});

test('today remains available until its training day has elapsed', () => {
  const p = plan();
  const w = oldLong(p);
  p.workouts = [{ ...w, date: asOf, estimatedKm: 30 }];
  const today = assessFeasibility(p, asOf);
  assert.equal(today.evidence.remaining.sessions, 1);
  assert.equal(today.evidence.unresolved.sessions, 0);
  assert.equal(today.status, 'forecast');
  const tomorrow = assessFeasibility(p, '2026-12-02');
  assert.equal(tomorrow.evidence.remaining.sessions, 0);
  assert.equal(tomorrow.evidence.unresolved.sessions, 1);
  assert.equal(tomorrow.status, 'review-required');
});

test('time-only road recordings are explicit unknown distance, not completed forecast km', () => {
  const p = plan();
  completed(oldLong(p), { actualKm: null, actualMinutes: 210 });
  const result = assessFeasibility(p, asOf);
  assert.equal(result.status, 'review-required');
  assert.equal(result.evidence.recorded.sessions, 1);
  assert.equal(result.evidence.recorded.longest, 0);
  assert.equal(result.evidence.recorded.unknownDistanceSessions, 1);
  assert.ok(result.evidence.recorded.longestEstimatedKm >= 30);
  assert.match(result.reasons[0], /not recorded distance/);
});

test('new and legacy exposure reasons clear while unrelated constraints survive', () => {
  const p = plan();
  refreshFeasibility(p, asOf);
  const exposure = p.feasibility.reasons[0];
  p.feasibility.reasons.push('A retained return-stage constraint.');
  p.feasibility.reasons.push(
    'The remaining block reaches 21 km for its longest training session.',
  );
  completed(oldLong(p));
  refreshFeasibility(p, asOf);
  assert.equal(p.feasibility.status, 'review-required');
  assert.deepEqual(p.feasibility.reasons, [
    'A retained return-stage constraint.',
  ]);
  assert.ok(!p.feasibility.reasons.includes(exposure));
  p.feasibility.reasons = [];
  refreshFeasibility(p, asOf);
  assert.equal(p.feasibility.status, 'forecast');
  assert.deepEqual(p.feasibility.reasons, []);
  assert.equal(p.feasibility.asOf, asOf);
});

test('event-deferred remains authoritative and base blocks gain no event exposure check', () => {
  const p = plan();
  p.feasibility = {
    status: 'event-deferred',
    reasons: ['Deferred by the runner.'],
    asOf: '2026-11-30',
  };
  const old = p.feasibility;
  assert.equal(assessFeasibility(p, asOf), old);
  p.profile.goal = 'base';
  delete p.feasibility;
  assert.equal(assessFeasibility(p, asOf), undefined);
});

test('after-event assessment has no future preparation and cannot count race-day logs', () => {
  const p = plan();
  const w = completed(oldLong(p), { actualDate: p.profile.raceDate });
  const result = assessFeasibility(p, '2026-12-20');
  assert.equal(result.evidence.phase, 'after-event');
  assert.equal(result.evidence.remaining.sessions, 0);
  assert.equal(result.evidence.recorded.sessions, 0);
  w.feedback.actualDate = '2026-11-29';
  assert.equal(
    assessFeasibility(p, '2026-12-20').evidence.recorded.longest,
    30,
  );
});

test('long ultras use the same actual-date and unknown-history boundaries, with minutes as evidence', () => {
  const p = plan();
  Object.assign(p.profile, { goal: 'ultra', raceDistanceKm: 160.9344 });
  const w = completed(oldLong(p), {
    actualMinutes: 190,
    actualKm: null,
    actualDate: '2026-12-02',
  });
  let result = assessFeasibility(p, asOf);
  assert.equal(result.evidence.unit, 'minutes');
  assert.equal(result.evidence.recorded.sessions, 0);
  assert.ok(result.checks.some((c) => c.code === 'training-exposure'));
  w.feedback.actualDate = asOf;
  result = assessFeasibility(p, asOf);
  assert.equal(result.evidence.recorded.longest, 190);
  assert.equal(
    result.checks.some((c) => c.code === 'training-exposure'),
    false,
  );
  assert.ok(result.checks.some((c) => c.code === 'long-ultra-capacity'));
});

test('two-day easy outings use the same exposure convention as plan generation', () => {
  const p = plan();
  p.profile.days = [2, 6];
  const w = completed(oldLong(p));
  w.kind = 'easy';
  assert.equal(assessFeasibility(p, asOf).evidence.recorded.longest, 30);
});

test('exposure keeps its existing long-run slot scope and states it when other actual runs exist', () => {
  const p = plan();
  const easy = p.workouts.find((w) => w.kind === 'easy' && w.date < asOf);
  completed(easy, { actualKm: 30 });
  p.extraRuns = [
    { id: 'extra-long', date: '2026-11-28', minutes: 210, km: 35 },
  ];
  const result = assessFeasibility(p, asOf);
  assert.equal(result.evidence.recorded.sessions, 0);
  assert.equal(result.evidence.recorded.longest, 0);
  assert.match(result.reasons[0], /For planned long-run slots/);
  assert.match(
    result.reasons[0],
    /Extra runs are included in weekly review and progress/,
  );
  p.profile.days = [2, 6];
  easy.feedback.actualKm = 10;
  const twoDay = assessFeasibility(p, asOf);
  assert.equal(twoDay.evidence.recorded.sessions, 1);
  assert.match(twoDay.reasons[0], /For planned easy-run slots/);
});

test('derived assessment round-trips through JSON without changing a prescription', () => {
  const p = plan();
  const derived = withCurrentFeasibility(p, asOf);
  const restored = JSON.parse(JSON.stringify(derived));
  assert.deepEqual(assessFeasibility(restored, asOf), derived.feasibility);
  assert.deepEqual(restored.workouts, p.workouts);
  assert.deepEqual(restored.profile, p.profile);
});

test('state API refreshes calendar evidence without writing a journal revision', async (t) => {
  const { registerHooks } = await import('node:module');
  const { existsSync } = await import('node:fs');
  const site = new URL('../', import.meta.url);
  const saved = JSON.stringify(plan());
  const account = {
    account_id: 'evidence-account',
    epoch: 0,
    status: 'active',
  };
  let writeCalls = 0;
  globalThis.feasibilityTestEnv = {
    DB: {
      prepare(sql) {
        const statement = {
          bind: () => statement,
          first: async () => {
            if (sql.includes('FROM accounts')) return account;
            if (sql.includes('FROM athlete_state'))
              return {
                version: 7,
                data: saved,
                updated_at: '2026-09-21T12:00:00Z',
              };
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => {
            writeCalls++;
            throw new Error('An assessment must not write.');
          },
        };
        return statement;
      },
    },
  };
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'cloudflare:workers')
        return {
          url: 'data:text/javascript,export const env=globalThis.feasibilityTestEnv;',
          shortCircuit: true,
        };
      if (context.parentURL?.startsWith(site.href)) {
        const base = specifier.startsWith('@/')
          ? new URL(specifier.slice(2), site)
          : specifier.startsWith('.')
            ? new URL(specifier, context.parentURL)
            : null;
        if (base)
          for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
            const url = new URL(base.href + suffix);
            if (existsSync(url)) return { url: url.href, shortCircuit: true };
          }
      }
      return next(specifier, context);
    },
  });
  t.after(() => {
    hooks.deregister();
    delete globalThis.feasibilityTestEnv;
  });
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-28T12:00:00Z'),
  });
  const { GET } = await import('../app/api/state/route.ts');
  const read = async () => {
    const response = await GET(
      new Request('https://fixture.invalid/api/state', {
        headers: { 'oai-authenticated-user-id': 'evidence-owner' },
      }),
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const early = await read();
  assert.equal(early.plan.feasibility.status, 'forecast');
  t.mock.timers.setTime(new Date('2026-12-01T12:00:00Z').getTime());
  const late = await read();
  assert.equal(late.plan.feasibility.status, 'review-required');
  assert.equal(late.plan.feasibility.asOf, asOf);
  assert.equal(late.version, 7);
  assert.equal(late.updatedAt, early.updatedAt);
  assert.deepEqual(late.plan.workouts, early.plan.workouts);
  assert.deepEqual(late.plan.profile, early.plan.profile);
  assert.equal(writeCalls, 0);
  assert.equal(JSON.stringify(fixture), saved);
});
