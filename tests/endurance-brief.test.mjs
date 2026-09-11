// Source-executing regressions; synthetic data only. Portable into stride/tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const lib = existsSync(new URL('./stride/lib/engine.ts', import.meta.url))
  ? new URL('./stride/lib/', import.meta.url)
  : new URL('../lib/', import.meta.url);
const {
  makePlan,
  demoProfile,
  addDays,
  weekday,
  validatePlan,
  revisePreferences,
  adjustPlan,
  MAX_EVENT_KM,
  preparationRequirements,
} = await import(new URL('engine.ts', lib));
const { exportProgram } = await import(new URL('program-export.ts', lib));
const { supportingSession, workoutGuidance } = await import(
  new URL('coaching-context.ts', lib)
);
const { qualitySchedule } = await import(new URL('training-structure.ts', lib));
const { currentTrainingBaseline } = await import(
  new URL('training-history.ts', lib)
);
const { encodeWorkout } = await import(new URL('fit.ts', lib));
const start = '2026-09-07';
const all = [0, 1, 2, 3, 4, 5, 6];
const inputs = (patch = {}) => ({
  ...demoProfile(start),
  name: 'Synthetic endurance runner',
  goal: 'marathon',
  raceDate: addDays(start, 139),
  weeklyKm: 70,
  longestKm: 30,
  currentRuns: 5,
  availableDays: all,
  runsPerWeek: 5,
  days: [0, 1, 3, 4, 6],
  qualityMode: 'automatic',
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  weekdayMinutes: 120,
  longMinutes: 200,
  easyPace: 6,
  intent: 'improve',
  method: 'balanced',
  ...patch,
});
const make = (patch = {}) => makePlan(inputs(patch), start);
const days = (program) => program.weeks.flatMap((w) => w.days);
const sessions = (program) => days(program).flatMap((d) => d.sessions);
const running = (p, wi) =>
  p.workouts.filter(
    (w) =>
      w.kind !== 'race' &&
      w.status !== 'skipped' &&
      (wi == null || w.week === wi),
  );
const sum = (ws) => ws.reduce((n, w) => n + w.minutes, 0);
const completed = (w, asOf) => {
  w.status = 'completed';
  w.feedback = {
    actualDate: asOf,
    actualMinutes: w.minutes + 10,
    actualKm: (w.minutes + 10) / 6,
    effort: 3,
    feeling: 'good',
    recordedAt: `${asOf}T10:00:00Z`,
    note: 'Synthetic history',
  };
};

void test('daily export is complete, unique, bounded, and preserves executable training totals', () => {
  const p = make({ startDate: '2026-09-08' }),
    before = structuredClone(p),
    out = exportProgram(p);
  const calendar = days(out);
  assert.equal(calendar.length, out.calendar_days);
  assert.equal(new Set(calendar.map((d) => d.date)).size, calendar.length);
  assert.equal(calendar[0].date, p.profile.startDate);
  assert.equal(calendar.at(-1).date, p.profile.raceDate);
  for (const week of out.weeks)
    assert.equal(week.running_minutes, sum(running(p, week.week_index)));
  for (const d of calendar) {
    assert.equal(d.day_index, weekday(d.date));
    if (d.workout_category === 'Rest') assert.equal(d.sessions.length, 0);
  }
  assert.deepEqual(p, before, 'Projection must not modify journal data');
  out.configuration.days.push(99);
  assert.deepEqual(
    p,
    before,
    'Exported configuration must not alias profile arrays',
  );
});

void test('race export distinguishes exact event distance from an invented finish prediction', () => {
  const p = make(),
    race = sessions(exportProgram(p)).find(
      (w) => w.workout_category === 'Race',
    );
  assert.ok(race);
  assert.equal(race.duration_minutes, null);
  assert.equal(race.estimated_distance, null);
  assert.equal(race.distance_km, 42.195);
  assert.equal(
    race.main_set.reduce((n, s) => n + (s.distance_metres ?? 0), 0),
    42195,
  );
});

void test('skipped workout remains visible while its day and totals prescribe no catch-up', () => {
  const p = make(),
    w = p.workouts.find((x) => x.kind === 'easy');
  w.status = 'skipped';
  w.skipReason = 'Unavailable';
  const out = exportProgram(p),
    d = days(out).find((x) => x.date === w.date);
  assert.equal(d.workout_category, 'Rest');
  assert.equal(d.sessions[0].status, 'skipped');
  assert.equal(d.sessions[0].id, w.id);
  assert.match(d.coach_notes.join(' '), /No catch-up/);
  assert.equal(out.weeks[w.week].running_minutes, sum(running(p, w.week)));
});

void test('completed workout exports actual evidence separately from its prescription', () => {
  const p = make(),
    w = p.workouts[0];
  completed(w, addDays(w.date, 1));
  const item = sessions(exportProgram(p)).find((s) => s.id === w.id);
  assert.equal(item.duration_minutes, w.minutes);
  assert.equal(item.recorded.duration_minutes, w.feedback.actualMinutes);
  assert.equal(item.recorded.actual_date, w.feedback.actualDate);
});

void test('cross-training reserves a running-free day without adding running sessions or evidence', () => {
  const p = make({
      crossTraining: [{ day: 2, activity: 'cycling', minutes: 40 }],
    }),
    before = structuredClone(p);
  assert.deepEqual(validatePlan(p), []);
  assert.ok(running(p).every((w) => weekday(w.date) !== 2));
  for (const week of p.weeks.filter(
    (w) => w.start >= start && addDays(w.start, 6) < p.profile.raceDate,
  ))
    assert.equal(new Set(running(p, week.index).map((w) => w.date)).size, 5);
  const out = exportProgram(p),
    cross = days(out).find((d) => d.workout_category === 'Cross-Train');
  assert.ok(cross);
  assert.equal(cross.sessions.length, 0);
  assert.equal(cross.cross_training.optional, true);
  assert.equal(sessions(out).length, p.workouts.length);
  assert.deepEqual(
    currentTrainingBaseline(p, addDays(start, 20)),
    currentTrainingBaseline(before, addDays(start, 20)),
  );
  assert.deepEqual(p, before);
});

void test('support intentions taper and recovery reduce their dose without affecting running totals', () => {
  const p = make({
    crossTraining: [{ day: 2, activity: 'cycling', minutes: 40 }],
  });
  const recovery = p.weeks.find((w) => w.phase === 'Recovery'),
    taper = p.weeks.find((w) => w.phase === 'Taper');
  assert.equal(supportingSession(p, addDays(recovery.start, 2)).minutes, 30);
  assert.equal(supportingSession(p, addDays(taper.start, 2)).minutes, 20);
  assert.equal(supportingSession(p, addDays(p.profile.startDate, -1)), null);
  assert.equal(supportingSession(p, addDays(p.profile.raceDate, 1)), null);
});

void test('strength is suppressed within the final race week and race always takes calendar precedence', () => {
  const p = make({
    crossTraining: [{ day: 2, activity: 'strength', minutes: 40 }],
  });
  const finalWednesday = addDays(p.profile.raceDate, -4);
  assert.equal(supportingSession(p, finalWednesday), null);
  assert.equal(supportingSession(p, p.profile.raceDate), null);
});

void test('return suppresses optional support and rehearsal instructions without altering return workouts', () => {
  const original = make({
    crossTraining: [{ day: 2, activity: 'cycling', minutes: 40 }],
    carbsPerHour: 60,
    practiceInDark: true,
  });
  const from = addDays(start, 14),
    next = adjustPlan(original, from, addDays(from, 2), 'rest', from),
    before = structuredClone(next);
  assert.equal(supportingSession(next, addDays(from, 9)), null);
  const out = exportProgram(next);
  assert.ok(
    days(out)
      .filter((d) => d.date >= from)
      .every((d) => !d.cross_training),
  );
  assert.ok(
    sessions(out)
      .flatMap((s) => s.coach_notes)
      .every((s) => !/carbohydrate\/hour|headlamp/i.test(s)),
  );
  assert.deepEqual(next, before);
});

void test('available preferred hard days win only within feasible spacing', () => {
  const p = make({ preferredHardDays: [1, 3] });
  assert.equal(qualitySchedule(p.profile).length, 1);
  assert.ok([1, 3].includes(qualitySchedule(p.profile)[0]));
  assert.deepEqual(validatePlan(p), []);
  const impossible = make({ preferredHardDays: [5, 6] });
  assert.deepEqual(validatePlan(impossible), []);
  assert.ok(
    qualitySchedule(impossible.profile).every((d) => ![5, 6].includes(d)),
  );
});

void test('two-run users never acquire quality because they prefer hard days', () => {
  const p = make({
    goal: 'base',
    raceDate: addDays(start, 55),
    weeklyKm: 10,
    longestKm: 5,
    currentRuns: 2,
    runsPerWeek: 2,
    preferredHardDays: [1, 3],
    recentQualitySessions: 0,
    recentQualityMinutes: 0,
  });
  assert.ok(p.workouts.every((w) => !w.hard && w.kind === 'easy'));
  assert.deepEqual(validatePlan(p), []);
});

void test('advisory-only preferences preserve workout bytes, load, evidence and FIT prescriptions', () => {
  const p = make(),
    before = structuredClone(p),
    next = revisePreferences(
      p,
      { carbsPerHour: 65, practiceInDark: true },
      addDays(start, 8),
    );
  assert.deepEqual(next.workouts, p.workouts);
  assert.deepEqual(p, before);
  assert.equal(sum(running(next)), sum(running(p)));
  assert.deepEqual(
    currentTrainingBaseline(next, addDays(start, 20)),
    currentTrainingBaseline(p, addDays(start, 20)),
  );
  const original = p.workouts.find((w) => w.kind === 'long' && w.minutes > 90),
    updated = next.workouts.find((w) => w.id === original.id);
  assert.deepEqual(encodeWorkout(updated), encodeWorkout(original));
  assert.ok(
    workoutGuidance(next, updated).some((s) =>
      s.includes('65 g carbohydrate/hour'),
    ),
  );
});

void test('cross-training input rejects impossible frequency, long-day conflict and malformed support', () => {
  assert.throws(
    () =>
      make({
        runsPerWeek: 6,
        currentRuns: 6,
        crossTraining: [
          { day: 1, activity: 'cycling', minutes: 30 },
          { day: 3, activity: 'mobility', minutes: 20 },
        ],
      }),
    /reserved/,
  );
  assert.throws(
    () =>
      make({ crossTraining: [{ day: 6, activity: 'cycling', minutes: 30 }] }),
    /long run/,
  );
  assert.throws(
    () =>
      make({ crossTraining: [{ day: 2, activity: 'cycling', minutes: 61 }] }),
    /10–60/,
  );
  assert.throws(() => make({ preferredHardDays: [1, 1] }), /distinct/);
});

void test('midweek scheduling preferences retain completed and elapsed history with no duplicate accounting', () => {
  const p = make({
      startDate: '2026-09-08',
      raceDate: '2026-12-28',
      runsPerWeek: 5,
      longDay: 5,
    }),
    asOf = '2026-09-10';
  const done = p.workouts.find((w) => w.date < asOf);
  assert.ok(done);
  completed(done, done.date);
  const before = structuredClone(p),
    next = revisePreferences(
      p,
      {
        crossTraining: [{ day: 2, activity: 'cycling', minutes: 40 }],
        preferredHardDays: [0, 3],
      },
      asOf,
    );
  assert.deepEqual(p, before);
  assert.deepEqual(validatePlan(next), []);
  for (const old of p.workouts.filter(
    (w) => w.date < asOf || w.status === 'completed',
  ))
    assert.deepEqual(
      next.workouts.find((w) => w.id === old.id),
      old,
    );
  assert.equal(
    new Set(next.workouts.map((w) => w.id)).size,
    next.workouts.length,
  );
  assert.ok(
    next.workouts
      .filter(
        (w) => w.date >= asOf && w.status === 'planned' && w.kind !== 'race',
      )
      .every((w) => weekday(w.date) !== 2),
  );
  const future = next.workouts.filter(
    (w) =>
      w.week === 0 &&
      w.date >= asOf &&
      w.status === 'planned' &&
      w.kind !== 'race',
  );
  const held = next.workouts
    .filter(
      (w) =>
        w.week === 0 &&
        (w.date < asOf || w.status === 'completed') &&
        w.kind !== 'race',
    )
    .reduce(
      (n, w) => n + Math.max(w.minutes, w.feedback?.actualMinutes ?? 0),
      0,
    );
  assert.ok(
    sum(future) + held <= p.profile.weeklyKm * p.profile.easyPace + 0.01,
    'Support preferences cannot create running volume above the established whole-week budget',
  );
});

void test('exact 50-mile support remains bounded and retains 80-km preparation requirements', () => {
  assert.equal(MAX_EVENT_KM, 160.9344);
  const p = make({
    goal: 'ultra',
    raceDistanceKm: 80.4672,
    raceDate: addDays(start, 195),
    weeklyKm: 70,
    longestKm: 30,
    longMinutes: 240,
  });
  assert.deepEqual(validatePlan(p), []);
  assert.deepEqual(
    preparationRequirements(p.profile),
    preparationRequirements({ ...p.profile, raceDistanceKm: 80 }),
  );
  assert.throws(
    () =>
      make({
        goal: 'ultra',
        raceDistanceKm: MAX_EVENT_KM + 1,
        raceDate: addDays(start, 195),
      }),
    /different preparation model/,
  );
  assert.throws(
    () =>
      make({
        goal: 'ultra',
        raceDistanceKm: MAX_EVENT_KM + 0.001,
        raceDate: addDays(start, 195),
      }),
    /different preparation model/,
  );
});

void test('same-day doubles remain two ordered sessions on one calendar day with honest metrics', () => {
  const p = make({
    weeklyKm: 90,
    longestKm: 30,
    currentRuns: 6,
    runsPerWeek: 6,
    volume: 'maintain',
    method: 'double-threshold',
    doubleDays: [2],
    stableWeeks: 16,
    easyDoubleWeeks: 6,
    recentSessionsPerWeek: 7,
    recentQualitySessions: 2,
    recentQualityMinutes: 48,
    thresholdControl: 'heart-rate',
    thresholdCeiling: 165,
    doubleGapHours: 6,
  });
  const out = exportProgram(p),
    paired = days(out).find((d) => d.workout_category === 'Multiple runs');
  assert.ok(paired);
  assert.deepEqual(
    paired.sessions.map((s) => s.session),
    ['AM', 'PM'],
  );
  assert.ok(paired.sessions[0].start_time < paired.sessions[1].start_time);
  assert.equal(paired.cross_training, null);
  for (const s of paired.sessions)
    for (const step of [...s.warmup, ...s.main_set, ...s.cooldown]) {
      assert.equal(step.target_metrics.pace_range, null);
      assert.equal(step.target_metrics.hr_zone, null);
      assert.equal(
        step.target_metrics.heart_rate_ceiling_bpm,
        step.kind === 'work' ? 165 : null,
      );
    }
  assert.equal(
    out.weeks.find((w) => w.days.includes(paired)).running_minutes,
    sum(running(p, p.workouts.find((w) => w.date === paired.date).week)),
  );
});

void test('night practice stays an optional short segment of an existing easy outing without extra prescription', () => {
  const p = make({ practiceInDark: true }),
    before = structuredClone(p),
    tagged = p.workouts.filter((w) =>
      workoutGuidance(p, w).some((s) => /headlamp/.test(s)),
    );
  assert.ok(tagged.length > 0 && tagged.length <= 3);
  assert.ok(
    tagged.every(
      (w) =>
        w.kind === 'easy' &&
        !w.hard &&
        !w.pairId &&
        w.minutes >= 20 &&
        workoutGuidance(p, w).some((note) => note.includes('15–20 minutes')),
    ),
  );
  assert.deepEqual(p, before);
});

void test('new preferences survive recovery validation and reserved days reject manual running moves', async () => {
  const { validateRecovery } = await import(new URL('recovery.ts', lib));
  const { moveWorkout } = await import(new URL('engine.ts', lib));
  const p = make({
    crossTraining: [{ day: 2, activity: 'cycling', minutes: 40 }],
    preferredHardDays: [1, 3],
    carbsPerHour: 65,
    practiceInDark: true,
  });
  const file = {
    format: 'stride-recovery-2',
    exportedAt: '2026-09-08T18:00:00Z',
    profile: null,
    plan: p,
  };
  const recovered = validateRecovery(file).plan;
  assert.deepEqual(recovered.profile, p.profile);
  const run = p.workouts.find((w) => w.kind === 'easy' && w.week === 0);
  const before = structuredClone(p);
  assert.throws(
    () => moveWorkout(p, run.id, addDays(start, 2), start),
    /reserved for cross-training/,
  );
  assert.deepEqual(p, before);
  const malformed = structuredClone(file);
  malformed.plan.profile.crossTraining[0].activity = 'running';
  assert.throws(() => validateRecovery(malformed), /cross-training/);
});
