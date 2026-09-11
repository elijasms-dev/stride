import test from 'node:test';
import assert from 'node:assert/strict';
const lib = new URL('../lib/', import.meta.url);
const {
  demoProfile,
  makePlan,
  adjustPlan,
  addDays,
  returnReview,
  advanceReturn,
  noviceReview,
  advanceRunWalk,
  suggestedAdjustment,
  revisePreferences,
} = await import(new URL('engine.ts', lib));
const { currentTrainingBaseline, trainingRecords } = await import(
  new URL('training-history.ts', lib)
);
const start = '2026-09-07';
function complete(w, patch = {}) {
  w.status = 'completed';
  w.feedback = {
    actualDate: w.date,
    actualMinutes: w.minutes,
    actualKm: w.estimatedKm,
    effort: 3,
    feeling: 'good',
    execution: 'as-planned',
    note: 'Synthetic algorithm regression',
    recordedAt: w.date + 'T18:00:00Z',
    ...patch,
  };
}
function extra(date, patch = {}) {
  return {
    id: 'extra:' + date,
    date,
    minutes: 30,
    km: 5,
    effort: 3,
    feeling: 'good',
    note: 'Synthetic algorithm regression',
    recordedAt: date + 'T19:00:00Z',
    ...patch,
  };
}
const cases = [
  {
    name: 'return',
    asOf: '2026-09-21',
    review: returnReview,
    advance: advanceReturn,
    stage: (p) => p.returnState.stage,
    expectedStage: 2,
    plan: () =>
      adjustPlan(
        makePlan(demoProfile(start), start),
        start,
        '2026-09-13',
        'rest',
        start,
      ),
  },
  {
    name: 'run-walk',
    asOf: '2026-09-14',
    review: noviceReview,
    advance: advanceRunWalk,
    stage: (p) => p.profile.runWalkStage,
    expectedStage: 1,
    plan: () =>
      makePlan(
        {
          ...demoProfile(start),
          goal: 'base',
          weeklyKm: 8,
          longestKm: 2,
          currentRuns: 4,
          days: [0, 2, 4, 6],
          longDay: 6,
          experience: 'new',
          weekdayMinutes: 40,
          longMinutes: 60,
        },
        start,
      ),
  },
];
function stageFixture(c, priorCount = 3) {
  const p = c.plan();
  p.workouts
    .filter((w) => w.status === 'planned' && w.date < c.asOf)
    .slice(0, priorCount)
    .forEach((w) => complete(w, { actualDate: addDays(w.date, 1) }));
  return p;
}
function addToday(p, c, source, patch = {}) {
  if (source === 'extra') p.extraRuns = [extra(c.asOf, patch)];
  else {
    const w = p.workouts.find(
      (w) => w.date === c.asOf && w.status === 'planned',
    );
    assert.ok(w, 'The fixture must include a prescribed session today');
    complete(w, { actualDate: c.asOf, ...patch });
  }
}
function unchangedReview(c, p) {
  const before = structuredClone(p),
    result = c.review(p, c.asOf);
  assert.deepEqual(
    p,
    before,
    'Review must not rewrite the journal or prescriptions',
  );
  return result;
}
function facts(p) {
  return {
    workouts: p.workouts.filter((w) => w.status === 'completed'),
    extras: p.extraRuns ?? [],
  };
}

for (const c of cases) {
  for (const source of ['prescribed', 'extra']) {
    for (const [label, patch] of [
      ['tiredness even at low effort', { feeling: 'tired', effort: 3 }],
      ['high effort at the 7/10 boundary', { feeling: 'good', effort: 7 }],
    ]) {
      if (typeof label !== 'string')
        throw new Error('Fixture label must be a string');
      void test(`${c.name}: today's ${source} ${label} vetoes advancement`, () => {
        const p = stageFixture(c);
        assert.equal(
          unchangedReview(c, p).ready,
          true,
          'Prior days must otherwise qualify',
        );
        addToday(p, c, source, patch);
        assert.equal(unchangedReview(c, p).ready, false);
        const before = structuredClone(p);
        assert.throws(
          () => c.advance(p, c.asOf),
          /comfortable|stage|recovery|running/i,
        );
        assert.deepEqual(p, before);
      });
    }
  }
  for (const [label, offset] of [
    ['future', 1],
    ['before the recent window', -8],
  ]) {
    void test(`${c.name}: fatigue dated ${label} does not veto current evidence`, () => {
      const p = stageFixture(c);
      p.extraRuns = [
        extra(addDays(c.asOf, offset), { feeling: 'tired', effort: 9 }),
      ];
      assert.equal(unchangedReview(c, p).ready, true);
    });
  }
  void test(`${c.name}: today's comfortable prescribed run cannot supply the third qualifying day`, () => {
    const p = stageFixture(c, 2);
    addToday(p, c, 'prescribed');
    assert.equal(unchangedReview(c, p).ready, false);
    assert.throws(() => c.advance(p, c.asOf), /comfortable|stage|running/i);
  });
  void test(`${c.name}: extra running does not replace required prescribed-session evidence`, () => {
    const p = stageFixture(c, 0);
    p.extraRuns = [-1, -3, -5].map((offset) => extra(addDays(c.asOf, offset)));
    assert.equal(unchangedReview(c, p).ready, false);
  });
  void test(`${c.name}: a hard historical prescription cannot supply an easy-session qualification`, () => {
    const p = stageFixture(c, 3);
    p.workouts.filter((w) => w.feedback).at(-1).hard = true;
    assert.equal(unchangedReview(c, p).ready, false);
  });
  void test(`${c.name}: copied provider identities cannot manufacture three completed days`, () => {
    const p = stageFixture(c);
    p.workouts
      .filter((w) => w.feedback)
      .forEach((w) => {
        w.feedback.activityId = 'one-provider-activity';
      });
    assert.equal(
      trainingRecords(p).length,
      1,
      'Canonical history must contain one real activity',
    );
    assert.equal(unchangedReview(c, p).ready, false);
    assert.throws(() => c.advance(p, c.asOf), /comfortable|stage|running/i);
  });
  void test(`${c.name}: separate comfortable activities progress while all actual history survives`, () => {
    const p = stageFixture(c);
    p.workouts
      .filter((w) => w.feedback)
      .forEach((w, index) => {
        w.feedback.activityId = 'distinct-activity-' + index;
      });
    p.extraRuns = [extra(c.asOf, { effort: 3, feeling: 'good' })];
    const before = structuredClone(p),
      recorded = structuredClone(facts(p));
    assert.equal(unchangedReview(c, p).ready, true);
    const next = c.advance(p, c.asOf);
    assert.equal(c.stage(next), c.expectedStage);
    assert.deepEqual(facts(next), recorded);
    assert.deepEqual(p, before);
  });
}

const baselineAsOf = addDays(start, 56);
function baselineFixture() {
  const p = makePlan(
    {
      ...demoProfile(start),
      raceDate: addDays(start, 104),
      terrain: 'flat',
      recentQualitySessions: 1,
      qualitySessions: 1,
    },
    start,
  );
  p.workouts
    .filter((w) => w.date < baselineAsOf)
    .forEach((w) =>
      complete(w, {
        actualMinutes: w.minutes * 1.2,
        actualKm: w.estimatedKm * 1.2,
      }),
    );
  return p;
}
function baseline(p) {
  const before = structuredClone(p),
    result = currentTrainingBaseline(p, baselineAsOf);
  assert.deepEqual(p, before);
  return result;
}
for (const source of ['prescribed', 'extra']) {
  void test(`baseline: today's tired ${source} run blocks increased capacity and progression`, () => {
    const p = baselineFixture(),
      control = baseline(p);
    assert.equal(control.supportsProgression, true);
    assert.ok(control.weeklyKm > p.profile.weeklyKm);
    addToday(p, { asOf: baselineAsOf }, source, {
      feeling: 'tired',
      effort: 3,
    });
    const observed = baseline(p);
    assert.equal(observed.supportsProgression, false);
    assert.ok(observed.weeklyKm <= p.profile.weeklyKm);
    assert.ok(
      observed.weeklyMinutes <= p.profile.weeklyKm * p.profile.easyPace,
    );
    assert.ok(observed.longestKm <= p.profile.longestKm);
    assert.ok(
      observed.longestMinutes <= p.profile.longestKm * p.profile.easyPace,
    );
  });
}
void test('baseline: today high effort on an easy prescribed run blocks progression', () => {
  const p = baselineFixture();
  addToday(p, { asOf: baselineAsOf }, 'prescribed', {
    feeling: 'good',
    effort: 7,
  });
  assert.equal(p.workouts.find((w) => w.date === baselineAsOf).hard, false);
  assert.equal(baseline(p).supportsProgression, false);
});
for (const [label, offset] of [
  ['future', 1],
  ['older than the fatigue window', -15],
]) {
  void test(`baseline: fatigue ${label} does not veto sustained recent capacity`, () => {
    const p = baselineFixture();
    if (offset > 0)
      p.extraRuns = [
        extra(addDays(baselineAsOf, offset), { feeling: 'tired', effort: 9 }),
      ];
    else {
      const old = p.workouts.find(
        (w) => w.feedback && w.feedback.actualDate < addDays(baselineAsOf, -14),
      );
      assert.ok(old);
      old.feedback.feeling = 'tired';
      old.feedback.effort = 9;
    }
    assert.equal(baseline(p).supportsProgression, true);
  });
}
void test('baseline: a large comfortable run today contributes no positive capacity', () => {
  const p = baselineFixture(),
    control = baseline(p);
  p.extraRuns = [extra(baselineAsOf, { minutes: 180, km: 30 })];
  assert.deepEqual(baseline(p), control);
});
void test('baseline: expected hard-session effort today retains the existing fatigue semantics', () => {
  const p = baselineFixture(),
    control = baseline(p);
  addToday(p, { asOf: baselineAsOf }, 'prescribed', {
    feeling: 'good',
    effort: 8,
  });
  p.workouts.find((w) => w.date === baselineAsOf).hard = true;
  assert.deepEqual(baseline(p), control);
});

void test('baseline: a later fatigued review cannot raise previously recorded duration ceilings', () => {
  const firstReview = addDays(start, 56),
    secondReview = addDays(firstReview, 14);
  let p = makePlan(
    {
      ...demoProfile(start),
      raceDate: addDays(start, 139),
      terrain: 'flat',
      recentQualitySessions: 1,
      qualitySessions: 1,
    },
    start,
  );
  // Actual running is faster than the supplied easy pace. Duration capacity
  // therefore cannot be reconstructed from the recorded kilometres and that pace.
  p.workouts
    .filter((w) => w.date < firstReview)
    .forEach((w) =>
      complete(w, {
        actualMinutes: w.minutes,
        actualKm: w.estimatedKm * 1.2,
      }),
    );
  p = revisePreferences(p, { days: [0, 3, 4, 6] }, firstReview);
  const prior = structuredClone(p.baselineEvidence);
  assert.ok(prior.weeklyMinutes < prior.weeklyKm * p.profile.easyPace);
  assert.ok(prior.longestMinutes < prior.longestKm * p.profile.easyPace);
  p.workouts
    .filter((w) => w.date >= firstReview && w.date < secondReview)
    .forEach((w) =>
      complete(w, {
        actualMinutes: w.minutes * 1.25,
        actualKm: w.estimatedKm * 1.25,
      }),
    );
  p.extraRuns = [extra(secondReview, { feeling: 'tired' })];
  const before = structuredClone(p),
    result = currentTrainingBaseline(p, secondReview);
  assert.deepEqual(p, before);
  assert.equal(result.supportsProgression, false);
  assert.ok(result.weeklyKm <= prior.weeklyKm);
  assert.ok(result.longestKm <= prior.longestKm);
  assert.ok(
    result.weeklyMinutes <= prior.weeklyMinutes,
    `Fatigue raised weekly duration from ${prior.weeklyMinutes} to ${result.weeklyMinutes}`,
  );
  assert.ok(
    result.longestMinutes <= prior.longestMinutes,
    `Fatigue raised long-session duration from ${prior.longestMinutes} to ${result.longestMinutes}`,
  );
  const next = revisePreferences(p, { days: [0, 2, 4, 6] }, secondReview);
  assert.deepEqual(next.baselineEvidence, result);
  const firstFullWeek = next.weeks.find((week) => week.start >= secondReview);
  assert.equal(
    firstFullWeek.start,
    secondReview,
    'The fixture replans at the start of a complete week',
  );
  const upcoming = next.workouts.filter(
    (w) =>
      w.week === firstFullWeek.index &&
      w.status === 'planned' &&
      w.kind !== 'race',
  );
  assert.equal(
    upcoming.length,
    next.profile.days.length,
    'The cap check must cover the complete prescribed week',
  );
  const executableMinutes = upcoming.map(
    (w) => w.steps.reduce((sum, step) => sum + step.seconds, 0) / 60,
  );
  const weeklyMinutes = executableMinutes.reduce(
    (sum, minutes) => sum + minutes,
    0,
  );
  const longestMinutes = Math.max(...executableMinutes);
  assert.ok(
    weeklyMinutes <= result.weeklyMinutes,
    `First full week executes ${weeklyMinutes} minutes above the reviewed ${result.weeklyMinutes}-minute capacity`,
  );
  assert.ok(
    longestMinutes <= result.longestMinutes,
    `Longest upcoming session executes ${longestMinutes} minutes above the reviewed ${result.longestMinutes}-minute capacity`,
  );
  assert.deepEqual(facts(next), facts(p));
  assert.deepEqual(
    p,
    before,
    'Repeated preference previews must preserve the original journal',
  );
});

void test('one copied tired external activity cannot produce a two-run recovery warning', () => {
  const p = makePlan(demoProfile(start), start);
  const first = extra(start, {
    id: 'original',
    feeling: 'tired',
    activityId: 'one-external-activity',
  });
  p.extraRuns = [first];
  assert.equal(suggestedAdjustment(p, start), null);
  p.extraRuns.push({ ...first, id: 'history-copy' });
  const before = structuredClone(p);
  assert.equal(trainingRecords(p).length, 1);
  assert.equal(suggestedAdjustment(p, start), null);
  assert.deepEqual(p, before);
});
void test('distinct tired activities still produce the recovery warning and preserve same-day runs', () => {
  const p = makePlan(demoProfile(start), start);
  p.extraRuns = ['a', 'b'].map((id) =>
    extra(start, {
      id,
      feeling: 'tired',
      activityId: 'activity-' + id,
    }),
  );
  assert.equal(trainingRecords(p).length, 2);
  assert.match(suggestedAdjustment(p, start).title, /recover/i);
});
