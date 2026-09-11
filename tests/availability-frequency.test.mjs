// Independent synthetic availability/frequency acceptance; portable to tests/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const { makePlan, demoProfile, addDays, dayDiff, weekday, revisePreferences } =
  await import(new URL('engine.ts', lib));
const { validateRecovery } = await import(new URL('recovery.ts', lib));
const start = '2026-09-07',
  all = [0, 1, 2, 3, 4, 5, 6];
const base = {
  ...demoProfile(start),
  goal: '10k',
  raceDate: addDays(start, 139),
  weeklyKm: 45,
  longestKm: 12,
  currentRuns: 7,
  days: [0, 2, 4, 6],
  longDay: 6,
  availableDays: all,
  runsPerWeek: 4,
  qualityMode: 'automatic',
  weekdayMinutes: 100,
  longMinutes: 200,
  easyPace: 6,
  experience: 'established',
  qualitySessions: 1,
  recentQualitySessions: 2,
  recentQualityMinutes: 32,
  intent: 'improve',
  difficulty: 'balanced',
  volume: 'maintain',
};
const runs = (p, i) =>
  p.workouts.filter(
    (w) =>
      w.kind !== 'race' &&
      w.status !== 'skipped' &&
      (i === undefined || w.week === i),
  );
const full = (p) =>
  p.weeks.filter(
    (w) =>
      w.start >= p.profile.startDate &&
      addDays(w.start, 6) < p.profile.raceDate,
  );
const build = (p) =>
  p.weeks.find((w) => w.phase === 'Build' && w.start >= p.profile.startDate);
const total = (ws) =>
  ws.reduce((n, w) => n + w.steps.reduce((n, s) => n + s.seconds, 0) / 60, 0);
const make = (patch) => makePlan({ ...base, ...patch }, start);
function verify(p, input) {
  assert.equal(p.profile.runsPerWeek, input.runsPerWeek);
  assert.deepEqual(
    p.profile.availableDays,
    [...input.availableDays].sort((a, b) => a - b),
  );
  assert.equal(p.profile.days.length, input.runsPerWeek);
  assert.equal(new Set(p.profile.days).size, input.runsPerWeek);
  assert.ok(p.profile.days.every((d) => input.availableDays.includes(d)));
  if (input.runsPerWeek >= 3) assert.ok(p.profile.days.includes(input.longDay));
  for (const week of full(p)) {
    const ws = runs(p, week.index);
    assert.equal(
      new Set(ws.map((w) => w.date)).size,
      input.runsPerWeek,
      `${week.phase}: desiredfrequency mustdetermine count`,
    );
    assert.equal(
      ws.length,
      input.runsPerWeek,
      'Ordinary method must not create extra sessions',
    );
  }
  for (const w of runs(p)) {
    assert.ok(
      p.profile.days.includes(weekday(w.date)),
      'Unused availability is not another training day',
    );
    assert.ok(
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) / 60 - w.minutes) <
        0.01,
    );
    assert.ok(
      w.minutes <=
        (w.kind === 'long' ? input.longMinutes : input.weekdayMinutes) + 0.01,
    );
  }
  const demanding = p.workouts
    .filter((w) => (w.hard || w.kind === 'long') && w.status !== 'skipped')
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < demanding.length; i++)
    assert.ok(
      dayDiff(demanding[i - 1].date, demanding[i].date) >= 2,
      'Demanding spacing includes week boundaries',
    );
  assert.equal(p.profile.currentRuns, input.currentRuns);
}
for (let count = 2; count <= 7; count++)
  void test(`available all7, desired${count}: only requested runs with the corresponding ordinary-week structure`, () => {
    const input = {
        ...base,
        runsPerWeek: count,
        currentRuns: count,
        weeklyKm: Math.max(24, count * 9),
      },
      before = structuredClone(input),
      p = makePlan(input, start);
    verify(p, input);
    assert.deepEqual(input, before);
    const ws = runs(p, build(p).index);
    assert.equal(
      ws.filter((w) => w.hard).length,
      count === 2 ? 0 : count <= 4 ? 1 : 2,
    );
    assert.equal(
      ws.filter((w) => w.kind === 'long').length,
      count === 2 ? 0 : 1,
    );
    if (count === 2)
      assert.ok(
        runs(p).every((w) => !w.hard && w.kind !== 'long'),
        'Two runs stay easy throughout training',
      );
  });
void test('available all7 with desired3 does not invent an increase from the recent3-day routine', () => {
  const input = {
      ...base,
      currentRuns: 3,
      runsPerWeek: 3,
      weeklyKm: 30,
      longestKm: 10,
    },
    p = makePlan(input, start);
  verify(p, input);
  assert.equal(p.profile.currentRuns, 3);
});
void test('extra availability cannot become extra weekly workload when desired frequency stays3', () => {
  const common = {
    currentRuns: 3,
    runsPerWeek: 3,
    weeklyKm: 30,
    longestKm: 10,
  };
  const a = make({ ...common, availableDays: [0, 2, 6] }),
    b = make({ ...common, availableDays: all });
  assert.equal(a.profile.days.length, 3);
  assert.equal(b.profile.days.length, 3);
  assert.ok(
    Math.abs(total(runs(a, 0)) - total(runs(b, 0))) <= 3,
    'Same frequency and baseline preserve the budget despite extra options',
  );
});
void test('reducing desired frequency scales the opening budget without concentrating the old weekly volume', () => {
  const input = {
    ...base,
    goal: 'base',
    currentRuns: 6,
    weeklyKm: 48,
    longestKm: 12,
  };
  const prior = makePlan({ ...input, runsPerWeek: 6 }, start),
    reduced = makePlan({ ...input, runsPerWeek: 3 }, start);
  const first = total(runs(prior, 0)),
    next = total(runs(reduced, 0));
  assert.ok(
    next <= first * 0.5 + 2,
    `Expected roughly half the opening time, got ${next} / ${first}`,
  );
  assert.equal(reduced.profile.weeklyKm, 48);
  assert.equal(reduced.profile.currentRuns, 6);
  assert.equal(reduced.profile.runsPerWeek, 3);
});
void test('new two-run base supports easy run/walk despite all7 available', () => {
  const input = {
    ...base,
    goal: 'base',
    runsPerWeek: 2,
    currentRuns: 0,
    weeklyKm: 0,
    longestKm: 0,
    experience: 'new',
    qualitySessions: 0,
    recentQualitySessions: 0,
    recentQualityMinutes: 0,
  };
  const p = makePlan(input, start);
  verify(p, input);
  assert.ok(runs(p).every((w) => !w.hard && w.kind !== 'long'));
  assert.ok(runs(p).every((w) => w.steps.some((s) => s.movement === 'walk')));
});
void test('base goal retains easy training instead of automatic race-workout counts', () => {
  const input = { ...base, goal: 'base', runsPerWeek: 5 },
    p = makePlan(input, start);
  verify(p, input);
  assert.ok(runs(p).every((w) => !w.hard));
});
void test('returning runner does not receive automatic two-session intensity merely from broad availability', () => {
  const input = {
      ...base,
      experience: 'returning',
      runsPerWeek: 5,
      currentRuns: 5,
      goal: 'base',
      weeklyKm: 30,
      longestKm: 10,
    },
    p = makePlan(input, start);
  verify(p, input);
  assert.ok(runs(p).every((w) => !w.hard));
});
void test('six-run marathon automatic structure includes controlled marathon work in race preparation', () => {
  const input = {
      ...base,
      goal: 'marathon',
      runsPerWeek: 6,
      currentRuns: 6,
      weeklyKm: 60,
      longestKm: 26,
      volume: 'gradual',
      raceDate: addDays(start, 153),
    },
    p = makePlan(input, start);
  verify(p, input);
  assert.ok(
    p.workouts.some(
      (w) =>
        p.weeks[w.week].phase === 'Race preparation' &&
        w.stimulus === 'race-rhythm' &&
        w.qualityMinutes > 0,
    ),
  );
});
void test('legacy profile retains exact scheduled days and its explicit quality override', () => {
  const legacy = { ...demoProfile(start), qualitySessions: 0 };
  const before = structuredClone(legacy),
    p = makePlan(legacy, start);
  assert.deepEqual(p.profile.days, legacy.days);
  assert.equal(p.profile.qualitySessions, 0);
  assert.ok(runs(p).every((w) => !w.templateId && !w.hard));
  assert.deepEqual(legacy, before);
});
void test('custom quality0 remains explicit when five runs are requested', () => {
  const input = {
      ...base,
      runsPerWeek: 5,
      qualityMode: 'custom',
      qualitySessions: 0,
    },
    p = makePlan(input, start);
  verify(p, input);
  assert.equal(p.profile.qualitySessions, 0);
  assert.ok(runs(p).every((w) => !w.hard && !w.templateId));
});
void test('automatic mode resolves stale quality input to requested-frequency structure', () => {
  const p = make({ runsPerWeek: 3, qualitySessions: 2 });
  assert.equal(p.profile.qualitySessions, 1);
  assert.equal(runs(p, build(p).index).filter((w) => w.hard).length, 1);
});
for (const patch of [
  { runsPerWeek: 5, availableDays: [0, 2, 6] },
  { runsPerWeek: 1 },
  { runsPerWeek: 8 },
  { runsPerWeek: 3.5 },
  { availableDays: [0, 0, 2, 6] },
  { availableDays: [0, 2, 7] },
  { availableDays: [6] },
])
  void test(`invalid availability/frequency rejects without input mutation: ${JSON.stringify(patch)}`, () => {
    const input = { ...base, ...patch },
      before = structuredClone(input);
    assert.throws(() => makePlan(input, start));
    assert.deepEqual(input, before);
  });
void test('clustered Mon/Tue/Wed with Wednesday long can still fit Monday quality', () => {
  const input = {
      ...base,
      availableDays: [0, 1, 2],
      runsPerWeek: 3,
      longDay: 2,
    },
    p = makePlan(input, start);
  verify(p, input);
  assert.deepEqual(
    runs(p, build(p).index)
      .filter((w) => w.hard)
      .map((w) => weekday(w.date)),
    [0],
  );
});
void test('five weekdays with Wednesday long finds both Monday and Friday quality', () => {
  const input = {
      ...base,
      availableDays: [0, 1, 2, 3, 4],
      runsPerWeek: 5,
      longDay: 2,
    },
    p = makePlan(input, start);
  verify(p, input);
  assert.deepEqual(
    runs(p, build(p).index)
      .filter((w) => w.hard)
      .map((w) => weekday(w.date))
      .sort((a, b) => a - b),
    [0, 4],
  );
});
void test('impossible clustered quality placement is explicitly explained or rejected, never silently claimed', () => {
  const input = {
    ...base,
    availableDays: [0, 1, 2],
    runsPerWeek: 3,
    longDay: 1,
  };
  let p;
  try {
    p = makePlan(input, start);
  } catch (e) {
    assert.match(e.message, /days|quality|spacing|space|schedule|rest/i);
    return;
  }
  assert.equal(runs(p, build(p).index).filter((w) => w.hard).length, 0);
  assert.ok(
    p.notes.some((n) =>
      /no.*quality|cannot.*quality|spacing|well.spaced|recovery.*space|fit 0 of 1 requested quality/i.test(
        n,
      ),
    ),
    'Unfulfilled requested structure must be visible',
  );
});
void test('frequency review preserves completed actual history and uses only the future resolved subset', () => {
  const p = make({ runsPerWeek: 4 }),
    asOf = addDays(start, 28);
  for (const w of p.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: 'Synthetic preserved run',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  const before = structuredClone(p),
    history = JSON.stringify(
      p.workouts.filter((w) => w.status === 'completed'),
    );
  const next = revisePreferences(
    p,
    { availableDays: all, runsPerWeek: 3, qualityMode: 'automatic' },
    asOf,
  );
  assert.equal(next.profile.runsPerWeek, 3);
  assert.equal(next.profile.days.length, 3);
  assert.equal(next.profile.currentRuns, p.profile.currentRuns);
  assert.equal(
    JSON.stringify(next.workouts.filter((w) => w.status === 'completed')),
    history,
  );
  assert.deepEqual(p, before);
  for (const w of full(next).filter((w) => w.start >= asOf))
    assert.equal(runs(next, w.index).length, 3);
});
void test('recovery round trip retains availability, desired frequency, resolved days and mode separately', () => {
  const p = make({ runsPerWeek: 4 }),
    file = {
      format: 'stride-recovery-2',
      exportedAt: '2026-09-07T18:00:00Z',
      profile: null,
      plan: p,
    };
  const restored = validateRecovery(JSON.parse(JSON.stringify(file))).plan;
  assert.deepEqual(restored.profile.availableDays, all);
  assert.equal(restored.profile.runsPerWeek, 4);
  assert.equal(restored.profile.qualityMode, 'automatic');
  assert.deepEqual(restored.profile.days, p.profile.days);
  const malformed = structuredClone(file);
  malformed.plan.profile.runsPerWeek = 8;
  assert.throws(() => validateRecovery(malformed));
});

void test('partly feasible automatic quality structure explains the unfilled second slot', () => {
  const p = make({
    currentRuns: 5,
    runsPerWeek: 5,
    availableDays: [0, 1, 2, 3, 4],
    longDay: 1,
  });
  assert.equal(p.profile.qualitySessions, 2);
  assert.equal(runs(p, build(p).index).filter((w) => w.hard).length, 1);
  assert.ok(
    p.notes.some(
      (n) =>
        /quality/i.test(n) &&
        /spacing|space|fit|feasib|available/i.test(n) &&
        /one|1/.test(n) &&
        /two|2/.test(n),
    ),
    'A one-of-two feasible quality structure must be explained',
  );
});

function completedBlock(p, asOf) {
  for (const w of p.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: 'Synthetic preserved run',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  return p;
}
void test('recorded lower-frequency weeks are not halved again during an unrelated review', () => {
  const p = completedBlock(
      make({
        goal: 'base',
        runsPerWeek: 3,
        currentRuns: 6,
        weeklyKm: 48,
        longestKm: 12,
      }),
      addDays(start, 28),
    ),
    asOf = addDays(start, 28),
    before = structuredClone(p);
  const history = JSON.stringify(
    p.workouts.filter((w) => w.status === 'completed'),
  );
  const next = revisePreferences(p, { recoveryWeeks: 3 }, asOf),
    upcoming = total(runs(next, 4));
  assert.ok(
    upcoming >= 138 && upcoming <= 144,
    `The established 143-minute three-run routine should remain near its recorded budget; got ${upcoming}`,
  );
  assert.equal(next.profile.currentRuns, 6);
  assert.equal(next.profile.weeklyKm, 48);
  assert.equal(
    JSON.stringify(next.workouts.filter((w) => w.status === 'completed')),
    history,
  );
  assert.deepEqual(p, before);
});
void test('a further frequency reduction uses the prior actual schedule and preserves actual history', () => {
  const asOf = addDays(start, 28),
    p = completedBlock(
      make({
        goal: 'base',
        runsPerWeek: 6,
        currentRuns: 6,
        weeklyKm: 48,
        longestKm: 12,
      }),
      asOf,
    ),
    before = structuredClone(p);
  const next = revisePreferences(p, { runsPerWeek: 3 }, asOf),
    upcoming = total(runs(next, 4));
  assert.ok(
    upcoming >= 138 && upcoming <= 145,
    `Six recorded days reducing to three should receive roughly half of the 287-minute routine; got ${upcoming}`,
  );
  assert.equal(next.profile.currentRuns, 6);
  assert.equal(next.profile.runsPerWeek, 3);
  assert.deepEqual(
    next.workouts.filter((w) => w.status === 'completed'),
    p.workouts.filter((w) => w.status === 'completed'),
  );
  assert.deepEqual(p, before);
});
void test('repeated reviews without observations retain the frequency-reduced starting budget', () => {
  const p = make({
      goal: 'base',
      runsPerWeek: 3,
      currentRuns: 6,
      weeklyKm: 48,
      longestKm: 12,
    }),
    before = structuredClone(p),
    asOf = addDays(start, 28);
  const first = revisePreferences(p, { recoveryWeeks: 3 }, asOf),
    second = revisePreferences(first, { recoveryWeeks: 4 }, asOf);
  for (const q of [first, second]) {
    const upcoming = total(runs(q, 4));
    assert.ok(
      upcoming >= 138 && upcoming <= 145,
      `Unrecorded running must neither restore the old 288-minute week nor reapply the reduction: got ${upcoming}`,
    );
    assert.equal(q.profile.weeklyKm, 48);
    assert.equal(q.profile.currentRuns, 6);
    assert.equal(q.profile.runsPerWeek, 3);
    assert.ok(q.workouts.every((w) => w.status === 'planned'));
    assert.deepEqual(
      q.workouts.filter((w) => w.date < asOf),
      p.workouts.filter((w) => w.date < asOf),
    );
  }
  assert.deepEqual(p, before);
});
