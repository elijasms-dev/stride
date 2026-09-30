import './ui-render-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const {
  TrainingView,
  TrainingInsights,
  WorkoutGuide,
  PlanPreferences,
  ExtraRunForm,
} = await import('../components/training.tsx');
const { TrainingComparison } =
  await import('../components/training/training-comparison.tsx');
const { metrics } =
  await import('../components/training/comparison-metrics.ts');
const { TodayRoute } = await import('../components/app/today-route.tsx');
const { AppProvider } = await import('../components/app/app-context.tsx');
const { WeatherProvider } = await import('../components/weather-widget.tsx');
const { Tabs } = await import('../components/ui/tabs.tsx');
const { addDays, demoPlan, weekday } = await import('../lib/engine.ts');
const { calendarSessions, orderedCalendarSessions, focusedSession } =
  await import('../lib/day-sessions.ts');
const { DEFAULT_HOME_PREFERENCES } = await import('../lib/home-preferences.ts');

const today = '2026-09-14';
const plan = demoPlan(today);
const noop = () => {};
const props = {
  plan,
  today,
  isDemo: false,
  onPreferences: noop,
  onNew: noop,
  onWorkout: noop,
  onExtra: noop,
  onClose: noop,
  onAction: async () => {},
  busy: false,
  version: 4,
};
const render = (Component, patch = {}) =>
  renderToStaticMarkup(createElement(Component, { ...props, ...patch }));

function renderToday(saved, currentDate, selectedId) {
  const dayWorkouts = orderedCalendarSessions(
    calendarSessions(saved),
    currentDate,
  );
  const value = {
    plan: saved,
    today,
    currentDate,
    workout: focusedSession(dayWorkouts, selectedId),
    dayWorkouts,
    homePreferences: { ...DEFAULT_HOME_PREFERENCES, upcomingCount: 0 },
    motion: false,
    suggestion: null,
    setSelectedDate: noop,
    setSelectedSession: noop,
    setView: noop,
    showWorkout: noop,
    openModal: noop,
    setDismissed: noop,
  };
  return renderToStaticMarkup(
    createElement(
      Tabs,
      { value: 'today' },
      createElement(
        AppProvider,
        { value },
        createElement(WeatherProvider, null, createElement(TodayRoute)),
      ),
    ),
  );
}

function emptyTodayPlan() {
  const saved = structuredClone(plan);
  saved.workouts = [];
  saved.extraRuns = [];
  saved.profile.crossTraining = [];
  delete saved.returnState;
  return saved;
}

const selectedDayMarkup = (html) =>
  html.slice(
    html.indexOf('id="selected-day-workout"'),
    html.indexOf('class="today-below-session"'),
  );

test('training entry exports preserve overview, comparison and research order', () => {
  const html = render(TrainingView);
  const overview = html.indexOf('Your starting point');
  const compare = html.indexOf('Compare your options');
  const research = html.indexOf('How other plans are shaped');
  assert.ok(overview >= 0 && compare > overview && research > compare);
  assert.match(html, /class="training-baseline">/);
  assert.equal(
    (html.match(/class="training-section" hidden=""/g) ?? []).length,
    2,
  );
  assert.match(html, /Plan preferences/);
  assert.match(render(TrainingView, { isDemo: true }), /Build my plan/);
});

test('comparison tab preserves current and alternative training metrics', () => {
  const candidate = structuredClone(plan);
  const next = candidate.workouts.find((run) => run.kind !== 'race');
  next.minutes += 10;
  const current = metrics(plan, today);
  const alternative = metrics(candidate, today);
  const html = render(TrainingComparison, {
    section: 'compare',
    option: 'maintain',
    setOption: noop,
    selectedWeek: 0,
    setSelectedWeek: noop,
    compare: { plan: candidate, patch: { volume: 'maintain' }, error: '' },
    current,
    candidate: alternative,
    unit: plan.profile.units,
    scale: Math.max(current.peak, alternative.peak),
    trainingDisplay: (value) => Math.round(value).toLocaleString(),
  });
  assert.match(html, /Weekly training minutes/);
  assert.match(html, /Peak remaining training week/);
  assert.match(html, /Longest training run/);
  assert.match(html, /Quality sessions/);
  assert.match(html, /Total training time/);
  assert.match(html, /Review this option/);
  assert.ok(Math.abs(alternative.minutes - current.minutes - 10) < 1e-9);
});

test('training preferences retain preview-first form and busy protection', () => {
  const html = render(PlanPreferences);
  assert.match(html, /Choose your week. Preview the changes before saving./);
  assert.match(html, /Preview future changes/);
  assert.doesNotMatch(html, /Apply from/);
  assert.match(
    render(PlanPreferences, { busy: true }),
    /<fieldset disabled=""/,
  );
});

test('extra-run entry preserves manual, imported and correction modes', () => {
  assert.match(render(ExtraRunForm), /Log an extra run/);
  const imported = render(ExtraRunForm, {
    imported: {
      id: 'recording',
      date: today,
      movingTime: 3600,
      distance: 10000,
      source: 'Garmin',
    },
    onBackToRecordings: noop,
  });
  assert.match(imported, /Review this recording/);
  assert.match(imported, /Where does this recording belong/);
  assert.match(imported, /Back to recordings/);
  const correction = render(ExtraRunForm, {
    existing: {
      id: 'extra-run',
      date: today,
      minutes: 45,
      km: 8,
      effort: 5,
      feeling: 'good',
      note: 'Comfortable',
    },
  });
  assert.match(correction, /Correct your run/);
  assert.match(correction, /Reason for correction/);
  assert.match(correction, /Save correction/);
});

test('insights and workout-guide public entry points retain their content', () => {
  assert.match(render(TrainingInsights), /Your last four weeks/);
  assert.match(render(TrainingInsights), /Log an extra run/);
  assert.match(render(WorkoutGuide), /Inside the workouts/);
  assert.match(render(WorkoutGuide), /Workout purpose/);
});

test('today route preserves workout and rest-day presentations through app context', () => {
  const workout = plan.workouts[0];
  const training = renderToday(plan, workout.date);
  assert.match(selectedDayMarkup(training), /class="today-hero"/);
  assert.match(training, /Open workout/);
  assert.match(training, /aria-label="Saved session instructions"/);
  assert.match(training, /Your session, step by step/);
  assert.match(training, /<h1[^>]*>Week \d+ · [^<]+<\/h1>/);
  assert.match(training, /aria-label="Previous week"/);
  assert.match(training, /aria-label="Next week"/);
  assert.doesNotMatch(training, /Browse days|Choose any date|<select/);
  const rest = renderToday(emptyTodayPlan(), workout.date);
  assert.match(selectedDayMarkup(rest), /<h2>Rest day<\/h2>/);
  assert.match(rest, /No run scheduled. Make space to recover./);
  assert.match(rest, /href="#today-workout-details"/);
  assert.doesNotMatch(rest, /Open workout|Saved session instructions/);
});

test('empty dates before and after the block are plain notes without workout actions or scenes', () => {
  const saved = emptyTodayPlan();
  for (const [date, title] of [
    [addDays(saved.profile.startDate, -1), 'Before your plan'],
    [addDays(saved.profile.raceDate, 1), 'After your block'],
  ]) {
    const html = renderToday(saved, date);
    const selected = selectedDayMarkup(html);
    assert.ok(selected.includes(`<strong>${title}.</strong>`));
    assert.match(selected, /No run is scheduled for this date./);
    assert.doesNotMatch(selected, /<button|<a\b|<article|session-atmosphere/);
    assert.doesNotMatch(
      html,
      /Saved session instructions|class="today-session-details"/,
    );
  }
});

test('runs recorded outside the block remain visible instead of becoming boundary or rest notes', () => {
  for (const date of [
    addDays(plan.profile.startDate, -1),
    addDays(plan.profile.raceDate, 1),
  ]) {
    const saved = emptyTodayPlan();
    saved.extraRuns = [
      {
        id: 'boundary-extra',
        date,
        minutes: 37,
        km: 5,
        effort: 4,
        feeling: 'good',
        note: 'Saved outside the block',
        recordedAt: `${date}T12:00:00Z`,
      },
    ];
    const before = JSON.stringify(saved);
    const html = renderToday(saved, date);
    assert.match(selectedDayMarkup(html), /<h2>Run recorded<\/h2>/);
    assert.doesNotMatch(
      selectedDayMarkup(html),
      /Before your plan|After your block|Rest day/,
    );
    assert.match(html, /<h3>Extra run<\/h3>/);
    assert.match(html, /5 km recorded · 37m recorded/);
    assert.match(html, /Saved outside the block/);
    assert.equal(JSON.stringify(saved), before);
  }
});

test('an optional supporting activity stays optional and is explained below the rest-day hero', () => {
  const saved = emptyTodayPlan();
  const date = saved.profile.startDate;
  saved.profile.crossTraining = [
    { day: weekday(date), activity: 'mobility', minutes: 15 },
  ];
  const html = renderToday(saved, date);
  assert.match(selectedDayMarkup(html), /<h2>Rest day<\/h2>/);
  assert.match(selectedDayMarkup(html), /is optional; its details are below/);
  assert.match(html, /aria-label="Optional supporting activity"/);
  assert.match(html, /15m/);
  assert.doesNotMatch(html, /Open workout|Saved session instructions/);
});

test('split-session routes default to the remaining PM run and preserve the selected AM actuals', () => {
  const saved = emptyTodayPlan();
  const date = saved.profile.startDate;
  const am = {
    ...plan.workouts[0],
    id: 'am-recorded',
    date,
    week: 0,
    session: 'AM',
    startTime: '07:00',
    status: 'completed',
    title: 'Morning run',
    minutes: 99,
    feedback: {
      actualDate: date,
      actualMinutes: 31,
      actualKm: 3,
      effort: 3,
      feeling: 'good',
      note: 'Morning felt comfortable',
      recordedAt: `${date}T08:00:00Z`,
    },
  };
  const pm = {
    ...plan.workouts[0],
    id: 'pm-planned',
    date,
    week: 0,
    session: 'PM',
    startTime: '18:30',
    status: 'planned',
    title: 'Evening run',
    minutes: 42,
    purpose: 'Saved evening purpose',
    steps: [
      {
        kind: 'aerobic',
        seconds: 2520,
        effort: 'Conversational',
        label: 'Evening easy running',
      },
    ],
  };
  saved.workouts = [pm, am];
  const before = JSON.stringify(saved);
  const remaining = renderToday(saved, date);
  assert.match(remaining, /aria-label="Sessions for this day"/);
  assert.match(remaining, /aria-pressed="true">PM · 18:30 · 42m/);
  assert.match(selectedDayMarkup(remaining), /<h2>Evening run<\/h2>/);
  assert.match(remaining, /Saved evening purpose/);
  assert.match(remaining, /Evening easy running/);
  assert.match(remaining, /Morning felt comfortable/);

  const recorded = renderToday(saved, date, am.id);
  assert.match(recorded, /aria-pressed="true">AM · 07:00 · 31m recorded/);
  assert.match(selectedDayMarkup(recorded), /<h2>Morning run<\/h2>/);
  assert.match(selectedDayMarkup(recorded), /31m/);
  assert.match(selectedDayMarkup(recorded), /recorded distance/);
  assert.doesNotMatch(
    selectedDayMarkup(recorded),
    /1h 39m|km target|Open workout/,
  );
  assert.match(recorded, /How your run felt/);
  assert.match(
    recorded,
    /<details class="today-original-prescription"><summary>Original planned session/,
  );
  assert.match(recorded, /These saved instructions are not recorded results/);
  assert.equal(JSON.stringify(saved), before);
});

test('a skipped session remains inspectable with its reason and is never presented as a recorded run', () => {
  const saved = emptyTodayPlan();
  const date = saved.profile.startDate;
  saved.workouts = [
    {
      ...plan.workouts[0],
      date,
      week: 0,
      status: 'skipped',
      skipReason: 'Needed extra recovery',
    },
  ];
  const html = renderToday(saved, date);
  assert.match(selectedDayMarkup(html), /View skipped run/);
  assert.match(
    html,
    /This session is marked skipped. It is not a recorded run./,
  );
  assert.match(html, /Needed extra recovery/);
  assert.match(html, /Skipped session’s original plan/);
  assert.doesNotMatch(
    html,
    /aria-label="Recorded run details"|<h2>Run recorded/,
  );
});

test('inline completed-run details preserve execution feedback and explicitly recorded zero quality work', () => {
  for (const [execution, label, qualityMinutes] of [
    ['partial', 'Completed some of the intended work', 7],
    ['easy-substitute', 'Ran easy instead', 0],
    ['not-attempted', 'Did not attempt the work', 0],
  ]) {
    const saved = emptyTodayPlan();
    const date = saved.profile.startDate;
    saved.workouts = [
      {
        ...plan.workouts[0],
        date,
        week: 0,
        kind: 'intervals',
        hard: true,
        status: 'completed',
        feedback: {
          actualDate: date,
          actualMinutes: 31,
          actualKm: 3,
          effort: 3,
          feeling: 'okay',
          note: 'Saved execution feedback',
          recordedAt: `${date}T08:00:00Z`,
          execution,
          completedQualityMinutes: qualityMinutes,
        },
      },
    ];
    const before = JSON.stringify(saved);
    const html = renderToday(saved, date);
    const observations = html.match(
      /<section[^>]+aria-label="Recorded run details"[\s\S]*?<\/section>/,
    )?.[0];
    assert.ok(observations, 'completed-run feedback is available inline');
    assert.ok(
      observations.includes(`<dt>Session execution</dt><dd>${label}</dd>`),
    );
    assert.ok(
      observations.includes(
        `<dt>Quality work recorded</dt><dd>${qualityMinutes}m</dd>`,
      ),
    );
    assert.match(observations, /Saved execution feedback/);
    assert.doesNotMatch(observations, /Completed the intended work/);
    assert.match(
      html,
      /<details class="today-original-prescription"><summary>Original planned session/,
    );
    assert.equal(JSON.stringify(saved), before);
  }
});

test('marathon preferences retain selectable zero, one and two workout options', () => {
  for (const qualityMode of ['automatic', 'custom']) {
    const saved = {
      ...plan,
      profile: {
        ...plan.profile,
        goal: 'marathon',
        experience: 'established',
        method: 'balanced',
        intent: 'improve',
        weeklyKm: 70,
        currentRuns: 5,
        runsPerWeek: 5,
        days: [0, 1, 2, 3, 5],
        availableDays: [0, 1, 2, 3, 4, 5, 6],
        longDay: 5,
        qualityMode,
        qualitySessions: 2,
        recentQualitySessions: 2,
      },
    };
    const html = render(PlanPreferences, { plan: saved });
    const frequency = html.slice(
      html.indexOf('class="plan-workout-choice"'),
      html.indexOf('class="plan-schedule-picker"'),
    );
    assert.match(frequency, /Harder workouts per week/);
    for (const count of [0, 1, 2])
      assert.match(frequency, new RegExp(`value="${count}"`));
    assert.doesNotMatch(frequency, /disabled=""|aria-disabled="true"/);
    assert.match(
      frequency,
      new RegExp(
        `checked="" value="${qualityMode === 'custom' ? 2 : 'automatic'}"`,
      ),
    );
  }
});

test('an unrelated preference preview preserves the selected workout count and variety', async (t) => {
  const { usePlanPreferences } =
    await import('../components/training/use-plan-preferences.ts');
  const saved = {
    ...plan,
    profile: {
      ...plan.profile,
      qualityMode: 'custom',
      qualitySessions: 2,
      workoutVariety: 'familiar',
    },
  };
  const original = JSON.stringify(saved);
  const submitted = [];
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    if (path === '/api/account')
      return Response.json({ accountId: 'frequency-test', accountEpoch: 1 });
    assert.equal(path, '/api/plan');
    submitted.push(JSON.parse(init.body));
    return Response.json({ plan: saved, version: 4, effectiveDate: today });
  });
  let state;
  function Harness() {
    // oxlint-disable-next-line react/react-compiler -- Capture the hook API once for the server-render interaction test.
    state = usePlanPreferences({
      ...props,
      plan: saved,
      initialPatch: { terrain: 'hills' },
    });
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  await state.previewPreferences({ preventDefault: noop });
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].action, 'preferencesPreview');
  assert.equal(submitted[0].preferences.terrain, 'hills');
  assert.equal(submitted[0].preferences.qualityMode, 'custom');
  assert.equal(submitted[0].preferences.qualitySessions, 2);
  assert.equal(submitted[0].preferences.workoutVariety, 'familiar');
  assert.equal(JSON.stringify(saved), original);
});
