import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProfile, makePlan } from '../lib/engine.ts';
import { addDays } from '../lib/plan/calendar.ts';
import {
  trainingPlanHtml,
  printTrainingPlan,
  downloadTrainingPlan,
} from '../lib/plan-print.ts';

const start = '2026-09-21';
const step = (overrides = {}) => ({
  label: 'Easy running',
  kind: 'aerobic',
  seconds: 1800,
  effort: 'Conversational, 2–3 / 10',
  intensity: 3,
  ...overrides,
});
const workout = (overrides = {}) => ({
  id: 'run-1',
  date: start,
  originalDate: start,
  week: 0,
  title: 'Easy run',
  kind: 'easy',
  minutes: 30,
  estimatedKm: 5,
  hard: false,
  purpose: 'Comfortable running.',
  reason: '',
  steps: [step()],
  status: 'planned',
  ...overrides,
});
const plan = (overrides = {}) => ({
  id: 'print-fixture',
  engineVersion: 'saved-engine',
  policyVersion: 'saved-policy',
  profile: {
    ...demoProfile(start),
    name: 'Alex',
    raceName: 'Autumn marathon',
    raceDate: addDays(start, 13),
    easyPace: 6,
  },
  createdAt: '2026-09-21T12:00:00.000Z',
  weeks: [0, 1].map((index) => ({
    index,
    start: addDays(start, index * 7),
    phase: index ? 'Race week' : 'Taper',
    targetKm: 5,
    longKm: 0,
    focus: 'Stay comfortable.',
  })),
  workouts: [workout()],
  notes: [],
  ...overrides,
});

void test('a real twelve-week marathon export contains all 84 dates through race day', () => {
  const generated = makePlan(
    {
      ...demoProfile(start),
      startDate: start,
      raceDate: addDays(start, 83),
      goal: 'marathon',
      raceName: 'Twelve-week marathon',
      weeklyKm: 70,
      longestKm: 23,
      currentRuns: 5,
      days: [0, 1, 2, 4, 6],
      availableDays: [0, 1, 2, 4, 6],
      runsPerWeek: 5,
      longDay: 6,
      experience: 'established',
      recentQualitySessions: 1,
      recentQualityMinutes: 30,
      stableWeeks: 8,
      qualityMode: 'automatic',
      qualitySessions: 1,
      weekdayMinutes: 120,
      longMinutes: 240,
      easyPace: 6,
    },
    new Date(`${start}T12:00:00Z`),
  );
  const before = structuredClone(generated);
  const html = trainingPlanHtml(generated);
  const dates = [...html.matchAll(/data-date="([\d-]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    dates,
    Array.from({ length: 84 }, (_, index) => addDays(start, index)),
  );
  assert.equal((html.match(/class="week-heading"/g) ?? []).length, 12);
  assert.match(html, /Rest day\./);
  assert.match(html, /Race separately: 42\.195 km/);
  assert.deepEqual(generated, before);
});

void test('saved step order and exact distance endings survive without invented pace or race duration', () => {
  const w = workout({
    kind: 'intervals',
    hard: true,
    title: 'Two controlled repetitions',
    steps: [
      step({ label: 'Warm up first', kind: 'warmup', seconds: 600 }),
      step({
        label: 'First repetition',
        kind: 'work',
        metres: 400,
        seconds: 128,
        target: { mode: 'pace', low: 300, high: 320 },
      }),
      step({
        label: 'Walking recovery',
        kind: 'recovery',
        seconds: 90,
        movement: 'walk',
      }),
      step({
        label: 'Second repetition',
        kind: 'work',
        metres: 400,
        seconds: 128,
        target: { mode: 'heart-rate', low: 145, high: 155 },
      }),
      step({ label: 'Finish easy', kind: 'cooldown', seconds: 300 }),
    ],
  });
  const race = workout({
    id: 'race',
    date: addDays(start, 13),
    week: 1,
    kind: 'race',
    title: 'Marathon',
    minutes: 999,
    estimatedKm: 42.195,
    steps: [
      step({ label: 'Race', kind: 'work', metres: 42195, seconds: 59940 }),
    ],
  });
  const html = trainingPlanHtml(plan({ workouts: [w, race] }));
  const labels = w.steps.map((item) =>
    html.indexOf(`<strong>${item.label}</strong>`),
  );
  assert.ok(
    labels.every((position, index) => position > (labels[index - 1] ?? -1)),
  );
  assert.equal(
    (html.match(/Finish this step at its distance target/g) ?? []).length,
    2,
  );
  assert.match(html, /400 m/);
  assert.match(html, /Planning time: 2:08 min/);
  assert.match(html, /5:00–5:20 \/km/);
  assert.match(html, /145–155 bpm/);
  assert.match(html, /Walk\. Conversational/);
  assert.doesNotMatch(html, /16h 39m|999 min|999m/);
  assert.match(html, /Race duration is not predicted/);
});

void test('weekly training totals exclude races and skipped sessions, and retain both daily sessions', () => {
  const fixture = plan({
    workouts: [
      workout({ session: 'PM', startTime: '18:00', title: 'Evening run' }),
      workout({
        id: 'am',
        session: 'AM',
        startTime: '06:00',
        title: 'Morning run',
        estimatedKm: 4,
        minutes: 24,
      }),
      workout({
        id: 'skip',
        date: addDays(start, 1),
        title: 'Skipped seven',
        estimatedKm: 7,
        status: 'skipped',
      }),
      workout({
        id: 'race',
        date: addDays(start, 6),
        kind: 'race',
        estimatedKm: 42.195,
        title: 'Race',
        steps: [step({ metres: 42195 })],
      }),
    ],
  });
  const html = trainingPlanHtml(fixture);
  assert.match(
    html,
    /9 km scheduled training \(estimated distance\)<\/strong> · 54m prescribed time · 1 running day/,
  );
  assert.match(
    html,
    /Race separately: 42\.195 km\. Excluded from the training total/,
  );
  assert.ok(
    html.indexOf('AM 06:00 · Morning run') <
      html.indexOf('PM 18:00 · Evening run'),
  );
  assert.match(html, /Skipped prescription/);
  assert.match(html, /Skipped seven/);
});

void test('recorded dates and deduplicated extra runs remain separate from scheduled prescriptions', () => {
  const feedback = {
    actualDate: addDays(start, 1),
    actualMinutes: 42,
    actualKm: 6,
    effort: 3,
    feeling: 'good',
    note: 'Ran on Tuesday',
    recordedAt: '2026-09-22T12:00:00Z',
    activityId: 'same-activity',
  };
  const fixture = plan({
    workouts: [workout({ status: 'completed', feedback })],
    extraRuns: [
      {
        id: 'duplicate',
        date: start,
        minutes: 42,
        km: 6,
        effort: 3,
        feeling: 'good',
        note: 'Do not duplicate this import',
        recordedAt: feedback.recordedAt,
        activityId: 'same-activity',
      },
      {
        id: 'extra',
        date: addDays(start, 2),
        minutes: 20,
        km: null,
        effort: 2,
        feeling: 'okay',
        note: 'Distance unknown',
        recordedAt: feedback.recordedAt,
      },
    ],
  });
  const html = trainingPlanHtml(fixture);
  const tuesday = html.slice(
    html.indexOf(`data-date="${addDays(start, 1)}"`),
    html.indexOf(`data-date="${addDays(start, 2)}"`),
  );
  assert.match(
    tuesday,
    /Completed: Easy run \(scheduled Monday, 21 Sept 2026\)/,
  );
  assert.match(tuesday, /42m · 6 km/);
  assert.doesNotMatch(tuesday, /Rest day/);
  assert.match(html, /5 km scheduled training/);
  assert.match(
    html,
    /Recorded training: 1h 2m · 6 km \(1 run has no distance recorded; distance total is incomplete\)/,
  );
  assert.doesNotMatch(html, /Do not duplicate this import/);
  assert.match(html, /Additional recorded run/);
  assert.match(html, /Distance not recorded/);
});

void test('supporting activities and history outside the block are retained without adding running mileage', () => {
  const fixture = plan();
  fixture.profile.goal = 'base';
  fixture.profile.crossTraining = [
    { day: 3, activity: 'mobility', minutes: 20 },
  ];
  fixture.extraRuns = [
    {
      id: 'outside',
      date: addDays(start, -2),
      minutes: 40,
      km: 6,
      effort: 3,
      feeling: 'good',
      note: '',
      recordedAt: '2026-09-19T12:00:00Z',
    },
  ];
  const html = trainingPlanHtml(fixture);
  assert.match(html, /Optional: Gentle mobility/);
  assert.match(html, /No running scheduled/);
  assert.match(html, /Saved sessions outside the plan dates/);
  assert.match(html, /Saturday, 19 Sept 2026 · Recorded run/);
  assert.match(html, /5 km scheduled training/);
  assert.doesNotMatch(html, /11 km scheduled training/);
});

void test('mile preferences convert event and pace displays while track repetitions retain authored metres', () => {
  const fixture = plan({
    workouts: [
      workout({
        kind: 'intervals',
        steps: [
          step({
            kind: 'work',
            metres: 400,
            target: { mode: 'pace', low: 300, high: 320 },
          }),
        ],
      }),
    ],
  });
  fixture.profile.units = 'mi';
  const html = trainingPlanHtml(fixture);
  assert.match(html, /400 m/);
  assert.match(html, /8:03–8:35 \/mi/);
  assert.match(html, /3\.10686 mi scheduled training/);
});

void test('all user text is escaped and the offline document contains no executable or external content', () => {
  const fixture = plan();
  const attack =
    '<img src="https://bad.example/x" onerror="alert(1)"><script>alert(2)</script>&';
  fixture.profile.name = attack;
  fixture.profile.raceName = attack;
  fixture.workouts[0].title = attack;
  fixture.workouts[0].purpose = attack;
  fixture.workouts[0].steps[0].label = attack;
  fixture.workouts[0].steps[0].effort = attack;
  fixture.notes = [attack];
  const html = trainingPlanHtml(fixture);
  assert.match(html, /&lt;img src=&quot;https:\/\/bad\.example/);
  assert.doesNotMatch(html, /<(?:script|img|link|iframe)\b/i);
  assert.doesNotMatch(html, /<[^>]+\s(?:src|href|onerror)=/i);
  assert.match(html, /default-src 'none'/);
  assert.equal(trainingPlanHtml(fixture), html);
});

void test('invalid or reversed date ranges fail with a readable error', () => {
  for (const dates of [
    { startDate: 'not-a-date' },
    { raceDate: '2026-09-20' },
    { raceDate: '2026-02-30' },
  ]) {
    const fixture = plan();
    Object.assign(fixture.profile, dates);
    assert.throws(
      () => trainingPlanHtml(fixture),
      /Check the plan dates before printing/,
    );
  }
});

void test('browser printing uses an isolated iframe, cleans it up, and downloads remain self-contained', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  let printed = 0;
  let removed = 0;
  let clicked = 0;
  let afterPrint;
  let frame;
  let link;
  let downloaded;
  const timers = [];
  globalThis.window = { setTimeout: (callback) => timers.push(callback) };
  globalThis.document = {
    body: { appendChild: () => {} },
    createElement: (tag) => {
      if (tag === 'iframe') {
        frame = {
          attributes: {},
          style: {},
          setAttribute(key, value) {
            this.attributes[key] = value;
          },
          remove: () => removed++,
          contentWindow: {
            addEventListener: (event, callback) => {
              if (event === 'afterprint') afterPrint = callback;
            },
            focus: () => {},
            print: () => printed++,
          },
        };
        return frame;
      }
      link = { click: () => clicked++, remove: () => {} };
      return link;
    },
  };
  URL.createObjectURL = (blob) => {
    downloaded = blob;
    return 'blob:offline-plan';
  };
  URL.revokeObjectURL = () => {};
  try {
    printTrainingPlan(plan());
    assert.equal(frame.attributes.sandbox, 'allow-same-origin allow-modals');
    assert.match(frame.srcdoc, /<!doctype html>/);
    frame.onload();
    assert.equal(printed, 1);
    afterPrint();
    assert.equal(removed, 1);
    downloadTrainingPlan(plan());
    assert.equal(clicked, 1);
    assert.equal(link.download, 'stride-training-plan-2026-09-21.html');
    assert.equal(link.href, 'blob:offline-plan');
    assert.equal(downloaded.type, 'text/html;charset=utf-8');
    timers.forEach((callback) => callback());
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});
