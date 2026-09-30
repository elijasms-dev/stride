import './ui-render-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveStepPacing } from '../lib/source-pacing.ts';
import { exportCalendar } from '../lib/calendar.ts';
import { trainingPlanHtml } from '../lib/plan-print.ts';
import { demoProfile } from '../lib/engine.ts';
import {
  initialPaceSettings,
  paceSettingsConfig,
} from '../lib/pace-settings.ts';
import { workoutStepTarget, targetLabel } from '../lib/workout-targets.ts';
import { intervalsWorkoutText } from '../lib/intervals-workout.ts';
import { encodeWorkout } from '../lib/fit.ts';
import { Decoder, Stream } from '@garmin/fitsdk';
const { RecentRaceFields } =
  await import('../components/recent-race-fields.tsx');

const p = {
  ...demoProfile('2026-09-28'),
  goal: '10k',
  recentRace: { distanceKm: 5, timeMinutes: 25, representative: true },
};
const easy = {
  id: 'source-settings-easy',
  date: '2026-10-12',
  originalDate: '2026-10-12',
  week: 2,
  title: 'Easy running',
  kind: 'easy',
  hard: false,
  status: 'planned',
  minutes: 30,
  estimatedKm: 5,
  purpose: 'Comfortable running',
  reason: 'Test fixture',
  steps: [
    {
      kind: 'aerobic',
      label: 'Easy',
      effort: 'Comfortable conversation',
      intensity: 2,
      seconds: 1800,
    },
  ],
};

test('source guidance is not copied into manual pace fields', () => {
  const draft = initialPaceSettings(p, [easy]);
  assert.equal(draft.rows.easy.mode, 'source');
  assert.equal(draft.rows.easy.low, '');
  assert.equal(draft.rows.easy.high, '');
  const saved = paceSettingsConfig(p, draft);
  assert.deepEqual(saved.overrides, {});
  assert.equal(
    workoutStepTarget(easy, easy.steps[0], { ...p, workoutTargets: saved }),
    undefined,
  );
});

test('changing one role leaves every other role inherited and reset removes only that override', () => {
  const draft = {
    goalTime: '',
    rows: {
      easy: { mode: 'pace', low: '6:00', high: '6:30' },
      'current-5k': { mode: 'source', low: '', high: '' },
    },
  };
  const saved = paceSettingsConfig(p, draft);
  assert.deepEqual(Object.keys(saved.overrides), ['easy']);
  assert.deepEqual(saved.overrides.easy, { mode: 'pace', low: 360, high: 390 });
  const withSaved = { ...p, workoutTargets: saved };
  const reset = paceSettingsConfig(withSaved, {
    goalTime: '',
    rows: { easy: { mode: 'source', low: '', high: '' } },
  });
  assert.deepEqual(reset.overrides, {});
  assert.deepEqual(p.recentRace, {
    distanceKm: 5,
    timeMinutes: 25,
    representative: true,
  });
});

test('a single entered pace stays a point through settings, UI, Intervals text and FIT', () => {
  const saved = paceSettingsConfig(p, {
    goalTime: '',
    rows: { easy: { mode: 'pace', low: '6:00', high: '' } },
  });
  const target = workoutStepTarget(easy, easy.steps[0], {
    ...p,
    workoutTargets: saved,
  });
  assert.equal(target.low, 360);
  assert.equal(target.high, 360);
  assert.equal(targetLabel(target), '6:00 /km');
  const workout = { ...easy, steps: [{ ...easy.steps[0], target }] };
  assert.match(intervalsWorkoutText(workout), /1800s 6:00\/km Pace/);
  assert.doesNotMatch(intervalsWorkoutText(workout), /6:00-6:00/);
  const decoded = new Decoder(
    Stream.fromByteArray(encodeWorkout(workout)),
  ).read();
  assert.deepEqual(decoded.errors, []);
  const step = decoded.messages.workoutStepMesgs[0];
  assert.equal(step.targetType, 'speed');
  assert.equal(step.customTargetValueLow, step.customTargetValueHigh);
});

test('mile editing preserves untouched canonical targets rather than repeatedly rounding them', () => {
  const profile = {
    ...p,
    units: 'mi',
    workoutTargets: {
      mode: 'automatic',
      overrides: { easy: { mode: 'pace', low: 360, high: 390 } },
    },
  };
  const draft = initialPaceSettings(profile, [easy]);
  const next = paceSettingsConfig(profile, draft);
  assert.deepEqual(next.overrides.easy, profile.workoutTargets.overrides.easy);
});

test('goal finish time remains separate and malformed edits are rejected', () => {
  const goal = paceSettingsConfig(p, { goalTime: '45:00', rows: {} });
  assert.equal(goal.goalTimeMinutes, 45);
  assert.equal(p.recentRace.timeMinutes, 25);
  for (const time of ['45', '1:99:00', '-10:00'])
    assert.throws(() => paceSettingsConfig(p, { goalTime: time, rows: {} }));
  for (const low of ['5.3', 'NaN', '4:99'])
    assert.throws(() =>
      paceSettingsConfig(p, {
        goalTime: '',
        rows: { easy: { mode: 'pace', low, high: '' } },
      }),
    );
});

test('reference result UI shows actual pace and confirmation rather than universal invented zones', () => {
  const html = renderToStaticMarkup(
    createElement(RecentRaceFields, {
      profile: p,
      onChange() {},
      asOf: '2026-09-28',
    }),
  );
  assert.match(html, /5:00/);
  assert.match(html, /reflects my current fitness/);
  assert.match(html, /not an easy-run target/);
  assert.doesNotMatch(html, /Estimated training paces/);
});

test('changing event never revives a previous event goal or hidden event override', () => {
  const profile = {
    ...p,
    workoutTargets: {
      mode: 'automatic',
      raceScope: 'marathon:',
      goalTimeMinutes: 240,
      overrides: {
        'goal-race': { mode: 'pace', low: 340, high: 350 },
        'current-race': { mode: 'pace', low: 330, high: 340 },
        easy: { mode: 'pace', low: 360, high: 390 },
      },
    },
  };
  const draft = initialPaceSettings(profile, [easy]);
  assert.equal(draft.goalTime, '');
  const next = paceSettingsConfig(profile, draft);
  assert.equal(next.goalTimeMinutes, undefined);
  assert.equal(next.overrides['goal-race'], undefined);
  assert.equal(next.overrides['current-race'], undefined);
  assert.deepEqual(next.overrides.easy, profile.workoutTargets.overrides.easy);
});

test('saved progressive instructions survive reload and appear identically in screen, print, calendar and watch exports', async () => {
  const { SessionSequence } =
    await import('../components/session-sequence.tsx');
  const step = {
    ...easy.steps[0],
    kind: 'work',
    intensity: 6,
    effort: 'Legacy generic tempo cue',
    paceInstruction: {
      sourceId: 'higdon-10k-intermediate',
      sourceVersion: 'public-2026-09-28',
      kind: 'progressive',
    },
  };
  const workout = { ...easy, kind: 'tempo', hard: true, steps: [step] };
  step.pacing = resolveStepPacing(workout, step, p);
  const saved = JSON.parse(JSON.stringify(workout));
  const guidance = step.pacing.guidance;
  const plan = {
    id: 'saved-source-export',
    createdAt: '2026-09-28T12:00:00Z',
    profile: p,
    workouts: [saved],
    notes: [],
    weeks: [
      {
        index: 2,
        start: '2026-10-12',
        phase: 'Build',
        targetKm: 5,
        longKm: 0,
        focus: '',
      },
    ],
  };
  const ui = renderToStaticMarkup(
    createElement(SessionSequence, { workout: saved, units: 'km' }),
  );
  assert.ok(ui.includes(guidance));
  const native = intervalsWorkoutText(saved);
  assert.ok(native.includes(guidance));
  assert.ok(native.includes('freeride'));
  const fit = new Decoder(Stream.fromByteArray(encodeWorkout(saved))).read();
  assert.deepEqual(fit.errors, []);
  assert.equal(fit.messages.workoutStepMesgs[0].notes, guidance);
  assert.equal(fit.messages.workoutStepMesgs[0].targetType, 'open');
  const calendar = exportCalendar(plan, '2026-10-12', 1).replace(/\r\n /g, '');
  assert.ok(calendar.includes(guidance.replace(/,/g, '\\,')));
  const print = trainingPlanHtml(plan, '2026-10-12');
  assert.ok(print.includes(guidance));
  for (const output of [ui, native, calendar, print])
    assert.ok(!output.includes(step.effort));
});
