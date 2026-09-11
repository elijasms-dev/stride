import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateTrainingPlan, roundKm } from './trainingEngine.ts';
import type { Goal, UserTrainingInput } from './types.ts';

describe('Training Engine Core Tests', () => {
  it('never drops an experienced runner below their baseline long run', () => {
    const input: UserTrainingInput = {
      goal: 'marathon',
      weeksUntilRace: 12,
      daysPerWeek: 5,
      currentLongRun: 18,
      currentWeeklyVolume: 50,
    };

    const plan = generateTrainingPlan(input);
    assert.ok(plan.weeks[0].longRunKm >= 18);
  });

  it('strictly outputs [Long, Speed, Tempo, Recovery, Recovery] for 5-day schedules', () => {
    const input: UserTrainingInput = {
      goal: 'half',
      weeksUntilRace: 8,
      daysPerWeek: 5,
      currentLongRun: 10,
    };

    const plan = generateTrainingPlan(input);
    const expectedTypes = ['long', 'speed', 'tempo', 'recovery', 'recovery'];

    for (const week of plan.weeks) {
      const runTypes = week.dailySplits.map((split) => split.type);
      assert.deepStrictEqual(runTypes, expectedTypes);
    }
  });

  it('ensures daily splits sum EXACTLY to total weekly volume', () => {
    const input: UserTrainingInput = {
      goal: '10k',
      weeksUntilRace: 6,
      daysPerWeek: 4,
      currentLongRun: 8,
      currentWeeklyVolume: 25.5,
    };

    const plan = generateTrainingPlan(input);

    for (const week of plan.weeks) {
      const sumOfSplits = roundKm(
        week.dailySplits.reduce((sum, day) => sum + day.km, 0),
        2
      );
      assert.strictEqual(sumOfSplits, week.weeklyTotalVolume);
    }
  });

  it('does not repeat the same speed workout template in consecutive 3-week blocks', () => {
    const input: UserTrainingInput = {
      goal: 'marathon',
      weeksUntilRace: 10,
      daysPerWeek: 5,
      currentLongRun: 15,
    };

    const plan = generateTrainingPlan(input);
    const speedHistory: string[] = [];

    for (const week of plan.weeks) {
      const speedWorkout = week.dailySplits.find((s) => s.type === 'speed');
      if (speedWorkout?.templateId) {
        speedHistory.push(speedWorkout.templateId);
      }
    }

    for (let i = 0; i < speedHistory.length; i++) {
      const window = speedHistory.slice(Math.max(0, i - 3), i);
      assert.ok(!window.includes(speedHistory[i]));
    }
  });
});

describe('50-Runner Edge Case Sweep', () => {
  it('executes 50 random runner scenarios without crashing or failing math constraints', () => {
    const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'ultra'];
    const daysList = [3, 4, 5, 6, 7] as const;

    for (let i = 1; i <= 50; i++) {
      const randomGoal = goals[i % goals.length];
      const randomDays = daysList[i % daysList.length];
      const randomWeeks = (i % 15) + 2;
      const randomLongRun = (i % 25) + 3;

      const input: UserTrainingInput = {
        goal: randomGoal,
        weeksUntilRace: randomWeeks,
        daysPerWeek: randomDays,
        currentLongRun: randomLongRun,
        currentWeeklyVolume: randomLongRun * 2.2,
      };

      const plan = generateTrainingPlan(input);
      assert.strictEqual(plan.weeks.length, randomWeeks);

      for (const week of plan.weeks) {
        const sumOfSplits = roundKm(
          week.dailySplits.reduce((sum, day) => sum + day.km, 0),
          2
        );
        assert.strictEqual(sumOfSplits, week.weeklyTotalVolume);
      }
    }
  });
});
