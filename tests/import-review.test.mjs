import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Portable between work/ during review and stride/tests/ after adoption.
const lib = existsSync(new URL('../lib/import-review.ts', import.meta.url))
  ? new URL('../lib/', import.meta.url)
  : new URL('./stride/lib/', import.meta.url);
const { importReviewScope, mergeImportPage } = await import(
  new URL('import-review.ts', lib)
);

const connection = {
  provider_athlete_id: 'athlete-10',
  generation: 'connection-1',
};
const identity = { athleteId: 'athlete-10', generation: 'connection-1' };
const scope = JSON.stringify(['account-a:2', 'athlete-10', 'connection-1']);
function activity(id, date = '2026-09-07') {
  return {
    id,
    name: `Run ${id}`,
    date,
    distance: id === 'unknown-distance' ? null : 6123.4,
    movingTime: 2535,
    source: 'Garmin via Intervals.icu',
  };
}
function cache(patch = {}) {
  return {
    scope,
    activities: [
      activity('recent'),
      activity('unknown-distance', '2026-09-06'),
    ],
    nextCursor: '2026-07-27',
    ...patch,
  };
}
function freezeTree(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}
function merge(
  current,
  page,
  older = false,
  expected = scope,
  latest = scope,
  provider = identity,
) {
  return mergeImportPage(current, expected, latest, provider, page, older);
}

void test('a verified import scope uses account identity/epoch, provider athlete and connection generation', () => {
  assert.equal(importReviewScope('account-a:2', connection), scope);
  for (const [account, provider] of [
    ['account-b:2', connection],
    ['account-a:3', connection],
    ['account-a:2', { ...connection, provider_athlete_id: 'athlete-20' }],
    ['account-a:2', { ...connection, generation: 'connection-2' }],
  ])
    assert.notEqual(importReviewScope(account, provider), scope);
  assert.equal(
    importReviewScope('account:"a":2', {
      provider_athlete_id: 'athlete:10',
      generation: 'g:"1"',
    }),
    JSON.stringify(['account:"a":2', 'athlete:10', 'g:"1"']),
    'Tuple encoding must preserve opaque values without delimiter collisions',
  );
});

void test('incomplete account or connection identity cannot create an import scope', () => {
  for (const [account, provider] of [
    ['', connection],
    ['account-a:2', null],
    ['account-a:2', {}],
    ['account-a:2', { generation: 'connection-1' }],
    ['account-a:2', { provider_athlete_id: 'athlete-10' }],
    ['account-a:2', { ...connection, provider_athlete_id: '' }],
    ['account-a:2', { ...connection, provider_athlete_id: null }],
    ['account-a:2', { ...connection, generation: '' }],
    ['account-a:2', { ...connection, generation: null }],
  ])
    assert.equal(importReviewScope(account, provider), '');
});

void test('the first checked page can be reopened unchanged with its cursor and precise activity values', () => {
  const page = {
    activities: [activity('recent'), activity('unknown-distance')],
    nextCursor: '2026-07-27',
  };
  const result = merge(null, page);
  assert.deepEqual(result, { scope, ...page });
  assert.equal(result.activities[0].distance, 6123.4);
  assert.equal(result.activities[0].movingTime, 2535);
  assert.equal(result.activities[1].distance, null);
});

void test('loading an earlier page appends distinct recordings once and advances the cursor', () => {
  const current = cache();
  const page = {
    activities: [
      activity('unknown-distance', '2026-09-06'),
      activity('earlier', '2026-07-10'),
      activity('earlier', '2026-07-10'),
    ],
    nextCursor: '2026-06-15',
  };
  const result = merge(current, page, true);
  assert.deepEqual(
    result.activities.map(({ id }) => id),
    ['recent', 'unknown-distance', 'earlier'],
  );
  assert.equal(result.nextCursor, '2026-06-15');
  assert.equal(result.scope, scope);
});

void test('checking again replaces the retained pages and deduplicates the new result', () => {
  const current = cache();
  const page = {
    activities: [activity('new'), activity('new'), activity('another')],
    nextCursor: '2026-08-01',
  };
  const result = merge(current, page);
  assert.deepEqual(
    result.activities.map(({ id }) => id),
    ['new', 'another'],
  );
  assert.equal(result.nextCursor, '2026-08-01');
  assert.equal(
    result.activities.some(({ id }) => id === 'recent'),
    false,
  );
});

void test('a successful empty refresh removes stale rows, while an empty earlier page preserves loaded rows', () => {
  const current = cache();
  const empty = { activities: [], nextCursor: null };
  assert.deepEqual(merge(current, empty), { scope, ...empty });
  assert.deepEqual(merge(current, empty, true), {
    ...current,
    nextCursor: null,
  });
  assert.deepEqual(merge(null, empty), { scope, ...empty });
});

void test('same-day independent runs remain separate because deduplication follows provider id', () => {
  const page = {
    activities: [activity('morning'), activity('evening')],
    nextCursor: null,
  };
  assert.deepEqual(
    merge(null, page).activities.map(({ id }) => id),
    ['morning', 'evening'],
  );
});

for (const [label, changedScope] of [
  [
    'account switch',
    JSON.stringify(['account-b:2', 'athlete-10', 'connection-1']),
  ],
  [
    'account epoch change',
    JSON.stringify(['account-a:3', 'athlete-10', 'connection-1']),
  ],
  [
    'reconnection to the same athlete',
    JSON.stringify(['account-a:2', 'athlete-10', 'connection-2']),
  ],
  [
    'different provider athlete',
    JSON.stringify(['account-a:2', 'athlete-20', 'connection-1']),
  ],
  ['disconnect', ''],
]) {
  void test(`a late reply after ${label} cannot replace or append to the current cache`, () => {
    const current = cache({
      scope: changedScope,
      activities: [activity('current-account-run')],
    });
    const latePage = {
      activities: [activity('late-old-run')],
      nextCursor: '2026-01-01',
    };
    for (const older of [false, true]) {
      assert.strictEqual(
        merge(current, latePage, older, scope, changedScope),
        current,
      );
      assert.equal(merge(null, latePage, older, scope, changedScope), null);
    }
  });
}

for (const [label, provider] of [
  ['different athlete', { ...identity, athleteId: 'athlete-20' }],
  ['different generation', { ...identity, generation: 'connection-2' }],
  ['missing athlete', { ...identity, athleteId: '' }],
  ['missing generation', { ...identity, generation: '' }],
]) {
  void test(`a reply with ${JSON.stringify(label)} cannot publish under the captured scope`, () => {
    const current = cache();
    const page = {
      activities: [activity('wrong-provider-run')],
      nextCursor: null,
    };
    assert.strictEqual(
      merge(current, page, false, scope, scope, provider),
      current,
    );
    assert.strictEqual(
      merge(current, page, true, scope, scope, provider),
      current,
    );
  });
}

void test('a newly scoped page never inherits cached rows or cursor from a different account', () => {
  const foreign = cache({
    scope: JSON.stringify(['account-b:2', 'athlete-10', 'connection-1']),
  });
  const page = { activities: [activity('mine')], nextCursor: null };
  assert.deepEqual(merge(foreign, page, true), { scope, ...page });
});

void test('an empty or malformed captured scope cannot accept a page even when it equals the current scope', () => {
  const current = cache();
  const page = { activities: [activity('unverified')], nextCursor: null };
  for (const invalid of ['', 'not-json', 'null', '{}', '[]']) {
    assert.strictEqual(merge(current, page, false, invalid, invalid), current);
  }
});

void test('merging a page preserves frozen input records, arrays, cache and provider identity', () => {
  const current = freezeTree(cache());
  const page = freezeTree({
    activities: [activity('recent'), activity('earlier')],
    nextCursor: null,
  });
  const provider = freezeTree({ ...identity });
  const before = structuredClone({ current, page, provider });
  const result = merge(current, page, true, scope, scope, provider);
  assert.deepEqual(
    result.activities.map(({ id }) => id),
    ['recent', 'unknown-distance', 'earlier'],
  );
  assert.deepEqual({ current, page, provider }, before);
});
