import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const source = new URL(
  existsSync(new URL('./stride/', import.meta.url))
    ? './stride/lib/action-progress.ts'
    : '../lib/action-progress.ts',
  import.meta.url,
);
const {
  actionProgressLabel,
  getActionProgress,
  subscribeToActionProgress,
  singleFlight,
  withActionProgress,
} = await import(source);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
void test('heavy action labels are specific without exposing provider credentials or runner data', () => {
  for (const [path, action, word] of [
    ['/api/plan', 'preview', 'Building'],
    ['/api/plan', 'activate', 'Saving'],
    ['/api/plan', 'preferencesPreview', 'Reviewing'],
    ['/api/plan', 'adjustPreview', 'Recalculating'],
    ['/api/sync', 'confirm', 'confirmation'],
    ['/api/reconcile', '', 'calendar'],
    ['/api/connections', 'disconnect', 'Disconnecting'],
    ['/api/recovery', 'preview', 'recovery'],
  ]) {
    const label = actionProgressLabel(path, {
      method: 'POST',
      body: JSON.stringify({
        action,
        key: 'PRIVATE_KEY',
        name: 'PRIVATE_RUNNER',
      }),
    });
    assert.ok(label.includes(word), label);
    assert.doesNotMatch(label, /PRIVATE/);
  }
});
void test('background journal/account reads and measurement never block the interface', () => {
  assert.equal(actionProgressLabel('/api/account'), null);
  assert.equal(actionProgressLabel('/api/state'), null);
  assert.equal(actionProgressLabel('/api/profile'), null);
  assert.equal(
    actionProgressLabel('/api/measurement', { method: 'POST', body: '{}' }),
    null,
  );
  assert.match(
    actionProgressLabel('/api/activities?older=123'),
    /recorded runs/,
  );
  assert.match(actionProgressLabel('/api/export?before=2'), /download/);
});
void test('status publishes synchronously before the task starts and clears after success', async () => {
  const events = [],
    stop = subscribeToActionProgress(() =>
      events.push(getActionProgress()?.label ?? null),
    );
  let started = false;
  const pending = withActionProgress('Building…', async () => {
    started = true;
    return 42;
  });
  assert.equal(started, false);
  assert.equal(getActionProgress().label, 'Building…');
  assert.equal(await pending, 42);
  assert.equal(getActionProgress(), null);
  stop();
  assert.deepEqual(events, ['Building…', null]);
});
void test('original rejection is preserved and status always clears for retry', async () => {
  const error = new Error('Synthetic service unavailable');
  await assert.rejects(
    withActionProgress('Saving…', async () => {
      throw error;
    }),
    (actual) => actual === error,
  );
  assert.equal(getActionProgress(), null);
  assert.equal(
    await withActionProgress('Retrying…', async () => 'saved'),
    'saved',
  );
});
void test('nested follow-up returns to outer save state until the whole operation finishes', async () => {
  const gate = deferred(),
    states = [],
    stop = subscribeToActionProgress(() =>
      states.push(getActionProgress()?.label ?? null),
    );
  const outer = withActionProgress('Saving plan…', async () => {
    await withActionProgress('Updating calendar…', async () => 'updated');
    await gate.promise;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(getActionProgress().label, 'Saving plan…');
  gate.resolve();
  await outer;
  stop();
  assert.deepEqual(states, [
    'Saving plan…',
    'Updating calendar…',
    'Saving plan…',
    null,
  ]);
});
void test('an earlier concurrent request finishing cannot hide a later request', async () => {
  const first = deferred(),
    second = deferred();
  const a = withActionProgress('First…', () => first.promise),
    b = withActionProgress('Second…', () => second.promise);
  first.resolve();
  await a;
  assert.equal(getActionProgress().label, 'Second…');
  second.resolve();
  await b;
  assert.equal(getActionProgress(), null);
});
void test('rapid duplicate actions share one promise for the complete operation', async () => {
  const slot = { current: null },
    gate = deferred();
  let calls = 0;
  const work = async () => {
    calls++;
    await gate.promise;
    return 'saved';
  };
  const a = singleFlight(slot, work),
    b = singleFlight(slot, work);
  assert.equal(a, b);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  gate.resolve();
  assert.equal(await a, 'saved');
  assert.equal(await b, 'saved');
  assert.equal(slot.current, null);
});
void test('a failed logical action releases its guard and allows a real retry', async () => {
  const slot = { current: null };
  let attempts = 0;
  const work = async () => {
    attempts++;
    if (attempts === 1) throw new Error('Temporary');
    return 'saved';
  };
  await assert.rejects(singleFlight(slot, work), /Temporary/);
  assert.equal(slot.current, null);
  assert.equal(await singleFlight(slot, work), 'saved');
  assert.equal(attempts, 2);
});
