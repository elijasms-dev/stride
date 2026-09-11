import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo, signInHref } from '../lib/auth-navigation.ts';
void test('auth preserves known views and training context', () => {
  const path = '/?view=plan&day=2026-09-10&block=runner-block';
  assert.equal(safeReturnTo(path), path);
  assert.equal(
    signInHref(path),
    '/signin-with-chatgpt?return_to=' + encodeURIComponent(path),
  );
  assert.equal(safeReturnTo('/?setup=1'), '/?setup=1');
});
void test('external, protocol-relative, encoded, control and auth-loop destinations are rejected', () => {
  for (const path of [
    'https://attacker.test',
    '//attacker.test',
    '/\\attacker.test',
    '/%2f%2fattacker.test',
    '/login',
    '/api/export',
    '/signin-with-chatgpt',
    '/signout-with-chatgpt',
    '/callback',
    '/\n/attacker.test',
    null,
    ['/'],
  ])
    assert.equal(safeReturnTo(path), '/');
});
void test('unknown queries, arrays and invalid context are stripped', () => {
  assert.equal(
    safeReturnTo(
      '/?view=settings&next=https://attacker.test&token=private&day=nope&block=%2F%2Fattacker',
    ),
    '/?view=settings',
  );
});
