import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTrainingPlan,
  reconcileDailySplits,
  scaleWorkout,
  TrainingEngineError,
  WORKOUT_TEMPLATES,
} from '../lib/trainingEngine.ts';
import type { Goal, UserTrainingInput } from '../lib/types.ts';

const marathonFourWeek: UserTrainingInput = {
  currentLongRun: 18,
  currentWeeklyVolume: 55,
  weeksUntilRace: 4,
  daysPerWeek: 5,
  goal: 'marathon',
};

void describe('Short Marathon Test', () => {
  void test('4-week marathon preserves its starting baseline, uses integer steps and tapers', () => {
    const plan = generateTrainingPlan(marathonFourWeek);
    assert.equal(plan.week1LongRunKm, 18);
    assert.ok(plan.weeks[0].longRunKm >= 18);

    for (const week of plan.weeks) {
      assert.ok(Number.isInteger(week.longRunKm));
      if (week.phase === 'build' || week.phase === 'peak')
        assert.ok(week.longRunKm >= 18);
    }

    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1].longRunKm;
      const curr = plan.weeks[i].longRunKm;
      const gain = curr - prev;
      assert.ok(gain <= 2 + 1e-9);
      assert.ok(Number.isInteger(gain));
    }

    const peakWeek = plan.weeks.find((week) => week.phase === 'peak');
    assert.ok(peakWeek);
    assert.ok(peakWeek.weekNumber >= plan.weeksUntilRace - 3);
    assert.ok(peakWeek.weekNumber <= plan.weeksUntilRace - 2);
    assert.ok(plan.peakLongRunAchievedKm >= 18);
    assert.ok(plan.peakLongRunAchievedKm <= 18 + 2 + 1e-9);

    const raceWeek = plan.weeks.at(-1)!;
    assert.equal(raceWeek.phase, 'race-week');
    const w2 = plan.weeks[plan.weeks.length - 3];
    const w1 = plan.weeks[plan.weeks.length - 2];
    assert.ok(w2.volumeFraction >= 0.6 && w2.volumeFraction <= 0.7);
    assert.equal(w1.volumeFraction, 0.4);
  });
});

void describe('Schedule Enforcement Test', () => {
  void test('5-day schedule is exactly 1 long, 1 speed, 1 tempo, 2 recovery', () => {
    const plan = generateTrainingPlan({
      currentLongRun: 16,
      currentWeeklyVolume: 48,
      weeksUntilRace: 8,
      daysPerWeek: 5,
      goal: 'half',
    });

    for (const week of plan.weeks) {
      const types = week.dailySplits.map((day) => day.type);
      assert.deepEqual(types, [
        'long',
        'speed',
        'tempo',
        'recovery',
        'recovery',
      ]);
      assert.equal(
        week.dailySplits.filter((day) => day.type === 'long').length,
        1,
      );
      assert.equal(
        week.dailySplits.filter((day) => day.type === 'speed').length,
        1,
      );
      assert.equal(
        week.dailySplits.filter((day) => day.type === 'tempo').length,
        1,
      );
      assert.equal(
        week.dailySplits.filter((day) => day.type === 'recovery').length,
        2,
      );
      assert.equal(
        week.dailySplits.some((day) => day.title === 'Easy run'),
        false,
      );
      for (const recovery of week.dailySplits.filter(
        (day) => day.type === 'recovery',
      )) {
        assert.equal(recovery.title, 'Recovery run');
      }
    }
  });
});

void describe('Math Integrity Test', () => {
  void test('20 input combinations keep sum(dailySplits) === weeklyTotalVolume within 0.001', () => {
    const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'ultra'];
    const cases: UserTrainingInput[] = [];
    for (let i = 0; i < 20; i++) {
      cases.push({
        currentLongRun: 8 + (i % 12) * 1.7,
        currentWeeklyVolume: 25 + i * 3.25,
        weeksUntilRace: 2 + (i % 14),
        daysPerWeek: ([3, 4, 5, 6, 7] as const)[i % 5],
        goal: goals[i % goals.length],
      });
    }

    assert.equal(cases.length, 20);

    for (const input of cases) {
      const plan = generateTrainingPlan(input);
      for (const week of plan.weeks) {
        const sum = week.dailySplits.reduce((total, day) => total + day.km, 0);
        assert.ok(
          Math.abs(sum - week.weeklyTotalVolume) <= 0.001,
          `week ${week.weekNumber} ${input.goal}/${input.daysPerWeek}d: ${sum} vs ${week.weeklyTotalVolume}`,
        );
      }
    }
  });

  void test('remainder from 2-decimal rounding lands on the last recovery run', () => {
    const splits = [12.345, 6.111, 7.222, 4.001, 3.333];
    const total = 33.01;
    const next = reconcileDailySplits(splits, total);
    assert.equal(next.length, 5);
    const sum = next.reduce((totalKm, km) => totalKm + km, 0);
    assert.ok(Math.abs(sum - total) <= 0.001);
    const head = next.slice(0, 4).reduce((totalKm, km) => totalKm + km, 0);
    assert.equal(next[4], Math.round((total - head) * 100) / 100);
  });
});

void describe('History Anti-Repetition Test', () => {
  void test('no tempo template ID repeats inside any 3-week window', () => {
    const plan = generateTrainingPlan({
      currentLongRun: 22,
      currentWeeklyVolume: 70,
      weeksUntilRace: 12,
      daysPerWeek: 5,
      goal: 'marathon',
    });

    const tempoIds = plan.weeks.map(
      (week) =>
        week.dailySplits.find((day) => day.type === 'tempo')?.templateId,
    );
    for (const id of tempoIds) {
      assert.ok(id);
    }

    for (let start = 0; start <= tempoIds.length - 3; start++) {
      const window = tempoIds.slice(start, start + 3);
      assert.equal(new Set(window).size, 3);
    }
  });
});

void describe('Validation and parametric scaling', () => {
  void test('throws for weeksUntilRace < 2', () => {
    assert.throws(
      () =>
        generateTrainingPlan({
          ...marathonFourWeek,
          weeksUntilRace: 1,
        }),
      (error: unknown) =>
        error instanceof TrainingEngineError && error.code === 'INVALID_WEEKS',
    );
  });

  void test('throws for currentLongRun <= 0', () => {
    assert.throws(
      () =>
        generateTrainingPlan({
          ...marathonFourWeek,
          currentLongRun: 0,
        }),
      (error: unknown) =>
        error instanceof TrainingEngineError &&
        error.code === 'INVALID_LONG_RUN',
    );
    assert.throws(
      () =>
        generateTrainingPlan({
          ...marathonFourWeek,
          currentLongRun: -4,
        }),
      TrainingEngineError,
    );
  });

  void test('scaleWorkout hits targetKm with ratio-based reps', () => {
    const template = WORKOUT_TEMPLATES.speed[0];
    const scaled = scaleWorkout(10, template);
    assert.ok(Math.abs(scaled.totalKm - 10) <= 0.001);
    assert.ok(scaled.reps >= (template.minReps ?? 1));
    assert.ok(scaled.warmupKm / scaled.targetKm >= 0.14);
    assert.ok(scaled.warmupKm / scaled.targetKm <= 0.21);
    assert.ok(scaled.cooldownKm / scaled.targetKm >= 0.14);
    assert.ok(scaled.mainKm / scaled.targetKm >= 0.58);
    assert.ok(scaled.mainKm / scaled.targetKm <= 0.72);
  });

  void test('Week 1 long run never drops a high baseline toward a 5K default', () => {
    const plan = generateTrainingPlan({
      currentLongRun: 24,
      currentWeeklyVolume: 80,
      weeksUntilRace: 6,
      daysPerWeek: 5,
      goal: '5k',
    });
    assert.ok(plan.weeks[0].longRunKm >= 24);
    assert.equal(plan.week1LongRunKm, 24);
  });
});
