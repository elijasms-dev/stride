import assert from 'node:assert/strict';
import { addDays, taperFactor, validatePlan } from '../lib/engine.ts';
import { weekdayQuality } from './road-overhaul-helpers.mjs';

const close = (actual, expected, message, tolerance = 0.02) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
  );
const day = (date) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
const quality = (w) =>
  w.stimulus === 'aerobic'
    ? 0
    : w.steps.reduce(
        (sum, s) =>
          sum +
          (s.kind === 'work' && s.intensity >= 4
            ? (s.metres !== undefined && s.target?.mode === 'pace'
                ? (s.metres * s.target.high) / 1000
                : s.seconds) / 60
            : 0),
        0,
      );

/** Independent semantic checks accompanying the reviewed snapshot version.
 * These use the declared inputs, executable endpoints and explicit role ratios;
 * no selector, allocator or production balance-cap helper is used as an oracle. */
export function assertMarathonTraining(plan, input) {
  assert.deepEqual(validatePlan(plan), []);
  for (const key of [
    'weeklyKm',
    'longestKm',
    'currentRuns',
    'runsPerWeek',
    'startDate',
    'raceDate',
  ])
    if (input[key] !== undefined)
      assert.equal(plan.profile[key], input[key], key);
  const p = plan.profile;
  const first = plan.weeks.find((w) => w.start >= p.startDate);
  // All historical marathon fixtures have feasible declared opening baselines.
  // Dedicated balance regressions cover honestly disclosed constrained starts.
  close(first.targetKm, p.weeklyKm, 'Declared opening weekly distance');
  close(first.longKm, p.longestKm, 'Declared opening long run');
  let longAnchor = p.longestKm;
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    const minutes = runs.reduce((sum, w) => sum + w.minutes, 0);
    const km = runs.reduce((sum, w) => sum + w.estimatedKm, 0);
    close(week.trainingMinutes, minutes, 'Weekly executable minutes');
    close(week.targetKm, km, 'Weekly executable distance', 0.051);
    const dose = runs.reduce((sum, w) => sum + quality(w), 0);
    close(week.qualityMinutes, dose, 'Weekly executable quality dose');
    assert.ok(
      dose <= minutes * 0.22 + 0.02,
      'Quality load remains within its allocation',
    );
    assert.ok(
      km <= p.weeklyKm * 1.4 + 0.002,
      'No recipe increases the forecast ceiling',
    );
    const long = runs.find((w) => w.kind === 'long');
    const ordinary =
      week.start >= p.startDate &&
      addDays(week.start, 6) < p.raceDate &&
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      runs.every((w) => taperFactor(p, w.date) === 1);
    if (ordinary) {
      assert.equal(runs.length, p.runsPerWeek, 'Selected running days');
      assert.equal(
        runs.filter(weekdayQuality).length,
        p.qualitySessions,
        'Selected weekday workout count',
      );
      assert.ok(long);
      assert.ok(
        long.estimatedKm >= longAnchor && long.estimatedKm <= 35,
        'Non-recovery long progression',
      );
      if (week !== first)
        assert.ok(
          Number.isInteger(long.estimatedKm),
          'Progressed long runs use whole kilometres',
        );
      longAnchor = long.estimatedKm;
    }
    for (const w of runs) {
      close(
        w.minutes,
        w.steps.reduce((sum, s) => sum + s.seconds, 0) / 60,
        'Session executable duration',
        1e-9,
      );
      const dayLimit =
        p.dayPreferences?.find((d) => d.day === day(w.date))?.maxMinutes ??
        Infinity;
      assert.ok(
        w.minutes <=
          Math.min(
            dayLimit,
            w.kind === 'long' ? p.longMinutes : p.weekdayMinutes,
          ) +
            1 / 60 +
            1e-9,
        'Session/day time capacity',
      );
      close(
        w.qualityMinutes ?? 0,
        quality(w),
        'Session executable quality dose',
      );
      if (ordinary && w.kind === 'easy' && !w.hard) {
        const gap = (day(w.date) - day(long.date) + 7) % 7;
        const ratio =
          w.role === 'medium-long'
            ? 0.9
            : gap === 1 || gap === 6 || p.days.includes((day(w.date) + 1) % 7)
              ? 0.65
              : 0.8;
        assert.ok(
          w.estimatedKm <= long.estimatedKm * ratio + 0.001 ||
            w.minutes <= 5 + 1 / 60,
          'Supporting run retains its shorter role',
        );
      }
      for (const step of w.steps)
        if (step.metres !== undefined && step.target?.mode === 'pace')
          close(
            step.seconds,
            (step.metres * step.target.high) / 1000,
            'Distance endpoint planning pace',
            1,
          );
      if (
        w.steps.every(
          (s) => s.metres !== undefined || s.target?.mode === 'pace',
        )
      ) {
        const endpoint = (key) =>
          w.steps.reduce(
            (n, s) =>
              n +
              (s.metres !== undefined
                ? s.metres / 1000
                : s.seconds / s.target[key]),
            0,
          );
        assert.ok(
          w.estimatedKm >= endpoint('high') - 0.02 &&
            w.estimatedKm <= endpoint('low') + 0.02,
          'Funded metres fit executable target range',
        );
      }
    }
  }
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))), []);
}
