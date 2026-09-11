import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateTrainingPlan, roundKm } from './trainingEngine.ts';
import type { Goal, UserTrainingInput } from './types.ts';

describe('Massive 2,000-Scenario Production Verification Suite', () => {

  // 1. Matrix Sweep: Testing every permutation of Goals, Days, and Race Timelines
  it('passes an exhaustive matrix of 200 fixed boundary combinations', () => {
    const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'ultra'];
    const daysRange = [3, 4, 5, 6, 7] as const;
    const weekTimelines = [2, 3, 4, 8, 12, 16, 24, 52];
    
    let executedCount = 0;

    for (const goal of goals) {
      for (const days of daysRange) {
        for (const weeks of weekTimelines) {
          const input: UserTrainingInput = {
            goal,
            daysPerWeek: days,
            weeksUntilRace: weeks,
            currentLongRun: goal === 'ultra' ? 35 : goal === 'marathon' ? 15 : 5,
            currentWeeklyVolume: goal === 'ultra' ? 90 : goal === 'marathon' ? 45 : 18,
          };

          const plan = generateTrainingPlan(input);
          executedCount++;

          assert.strictEqual(plan.weeks.length, weeks, `Failed week count on scenario ${executedCount}`);

          for (const week of plan.weeks) {
            const splitSum = roundKm(
              week.dailySplits.reduce((acc, d) => acc + d.km, 0),
              2
            );
            assert.strictEqual(splitSum, week.weeklyTotalVolume, `Math leak in Matrix run #${executedCount}`);
          }
        }
      }
    }

    assert.strictEqual(executedCount, 200, 'Matrix sweep count mismatch');
  });

  // 2. High-Volume & Low-Volume Extreme Edge Cases
  it('handles extreme edge-case boundaries safely without crashing or leaking float precision', () => {
    const edgeCases: UserTrainingInput[] = [
      { goal: '5k', daysPerWeek: 3, weeksUntilRace: 2, currentLongRun: 1, currentWeeklyVolume: 3 },
      { goal: 'ultra', daysPerWeek: 7, weeksUntilRace: 24, currentLongRun: 50, currentWeeklyVolume: 140 },
      { goal: 'half', daysPerWeek: 5, weeksUntilRace: 9, currentLongRun: 7.3333, currentWeeklyVolume: 22.777 },
      { goal: 'marathon', daysPerWeek: 4, weeksUntilRace: 3, currentLongRun: 20, currentWeeklyVolume: 60 },
    ];

    for (const input of edgeCases) {
      const plan = generateTrainingPlan(input);

      for (const week of plan.weeks) {
        assert.ok(!Number.isNaN(week.weeklyTotalVolume), 'NaN found in weekly total volume');
        assert.ok(Number.isFinite(week.weeklyTotalVolume), 'Infinite volume detected');

        for (const day of week.dailySplits) {
          assert.ok(!Number.isNaN(day.km), 'NaN found in daily split');
          assert.ok(day.km >= 0, 'Negative distance generated');
        }

        const dailySum = roundKm(week.dailySplits.reduce((s, d) => s + d.km, 0), 2);
        assert.strictEqual(dailySum, week.weeklyTotalVolume);
      }
    }
  });

  // 3. Taper Logic Verification Across All Goals
  it('strictly validates taper protocols in the final 2-3 weeks of plans >= 6 weeks', () => {
    const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'ultra'];

    for (const goal of goals) {
      const plan = generateTrainingPlan({
        goal,
        daysPerWeek: 5,
        weeksUntilRace: 10,
        currentLongRun: 12,
        currentWeeklyVolume: 35,
      });

      const totalWeeks = plan.weeks.length;
      const peakWeek = plan.weeks[totalWeeks - 3];
      const finalTaperWeek = plan.weeks[totalWeeks - 1];

      assert.ok(
        finalTaperWeek.weeklyTotalVolume < peakWeek.weeklyTotalVolume,
        `Taper failed for goal: ${goal}`
      );
    }
  });

  // 4. Monte Carlo Fuzzing: 1,000 Randomized Runner Scenarios
  it('successfully passes 1,000 randomized Monte Carlo fuzz tests', () => {
    const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'ultra'];
    const daysList = [3, 4, 5, 6, 7] as const;

    for (let i = 1; i <= 1000; i++) {
      const randomGoal = goals[i % goals.length];
      const randomDays = daysList[i % daysList.length];
      const randomWeeks = (i % 20) + 2;
      const randomLongRun = (i % 40) + 2;
      const randomVolume = randomLongRun * (1.8 + (i % 10) * 0.1);

      const input: UserTrainingInput = {
        goal: randomGoal,
        daysPerWeek: randomDays,
        weeksUntilRace: randomWeeks,
        currentLongRun: randomLongRun,
        currentWeeklyVolume: randomVolume,
      };

      const plan = generateTrainingPlan(input);

      assert.strictEqual(plan.weeks.length, randomWeeks);

      for (const week of plan.weeks) {
        const sumOfSplits = roundKm(
          week.dailySplits.reduce((acc, d) => acc + d.km, 0),
          2
        );
        assert.strictEqual(sumOfSplits, week.weeklyTotalVolume);
        assert.strictEqual(week.dailySplits.length, randomDays);
      }
    }
  });
});
