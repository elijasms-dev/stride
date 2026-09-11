/** Local disposable acceptance fixture only. Never point this file at production. */
import assert from 'node:assert/strict';
import { demoProfile, todayInZone, addDays } from '../lib/engine.ts';
import { Decoder, Stream } from '@garmin/fitsdk';
const root = 'http://localhost:3000';
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log('PASS', message);
}
async function request(path, body, options = {}) {
  const account = await fetch(root + '/api/account', {
    headers: { Cookie: '__sites_local_auth=1' },
  }).then((r) => r.json());
  const r = await fetch(root + path, {
    ...options,
    method: body ? 'POST' : 'GET',
    headers: {
      Cookie: '__sites_local_auth=1',
      'Content-Type': 'application/json',
      Origin: root,
      'x-stride-account': account.accountId,
      'x-stride-epoch': String(account.accountEpoch),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: r.status, data };
}
check(
  (await fetch(root + '/api/state')).status === 401,
  'Unauthenticated data requests are rejected',
);
check(
  (
    await request(
      '/api/plan',
      { action: 'preview' },
      { headers: { Origin: 'https://untrusted.example' } },
    )
  ).status === 403,
  'Cross-origin writes are rejected',
);
let current = (await request('/api/state')).data;
assert.ok(
  !current.plan || current.plan.profile.raceName.startsWith('Acceptance test'),
  'Refusing to mutate a non-test training journal',
);
if (current.plan) {
  const removal = (
    await request('/api/recovery', { action: 'preview', kind: 'delete' })
  ).data;
  assert.equal(
    (
      await request('/api/recovery', {
        action: 'commit',
        kind: 'delete',
        id: removal.id,
        confirm: 'DELETE',
      })
    ).status,
    200,
    'Clear only the previously guarded synthetic fixture',
  );
  const reopen = (
    await request('/api/recovery', { action: 'preview', kind: 'reopen' })
  ).data;
  assert.equal(
    (
      await request('/api/recovery', {
        action: 'commit',
        kind: 'reopen',
        id: reopen.id,
        confirm: 'OPEN',
      })
    ).status,
    200,
  );
  current = (await request('/api/state')).data;
}
const date = todayInZone('UTC');
const weekday = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
const runningDays = [0, 2, 4, 6]
  .map((offset) => (weekday + offset) % 7)
  .sort((a, b) => a - b);
const p = {
  ...demoProfile(date),
  startDate: date,
  days: runningDays,
  longDay: (weekday + 6) % 7,
  raceDate: addDays(date, 83),
  timezone: 'UTC',
  raceName: 'Acceptance test · 10K',
};
const preview = await request('/api/plan', { action: 'preview', profile: p });
check(
  preview.status === 200 && preview.data.plan.workouts.length > 20,
  'Profile produces a full plan preview',
);
check(
  (await request('/api/state')).data.version === current.version,
  'Preview does not activate a plan',
);
const invalid = await request('/api/plan', {
  action: 'preview',
  profile: { ...p, weeklyKm: -1 },
});
check(invalid.status === 422, 'Invalid runner inputs fail without saving');
const activate = await request('/api/plan', {
  action: 'activate',
  version: current.version,
  profile: p,
});
check(activate.status === 200, 'Activation persists a plan');
current = activate.data;
const run = current.plan.workouts.find((w) => w.date === date);
assert.ok(run, 'Fixture requires a running day today');
const fit = await fetch(
  root + `/api/export?format=fit&id=${encodeURIComponent(run.id)}`,
  { headers: { Cookie: '__sites_local_auth=1' } },
);
const bytes = new Uint8Array(await fit.arrayBuffer());
const decoder = new Decoder(Stream.fromByteArray(bytes));
check(
  fit.status === 200 && decoder.checkIntegrity(),
  'Private workout download is valid FIT',
);
check(
  (await request('/api/sync', { version: current.version, id: run.id }))
    .status === 409,
  'Disconnected sync is explicit and cannot report success',
);
const future = current.plan.workouts.find((w) => w.date > date);
const feedback = {
  effort: 5,
  feeling: 'okay',
  actualMinutes: 39,
  actualKm: 6.1,
  note: 'Disposable local test',
};
check(
  (
    await request('/api/plan', {
      action: 'complete',
      version: current.version,
      id: future.id,
      feedback,
    })
  ).status === 422,
  'Future workouts cannot be completed accidentally',
);
const logged = await request('/api/plan', {
  action: 'complete',
  version: current.version,
  id: run.id,
  feedback,
});
check(logged.status === 200, 'Actual time, distance and feedback are saved');
current = logged.data;
check(
  (
    await request('/api/plan', {
      action: 'move',
      version: current.version,
      id: run.id,
      date: addDays(date, 1),
    })
  ).status === 422,
  'Completed prescription cannot be moved',
);
check(
  (await request('/api/plan', { action: 'skip', version: 0, id: future.id }))
    .status === 409,
  'Stale edits cannot overwrite a newer plan',
);
const races = await Promise.all([
  request('/api/plan', {
    action: 'skip',
    version: current.version,
    id: future.id,
    reason: 'First concurrent test',
  }),
  request('/api/plan', {
    action: 'skip',
    version: current.version,
    id: future.id,
    reason: 'Concurrent test',
  }),
]);
check(
  races.filter((r) => r.status === 200).length === 1 &&
    races.filter((r) => r.status === 409).length === 1,
  'Only one concurrent writer wins a plan revision',
);
current = (await request('/api/state')).data;
const changed = await request('/api/plan', {
  action: 'adjust',
  version: current.version,
  from: addDays(date, 7),
  to: addDays(date, 10),
  mode: 'rest',
});
check(changed.status === 200, 'Interruption saves a reviewed, lighter return');
current = changed.data;
const undo = await request('/api/plan', {
  action: 'undo',
  version: current.version,
});
check(
  undo.status === 200 &&
    undo.data.plan.workouts.find((w) => w.id === run.id).status === 'completed',
  'Undo restores the plan and preserves completed history',
);
const saved = (await request('/api/state')).data;
check(
  saved.history.length >= 4 &&
    saved.plan.workouts.find((w) => w.id === run.id).feedback.actualKm === 6.1,
  'Journal and revision history survive reload',
);
const exported = await request('/api/export');
check(
  exported.status === 200 &&
    Array.isArray(exported.data.history) &&
    !JSON.stringify(exported.data).includes('encrypted_key'),
  'Backup includes plan history and excludes credentials',
);
console.log(
  `${checks} API acceptance checks passed. Local fixture is labeled Acceptance test.`,
);
check(
  (await fetch(root + '/api/profile')).status === 401,
  'Profiles require private authentication',
);
check(
  (
    await fetch(root + '/api/state', {
      headers: { 'oai-authenticated-user-id': 'forged-owner' },
    })
  ).status === 401,
  'Client-supplied identity headers cannot bypass the private gate',
);
check(
  (
    await request('/api/profile', {
      displayName: 'Runner',
      city: '',
      units: ['km'],
      timezone: 'UTC',
      accent: 'evergreen',
    })
  ).status === 422,
  'Profile enum values require real strings',
);
check(
  (
    await request('/api/profile', {
      displayName: 'Runner',
      city: '',
      units: 'km',
      timezone: 'Not/A_Zone',
      accent: 'evergreen',
    })
  ).status === 422,
  'Unknown profile timezone is rejected',
);
check(
  (
    await fetch(root + '/api/profile', {
      method: 'POST',
      headers: {
        Cookie: '__sites_local_auth=1',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  ).status === 403,
  'Writes without an Origin header are rejected',
);
check(
  (
    await request(
      '/api/profile',
      {
        displayName: 'Runner',
        city: '',
        units: 'km',
        timezone: 'UTC',
        accent: 'evergreen',
      },
      { headers: { Origin: 'https://localhost:3000' } },
    )
  ).status === 403,
  'Same hostname with the wrong scheme is rejected',
);
check(
  (await request('/api/profile', { padding: 'x'.repeat(100001) })).status ===
    413,
  'Oversized requests are rejected before parsing',
);
const phaseState = (await request('/api/state')).data;
const prefs = await request('/api/plan', {
  action: 'preferencesPreview',
  version: phaseState.version,
  preferences: { ...phaseState.plan.profile, difficulty: 'gentle' },
});
check(
  prefs.status === 200 &&
    prefs.data.version === phaseState.version &&
    prefs.data.effectiveDate === date,
  'Preference preview is bound to its plan revision and day',
);
check(
  (await request('/api/state')).data.version === phaseState.version,
  'Preference preview does not mutate the journal',
);
check(
  (
    await request('/api/plan', {
      action: 'preferences',
      version: phaseState.version,
      effectiveDate: addDays(date, -1),
      preferences: phaseState.plan.profile,
    })
  ).status === 409,
  'Yesterday’s preference preview cannot be applied',
);
const extra = {
  date: addDays(date, -1),
  minutes: 35,
  km: null,
  effort: 3,
  feeling: 'okay',
  note: 'Acceptance test extra',
};
const added = await request('/api/plan', {
  action: 'freeRun',
  version: phaseState.version,
  run: extra,
});
check(
  added.status === 200 && added.data.plan.extraRuns.at(-1).km === null,
  'Off-plan running preserves unknown distance and actual duration',
);
const attached = await request('/api/plan', {
  action: 'attachRecording',
  version: added.data.version,
  id: run.id,
  run: {
    ...extra,
    date,
    minutes: 40,
    km: 6.2,
    activityId: 'acceptance-recording-' + added.data.version,
  },
});
check(
  attached.status === 409 &&
    (await request('/api/state')).data.version === added.data.version,
  'Fabricated recording claims are rejected without a verified provider connection',
);
check(
  (
    await request('/api/plan', {
      action: 'preferences',
      version: prefs.data.version,
      effectiveDate: prefs.data.effectiveDate,
      preferences: prefs.data.plan.profile,
    })
  ).status === 409,
  'A new journal entry invalidates an older preference preview',
);
const finalPrefs = await request('/api/plan', {
  action: 'preferences',
  version: added.data.version,
  effectiveDate: date,
  preferences: { ...added.data.plan.profile, difficulty: 'gentle' },
});
check(
  finalPrefs.status === 200 &&
    finalPrefs.data.plan.workouts.find((w) => w.id === run.id).status ===
      'completed',
  'Preference changes keep the current race and completed history',
);
const beforeProfile = (await request('/api/state')).data;
check(
  (
    await request('/api/profile', {
      displayName: 'Acceptance runner',
      city: 'Local test',
      units: 'mi',
      timezone: 'Europe/Vilnius',
      accent: 'slate',
    })
  ).status === 200,
  'Profile customization persists',
);
const account = (await request('/api/profile')).data;
const afterProfile = (await request('/api/state')).data;
check(
  account.profile.display_name === 'Acceptance runner' &&
    account.profile.accent === 'slate' &&
    afterProfile.version === beforeProfile.version + 1 &&
    afterProfile.plan.profile.units === 'mi' &&
    afterProfile.plan.profile.timezone === 'Europe/Vilnius',
  'Profile settings update current units and timezone without changing prescriptions',
);
assert.deepEqual(afterProfile.plan.workouts, beforeProfile.plan.workouts);
check(
  !('googleConfigured' in account) && !('google_email' in account.profile),
  'Google integration is absent from the account API',
);
const page = await fetch(root + '/login', {
  headers: { Cookie: '__sites_local_auth=1' },
});
check(
  page.status === 200 &&
    page.headers.get('x-content-type-options') === 'nosniff' &&
    page.headers.get('content-security-policy')?.includes("object-src 'none'"),
  'Private access page includes browser security headers',
);
console.log(`${checks} total API acceptance checks passed.`);

// These destructive checks are restricted to the same explicitly synthetic local journal.
current = (await request('/api/state')).data;
assert.ok(
  current.plan?.profile.raceName.startsWith('Acceptance test'),
  'Refuse recovery tests against a non-test journal.',
);
const epochBefore = current.accountEpoch;
check(
  (
    await request(
      '/api/plan',
      {
        action: 'preferencesPreview',
        version: current.version,
        preferences: {},
      },
      { headers: { 'x-stride-epoch': String(epochBefore + 1) } },
    )
  ).status === 409,
  'An old or invented account epoch cannot preview a write',
);
const event = {
  goal: 'base',
  raceName: 'Acceptance test next block',
  raceDate: addDays(todayInZone(current.plan.profile.timezone), 55),
  raceTerrain: 'road',
};
const eventPreview = await request('/api/plan', {
  action: 'eventPreview',
  version: current.version,
  event,
});
check(
  eventPreview.status === 200,
  'Event change returns a full reviewed replacement block',
);
const changedEvent = await request('/api/plan', {
  action: 'changeEvent',
  version: eventPreview.data.version,
  effectiveDate: eventPreview.data.effectiveDate,
  event,
});
check(
  changedEvent.status === 200,
  'Reviewed event change persists through the HTTP API',
);
const cal = await fetch(root + '/api/export?format=calendar', {
  headers: { Cookie: '__sites_local_auth=1' },
});
check(
  cal.status === 200 &&
    cal.headers.get('content-type').includes('text/calendar') &&
    (await cal.text()).includes('BEGIN:VCALENDAR'),
  'Calendar download returns an actual iCalendar snapshot',
);
const backup = (await request('/api/export?format=recovery')).data;
check(
  backup.format === 'stride-recovery-2' &&
    backup.plan &&
    backup.profile &&
    !JSON.stringify(backup).includes('encrypted_key'),
  'Recovery export contains the journal and profile without a connection key',
);
let review = (
  await request('/api/recovery', {
    action: 'preview',
    kind: 'restore',
    file: backup,
  })
).data;
check(
  !!review.id &&
    review.replacement.completed ===
      backup.plan.workouts.filter((w) => w.status === 'completed').length,
  'Recovery preview counts the actual recorded running',
);
const restored = await request('/api/recovery', {
  action: 'commit',
  kind: 'restore',
  id: review.id,
  file: backup,
  confirm: 'REPLACE',
});
check(
  restored.status === 200 && restored.data.accountEpoch === epochBefore + 1,
  'Recovery commit atomically advances the account epoch',
);
const repeated = await request('/api/recovery', {
  action: 'commit',
  kind: 'restore',
  id: review.id,
  file: backup,
  confirm: 'REPLACE',
});
check(
  repeated.status === 200 && repeated.data.alreadyCompleted,
  'A retried successful recovery is recognized without a second restore',
);
check(
  (
    await request(
      '/api/plan',
      {
        action: 'activate',
        version: restored.data.version,
        profile: backup.plan.profile,
      },
      { headers: { 'x-stride-epoch': String(epochBefore) } },
    )
  ).status === 409,
  'An in-flight pre-recovery request cannot overwrite the recovered journal',
);
review = (await request('/api/recovery', { action: 'preview', kind: 'delete' }))
  .data;
const deleted = await request('/api/recovery', {
  action: 'commit',
  kind: 'delete',
  id: review.id,
  confirm: 'DELETE',
});
check(
  deleted.status === 200 && deleted.data.accountStatus === 'closed',
  'Explicit synthetic journal deletion closes the local account',
);
const emptyExport = (await request('/api/export?format=recovery')).data;
check(
  emptyExport.plan === null && emptyExport.profile === null,
  'Deleted local journal exports no plan or profile',
);
review = (
  await request('/api/recovery', {
    action: 'preview',
    kind: 'restore',
    file: backup,
  })
).data;
const opened = await request('/api/recovery', {
  action: 'commit',
  kind: 'restore',
  id: review.id,
  file: backup,
  confirm: 'REPLACE',
});
check(
  opened.status === 200 &&
    opened.data.accountStatus === 'active' &&
    opened.data.plan.workouts.length === backup.plan.workouts.length,
  'The exact synthetic backup restores a closed journal without losing records',
);
const billing = (await request('/api/billing')).data;
check(
  billing.enabled === false && billing.mode === 'disabled',
  'Billing remains explicitly disabled in the real API',
);
for (const path of ['/about', '/privacy', '/terms']) {
  const page = await fetch(root + path, {
    headers: { Cookie: '__sites_local_auth=1' },
  });
  check(
    page.status === 200 && (await page.text()).includes('Stride'),
    `The ${path} information surface renders through the app server`,
  );
}
console.log(
  `${checks} total API acceptance checks passed including recovery, event changes, calendar and billing gates.`,
);
