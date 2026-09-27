import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoProfile, validateProfile } from '../lib/engine.ts';
import {
  DRAFT_LIFETIME_MS,
  purgeDurableDrafts,
  purgeScopeDurableDrafts,
} from '../lib/durable-draft.ts';
import {
  validOnboardingDraft,
  onboardingDraftIdentity,
  loadOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
} from '../lib/onboarding-draft.ts';
const { default: Onboarding } = await import('../components/onboarding.tsx');
const now = Date.parse('2026-09-24T12:00:00Z');
const scope = 'account-A:4';
function storage() {
  const values = new Map();
  return {
    values,
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const draft = () => ({
  profile: demoProfile('2026-09-24'),
  raw: { weeklyKm: { text: '.', value: 'NaN', factor: 1, pace: false } },
  step: 1,
  scheduleTouched: false,
});
const envelope = (value, savedAt = now) =>
  JSON.stringify({ version: 1, savedAt, value });

test('onboarding survives a closed tab through a validated device envelope with raw incomplete input intact', () => {
  const local = storage(),
    session = storage(),
    value = draft();
  value.profile.weeklyKm = NaN;
  assert.equal(saveOnboardingDraft(scope, value, local, now), true);
  const restored = loadOnboardingDraft(scope, local, session, now + 1000);
  assert.equal(restored.unavailable, false);
  assert.equal(restored.draft.profile.weeklyKm, null);
  assert.deepEqual(restored.draft.raw, value.raw);
  assert.equal(session.length, 0);
  assert.throws(
    () => validateProfile(restored.draft.profile, '2026-09-24'),
    undefined,
    'Restoring a draft must not bypass full plan validation',
  );
});

test('profile eligibility stays in existing validation, with malformed stored shapes rejected before render', () => {
  assert.equal(validOnboardingDraft(draft()), true);
  const local = storage(),
    session = storage(),
    key = onboardingDraftIdentity(scope).storageKey;
  for (const patch of [
    { days: [0, 'Monday'] },
    { availableDays: {} },
    { timezone: 'not/a-timezone' },
    { goal: 'unknown' },
    { experience: {} },
    { crossTraining: [{ day: 2, activity: 'unknown', minutes: 30 }] },
    { dayPreferences: [{ day: 0, startTime: {} }] },
    { recentRace: { distanceKm: {}, timeMinutes: 20 } },
    { extraExecutableField: 'no' },
  ]) {
    const value = draft();
    Object.assign(value.profile, patch);
    local.setItem(key, envelope(value));
    assert.equal(loadOnboardingDraft(scope, local, session, now).draft, null);
    assert.equal(local.getItem(key), null);
  }
  for (const raw of [
    { x: 'not-a-numeric-draft' },
    { x: { text: {}, value: '3', factor: 1, pace: false } },
  ]) {
    local.setItem(key, envelope({ ...draft(), raw }));
    assert.equal(loadOnboardingDraft(scope, local, session, now).draft, null);
  }
});

test('expired, future, unknown-version, malformed and oversized envelopes cannot restore', () => {
  const local = storage(),
    session = storage(),
    key = onboardingDraftIdentity(scope).storageKey;
  for (const raw of [
    envelope(draft(), now - DRAFT_LIFETIME_MS - 1),
    envelope(draft(), now + 60001),
    JSON.stringify({ version: 2, savedAt: now, value: draft() }),
    '{broken',
    'x'.repeat(65537),
    envelope({ ...draft(), step: 3 }),
  ]) {
    local.setItem(key, raw);
    assert.equal(loadOnboardingDraft(scope, local, session, now).draft, null);
  }
});

test('valid legacy session draft migrates once while preserving its original expiration', () => {
  const local = storage(),
    session = storage(),
    identity = onboardingDraftIdentity(scope),
    value = draft();
  const savedAt = now - 1000;
  session.setItem(identity.legacyKey, JSON.stringify({ ...value, savedAt }));
  const loaded = loadOnboardingDraft(scope, local, session, now);
  assert.deepEqual(loaded.draft, {
    ...value,
    profile: {
      ...value.profile,
      availableDays: value.profile.availableDays ?? value.profile.days,
      runsPerWeek: value.profile.runsPerWeek ?? value.profile.days.length,
    },
  });
  assert.equal(JSON.parse(local.getItem(identity.storageKey)).savedAt, savedAt);
  assert.equal(session.getItem(identity.legacyKey), null);
  assert.deepEqual(
    loadOnboardingDraft(scope, local, storage(), now).draft,
    loaded.draft,
  );
});

test('a denied durable write preserves the valid legacy draft and reports persistence failure', () => {
  const local = storage(),
    session = storage(),
    identity = onboardingDraftIdentity(scope);
  local.setItem = () => {
    throw new Error('Quota unavailable');
  };
  session.setItem(
    identity.legacyKey,
    JSON.stringify({ ...draft(), savedAt: now }),
  );
  const loaded = loadOnboardingDraft(scope, local, session, now);
  assert.ok(loaded.draft);
  assert.equal(loaded.unavailable, true);
  assert.ok(session.getItem(identity.legacyKey));
  assert.equal(saveOnboardingDraft(scope, draft(), local, now), false);
  assert.equal(saveOnboardingDraft('', draft(), storage(), now), false);
});

test('device draft wins over older session data and activation/discard erase both stores only for that form', () => {
  const local = storage(),
    session = storage(),
    identity = onboardingDraftIdentity(scope);
  const value = draft();
  value.profile.name = 'Current draft';
  saveOnboardingDraft(scope, value, local, now);
  session.setItem(
    identity.legacyKey,
    JSON.stringify({ ...draft(), savedAt: now - 1000 }),
  );
  saveOnboardingDraft('account-B:1', draft(), local, now);
  assert.equal(
    loadOnboardingDraft(scope, local, session, now).draft.profile.name,
    'Current draft',
  );
  assert.equal(clearOnboardingDraft(scope, local, session), true);
  assert.equal(local.getItem(identity.storageKey), null);
  assert.equal(session.getItem(identity.legacyKey), null);
  assert.ok(local.getItem(onboardingDraftIdentity('account-B:1').storageKey));
});

test('restart drafts share the account purge boundary without colliding across plans or accounts', () => {
  const local = storage();
  const identities = [
    scope,
    `${scope}:restart:plan-one`,
    `${scope}:restart:plan-two`,
    'account-B:1',
    'account-B:1:restart:plan-one',
  ].map(onboardingDraftIdentity);
  for (const entry of identities) local.setItem(entry.storageKey, 'synthetic');
  assert.equal(new Set(identities.map((entry) => entry.storageKey)).size, 5);
  purgeDurableDrafts(scope, local);
  assert.equal(local.length, 3);
  assert.ok(local.getItem(identities[2].storageKey));
  local.setItem(identities[3].storageKey, 'new account');
  purgeScopeDurableDrafts(scope, local);
  assert.deepEqual(
    [...local.values.keys()],
    [identities[3].storageKey],
    'A stale tab purges only its old account, including every restart draft',
  );
});

test('onboarding renders device persistence copy and an accessible storage failure message', (t) => {
  for (const [key, value] of Object.entries({
    window: {},
    localStorage: {
      getItem() {
        throw new Error('Storage disabled');
      },
    },
    sessionStorage: storage(),
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }
  const html = renderToStaticMarkup(
    createElement(Onboarding, {
      open: true,
      onClose() {},
      onActivate: async () => {},
      draftScope: scope,
      busy: false,
    }),
  );
  assert.match(html, /stays on this device for up to 30 days/);
  assert.match(
    html,
    /role="alert">Your draft could not be saved on this device/,
  );
  assert.doesNotMatch(html, /stays in this tab/);
});
