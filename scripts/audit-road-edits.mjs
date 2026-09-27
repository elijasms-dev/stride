// Offline audit of production route handlers and production plan modules.
// Uses synthetic road-runner inputs, migrated in-memory SQLite and a fixed clock.
// Never reads a saved account, .env, browser storage or provider credentials.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const asOf = '2026-09-19';
const start = '2026-09-14';
const fixedInstant = `${asOf}T12:00:00.000Z`;
const RealDate = globalThis.Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [fixedInstant]));
  }
  static now() {
    return RealDate.parse(fixedInstant);
  }
};
globalThis.roadEditAuditEnv = {
  DB: null,
  STRIDE_ENCRYPTION_KEY: 'synthetic-road-edit-audit-key',
};
globalThis.fetch = async () => {
  throw new Error('Road edit audit prohibits network requests');
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers')
      return {
        url: 'data:text/javascript,export const env=globalThis.roadEditAuditEnv;',
        shortCircuit: true,
      };
    if (context.parentURL?.startsWith(root.href)) {
      const base = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), root)
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
const engine = await import('../lib/engine.ts');
const { qualityWorkMinutes } = await import('../lib/prescription.ts');
const { workoutStepTarget } = await import('../lib/workout-targets.ts');
const { readAccount } = await import('../lib/accounts.ts');
const { POST: planRoute } = await import('../app/api/plan/route.ts');
const { POST: profileRoute } = await import('../app/api/profile/route.ts');
const { GET: exportRoute } = await import('../app/api/export/route.ts');
const { POST: recoveryRoute } = await import('../app/api/recovery/route.ts');
const { validateRecovery } = await import('../lib/recovery.ts');
const { addDays, makePlan, demoProfile, validatePlan, taperFactor } = engine;

const json = (value) => JSON.stringify(value);
const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};
const equal = (actual, expected, message) =>
  ensure(isDeepStrictEqual(actual, expected), message);

const cases = ['5k', '10k', 'half', 'marathon'].flatMap((goal) =>
  [0, 1, 2].flatMap((qualitySessions) =>
    ['distance-km', 'time-mi'].map((variant) => ({
      id: `${goal}-q${qualitySessions}-${variant}`,
      input: {
        ...demoProfile(start),
        goal,
        raceName: `Synthetic ${goal} edit audit`,
        startDate: start,
        raceDate: addDays(
          start,
          ['half', 'marathon'].includes(goal) ? 111 : 83,
        ),
        weeklyKm: goal === 'marathon' ? 70 : goal === 'half' ? 60 : 50,
        longestKm:
          goal === 'marathon'
            ? 23
            : goal === 'half'
              ? 18
              : goal === '10k'
                ? 14
                : 12,
        currentRuns: 5,
        runsPerWeek: 5,
        days: [0, 1, 2, 4, 6],
        availableDays: [0, 1, 2, 3, 4, 5, 6],
        longDay: 6,
        weekdayMinutes: 120,
        longMinutes: 300,
        easyPace: 6,
        qualityMode: 'custom',
        qualitySessions,
        recentQualitySessions: 2,
        recentQualityMinutes: 40,
        workoutVariety: 'varied',
        workoutFormat: 'automatic',
        runMeasure: variant.startsWith('time') ? 'time' : 'distance',
        units: variant.endsWith('mi') ? 'mi' : 'km',
        timezone: 'UTC',
        recentRace: {
          distanceKm: 10,
          timeMinutes: 50,
          date: '2026-09-01',
          source: 'race',
          course: 'road',
        },
      },
    })),
  ),
);

function d1(sqlite) {
  const prepare = (sql, args = []) => ({
    bind: (...values) => prepare(sql, values),
    first: async (column) => {
      const row = sqlite.prepare(sql).get(...args) ?? null;
      return column ? (row?.[column] ?? null) : row;
    },
    all: async () => ({
      results: sqlite.prepare(sql).all(...args),
      success: true,
      meta: {},
    }),
    run: async () => {
      const result = sqlite.prepare(sql).run(...args);
      return {
        success: true,
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    },
  });
  return {
    prepare,
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    exec: async (sql) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
}

function prescription(w, keepId = true) {
  return {
    ...(keepId ? { id: w.id } : {}),
    date: w.date,
    originalDate: w.originalDate,
    week: w.week,
    title: w.title,
    kind: w.kind,
    minutes: w.minutes,
    estimatedKm: w.estimatedKm,
    hard: w.hard,
    steps: w.steps,
    status: w.status,
    feedback: w.feedback,
    changed: w.changed,
    changeSource: w.changeSource,
  };
}
function checks(before, after, requested, options = {}) {
  ensure(after, 'Saved state lost the active plan');
  const issues = validatePlan(after);
  ensure(
    issues.length === 0,
    `Accepted state fails validatePlan: ${issues.join('; ')}`,
  );
  equal(
    validatePlan(JSON.parse(json(after))),
    [],
    'JSON persistence invalidated accepted plan',
  );
  ensure(
    after.profile.qualityMode === 'custom' &&
      after.profile.qualitySessions === requested,
    `Explicit weekday preference lost: expected ${requested}, received ${after.profile.qualitySessions} (${after.profile.qualityMode})`,
  );
  for (const w of before.workouts) {
    if (options.restored) break; // Restore changes identities; checked separately below.
    const next = after.workouts.find((item) => item.id === w.id);
    const reviewedManualTarget =
      options.targetEdit &&
      w.date >= asOf &&
      w.status === 'planned' &&
      w.changed &&
      w.changeSource === 'manual';
    if (
      (w.date < asOf ||
        w.status === 'completed' ||
        (w.changed && w.changeSource === 'manual')) &&
      w.id !== options.editId &&
      !reviewedManualTarget
    )
      equal(
        next && prescription(next),
        prescription(w),
        `Protected saved prescription or log changed: ${w.id}`,
      );
    if (reviewedManualTarget) {
      ensure(
        next && next.changeSource === 'manual',
        `Reviewed target edit lost manual protection: ${w.id}`,
      );
      equal(
        [next.date, next.minutes, next.kind, next.hard],
        [w.date, w.minutes, w.kind, w.hard],
        `Target edit changed manual session timing or role: ${w.id}`,
      );
      equal(
        next.steps.map(({ kind, seconds, intensity, movement }) => ({
          kind,
          seconds,
          intensity,
          movement,
        })),
        w.steps.map(({ kind, seconds, intensity, movement }) => ({
          kind,
          seconds,
          intensity,
          movement,
        })),
        `Target edit changed manual work/recovery duration: ${w.id}`,
      );
    }
    if (options.keepAllocation) {
      ensure(!!next, `Unrelated edit dropped ${w.id}`);
      equal(
        [next.date, next.minutes],
        [w.date, w.minutes],
        `Unrelated edit changed allocated date/time: ${w.id}`,
      );
      ensure(
        options.measurementRounding
          ? Math.abs(next.estimatedKm - w.estimatedKm) <= 0.0005 + 1e-12
          : next.estimatedKm === w.estimatedKm,
        `Unrelated edit changed allocated time/distance: ${w.id}; ${json([w.date, w.minutes, w.estimatedKm])} -> ${json([next.date, next.minutes, next.estimatedKm])}`,
      );
    }
  }
  for (const week of after.weeks) {
    if (
      week.start < asOf ||
      ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
      addDays(week.start, 6) >= after.profile.raceDate ||
      taperFactor(after.profile, addDays(week.start, 6)) < 1
    )
      continue;
    const runs = after.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    const count = runs.filter(
      (w) => w.kind !== 'long' && w.hard && qualityWorkMinutes(w) > 0,
    ).length;
    ensure(
      count === requested,
      `Week ${week.index + 1} has ${count} weekday workouts; selected ${requested}`,
    );
  }
}

async function auditCase(item) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('drizzle/', root))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort())
    sqlite.exec(readFileSync(new URL(`drizzle/${file}`, root), 'utf8'));
  globalThis.roadEditAuditEnv.DB = d1(sqlite);
  const owner = `road-edit-audit-${item.id}`;
  await readAccount(owner);
  const initial = makePlan(item.input, start, false);
  sqlite
    .prepare(
      'INSERT INTO athlete_state(owner,version,data,updated_at) VALUES(?,?,?,?)',
    )
    .run(owner, 1, json(initial), fixedInstant);
  sqlite
    .prepare(
      'INSERT INTO profiles(owner,display_name,city,units,timezone,accent,updated_at) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      owner,
      'Synthetic runner',
      '',
      item.input.units,
      'UTC',
      'evergreen',
      fixedInstant,
    );
  const state = () => {
    const row = sqlite
      .prepare('SELECT version,data FROM athlete_state WHERE owner=?')
      .get(owner);
    return { version: row.version, plan: JSON.parse(row.data) };
  };
  const request = (path, payload) => {
    const account = sqlite
      .prepare('SELECT account_id,epoch FROM accounts WHERE owner=?')
      .get(owner);
    return new Request(`https://road-audit.invalid${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        'oai-authenticated-user-id': owner,
        'x-stride-account': account.account_id,
        'x-stride-epoch': String(account.epoch),
        origin: 'https://road-audit.invalid',
        'content-type': 'application/json',
      },
      ...(payload ? { body: json(payload) } : {}),
    });
  };
  const call = async (handler, path, payload) => {
    const response = await handler(request(path, payload));
    return { status: response.status, data: await response.json() };
  };
  const planAction = (payload) =>
    call(planRoute, '/api/plan', { version: state().version, ...payload });
  const requireSuccess = (response, name) => {
    ensure(
      response.status === 200,
      `${name}: HTTP ${response.status}: ${response.data.error ?? json(response.data)}`,
    );
    return response.data;
  };
  const trace = [];
  let requested = item.input.qualitySessions;
  let manualId;
  let lastRecovery;
  async function exercise(name, action, options = {}) {
    const before = state();
    try {
      const details = await action(before);
      const after = state();
      const expected = options.count ?? requested;
      checks(before.plan, after.plan, expected, options);
      requested = expected;
      trace.push({
        name,
        status: 'pass',
        versionBefore: before.version,
        versionAfter: after.version,
        ...(details ? { details } : {}),
      });
    } catch (error) {
      trace.push({
        name,
        status: 'needs-review',
        versionBefore: before.version,
        versionAfter: state().version,
        error: error.message,
      });
    }
  }
  async function reject(name, action, status, pattern) {
    const before = state();
    try {
      const result = await action(before);
      ensure(
        result.status === status && pattern.test(result.data.error ?? ''),
        `Expected HTTP ${status} /${pattern.source}/, received HTTP ${result.status}: ${result.data.error ?? json(result.data)}`,
      );
      equal(state(), before, 'Rejected request changed durable state');
      trace.push({
        name,
        status: 'correct-rejection',
        httpStatus: result.status,
        reason: result.data.error,
      });
    } catch (error) {
      trace.push({ name, status: 'needs-review', error: error.message });
    }
  }
  async function previewSave(action, payload) {
    const before = state();
    const preview = requireSuccess(
      await planAction({ action: `${action}Preview`, ...payload }),
      `${action} preview`,
    );
    equal(state(), before, `${action} preview wrote the journal`);
    const saved = requireSuccess(
      await planAction({
        action,
        ...payload,
        effectiveDate: preview.effectiveDate,
        ...(preview.fingerprint ? { fingerprint: preview.fingerprint } : {}),
      }),
      `${action} save`,
    );
    equal(
      saved.plan.workouts.map((w) => prescription(w)),
      preview.plan.workouts.map((w) => prescription(w)),
      `${action} saved a different prescription from its reviewed preview`,
    );
    return {
      reviewedVersion: preview.version,
      effectiveDate: preview.effectiveDate,
      ...(action === 'runMeasure'
        ? {
            distancePrecisionChanges: preview.plan.workouts.flatMap((w) => {
              const old = before.plan.workouts.find((item) => item.id === w.id);
              return old && old.estimatedKm !== w.estimatedKm
                ? [
                    {
                      id: w.id,
                      date: w.date,
                      beforeKm: old.estimatedKm,
                      afterKm: w.estimatedKm,
                      deltaMetres: (w.estimatedKm - old.estimatedKm) * 1000,
                    },
                  ]
                : [];
            }),
          }
        : {}),
      changedSessions: preview.plan.workouts.filter(
        (w) =>
          !isDeepStrictEqual(
            w.steps,
            before.plan.workouts.find((old) => old.id === w.id)?.steps,
          ),
      ).length,
    };
  }
  const preferences = (patch) =>
    previewSave('preferences', { preferences: patch });
  const ordinaryPast = initial.workouts.filter(
    (w) => w.date < asOf && w.kind !== 'race',
  );
  for (const run of ordinaryPast) {
    await exercise(
      `log ${run.date}`,
      async () => {
        const w = state().plan.workouts.find(
          (candidate) => candidate.id === run.id,
        );
        requireSuccess(
          await planAction({
            action: 'complete',
            id: w.id,
            feedback: {
              actualDate: w.date,
              actualMinutes: w.minutes,
              actualKm: w.estimatedKm,
              effort: w.hard ? 6 : 3,
              feeling: 'good',
              note: 'Synthetic road-audit completion.',
              execution: 'as-planned',
              completedQualityMinutes: qualityWorkMinutes(w),
            },
          }),
          'log run',
        );
        const saved = state().plan.workouts.find(
          (candidate) => candidate.id === w.id,
        );
        ensure(
          saved.status === 'completed' &&
            saved.feedback.actualKm === w.estimatedKm,
          'Completed facts were not saved',
        );
      },
      { editId: run.id },
    );
  }
  const correctedId = ordinaryPast[0].id;
  await exercise(
    'correct recorded distance and elapsed time',
    async () => {
      const w = state().plan.workouts.find(
        (candidate) => candidate.id === correctedId,
      );
      const feedback = {
        ...w.feedback,
        actualMinutes: w.feedback.actualMinutes + 1,
        actualKm: Number((w.feedback.actualKm - 0.2).toFixed(3)),
        note: 'Corrected synthetic GPS distance.',
      };
      requireSuccess(
        await planAction({
          action: 'correctLog',
          id: w.id,
          feedback,
          correctionReason: 'Corrected GPS and elapsed-time entry',
        }),
        'correct log',
      );
      const corrected = state().plan.workouts.find(
        (candidate) => candidate.id === w.id,
      );
      ensure(
        corrected.feedback.actualKm === feedback.actualKm &&
          corrected.feedback.actualMinutes === feedback.actualMinutes,
        'Correction was ignored',
      );
      equal(
        corrected.steps,
        w.steps,
        'Correcting a log rewrote the prescription',
      );
    },
    { editId: correctedId },
  );
  await exercise('manually shorten a future easy run', async () => {
    const w = state().plan.workouts.find(
      (candidate) => candidate.kind === 'easy' && candidate.date >= asOf,
    );
    ensure(w && w.minutes > 25, 'Expected a suitable future easy run');
    manualId = w.id;
    requireSuccess(
      await planAction({
        action: 'advanced',
        id: w.id,
        minutes: Math.floor(w.minutes) - 5,
      }),
      'shorten',
    );
    ensure(
      state().plan.workouts.find((candidate) => candidate.id === manualId)
        .changeSource === 'manual',
      'Manual edit was not marked as protected',
    );
  });
  for (const units of [
    item.input.units === 'km' ? 'mi' : 'km',
    item.input.units,
  ])
    await exercise(
      `display units ${units}`,
      async () => {
        requireSuccess(
          await call(profileRoute, '/api/profile', {
            displayName: 'Synthetic runner',
            city: '',
            units,
            timezone: 'UTC',
            accent: 'evergreen',
          }),
          'profile units',
        );
        ensure(
          state().plan.profile.units === units,
          'Selected display unit not saved',
        );
      },
      { keepAllocation: true },
    );
  for (const [index, measure] of [
    'time',
    'distance',
    'distance',
    item.input.runMeasure,
  ].entries())
    await exercise(
      `measurement ${measure}${index === 2 ? ' reapplied' : ''}`,
      async () => {
        const before = state().plan;
        const details = await previewSave('runMeasure', { measure });
        ensure(
          state().plan.profile.runMeasure === measure,
          'Selected measurement not saved',
        );
        if (index === 2)
          equal(
            state().plan.workouts.map((w) => prescription(w)),
            before.workouts.map((w) => prescription(w)),
            'Reapplying distance measure changed saved prescriptions',
          );
        return details;
      },
      { keepAllocation: true, measurementRounding: index !== 2 },
    );
  await exercise(
    'benchmark metadata after block start',
    async () => {
      const before = state().plan;
      await preferences({
        recentRace: {
          ...before.profile.recentRace,
          date: '2026-09-16',
          source: 'time-trial',
          course: 'track',
        },
      });
      equal(
        state().plan.workouts.map((w) => prescription(w)),
        before.workouts.map((w) => prescription(w)),
        'Descriptive benchmark metadata changed prescriptions',
      );
    },
    { keepAllocation: true },
  );
  await exercise('reviewed benchmark performance update', () =>
    preferences({
      recentRace: { ...state().plan.profile.recentRace, timeMinutes: 49.5 },
    }),
  );
  const configs = [
    { mode: 'effort' },
    {
      mode: 'heart-rate',
      heartRate: {
        easy: { low: 125, high: 145 },
        tempo: { low: 150, high: 165 },
        interval: { low: 165, high: 175 },
        race: { low: 150, high: 165 },
      },
      raceScope: `${item.input.goal}:`,
    },
    {
      mode: 'pace',
      pace: {
        easy: { low: 350, high: 390 },
        tempo: { low: 280, high: 310 },
        interval: { low: 250, high: 280 },
        race: { low: 300, high: 330 },
      },
      raceScope: `${item.input.goal}:`,
    },
  ];
  for (const targets of configs)
    await exercise(
      `manual targets ${targets.mode}`,
      async () => {
        await previewSave('targets', { targets });
        const p = state().plan;
        equal(
          p.profile.workoutTargets,
          { ...targets, raceScope: `${item.input.goal}:` },
          'Manual targets did not persist',
        );
        for (const w of p.workouts.filter(
          (w) => w.date >= asOf && w.status === 'planned' && w.id !== manualId,
        ))
          for (const step of w.steps)
            equal(
              step.target,
              workoutStepTarget(w, step, p.profile),
              `Manual targets did not take priority in ${w.id}`,
            );
      },
      { targetEdit: true },
    );
  for (let pass = 1; pass <= 3; pass++)
    for (const workoutVariety of ['familiar', 'varied'])
      await exercise(
        `variety ${workoutVariety}, repetition ${pass}`,
        () => preferences({ workoutVariety }),
        { keepAllocation: true },
      );
  for (const workoutFormat of ['time', 'distance', 'automatic'])
    await exercise(
      `format ${workoutFormat}`,
      () => preferences({ workoutFormat }),
      { keepAllocation: true },
    );
  for (let pass = 1; pass <= 2; pass++)
    await exercise(
      `explicit variety refresh ${pass}`,
      () => previewSave('variety', {}),
      { keepAllocation: true },
    );
  for (const count of [0, 1, 2, 0])
    await exercise(
      `frequency ${requested} to ${count}`,
      () => preferences({ qualityMode: 'custom', qualitySessions: count }),
      { count },
    );
  await exercise(
    'same frequency reapplied',
    async () => {
      const before = state().plan;
      await preferences({ qualityMode: 'custom', qualitySessions: requested });
      equal(
        state().plan.workouts.map((w) => prescription(w)),
        before.workouts.map((w) => prescription(w)),
        'Same preference was not idempotent',
      );
    },
    { keepAllocation: true },
  );
  await exercise(
    'JSON and recovery validation roundtrip',
    async () => {
      const before = state().plan;
      const clone = JSON.parse(json(before));
      equal(clone, before, 'JSON roundtrip changed data');
      const file = {
        format: 'stride-recovery-2',
        exportedAt: fixedInstant,
        profile: null,
        plan: clone,
      };
      const restored = validateRecovery(file);
      equal(
        restored.plan.profile,
        before.profile,
        'Recovery normalization changed profile preferences',
      );
      equal(
        restored.plan.workouts.map((w) => prescription(w)),
        before.workouts.map((w) => prescription(w)),
        'Recovery normalization changed stored prescriptions or actuals',
      );
    },
    { keepAllocation: true },
  );
  await reject(
    'reject future benchmark date',
    () =>
      planAction({
        action: 'preferencesPreview',
        preferences: {
          recentRace: {
            ...state().plan.profile.recentRace,
            date: '2026-09-20',
          },
        },
      }),
    422,
    /future/,
  );
  await reject(
    'reject invalid two-workout background',
    () =>
      planAction({
        action: 'preferencesPreview',
        preferences: {
          qualityMode: 'custom',
          qualitySessions: 2,
          recentQualitySessions: 0,
        },
      }),
    422,
    /Two quality sessions/,
  );
  await reject(
    'reject correction without reason',
    () =>
      planAction({
        action: 'correctLog',
        id: correctedId,
        feedback: state().plan.workouts.find((w) => w.id === correctedId)
          .feedback,
        correctionReason: ' ',
      }),
    422,
    /reason/,
  );
  await reject(
    'reject stale state version',
    () =>
      planAction({
        action: 'preferences',
        version: 0,
        preferences: { workoutVariety: 'familiar' },
        effectiveDate: asOf,
      }),
    409,
    /changed|version|updated|review/i,
  );
  await reject(
    'reject unreviewed target fingerprint',
    () =>
      planAction({
        action: 'targets',
        targets: configs[0],
        effectiveDate: asOf,
        fingerprint: 'not-a-reviewed-preview',
      }),
    409,
    /preview changed/,
  );
  await reject(
    'reject logging future workout',
    () => {
      const future = state().plan.workouts.find(
        (w) => w.date > asOf && w.status === 'planned',
      );
      return planAction({
        action: 'complete',
        id: future.id,
        feedback: {
          actualDate: future.date,
          actualMinutes: future.minutes,
          actualKm: future.estimatedKm,
          effort: 3,
          feeling: 'good',
          note: 'Synthetic future result.',
        },
      });
    },
    422,
    /date or afterwards|future/,
  );
  await exercise(
    'export and restore through production routes',
    async (before) => {
      const file = requireSuccess(
        await call(exportRoute, '/api/export?format=recovery'),
        'recovery export',
      );
      equal(
        file.plan.workouts.map((w) => prescription(w)),
        before.plan.workouts.map((w) => prescription(w)),
        'Export lost prescriptions or actuals',
      );
      const preview = requireSuccess(
        await call(recoveryRoute, '/api/recovery', {
          action: 'preview',
          kind: 'restore',
          file,
        }),
        'restore preview',
      );
      equal(state(), before, 'Restore preview mutated the current journal');
      const committed = requireSuccess(
        await call(recoveryRoute, '/api/recovery', {
          action: 'commit',
          kind: 'restore',
          id: preview.id,
          file,
          confirm: 'REPLACE',
        }),
        'restore commit',
      );
      equal(
        committed.plan.profile,
        before.plan.profile,
        'Restore changed training preferences',
      );
      const restoreFacts = (w) => {
        const result = prescription(w, false);
        if (result.feedback) {
          const { source: _source, ...feedback } = result.feedback;
          result.feedback = feedback;
        }
        return result;
      };
      equal(
        committed.plan.workouts.map(restoreFacts),
        before.plan.workouts.map(restoreFacts),
        'Restore changed executable steps or recorded facts',
      );
      ensure(
        committed.plan.workouts
          .filter((w) => w.feedback)
          .every(
            (w) =>
              w.feedback.source ===
              'Recovered journal · unverified provider link',
          ),
        'Restore incorrectly retained verified recording provenance',
      );
      lastRecovery = { file, id: preview.id };
      return {
        regeneratedPlanIdentity: committed.plan.id !== before.plan.id,
        revision: committed.version,
      };
    },
    { restored: true },
  );
  if (lastRecovery)
    await exercise('repeated restore commit is idempotent', async (before) => {
      const result = requireSuccess(
        await call(recoveryRoute, '/api/recovery', {
          action: 'commit',
          kind: 'restore',
          id: lastRecovery.id,
          file: lastRecovery.file,
          confirm: 'REPLACE',
        }),
        'repeat restore',
      );
      ensure(
        result.alreadyCompleted === true,
        'Restore retry did not acknowledge its prior completion',
      );
      equal(state(), before, 'Restore retry changed durable state');
    });
  const result = {
    id: item.id,
    input: item.input,
    status: trace.some((step) => step.status === 'needs-review')
      ? 'needs-review'
      : 'pass',
    counts: {
      passed: trace.filter((s) => s.status === 'pass').length,
      correctRejections: trace.filter((s) => s.status === 'correct-rejection')
        .length,
      needsReview: trace.filter((s) => s.status === 'needs-review').length,
    },
    finalSelectedWeekdayWorkouts: state().plan.profile.qualitySessions,
    trace,
    reproduce: `node --experimental-strip-types scripts/audit-road-edits.mjs --case ${item.id} --out /private/tmp/stride-road-${item.id}`,
  };
  sqlite.close();
  return result;
}

function sourceIdentity() {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootPath,
    encoding: 'utf8',
  }).trim();
  const files = execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      'lib',
      'app/api',
      'drizzle',
    ],
    { cwd: rootPath, encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort();
  const hash = createHash('sha256');
  for (const file of files)
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(resolve(rootPath, file)))
      .update('\0');
  return {
    sha,
    dirty: !!execFileSync('git', ['status', '--porcelain'], {
      cwd: rootPath,
      encoding: 'utf8',
    }).trim(),
    productionSourceSha256: hash.digest('hex'),
    sourceFileCount: files.length,
  };
}

async function main() {
  let caseId;
  let out = resolve(rootPath, 'docs/verification/2026-09-19/road-audit/edits');
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    ensure(
      args[i + 1] && ['--case', '--out'].includes(args[i]),
      'Usage: node --experimental-strip-types scripts/audit-road-edits.mjs [--case ID] [--out OUTPUT_PREFIX]',
    );
    if (args[i] === '--case') caseId = args[i + 1];
    else out = resolve(args[i + 1]);
  }
  ensure(
    !caseId || cases.some((item) => item.id === caseId),
    `Unknown road audit case: ${caseId}`,
  );
  const identity = sourceIdentity();
  const results = [];
  for (const item of cases.filter((entry) => !caseId || entry.id === caseId)) {
    try {
      results.push(await auditCase(item));
    } catch (error) {
      results.push({
        id: item.id,
        input: item.input,
        status: 'needs-review',
        counts: { passed: 0, correctRejections: 0, needsReview: 1 },
        trace: [
          { name: 'case setup', status: 'needs-review', error: error.message },
        ],
        reproduce: `node --experimental-strip-types scripts/audit-road-edits.mjs --case ${item.id} --out /private/tmp/stride-road-${item.id}`,
      });
    }
  }
  const changedDuringRun =
    identity.productionSourceSha256 !== sourceIdentity().productionSourceSha256;
  const distancePrecisionChanges = results.flatMap((r) =>
    r.trace.flatMap((step) =>
      (step.details?.distancePrecisionChanges ?? []).map((change) => ({
        case: r.id,
        operation: step.name,
        ...change,
      })),
    ),
  );
  const summary = {
    cases: results.length,
    passingCases: results.filter((r) => r.status === 'pass').length,
    passedOperations: results.reduce((n, r) => n + r.counts.passed, 0),
    correctRejections: results.reduce(
      (n, r) => n + r.counts.correctRejections,
      0,
    ),
    needsReview: results.reduce((n, r) => n + r.counts.needsReview, 0),
    distancePrecisionChanges: distancePrecisionChanges.length,
    maximumDistanceRoundingMetres: Math.max(
      0,
      ...distancePrecisionChanges.map((change) => Math.abs(change.deltaMetres)),
    ),
    changedDuringRun,
  };
  const report = {
    format: 'stride-road-edit-audit-1',
    generatedAt: new RealDate().toISOString(),
    asOf,
    clock: fixedInstant,
    start,
    identity,
    summary,
    scope:
      'Only 5K, 10K, half-marathon and marathon; production route handlers, production engine, actual SQLite migrations, synthetic isolated accounts, no network. No custom/ultra profiles are generated.',
    assertions: [
      'Explicit workout counts remain saved; eligible future ordinary weeks match them.',
      'Past/completed/manual prescriptions and actuals remain unchanged except deliberate logging/correction.',
      'Unrelated metadata/unit/recipe changes preserve allocated dates, minutes and kilometres.',
      'Measurement conversion alone may round a timed estimate to the nearest metre (at most 0.5 m); it must preserve session dates/minutes, protected history and repeated application exactly.',
      'Each reviewed preview matches its saved prescription.',
      'Accepted states and JSON/recovery copies pass production validation.',
      'Expected errors match exact HTTP status and reason category and do not mutate the journal.',
      'Actual export/restore preserves profiles, executable steps and recorded facts, with fresh identities and idempotent commit retries.',
    ],
    limits: [
      'Synthetic application verification, not coaching/scientific validation.',
      'This audit does not establish hosted authentication, browser usability, watch delivery or production backup operations.',
      'Only comfortable established five-run baselines are used here; separate boundary audit covers constrained/new-runner inputs.',
    ],
    distancePrecisionChanges,
    results,
  };
  const failures = results.flatMap((r) =>
    r.trace
      .filter((s) => s.status === 'needs-review')
      .map((s) => ({
        case: r.id,
        step: s.name,
        error: s.error,
        reproduce: r.reproduce,
      })),
  );
  const markdown = [
    '# Road-plan edit, logging and recovery audit',
    '',
    `Fixed simulation day: **${asOf}**. Source HEAD: \`${identity.sha}\`; dirty source: **${identity.dirty}**. Production source SHA-256: \`${identity.productionSourceSha256}\`.`,
    '',
    report.scope,
    '',
    `**${summary.passingCases}/${summary.cases} cases passed; ${summary.passedOperations} accepted operations passed; ${summary.correctRejections} correctly rejected incompatible requests; ${summary.needsReview} operations need review.**`,
    '',
    changedDuringRun
      ? '**Source changed during the run; rerun before treating this report as one reproducible revision.**'
      : 'Production source did not change during this run.',
    '',
    '## Coverage',
    '',
    'Every distance was tested with 0, 1 and 2 explicit weekday workouts, starting in both kilometres/distance and miles/time modes. Each case logged real past workouts through the plan route, corrected a log, manually shortened a future easy run, switched units and prescription measure, updated benchmark metadata/performance, applied effort/heart-rate/pace targets, repeated recipe preferences, changed frequency 0 → 1 → 2 → 0, round-tripped JSON, and exported/restored through production routes.',
    '',
    'Expected rejections cover future benchmarks, insufficient background for two workouts, corrections without a reason, stale versions, unreviewed target fingerprints and future workout logging. An arbitrary PlanError is never accepted as a passing outcome.',
    '',
    `Measurement conversion produced ${summary.distancePrecisionChanges} recorded distance-precision normalizations, at most ${summary.maximumDistanceRoundingMetres.toFixed(6)} metres. Converting a timed estimate to executable whole metres may round by at most 0.5 metres; all session dates/minutes and protected history must remain exact. Reapplying the same measurement must preserve every prescription exactly. This is reported separately from plan drift.`,
    '',
    '| Case | Passed operations | Correct rejections | Needs review |',
    '|---|---:|---:|---:|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.counts.passed} | ${r.counts.correctRejections} | ${r.counts.needsReview} |`,
    ),
    '',
    '## Findings requiring review',
    '',
    ...(failures.length
      ? failures.map(
          (f) =>
            `- **${f.case} — ${f.step}:** ${f.error}\n\n  Reproduce: \`${f.reproduce}\``,
        )
      : ['None found in these cases.']),
    '',
    '## Boundaries of this result',
    '',
    ...report.limits.map((limit) => `- ${limit}`),
    '',
    'The paired `edits.json` contains all exact synthetic inputs, operation outcomes, status codes and reproduction commands.',
    '',
    'Re-run the full audit: `node --experimental-strip-types scripts/audit-road-edits.mjs`.',
    '',
  ].join('\n');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(`${out}.json`, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${out}.md`, markdown);
  process.stdout.write(
    `${JSON.stringify({ summary, identity, files: [`${out}.json`, `${out}.md`], failures }, null, 2)}\n`,
  );
  if (summary.needsReview || changedDuringRun) process.exitCode = 1;
}
main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
