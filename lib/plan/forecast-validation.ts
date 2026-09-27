import { isRoadRaceProfile } from '../road-training-policy.ts';
import { requestedQualityCount } from '../training-structure.ts';
import { addDays } from './calendar.ts';
import { weekIncludesTaper } from './generation-calendar.ts';
import { calculateWeekLoad } from './generation-load.ts';
import { resolveGenerationPolicy } from './generation-policy.ts';
import { TRAINING_POLICY } from './policy.ts';
import type { Plan } from './types.ts';

/** Upper bounds for fresh forecasts, independently checked against saved runs.
 * Logging, return plans and deliberate edits have separate evidence envelopes.
 * A missing run must fail the contract, never make the whole week exempt. */
export function forecastEnvelopeErrors(plan: Plan): string[] {
  const p = plan.profile;
  if (
    plan.policyVersion !== TRAINING_POLICY.version ||
    plan.returnState ||
    plan.baselineEvidence ||
    (plan.constraintsFrom ?? p.startDate) !== p.startDate ||
    plan.workouts.some(
      (w) => w.status !== 'planned' || w.changed || w.returnRole,
    ) ||
    !['5k', '10k', 'half', 'marathon'].includes(p.goal) ||
    (p.method && p.method !== 'balanced')
  )
    return [];
  const context = resolveGenerationPolicy(p);
  const errors: string[] = [];
  let load = context.initialLoad;
  let previousLong: number | undefined;
  const tolerance = 0.001001;
  for (const week of plan.weeks) {
    load = calculateWeekLoad(context, week.index, load).load;
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    const total = runs.reduce((sum, w) => sum + w.estimatedKm, 0);
    const ordinary =
      week.start >= p.startDate &&
      addDays(week.start, 6) < p.raceDate &&
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      !weekIncludesTaper(p, week.start);
    const absoluteCap = Math.min(
      context.absoluteCeiling,
      context.base * context.policy.maxForecast,
      p.peakWeeklyKm ?? Infinity,
      p.volume === 'maintain' ? context.base : Infinity,
    );
    if (total > absoluteCap + tolerance)
      errors.push(
        `Week ${week.index + 1} exceeds its declared-baseline forecast ceiling.`,
      );
    // Whole-minute recipe allocation may round once per outing.
    if (
      ordinary &&
      total >
        Math.max(p.weeklyKm, load) + runs.length / context.pace + tolerance
    )
      errors.push(
        `Week ${week.index + 1} exceeds its gradual weekly progression allowance.`,
      );
    const longs = runs.filter((w) => w.kind === 'long');
    for (const long of longs)
      if (
        long.estimatedKm >
        Math.max(context.initialLong, context.peakLong) + tolerance
      )
        errors.push(
          `Week ${week.index + 1} exceeds its event long-run ceiling.`,
        );
    if (!ordinary) continue;
    const dates = p.days.map((day) => addDays(week.start, day));
    if (
      runs.length !== dates.length ||
      dates.some((date) => runs.filter((w) => w.date === date).length !== 1)
    )
      errors.push(
        `Week ${week.index + 1} must retain all ${p.days.length} selected running days.`,
      );
    if (p.days.length > 2 && longs.length !== 1)
      errors.push(`Week ${week.index + 1} needs one long run.`);
    const long = longs[0];
    if (long) {
      if (
        previousLong !== undefined &&
        long.estimatedKm > previousLong + 2 + tolerance
      )
        errors.push(
          `Week ${week.index + 1} increases its long run by more than 2 km.`,
        );
      previousLong = long.estimatedKm;
      if (
        isRoadRaceProfile(p) &&
        runs.some(
          (w) =>
            w.kind === 'easy' &&
            !w.hard &&
            w.estimatedKm > long.estimatedKm + tolerance,
        )
      )
        errors.push(
          `Week ${week.index + 1} has an easy run longer than its designated long run. Redistribute the weekly distance or review the starting inputs.`,
        );
    }
    if (p.goal === 'marathon') {
      const workMinutes = (w: Plan['workouts'][number]) =>
        w.steps
          .filter(
            (s) =>
              s.kind === 'work' && s.intensity >= 4 && s.movement !== 'walk',
          )
          .reduce((sum, s) => sum + s.seconds / 60, 0);
      const weekdayRuns = runs.filter((w) => w.kind !== 'long');
      const complete = (w: Plan['workouts'][number]) =>
        workMinutes(w) >= 6 - 1e-6;
      const strides = (w: Plan['workouts'][number]) =>
        w.kind === 'easy' &&
        !w.hard &&
        w.stimulus === 'economy' &&
        workMinutes(w) <= 3 + 1e-6 &&
        w.steps
          .filter((s) => s.kind === 'work' && s.intensity >= 4)
          .every((s) => s.seconds <= 30);
      const quality = weekdayRuns.filter(complete);
      const inconsistent = weekdayRuns.some(
        (w) =>
          (workMinutes(w) > 0 && !complete(w) && !strides(w)) ||
          (complete(w) &&
            (!w.hard || !['tempo', 'intervals', 'fartlek'].includes(w.kind))) ||
          ((w.hard || ['tempo', 'intervals', 'fartlek'].includes(w.kind)) &&
            !complete(w)),
      );
      if (quality.length !== requestedQualityCount(p) || inconsistent)
        errors.push(
          `Week ${week.index + 1} needs exactly ${requestedQualityCount(p)} complete weekday workouts.`,
        );
    }
  }
  return errors;
}
