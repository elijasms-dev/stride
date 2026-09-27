import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(
  new URL('../public/journal-store.js', import.meta.url),
  'utf8',
).replace('export function deviceJournal', 'function deviceJournal');
function setup() {
  const stats = {
    closed: 0,
    transactions: 0,
    changes: 0,
    created: 0,
    aborted: 0,
    writes: 0,
  };
  const request = {};
  const read = { result: { scope: 'A' } };
  const tx = {
    objectStore: () => ({
      get: () => read,
      put: () => stats.writes++,
      delete: () => stats.writes++,
    }),
    abort: () => stats.aborted++,
  };
  const db = {
    close: () => stats.closed++,
    transaction: () => {
      stats.transactions++;
      return tx;
    },
    createObjectStore: () => stats.created++,
  };
  request.result = db;
  request.transaction = tx;
  const context = vm.createContext({ indexedDB: { open: () => request } });
  vm.runInContext(source, context);
  return {
    request,
    read,
    tx,
    db,
    stats,
    open: (change) => context.deviceJournal(change),
  };
}
test('blocked database opens cannot later perform a ghost save after the caller received a failure', async () => {
  const f = setup();
  const result = f.open((current) => {
    f.stats.changes++;
    return { ...current, pending: ['ghost'] };
  });
  f.request.onblocked();
  await assert.rejects(result, /Close other Stride tabs/);
  f.request.onupgradeneeded();
  assert.equal(f.stats.created, 0);
  assert.equal(f.stats.aborted, 1);
  f.request.onsuccess();
  assert.equal(f.stats.transactions, 0);
  assert.equal(f.stats.changes, 0);
  assert.equal(f.stats.writes, 0);
  assert.equal(f.stats.closed, 1);
});
test('a save resolves only after commit and rejects a failed transaction without later applying its change', async () => {
  const f = setup();
  let finished = false;
  const result = f
    .open((current) => ({ ...current, pending: ['one'] }))
    .then((value) => {
      finished = true;
      return value;
    });
  f.request.onsuccess();
  f.read.onsuccess();
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(f.stats.writes, 1);
  f.tx.oncomplete();
  assert.equal((await result).pending[0], 'one');
  const failed = setup();
  const bad = failed.open(() => {
    failed.stats.changes++;
    return null;
  });
  failed.request.onsuccess();
  failed.tx.onerror();
  await assert.rejects(bad, /full or unavailable/);
  failed.read.onsuccess();
  assert.equal(failed.stats.changes, 0);
  assert.equal(failed.stats.writes, 0);
});
test('scope conflicts preserve their specific error and never publish a successful save', async () => {
  const f = setup();
  const result = f.open(() => {
    throw new Error('The account changed');
  });
  f.request.onsuccess();
  f.read.onsuccess();
  await assert.rejects(result, /account changed/);
  f.tx.onabort();
  assert.equal(f.stats.aborted, 1);
  assert.equal(f.stats.writes, 0);
});
