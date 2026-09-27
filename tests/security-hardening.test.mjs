import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptCredential,
  decryptCredential,
  credentialNeedsRotation,
  CredentialConfigurationError,
} from '../lib/credential-encryption.ts';
import {
  beginRequestObservation,
  safeRequestObservation,
} from '../lib/request-observation.ts';
import config from '../next.config.ts';
const legacy = 'synthetic-existing-legacy-key';
const first = 'synthetic-new-random-key-with-32-characters-a';
const second = 'synthetic-new-random-key-with-32-characters-b';
const secrets = (active = 'first') => ({
  STRIDE_ENCRYPTION_KEY: legacy,
  STRIDE_ENCRYPTION_KEY_ID: active,
  STRIDE_ENCRYPTION_KEYS: JSON.stringify({ first, second }),
});
async function oldEnvelope(plaintext) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(legacy),
  );
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...data));
}

test('versioned credential envelopes use unique IVs and authenticate their key identity', async () => {
  const plaintext = 'synthetic-secret-never-log-μ';
  const a = await encryptCredential(plaintext, secrets());
  const b = await encryptCredential(plaintext, secrets());
  assert.notEqual(a, b);
  assert.match(a, /^stride:v1:first:/);
  assert.equal(await decryptCredential(a, secrets()), plaintext);
  assert.equal(credentialNeedsRotation(a, secrets()), false);
  const sameKeyDifferentIds = {
    ...secrets(),
    STRIDE_ENCRYPTION_KEYS: JSON.stringify({ first, second: first }),
  };
  await assert.rejects(
    decryptCredential(a.replace(':first:', ':second:'), sameKeyDifferentIds),
  );
  await assert.rejects(
    decryptCredential(a.slice(0, -8) + 'AAAAAA==', secrets()),
  );
  await assert.rejects(decryptCredential(a.replace(':v1:', ':v2:'), secrets()));
});

test('legacy raw ciphertext survives rotation; new active key does not invalidate retained keys', async () => {
  const a = await oldEnvelope('old-api-key');
  assert.equal(await decryptCredential(a, secrets()), 'old-api-key');
  assert.equal(credentialNeedsRotation(a, secrets()), true);
  const b = await encryptCredential(
    await decryptCredential(a, secrets()),
    secrets(),
  );
  assert.equal(await decryptCredential(b, secrets('second')), 'old-api-key');
  assert.equal(credentialNeedsRotation(b, secrets('second')), true);
  const c = await encryptCredential('current-api-key', secrets('second'));
  const retired = {
    ...secrets('second'),
    STRIDE_ENCRYPTION_KEYS: JSON.stringify({ second }),
  };
  assert.equal(await decryptCredential(c, retired), 'current-api-key');
  await assert.rejects(
    decryptCredential(b, retired),
    CredentialConfigurationError,
  );
});

test('single legacy secret remains compatible and invalid keyrings fail closed', async () => {
  const single = {
    STRIDE_ENCRYPTION_KEY: legacy,
    STRIDE_ENCRYPTION_KEY_ID: '',
  };
  const a = await encryptCredential('key', single);
  assert.match(a, /^stride:v1:legacy:/);
  assert.equal(await decryptCredential(a, single), 'key');
  for (const broken of [
    {},
    { ...secrets(), STRIDE_ENCRYPTION_KEYS: 'garbage' },
    { ...secrets(), STRIDE_ENCRYPTION_KEY_ID: 'missing' },
    {
      ...secrets(),
      STRIDE_ENCRYPTION_KEYS: JSON.stringify({ first: 'short' }),
    },
    { ...secrets(), STRIDE_ENCRYPTION_KEY_ID: undefined },
    { ...secrets(), STRIDE_ENCRYPTION_KEYS: JSON.stringify({ legacy: first }) },
  ])
    await assert.rejects(
      encryptCredential('key', broken),
      CredentialConfigurationError,
    );
});

test('request observations expose only closed operation names and bounded durations', () => {
  const observed = beginRequestObservation(
    new Request('https://stride.test/api/activities?owner=PRIVATE&key=SECRET'),
  );
  const metric = safeRequestObservation(observed);
  assert.equal(metric.operation, 'activities');
  assert.ok(metric.durationMs >= 0);
  assert.doesNotMatch(JSON.stringify(metric), /PRIVATE|SECRET|https|owner/);
  assert.equal(
    safeRequestObservation({
      operation: 'PRIVATE/SECRET',
      startedAt: -Infinity,
    }).operation,
    'other',
  );
  assert.equal(
    beginRequestObservation(new Request('https://stride.test/api/PRIVATE'))
      .operation,
    'other',
  );
});

test('security headers prevent foreign framing while preserving current scripts and local workers', async () => {
  const headers = (await config.headers())[0].headers;
  assert.equal(
    headers.find((h) => h.key === 'X-Frame-Options').value,
    'SAMEORIGIN',
  );
  const csp = headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /worker-src 'self'/);
  assert.doesNotMatch(csp, /script-src/);
});
