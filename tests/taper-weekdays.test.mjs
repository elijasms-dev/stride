// Synthetic source-executing race-relative taper acceptance. Portable to tests/.
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
  dayDiff,
  weekday,
  revisePreferences,
  raceDistance,
  taperFactor,
} = await import(new URL('engine.ts', lib));
const { usesMarathonBook, marathonTaperDays } = await import(
  new URL('marathon-book.ts', lib)
);
const start = '2026-09-07';
const base = {
  ...demoProfile(start),
  startDate: start,
  weeklyKm: 70,
  longestKm: 30,
  currentRuns: 6,
  days: [0, 1, 2, 3, 4, 5],
  longDay: 5,
  weekdayMinutes: 120,
  longMinutes: 180,
  easyPace: 6,
  experience: 'established',
  qualitySessions: 2,
  recentQualitySessions: 2,
  recentQualityMinutes: 40,
  intent: 'improve',
  difficulty: 'balanced',
  volume: 'gradual',
};
const training = (p) =>
  p.workouts.filter((w) => w.kind !== 'race' && w.status !== 'skipped');
const minutes = (w) => w.steps.reduce((n, s) => n + s.seconds, 0) / 60;
const sum = (ws) => ws.reduce((n, w) => n + minutes(w), 0);
function verify(p) {
  const race = p.workouts.filter((w) => w.kind === 'race');
  assert.equal(race.length, 1);
  assert.equal(race[0].date, p.profile.raceDate);
  assert.ok(
    Math.abs(race[0].steps[0].metres - raceDistance(p.profile) * 1000) < 0.11,
  );
  const runs = training(p),
    taperStart = p.weeks.findIndex((w) =>
      ['Taper', 'Race week'].includes(w.phase),
    );
  const reference = p.weeks
    .slice(0, taperStart)
    .reverse()
    .find(
      (w) =>
        w.phase !== 'Recovery' &&
        runs
          .filter((s) => s.week === w.index)
          .every((s) => taperFactor(p.profile, s.date) === 1) &&
        new Set(runs.filter((s) => s.week === w.index).map((s) => s.date))
          .size >= p.profile.days.length,
    );
  assert.ok(reference, 'Use an actual pre-taper training week');
  const baseline = sum(runs.filter((w) => w.week === reference.index));
  assert.ok(baseline > 0);
  for (const [bucket, factor] of [
    [1, 0.4],
    [2, usesMarathonBook(p.profile) ? 0.6 : 0.65],
    ...(p.profile.goal === '10k' ||
    (usesMarathonBook(p.profile) && marathonTaperDays(p.profile) === 14)
      ? []
      : [[3, usesMarathonBook(p.profile) ? 0.75 : 0.85]]),
  ]) {
    const window = runs.filter((w) => {
      const d = dayDiff(w.date, p.profile.raceDate);
      return usesMarathonBook(p.profile)
        ? d >= (bucket - 1) * 7 && d < bucket * 7
        : d >= (bucket - 1) * 7 + 1 && d <= bucket * 7;
    });
    const days = new Set(window.map((w) => w.date)).size;
    const ceiling =
      baseline *
      factor *
      (usesMarathonBook(p.profile) && bucket === 1
        ? 1
        : Math.min(1, days / p.profile.days.length));
    assert.ok(
      sum(window) <= ceiling + 0.01,
      `${p.profile.goal} race weekday ${weekday(p.profile.raceDate)}, days${(bucket - 1) * 7 + 1}..${bucket * 7}: ${sum(window)}min exceeds actual pre-taper bound${ceiling}`,
    );
  }
  for (const w of runs) {
    const d = dayDiff(w.date, p.profile.raceDate);
    assert.ok(w.date >= p.profile.startDate && w.date < p.profile.raceDate);
    assert.ok(p.profile.days.includes(weekday(w.date)));
    assert.equal(
      w.week,
      Math.floor(dayDiff(p.weeks[0].start, w.date) / 7),
      'Calendar labels stay consistent while taper is race-relative',
    );
    assert.ok(Math.abs(minutes(w) - w.minutes) < 0.01);
    if (
      w.status === 'planned' &&
      w.date >= (p.constraintsFrom ?? p.profile.startDate)
    )
      assert.ok(
        w.minutes <=
          (w.kind === 'long'
            ? p.profile.longMinutes
            : p.profile.weekdayMinutes) +
            0.01,
      );
    if (d >= 1 && d <= (usesMarathonBook(p.profile) ? 6 : 7)) {
      const cap = usesMarathonBook(p.profile)
        ? d === 1
          ? 45
          : d === 2
            ? 60
            : p.profile.weekdayMinutes
        : d === 1
          ? 20
          : d === 2
            ? 25
            : d === 3
              ? 30
              : 45;
      assert.ok(
        w.minutes <= cap,
        `${w.date}: ${w.minutes}min exceeds final-${d}-day cap${cap}`,
      );
      assert.notEqual(
        w.kind,
        'long',
        'No long run inside the final seven days',
      );
      if (d <= 2)
        assert.equal(
          w.hard,
          false,
          'No hard workout within two days of racing',
        );
    }
  }
}
for (const goal of ['10k', 'half', 'marathon'])
  for (let day = 0; day < 7; day++)
    void test(`${goal}: race on weekday ${day} respects actual taper windows and executable session caps`, () => {
      const profile = { ...base, goal, raceDate: addDays('2026-12-28', day) },
        before = structuredClone(profile);
      const p = makePlan(profile, start);
      verify(p);
      assert.deepEqual(profile, before);
    });
void test('Monday marathon benchmark does not redistribute race-week volume into a 93-minute Saturday run', () => {
  const p = makePlan(
    {
      ...base,
      goal: 'marathon',
      startDate: '2026-09-08',
      raceDate: '2026-12-28',
      currentRuns: 5,
      qualitySessions: 1,
      recentQualitySessions: undefined,
      recentQualityMinutes: undefined,
    },
    '2026-09-08',
  );
  const final = p.workouts.find((w) => w.date === '2026-12-26'),
    long = p.workouts.find((w) => w.date === '2026-12-19');
  assert.ok(final);
  assert.ok(long);
  assert.ok(final.minutes <= 60);
  assert.equal(final.hard, false);
  assert.notEqual(final.kind, 'long');
  assert.equal(long.kind, 'long');
  assert.ok(long.minutes <= base.longMinutes * 0.6 + 1);
  verify(p);
});
void test('reducing upcoming taper limits preserves every recorded session and original snapshot', () => {
  const p = makePlan(
      { ...base, goal: 'marathon', raceDate: '2026-12-28' },
      start,
    ),
    asOf = '2026-12-20';
  for (const w of p.workouts.filter((w) => w.date < asOf)) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualMinutes: w.minutes,
      actualKm: w.estimatedKm,
      effort: 3,
      feeling: 'good',
      execution: 'as-planned',
      note: 'Synthetic completed history',
      recordedAt: w.date + 'T18:00:00Z',
    };
  }
  const before = structuredClone(p),
    records = JSON.stringify(
      p.workouts.filter((w) => w.status === 'completed'),
    );
  const next = revisePreferences(p, { weekdayMinutes: 40 }, asOf);
  assert.deepEqual(p, before);
  assert.equal(
    JSON.stringify(next.workouts.filter((w) => w.status === 'completed')),
    records,
  );
  assert.ok(
    next.workouts
      .filter((w) => w.date >= asOf && w.kind !== 'race')
      .every((w) => w.minutes <= 40),
  );
  assert.equal(next.workouts.find((w) => w.kind === 'race').date, '2026-12-28');
  verify(next);
});
