import { roadOpeningFailures } from './road-overhaul-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makePlan,
  refreshWorkoutVariety,
  revisePreferences,
  validatePlan,
} from '../lib/engine.ts';
import { updateRunMeasure } from '../lib/run-distance.ts';
import { roadProfile } from './road-overhaul-cases.mjs';
import { dayAfter, weekdayQuality } from './road-overhaul-helpers.mjs';
import { referenceOrdinaryQualityCount } from '../scripts/short-race-reference-oracle.mjs';

const gap = (a, b) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
function assertSavedFrequency(plan, requested, asOf = plan.profile.startDate) {
  assert.equal(plan.profile.qualitySessions, requested);
  assert.equal(plan.profile.qualityMode, 'custom');
  for (const week of plan.weeks) {
    if (
      week.start < asOf ||
      week.phase === 'Recovery' ||
      gap(dayAfter(week.start, 6), plan.profile.raceDate) <=
        (plan.profile.goal === '5k' ? 6 : plan.profile.goal === '10k' ? 13 : 14)
    )
      continue;
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.status !== 'skipped',
    );
    assert.equal(
      runs.filter(weekdayQuality).length,
      referenceOrdinaryQualityCount(plan.profile, week.index, requested),
      `${plan.profile.goal}, week ${week.index + 1}: selected ${requested}`,
    );
  }
  assert.deepEqual(validatePlan(plan), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
}
function markCompletedBefore(plan, asOf) {
  for (const w of plan.workouts.filter(
    (w) => w.date < asOf && w.kind !== 'race',
  )) {
    w.status = 'completed';
    w.feedback = {
      actualDate: w.date,
      actualKm: w.estimatedKm,
      actualMinutes: w.minutes,
      effort: weekdayQuality(w) ? 6 : 3,
      feeling: 'good',
      execution: 'as-planned',
      executionSource: 'self-report',
      completedQualityMinutes: w.steps
        .filter((s) => s.kind === 'work' && s.intensity >= 4)
        .reduce((n, s) => n + s.seconds / 60, 0),
      note: 'Synthetic fulfilled session',
      recordedAt: `${w.date}T20:00:00Z`,
    };
  }
}

for (const goal of ['5k', '10k', 'half']) {
  for (const requested of [0, 1, 2]) {
    for (const withHistory of [false, true]) {
      test(`${goal} q${requested}: edits preserve frequency and ${withHistory ? 'recorded history' : 'opening baseline'}`, () => {
        const input = roadProfile(goal, 'advanced', requested, 18, {
          recentQualitySessions: 2,
          recentQualityMinutes: 40,
        });
        const plan = makePlan(input, input.startDate, false);
        const asOf = dayAfter(input.startDate, withHistory ? 21 : 0);
        if (withHistory) markCompletedBefore(plan, asOf);
        const before = structuredClone(plan);
        const prior = plan.workouts.filter((w) => w.date < asOf);
        const nextPlans = [
          refreshWorkoutVariety(plan, asOf),
          revisePreferences(plan, {}, asOf),
          revisePreferences(plan, { workoutVariety: 'familiar' }, asOf),
          revisePreferences(plan, { units: 'mi' }, asOf),
          updateRunMeasure(plan, 'time', asOf),
        ];
        for (const next of nextPlans) {
          assert.deepEqual(
            next.workouts.filter((w) => w.date < asOf),
            prior,
          );
          assertSavedFrequency(next, requested, asOf);
          assert.equal(next.profile.weeklyKm, input.weeklyKm);
          assert.equal(next.profile.longestKm, input.longestKm);
          if (!withHistory) {
            assert.deepEqual(roadOpeningFailures(next, input), []);
            assert.equal(
              next.workouts.find((w) => w.kind === 'long')?.estimatedKm,
              input.longestKm,
            );
          }
        }
        assert.deepEqual(
          plan,
          before,
          'edit functions mutated their supplied plan',
        );
      });
    }
  }

  test(`${goal}: explicit 0 → 1 → 2 → 0 review never loses or adds workouts`, () => {
    const input = roadProfile(goal, 'advanced', 0, 18, {
      recentQualitySessions: 2,
      recentQualityMinutes: 40,
    });
    let plan = makePlan(input, input.startDate, false);
    for (const count of [1, 2, 0]) {
      const before = structuredClone(plan);
      const next = revisePreferences(
        plan,
        { qualityMode: 'custom', qualitySessions: count },
        input.startDate,
      );
      assertSavedFrequency(next, count);
      assert.deepEqual(plan, before);
      plan = next;
    }
  });

  test(`${goal}: validation rejects a removed ordinary-week workout`, () => {
    const input = roadProfile(goal, 'advanced', 2);
    const plan = makePlan(input, input.startDate, false);
    const removed = plan.workouts.find(
      (w) => w.week === 1 && weekdayQuality(w),
    );
    assert.ok(removed);
    Object.assign(removed, {
      kind: 'easy',
      hard: false,
      title: 'Easy replacement',
      steps: [
        {
          label: 'Easy',
          kind: 'work',
          seconds: Math.round(removed.minutes * 60),
          intensity: 2,
          effort: 'Easy conversational running.',
        },
      ],
    });
    for (const key of [
      'templateId',
      'stimulus',
      'qualityMinutes',
      'targetWorkMinutes',
      'distanceEstimate',
    ])
      delete removed[key];
    assert.match(
      validatePlan(plan).join('\n'),
      /Week 2 needs exactly 2 complete weekday workouts/,
      'A structurally valid easy run cannot silently stand in for the second selected workout',
    );
  });

  test(`${goal}: a stale hard flag on easy running cannot satisfy workout frequency`, () => {
    const input = roadProfile(goal, 'advanced', 1);
    const plan = makePlan(input, input.startDate, false);
    const removed = plan.workouts.find(
      (w) => w.week === 1 && weekdayQuality(w),
    );
    assert.ok(removed);
    removed.steps = [
      {
        label: 'Easy',
        kind: 'work',
        seconds: Math.round(removed.minutes * 60),
        intensity: 2,
        effort: 'Easy conversational running.',
      },
    ];
    removed.qualityMinutes = 0;
    assert.match(
      validatePlan(plan).join('\n'),
      /Week 2 needs exactly 1 complete weekday workouts/,
      'Validation must inspect executable main work, not just a stale hard flag/template',
    );
  });
}
