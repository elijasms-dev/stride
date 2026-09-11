import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(s, c, next) {
    return next(s === './action-progress' ? './action-progress.ts' : s, c);
  },
});
const { createApiClient, SessionChangedError, StaleResponseError } =
  await import('../lib/client-api.ts');
const a = { accountId: 'runner-A', accountEpoch: 0 };
const b = { accountId: 'runner-B', accountEpoch: 0 };
const ok = (data) => Response.json(data);
const write = { method: 'POST', body: '{}' };
const recovery = {
  method: 'POST',
  body: JSON.stringify({ action: 'commit', kind: 'restore' }),
};
function fixture(responses) {
  const calls = [];
  const client = createApiClient(async (path, init) => {
    calls.push({ path, init });
    const value = responses.shift();
    if (value instanceof Error) throw value;
    return typeof value === 'function' ? value() : value;
  });
  return { client, calls };
}

void test('first write bootstraps identity and sends immutable ID and epoch', async () => {
  const { client, calls } = fixture([ok(a), ok({ saved: true })]);
  await client.api('/api/profile', write, false);
  assert.equal(calls[0].path, '/api/account');
  assert.equal(calls[1].init.headers.get('x-stride-account'), a.accountId);
  assert.equal(calls[1].init.headers.get('x-stride-epoch'), '0');
  assert.equal(calls[1].init.credentials, 'same-origin');
});
void test('same-epoch account switch invalidates the document and blocks all subsequent requests', async () => {
  const { client, calls } = fixture([ok(a), ok(b)]);
  let changes = 0;
  client.subscribe(() => changes++);
  await client.api('/api/account');
  await assert.rejects(client.api('/api/state'), SessionChangedError);
  await assert.rejects(
    client.api('/api/profile', write, false),
    SessionChangedError,
  );
  assert.equal(client.isInvalid(), true);
  assert.equal(changes, 1);
  assert.equal(calls.length, 2);
});
void test('unexpected epoch changes require a new document', async () => {
  const { client } = fixture([ok(a), ok({ ...a, accountEpoch: 1 })]);
  await client.api('/api/account');
  await assert.rejects(client.api('/api/account'), SessionChangedError);
});
void test('failed payload cannot silently change account authority', async () => {
  const { client, calls } = fixture([
    ok(a),
    Response.json({ ...b, error: 'Invalid profile' }, { status: 422 }),
    ok({ saved: true }),
  ]);
  await client.api('/api/account');
  await assert.rejects(
    client.api('/api/profile', write, false),
    /Invalid profile/,
  );
  await client.api('/api/profile', write, false);
  assert.equal(calls[2].init.headers.get('x-stride-account'), a.accountId);
});
void test('server account conflict, expired session and HTML redirect invalidate', async () => {
  for (const response of [
    Response.json(
      { code: 'ACCOUNT_CONTEXT_CHANGED', error: 'Reload' },
      { status: 409 },
    ),
    Response.json({ error: 'Login' }, { status: 401 }),
    new Response('<html>Sign in</html>', {
      headers: { 'content-type': 'text/html' },
    }),
  ]) {
    const { client } = fixture([ok(a), response]);
    await client.api('/api/account');
    await assert.rejects(
      client.api('/api/profile', write, false),
      SessionChangedError,
    );
    assert.equal(client.isInvalid(), true);
  }
});
void test('only successful recovery commit may advance this account epoch', async () => {
  const { client, calls } = fixture([
    ok(a),
    ok({ ...a, accountEpoch: 1 }),
    ok({ saved: true }),
  ]);
  await client.api('/api/account');
  await client.api('/api/recovery', recovery, false);
  await client.api('/api/profile', write, false);
  assert.equal(client.isInvalid(), false);
  assert.equal(calls[2].init.headers.get('x-stride-epoch'), '1');
});
void test('recovery cannot adopt a different account or skip an epoch', async () => {
  for (const value of [
    { ...b, accountEpoch: 1 },
    { ...a, accountEpoch: 2 },
  ]) {
    const { client } = fixture([ok(a), ok(value)]);
    await client.api('/api/account');
    await assert.rejects(
      client.api('/api/recovery', recovery, false),
      SessionChangedError,
    );
  }
});
void test('late old read after recovery cannot roll back UI or the next write stamp', async () => {
  let finish;
  const pending = new Promise((resolve) => (finish = resolve));
  const { client, calls } = fixture([
    ok(a),
    () => pending,
    ok({ ...a, accountEpoch: 1 }),
    ok({ saved: true }),
  ]);
  await client.api('/api/account');
  const old = client.api('/api/state');
  await client.api('/api/recovery', recovery, false);
  finish(ok(a));
  await assert.rejects(old, StaleResponseError);
  await client.api('/api/profile', write, false);
  assert.equal(calls[3].init.headers.get('x-stride-epoch'), '1');
  assert.equal(client.isInvalid(), false);
});
void test('malformed or missing initial identity fails closed', async () => {
  for (const value of [
    {},
    { ...a, accountId: '' },
    { ...a, accountEpoch: -1 },
    { ...a, accountEpoch: 0.5 },
    { ...a, accountEpoch: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const { client, calls } = fixture([ok(value)]);
    await assert.rejects(
      client.api('/api/profile', write, false),
      SessionChangedError,
    );
    assert.equal(calls.length, 1);
  }
});
void test('network failures permit retry using the original identity', async () => {
  const { client, calls } = fixture([
    ok(a),
    new Error('offline'),
    ok({ saved: true }),
  ]);
  await client.api('/api/account');
  await assert.rejects(
    client.api('/api/profile', write, false),
    /did not finish/,
  );
  assert.equal(client.isInvalid(), false);
  await client.api('/api/profile', write, false);
  assert.equal(calls[2].init.headers.get('x-stride-account'), a.accountId);
});

void test('late old-epoch rejection does not invalidate a completed recovery', async () => {
  let finish;
  const pending = new Promise((resolve) => (finish = resolve));
  const { client, calls } = fixture([
    ok(a),
    () => pending,
    ok({ ...a, accountEpoch: 1 }),
    ok({ saved: true }),
  ]);
  await client.api('/api/account');
  const old = client.api('/api/profile', write, false);
  await client.api('/api/recovery', recovery, false);
  finish(
    Response.json(
      { code: 'ACCOUNT_CONTEXT_CHANGED', error: 'Stale epoch' },
      { status: 409 },
    ),
  );
  await assert.rejects(old, StaleResponseError);
  await client.api('/api/profile', write, false);
  assert.equal(client.isInvalid(), false);
  assert.equal(calls[3].init.headers.get('x-stride-epoch'), '1');
});
