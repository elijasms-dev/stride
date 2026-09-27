import { isDeepStrictEqual } from 'node:util';
import { makePlan, validatePlan } from '../lib/engine.ts';
import {
  dayAfter,
  weekdayQuality,
  roadOpeningFailures,
} from './road-overhaul-helpers.mjs';
import { ROAD_DISTANCES } from './road-overhaul-cases.mjs';

const gap = (a, b) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
const close = (a, b, tolerance = 0.00101) => Math.abs(a - b) <= tolerance;
const weekday = (date) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

export function independentRoadChecks(plan, input) {
  const failures = roadOpeningFailures(plan, input),
    p = plan.profile;
  const check = (ok, message) => {
    if (!ok) failures.push(message);
  };
  const taperDays = input.goal === 'half' ? 14 : 7;
  const longCeiling = { '5k': 14, '10k': 16, half: 23 }[input.goal];
  // Literal reviewed contracts, deliberately independent of the implementation
  // helper: runner ability follows existing volume/frequency, never pace.
  const developing =
    input.experience !== 'established' ||
    input.currentRuns < 4 ||
    input.weeklyKm < { '5k': 20, '10k': 25, half: 35 }[input.goal];
  const advanced =
    !developing &&
    input.currentRuns >= 5 &&
    input.weeklyKm >= (input.goal === 'half' ? 55 : 45) &&
    input.longestKm >= { '5k': 10, '10k': 12, half: 16 }[input.goal];
  const abilityIndex = developing ? 0 : advanced ? 2 : 1;
  const qualityCap = {
    '5k': [50, 65, 80],
    '10k': [55, 70, 85],
    half: [60, 80, 95],
  }[input.goal][abilityIndex];
  const aerobicCap = [10, 15, 20][abilityIndex];
  const weeklyMultiplier = [1.65, 1.45, 1.3][abilityIndex];
  const requested = input.qualitySessions ?? 1;
  check(
    p.qualityMode === input.qualityMode && p.qualitySessions === requested,
    `Saved workout choice changed from ${input.qualityMode}/${requested} to ${p.qualityMode}/${p.qualitySessions}`,
  );
  const races = plan.workouts.filter((w) => w.kind === 'race');
  check(
    races.length === 1 && races[0].date === input.raceDate,
    'Race must occur exactly once, on the selected race date',
  );
  if (races[0])
    check(
      close(races[0].estimatedKm, ROAD_DISTANCES[input.goal]),
      'Race distance changed',
    );
  check(
    validatePlan(plan).length === 0,
    `validatePlan: ${validatePlan(plan).join('; ')}`,
  );
  check(
    validatePlan(JSON.parse(JSON.stringify(plan))).length === 0,
    'Serialization breaks validation',
  );
  let lastOrdinaryLong, lastOrdinaryWeekly;
  const weeks = plan.weeks.map((week) => {
    const runs = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    const sumKm = runs.reduce((sum, w) => sum + w.estimatedKm, 0);
    const sumMinutes = runs.reduce((sum, w) => sum + w.minutes, 0);
    const longs = runs.filter((w) => w.kind === 'long');
    const quality = runs.filter(weekdayQuality);
    const longKm = longs[0]?.estimatedKm ?? null;
    const ordinary =
      week.start >= input.startDate &&
      gap(dayAfter(week.start, 6), input.raceDate) > taperDays &&
      week.phase !== 'Recovery';
    // Week.targetKm is the existing one-decimal display aggregate; per-session
    // allocations retain metre precision and opening checks use their sum.
    check(
      close(week.targetKm, sumKm, 0.050001),
      `Week ${week.index + 1}: stored distance disagrees with actual sessions`,
    );
    check(
      close(week.trainingMinutes ?? sumMinutes, sumMinutes, 0.11),
      `Week ${week.index + 1}: stored minutes disagree with actual sessions`,
    );
    check(
      sumKm <=
        input.weeklyKm * (input.volume === 'maintain' ? 1 : weeklyMultiplier) +
          0.00101,
      `Week ${week.index + 1}: weekly load exceeds the ability-based forecast ceiling`,
    );
    check(longs.length <= 1, `Week ${week.index + 1}: multiple long runs`);
    check(
      new Set(runs.map((w) => w.date)).size <= input.runsPerWeek,
      `Week ${week.index + 1}: extra running days added`,
    );
    if (input.weeklyMinutesLimit != null)
      check(
        sumMinutes <= input.weeklyMinutesLimit + 1 / 60,
        `Week ${week.index + 1}: weekly time limit exceeded`,
      );
    if (week.phase === 'Taper')
      check(
        gap(week.start, input.raceDate) <= taperDays,
        `Week ${week.index + 1}: whole week labelled taper before its true start`,
      );
    if (week.index === 0 && ordinary) {
      if (input.runsPerWeek >= 3)
        check(
          close(longKm, input.longestKm),
          `Opening long run ${longKm} differs from declared ${input.longestKm}`,
        );
    }
    if (ordinary) {
      check(
        quality.length === requested,
        `Week ${week.index + 1}: requested ${requested} weekday workouts, received ${quality.length}`,
      );
      check(
        new Set(runs.map((w) => w.date)).size === input.runsPerWeek,
        `Week ${week.index + 1}: expected ${input.runsPerWeek} running days`,
      );
      if (input.runsPerWeek >= 3) {
        check(longKm !== null, `Week ${week.index + 1}: missing long run`);
        if (longKm !== null && lastOrdinaryLong !== undefined) {
          check(
            longKm >= lastOrdinaryLong - 0.001,
            `Week ${week.index + 1}: unmarked long-run decline ${lastOrdinaryLong} -> ${longKm}`,
          );
          check(
            longKm <= lastOrdinaryLong + 2.001,
            `Week ${week.index + 1}: long run jumps more than 2 km: ${lastOrdinaryLong} -> ${longKm}`,
          );
        }
      }
      if (lastOrdinaryWeekly !== undefined)
        check(
          sumKm >= lastOrdinaryWeekly - 0.00101,
          `Week ${week.index + 1}: unmarked weekly decline ${lastOrdinaryWeekly} -> ${sumKm}`,
        );
      lastOrdinaryLong = longKm ?? lastOrdinaryLong;
      lastOrdinaryWeekly = sumKm;
    }
    return {
      index: week.index,
      start: week.start,
      phase: week.phase,
      ordinary,
      trainingKm: sumKm,
      trainingMinutes: sumMinutes,
      longKm,
      quality: quality.length,
      runs,
    };
  });
  for (const w of plan.workouts) {
    check(
      w.date >= input.startDate && w.date <= input.raceDate,
      `${w.date}: outside plan dates`,
    );
    check(
      Number.isFinite(w.minutes) &&
        w.minutes > 0 &&
        Number.isFinite(w.estimatedKm) &&
        w.estimatedKm > 0,
      `${w.date}: invalid session allocation`,
    );
    check(
      w.steps.length > 0 &&
        w.steps.every(
          (s) =>
            Number.isFinite(s.seconds) &&
            s.seconds > 0 &&
            (s.metres === undefined ||
              (Number.isFinite(s.metres) && s.metres > 0)),
        ),
      `${w.date}: invalid step duration/distance`,
    );
    check(
      close(
        w.steps.reduce((n, s) => n + s.seconds, 0),
        w.minutes * 60,
        1.01,
      ),
      `${w.date}: steps do not add up to duration`,
    );
    if (w.kind === 'race') continue;
    const limit = w.kind === 'long' ? input.longMinutes : input.weekdayMinutes;
    const dayLimit =
      input.dayPreferences?.find((day) => day.day === weekday(w.date))
        ?.maxMinutes ?? Infinity;
    check(
      w.minutes <= Math.min(limit, dayLimit) + 1 / 60,
      `${w.date}: session time limit exceeded`,
    );
    check(
      input.availableDays.includes(weekday(w.date)),
      `${w.date}: scheduled on unavailable day`,
    );
    if (gap(w.date, input.raceDate) <= 2)
      check(!w.hard, `${w.date}: hard workout within two days of race`);
    if (w.kind === 'long') {
      check(
        w.estimatedKm <= Math.max(input.longestKm, longCeiling) + 0.001,
        `${w.date}: long run exceeds event ceiling`,
      );
      if (w.estimatedKm > input.longestKm + 0.001)
        check(
          Number.isInteger(w.estimatedKm),
          `${w.date}: new long-run progression is fractional`,
        );
    }
    if (input.qualitySessions === 0)
      check(
        !weekdayQuality(w),
        `${w.date}: quality session added despite zero choice`,
      );
    if (weekdayQuality(w)) {
      check(w.hard, `${w.date}: sustained workout is not marked hard`);
      check(
        w.steps.some((s) => s.kind === 'warmup') &&
          w.steps.some((s) => s.kind === 'cooldown'),
        `${w.date}: quality workout missing warm-up or cooldown`,
      );
      if (!input.method || input.method === 'balanced') {
        check(
          w.minutes <= qualityCap + 1 / 60,
          `${w.date}: quality workout exceeds event/ability duration cap`,
        );
        check(
          w.steps
            .filter((s) => s.kind === 'aerobic')
            .reduce((n, s) => n + s.seconds / 60, 0) <=
            aerobicCap + 1 / 60,
          `${w.date}: surplus easy padding exceeds the allowed ${aerobicCap} minutes`,
        );
        if (
          developing ||
          input.intent === 'finish' ||
          input.difficulty === 'gentle'
        )
          check(
            w.steps
              .filter((s) => s.kind === 'work')
              .every((s) => s.intensity <= 5),
            `${w.date}: controlled work becomes harder than its allowed steady effort`,
          );
      }
    }
  }
  return { failures, weeks };
}

export function executeRoadScenario(scenario) {
  const input = structuredClone(scenario.profile),
    before = structuredClone(input);
  try {
    const plan = makePlan(input, input.startDate, false);
    const result = independentRoadChecks(plan, input);
    if (!isDeepStrictEqual(input, before))
      result.failures.push('Generation mutated supplied input');
    if (scenario.expectation === 'reject')
      result.failures.push(
        'Contradictory/unsupported input was silently accepted',
      );
    return {
      ...scenario,
      status: result.failures.length ? 'failed' : 'accepted',
      plan,
      ...result,
    };
  } catch (error) {
    const controlled =
      error.name === 'PlanError' &&
      typeof error.message === 'string' &&
      error.message.length > 0;
    return {
      ...scenario,
      status:
        controlled && scenario.expectation === 'reject' ? 'rejected' : 'failed',
      error: { name: error.name, message: error.message },
      failures:
        controlled && scenario.expectation === 'reject'
          ? []
          : [`${error.name}: ${error.message}`],
    };
  }
}
