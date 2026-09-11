import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, demoProfile, makePlan, weekday } from '../lib/engine.ts';
import { dailyGuide, dayOverview } from '../lib/daily-guide.ts';

const start = '2026-09-07';
const base = makePlan(demoProfile(start), start);
function fixture() {
  const plan = structuredClone(base);
  const workout = {
    ...structuredClone(plan.workouts[0]),
    date: start,
    week: 0,
    status: 'planned',
    kind: 'easy',
    hard: false,
    title: 'Easy run',
    minutes: 30,
    steps: [],
  };
  plan.workouts = [];
  plan.extraRuns = [];
  plan.profile.crossTraining = [];
  delete plan.returnState;
  return { plan, workout };
}
const copy = (guide) =>
  guide.sections.flatMap((s) => [s.title, ...s.paragraphs]).join(' ');
const ids = (guide) => guide.sections.map((s) => s.id);
const food = (guide) =>
  guide.sections.find((s) => s.id === 'food').paragraphs.join(' ');

void test('rest dates open recovery, meals and actual next-day guidance without adding work', () => {
  const { plan, workout } = fixture();
  plan.workouts = [{ ...workout, date: addDays(start, 1), title: '6 × 400 m' }];
  assert.equal(dayOverview(plan, start).title, 'Rest day');
  const guide = dailyGuide(plan, start);
  assert.deepEqual(ids(guide), ['recovery', 'food', 'next']);
  assert.match(copy(guide), /taking the day off/);
  assert.match(copy(guide), /Tomorrow’s plan: 6 × 400 m/);
  plan.workouts[0].status = 'skipped';
  assert.doesNotMatch(
    copy(dailyGuide(plan, start)),
    /Tomorrow’s plan: 6 × 400 m/,
  );
});

void test('easy, long, quality, race and return sessions have distinct relevant preparation', () => {
  const { plan, workout } = fixture();
  const guides = [
    workout,
    { ...workout, kind: 'long', minutes: 120 },
    { ...workout, kind: 'intervals', hard: true },
    { ...workout, kind: 'race', hard: true },
    { ...workout, steps: [{ movement: 'walk', kind: 'work' }] },
  ].map((w) => dailyGuide(plan, start, w));
  guides.forEach((g) => assert.deepEqual(ids(g), ['before', 'food', 'after']));
  assert.equal(new Set(guides.map((g) => g.sections[0].title)).size, 5);
  assert.match(food(guides[0]), /gels are not automatically needed/);
  assert.match(food(guides[1]), /already tolerate/);
  assert.match(copy(guides[2]), /prescribed warm-up/);
  assert.match(copy(guides[3]), /already tried in training/);
  assert.match(
    copy(guides[4]),
    /without extending the session or adding faster efforts/,
  );
});

void test('a skipped AM session never turns a planned PM run into a rest day', () => {
  const { plan, workout } = fixture();
  const skipped = { ...workout, id: 'am', session: 'AM', status: 'skipped' };
  const pm = { ...workout, id: 'pm', session: 'PM' };
  plan.workouts = [skipped, pm];
  assert.equal(dayOverview(plan, start).title, 'Training day');
  assert.deepEqual(
    dayOverview(plan, start).planned.map((w) => w.id),
    ['pm'],
  );
  assert.match(copy(dailyGuide(plan, start, skipped)), /Other sessions remain/);
  assert.doesNotMatch(
    copy(dailyGuide(plan, start, skipped)),
    /your rest day|day without running/,
  );
  assert.equal(dailyGuide(plan, start).key, dailyGuide(plan, start, pm).key);
});

void test('recorded, corrected and archived runs use actual dates and canonical deduplication', () => {
  const { plan, workout } = fixture();
  const actualDate = addDays(start, 1);
  const completed = {
    ...workout,
    week: -1,
    status: 'completed',
    feedback: {
      actualDate,
      actualMinutes: 21,
      actualKm: 3,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: `${actualDate}T12:00:00Z`,
      activityId: 'watch:one',
    },
  };
  plan.workouts = [completed];
  plan.extraRuns = [
    {
      id: 'duplicate',
      date: actualDate,
      minutes: 21,
      km: 3,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: `${actualDate}T12:00:00Z`,
      activityId: 'watch:one',
    },
  ];
  assert.equal(dayOverview(plan, start).records.length, 0);
  const overview = dayOverview(plan, actualDate);
  assert.equal(overview.title, 'Run recorded');
  assert.equal(overview.records.length, 1);
  assert.equal(overview.records[0].record.minutes, 21);
  assert.match(
    copy(dailyGuide(plan, start)),
    /already recorded for the next day/,
  );
  assert.match(copy(dailyGuide(plan, actualDate)), /running recorded/);
  assert.doesNotMatch(
    copy(dailyGuide(plan, actualDate)),
    /No run is scheduled\.|day without running/,
  );
  const skipped = { ...workout, status: 'skipped', date: actualDate };
  assert.match(copy(dailyGuide(plan, actualDate, skipped)), /running recorded/);
  const completedGuide = dailyGuide(plan, actualDate, completed);
  assert.deepEqual(ids(completedGuide), ['after', 'food', 'next']);
  assert.doesNotMatch(
    copy(completedGuide),
    /Complete any cool-down|Recover after harder running/,
  );
});

void test('supporting activities retain optional saved duration and existing race/return suppression', () => {
  const { plan } = fixture();
  plan.profile.crossTraining = [
    { day: weekday(start), activity: 'mobility', minutes: 20 },
  ];
  const overview = dayOverview(plan, start);
  assert.equal(overview.title, 'Gentle mobility');
  assert.equal(overview.activity.minutes, 20);
  assert.match(copy(dailyGuide(plan, start)), /optional today/);
  plan.returnState = { stage: 1, from: start };
  assert.equal(dayOverview(plan, start).activity, null);
  delete plan.returnState;
  plan.profile.crossTraining = [
    { day: weekday(plan.profile.raceDate), activity: 'strength', minutes: 30 },
  ];
  assert.equal(dayOverview(plan, plan.profile.raceDate).activity, null);
});

void test('outside-block guidance never claims the runner completed a race', () => {
  const { plan } = fixture();
  assert.equal(dayOverview(plan, addDays(start, -1)).title, 'Before your plan');
  const after = addDays(plan.profile.raceDate, 1);
  assert.equal(dayOverview(plan, after).title, 'After your block');
  assert.doesNotMatch(
    copy(dailyGuide(plan, after)),
    /completed (your |the )?race|finish area|race result/,
  );
});

void test('reading every day and workout never mutates a frozen saved plan or its prescriptions', () => {
  const plan = structuredClone(base);
  const before = structuredClone(plan);
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  }
  freeze(plan);
  for (const w of plan.workouts) {
    dailyGuide(plan, w.date, w);
    dayOverview(plan, w.date);
  }
  for (let day = 0; day < 7; day++) dailyGuide(plan, addDays(start, day));
  assert.deepEqual(plan, before);
});
