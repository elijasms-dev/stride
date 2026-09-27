import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

globalThis.revisionReviewEnv = { DB: null };
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.revisionReviewEnv;',
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
const { GET } = await import('../app/api/history/route.ts');
const { readAccount } = await import('../lib/accounts.ts');
const { demoPlan, addDays } = await import('../lib/engine.ts');
const { reviewRevision, parseRevisionPlan } =
  await import('../lib/revision-review.ts');
const { PlanChangeHistory, RevisionComparison } =
  await import('../components/plan-change-history.tsx');
const owner = 'history-owner',
  other = 'other-history-owner',
  marker = 'PRIVATE-TRAINING-NOTE-SENTINEL';
const metadata = (
  version = 2,
  label = 'Updated future training preferences',
) => ({ version, label, created_at: '2026-09-21T12:00:00Z' });
function plans() {
  const before = structuredClone(demoPlan('2026-09-21'));
  before.workouts = before.workouts.slice(0, 4);
  before.profile.qualityMode = 'custom';
  before.profile.qualitySessions = 2;
  return { before, after: structuredClone(before) };
}
async function fixture(t, options = {}) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort())
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  const stats = { snapshots: 0, snapshotBytes: 0, writes: [] };
  const prepare = (sql, args = []) => ({
    bind: (...values) => prepare(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => {
      const results = sqlite.prepare(sql).all(...args);
      if (/SELECT version,data,label/.test(sql)) {
        stats.snapshots += results.length;
        stats.snapshotBytes += results.reduce(
          (sum, r) => sum + Buffer.byteLength(r.data),
          0,
        );
      }
      options.afterAll?.(sql, sqlite);
      return { results, success: true, meta: {} };
    },
    run: async () => {
      stats.writes.push(sql);
      const result = sqlite.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });
  globalThis.revisionReviewEnv.DB = { prepare };
  t.after(() => sqlite.close());
  for (const who of [owner, other]) await readAccount(who);
  stats.writes = [];
  const insert = (
    version,
    plan,
    label = 'Updated future training preferences',
    who = owner,
  ) =>
    sqlite
      .prepare(
        'INSERT INTO revisions(owner,version,data,label,created_at) VALUES(?,?,?,?,?)',
      )
      .run(who, version, JSON.stringify(plan), label, '2026-09-21T12:00:00Z');
  const request = (query = '?version=2', who = owner) =>
    new Request('https://stride.test/api/history' + query, {
      headers: who ? { 'oai-authenticated-user-id': who } : {},
    });
  return { sqlite, stats, insert, request };
}

test('saved differences include moved-to-earlier and removed sessions, exact steps, and changed preferences', () => {
  const { before, after } = plans();
  after.profile.qualitySessions = 1;
  after.profile.recentRace = {
    distanceKm: 10,
    timeMinutes: 47,
    date: '2026-09-01',
    source: 'race',
    course: 'road',
  };
  after.workouts[0].date = '2026-01-01';
  const removed = after.workouts.splice(1, 1)[0];
  after.workouts[1].steps[0].seconds += 1;
  after.workouts[1].reason =
    'A reviewed change keeps this session within your time limit.';
  const original = JSON.stringify({ before, after });
  const review = reviewRevision(before, after, metadata(), 1);
  assert.equal(review.boundary, null);
  assert.ok(
    review.preferences.some(
      (r) =>
        r.label === 'Weekday workouts' &&
        r.before.startsWith('2') &&
        r.after.startsWith('1'),
    ),
  );
  assert.ok(
    review.preferences.some(
      (r) => r.label === 'Benchmark date' && r.after === '2026-09-01',
    ),
  );
  assert.equal(
    review.sessions.find((r) => r.id === after.workouts[0].id).kind,
    'Moved',
  );
  assert.equal(
    review.sessions.find((r) => r.id === removed.id).kind,
    'Removed',
  );
  assert.ok(
    review.sessions
      .find((r) => r.id === after.workouts[1].id)
      .rows.some((r) => r.label === 'Step 1'),
  );
  assert.ok(
    review.sessions
      .find((r) => r.id === after.workouts[1].id)
      .rows.some(
        (r) =>
          r.label === 'Why this session' &&
          r.after === after.workouts[1].reason,
      ),
  );
  assert.equal(
    JSON.stringify({ before, after }),
    original,
    'No migration, regeneration or snapshot edits',
  );
});

test('preference history uses weekday names and readable training choices without changing saved order', () => {
  const { before, after } = plans();
  before.profile.availableDays = [6, 0];
  after.profile.availableDays = [5, 1];
  before.profile.doubleDays = [];
  after.profile.doubleDays = [6, 2];
  before.profile.preferredHardDays = [3, 1];
  after.profile.preferredHardDays = [4, 0];
  before.profile.method = 'threshold-singles';
  after.profile.method = 'easy-doubles';
  before.profile.thresholdControl = 'effort';
  after.profile.thresholdControl = 'heart-rate';
  after.profile.recentRace = {
    distanceKm: 10,
    timeMinutes: 50,
    source: 'time-trial',
  };
  const original = JSON.stringify({ before, after });
  const review = reviewRevision(before, after, metadata(), 1);
  for (const [label, previous, next] of [
    ['Available days', 'Mon, Sun', 'Tue, Sat'],
    ['Double-session days', 'None', 'Wed, Sun'],
    ['Preferred workout days', 'Tue, Thu', 'Mon, Fri'],
    ['Training method', 'Threshold singles', 'Easy doubles'],
    ['Threshold control', 'By effort', 'Heart rate'],
    ['Benchmark source', 'Not set', 'Time trial'],
  ]) {
    const change = review.preferences.find((row) => row.label === label);
    assert.equal(change?.before, previous, label);
    assert.equal(change?.after, next, label);
  }
  assert.ok(!JSON.stringify(review.preferences).includes('Mon = 0'));
  assert.equal(JSON.stringify({ before, after }), original);
});

test('first, recovered, empty and new-block histories disclose comparison boundaries', () => {
  const { before, after } = plans();
  for (const [old, next, label, previous, boundary] of [
    [null, after, 'Activated a new training plan', null, 'first'],
    [
      before,
      after,
      'Restored a recovery copy; provider connections cleared',
      1,
      'recovery',
    ],
    [
      before,
      { ...after, id: 'another-block' },
      'Activated a new training plan',
      1,
      'new-block',
    ],
    [before, null, 'Opened an empty journal', 1, 'empty'],
  ]) {
    const review = reviewRevision(old, next, metadata(2, label), previous);
    assert.equal(review.boundary, boundary);
    assert.deepEqual(review.sessions, []);
    assert.ok(review.explanation.length > 20);
  }
});

test('note-only corrections remain private but are acknowledged as recorded changes', () => {
  const { before, after } = plans();
  before.workouts[0].feedback = {
    actualMinutes: 33,
    actualKm: 5,
    note: 'Old private note',
  };
  after.workouts[0].feedback = { ...before.workouts[0].feedback, note: marker };
  after.profile.name = marker;
  after.notes = [marker];
  after.activationInput = marker;
  after.extraRuns = [
    { id: 'extra', date: '2026-09-20', minutes: 20, km: 3, note: marker },
  ];
  const review = reviewRevision(
    before,
    after,
    metadata(2, 'Corrected a run log: ' + marker),
    1,
  );
  assert.equal(review.recordedChanges, 2);
  assert.equal(review.totalSessions, 0);
  assert.equal(review.revision.label, 'Corrected a run log');
  assert.ok(!JSON.stringify(review).includes(marker));
});

test('session comparison pages contain every change once', () => {
  const { before, after } = plans(),
    source = before.workouts[0];
  before.workouts = [];
  after.workouts = Array.from({ length: 45 }, (_, i) => ({
    ...source,
    id: 'session-' + i,
    date: addDays(source.date, i),
  }));
  const all = [];
  let offset = 0;
  do {
    const review = reviewRevision(before, after, metadata(), 1, offset);
    assert.equal(review.totalSessions, 45);
    assert.ok(review.sessions.length <= 20);
    all.push(...review.sessions.map((s) => s.id));
    offset = review.nextOffset;
  } while (offset !== null);
  assert.equal(all.length, 45);
  assert.equal(new Set(all).size, 45);
});

test('history endpoint is owner scoped, stamped, byte bounded and leaves journal snapshots untouched', async (t) => {
  const f = await fixture(t),
    { before, after } = plans();
  after.workouts[0].date = addDays(after.workouts[0].date, 1);
  f.insert(1, before);
  f.insert(2, after);
  f.insert(3, { ...after, notes: [marker] });
  f.insert(2, { ...after, engineVersion: marker }, 'Foreign revision', other);
  const stored = f.sqlite.prepare('SELECT * FROM revisions').all();
  const response = await GET(f.request()),
    data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(
    data.accountId,
    f.sqlite.prepare('SELECT account_id FROM accounts WHERE owner=?').get(owner)
      .account_id,
  );
  assert.equal(data.accountEpoch, 0);
  assert.equal(data.previousVersion, 1);
  assert.equal(data.revision.version, 2);
  assert.equal(f.stats.snapshots, 2);
  assert.ok(f.stats.snapshotBytes <= 3000000);
  assert.ok(!JSON.stringify(data).includes(marker));
  assert.equal(data.plan, undefined);
  assert.equal(data.history, undefined);
  assert.equal(data.sessions.length, 1);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM revisions').all(), stored);
  assert.ok(
    f.stats.writes.every((sql) => sql.startsWith('INSERT INTO request_limits')),
  );
});

test('history requires authentication and exact valid version; malformed cursors never load snapshots', async (t) => {
  const f = await fixture(t),
    { after } = plans();
  f.insert(1, after);
  assert.equal((await GET(f.request('?version=1', null))).status, 401);
  for (const query of [
    '',
    '?version=',
    '?version=0',
    '?version=-1',
    '?version=1.5',
    '?version=1&offset=-1',
    '?version=9007199254740992',
  ])
    assert.equal((await GET(f.request(query))).status, 422, query);
  assert.equal((await GET(f.request('?version=2'))).status, 404);
  assert.equal(f.stats.snapshots, 0);
});

test('oversized snapshots are rejected from metadata without materializing JSON', async (t) => {
  const f = await fixture(t);
  f.sqlite
    .prepare(
      'INSERT INTO revisions(owner,version,data,label,created_at) VALUES(?,?,?,?,?)',
    )
    .run(
      owner,
      1,
      'x'.repeat(1500001),
      'Large revision',
      '2026-09-21T12:00:00Z',
    );
  assert.equal((await GET(f.request('?version=1'))).status, 413);
  assert.equal(f.stats.snapshots, 0);
});

test('malformed snapshots return a bounded recovery message without leaking payloads', async (t) => {
  const f = await fixture(t),
    logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  f.sqlite
    .prepare(
      'INSERT INTO revisions(owner,version,data,label,created_at) VALUES(?,?,?,?,?)',
    )
    .run(owner, 1, marker, 'Revision', '2026-09-21T12:00:00Z');
  const response = await GET(f.request('?version=1'));
  assert.equal(response.status, 409);
  assert.ok(!(await response.text()).includes(marker));
  assert.equal(logs.length, 0);
  assert.throws(() =>
    parseRevisionPlan(JSON.stringify({ profile: {}, workouts: [] })),
  );
});

test('account recovery during a history read rejects the stale result', async (t) => {
  const f = await fixture(t, {
      afterAll(sql, sqlite) {
        if (/SELECT version,data,label/.test(sql))
          sqlite
            .prepare('UPDATE accounts SET epoch=epoch+1 WHERE owner=?')
            .run(owner);
      },
    }),
    { before, after } = plans();
  f.insert(1, before);
  f.insert(2, after);
  const response = await GET(f.request()),
    data = await response.json();
  assert.equal(response.status, 409);
  assert.equal(data.code, 'ACCOUNT_CONTEXT_CHANGED');
  assert.equal(data.sessions, undefined);
});

test('history rate budget rejects before snapshot reads and isolates owners', async (t) => {
  const f = await fixture(t),
    { after } = plans();
  f.insert(1, after);
  f.insert(1, after, 'First revision', other);
  f.sqlite
    .prepare(
      'INSERT INTO request_limits(owner,bucket,count,reset_at) VALUES(?,?,?,?)',
    )
    .run(owner, 'history-review', 30, Math.floor(Date.now() / 1000) + 60);
  assert.equal((await GET(f.request('?version=1'))).status, 429);
  assert.equal(f.stats.snapshots, 0);
  assert.equal((await GET(f.request('?version=1', other))).status, 200);
  assert.equal(f.stats.snapshots, 1);
});

test('history UI offers accessible expansion, honest undo semantics and saved rule versions', () => {
  const { before, after } = plans();
  after.workouts[0].date = addDays(after.workouts[0].date, 1);
  const review = reviewRevision(before, after, metadata(), 1);
  const html = renderToStaticMarkup(
    createElement(PlanChangeHistory, {
      history: [metadata(2), metadata(1)],
      currentVersion: 2,
      busy: false,
      onUndo() {},
    }),
  );
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /preserving recorded runs/);
  assert.match(html, /watch or calendar may need an update/);
  assert.match(html, /Undo last change/);
  const detail = renderToStaticMarkup(
    createElement(RevisionComparison, { review }),
  );
  assert.match(detail, /Moved/);
  assert.match(detail, /Before/);
  assert.match(detail, /After/);
  assert.match(detail, /Saved training rules/);
  const recovery = renderToStaticMarkup(
    createElement(PlanChangeHistory, {
      history: [metadata(2, 'Restored a recovery copy'), metadata(1)],
      currentVersion: 2,
      busy: false,
      onUndo() {},
    }),
  );
  assert.match(recovery, /disabled=""[^>]*>Undo last change/);
  assert.match(recovery, /Undo does not cross a recovery boundary/);
});
