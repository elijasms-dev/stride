import { schedulingEasyPace } from '../fitness-pacing.ts';
import {
  isRoadRaceProfile,
  roadWorkoutMinutesCap,
  roadTrainingPolicy,
} from '../road-training-policy.ts';
import { usesMarathonBook } from '../marathon-book.ts';
import { distanceEstimate, executableDistanceRange } from '../prescription.ts';
import { runningDayLimit } from '../runner-customization.ts';
import { withSpecificWorkoutName } from '../workout-names.ts';
import { longUltraOpeningBaselineMessage } from '../ultra-policy.ts';
import { addDays, dayDiff, weekday } from './calendar.ts';
import { PlanError } from './errors.ts';
import { taperFactor, weekIncludesTaper } from './generation-calendar.ts';
import {
  GENERATION_POLICY,
  SECONDS_PER_MINUTE,
} from './generation-constants.ts';
import { TRAINING_POLICY } from './policy.ts';
import { ENVELOPE_TAPER_POLICY } from './policy-constants.ts';
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import type { Plan, Workout } from './types.ts';
import {
  balanceReferenceLong,
  easyLongRoleCapKm,
  usesDistinctLongBalance,
} from './session-balance.ts';

const METRES_PER_KM = 1000;
const DISTANCE_TOLERANCE_KM = 1 / METRES_PER_KM;
const NUMERIC_TOLERANCE = 1e-6;
// Executable prescriptions round to whole seconds, as does plan validation.
const SECOND_TOLERANCE = 1;
const MINIMUM_SESSION_SECONDS =
  GENERATION_POLICY.minimumSessionMinutes * SECONDS_PER_MINUTE;
const OPENING_CAPACITY_ERROR =
  'Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.';

/** Only a fresh complete week represents all seven days of the declared baseline.
 * History, deliberate edits, partial starts and taper have separate allocations. */
export function hasOpeningBaseline(plan: Plan, allowDeclared = false) {
  const week = plan.weeks[0];
  return (
    plan.policyVersion === TRAINING_POLICY.version &&
    !!week &&
    (!plan.baselineEvidence ||
      (allowDeclared &&
        plan.baselineEvidence.source === 'declared-baseline')) &&
    !plan.returnState &&
    (!plan.constraintsFrom ||
      plan.constraintsFrom === plan.profile.startDate) &&
    week.start === plan.profile.startDate &&
    addDays(week.start, 6) <= plan.profile.raceDate &&
    !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
    !weekIncludesTaper(plan.profile, week.start) &&
    plan.profile.weeklyKm > 0 &&
    plan.workouts
      .filter((w) => w.week === week.index)
      .every((w) => w.status === 'planned' && !w.returnRole && !w.changed)
  );
}

// A metre target is executable when its whole-second duration fits the budget.
// Using the rounded duration avoids inventing a 1 m shortfall at five minutes.
function metresWithinSeconds(seconds: number, pace: number) {
  return Math.floor(
    ((Math.floor(seconds + NUMERIC_TOLERANCE) + 0.5 - NUMERIC_TOLERANCE) /
      pace) *
      METRES_PER_KM,
  );
}

function adjustableRelaxedBlock(workout: Workout) {
  const runWalk =
    !workout.hard &&
    workout.steps.some((step) => step.movement === 'run') &&
    workout.steps.some((step) => step.movement === 'walk');
  return workout.steps
    .map((step, index) => ({ step, index }))
    .filter(
      ({ step }) =>
        step.intensity <= 3 && (!runWalk || step.movement === 'walk'),
    )
    .sort((a, b) => b.step.seconds - a.step.seconds)[0];
}

function minimumAdjustableSeconds(workout: Workout) {
  const largest = adjustableRelaxedBlock(workout)?.step.seconds ?? 0;
  return Math.max(
    MINIMUM_SESSION_SECONDS,
    workout.steps.reduce((sum, step) => sum + step.seconds, 0) - largest + 1,
  );
}

/** The book's endurance taper also caps familiar daily time before the weekly
 * phase changes. Easy funding must respect the same bound as the envelope. */
function familiarDayLimits(plan: Plan) {
  const p = plan.profile;
  const limits = new Map<number, number>();
  if (p.goal === 'base' || !usesMarathonBook(p)) return limits;
  const reference = [...plan.weeks].reverse().find((week) => {
    const runs = plan.workouts.filter(
      (run) =>
        run.week === week.index &&
        run.kind !== 'race' &&
        run.status !== 'skipped',
    );
    return (
      week.phase !== 'Recovery' &&
      dayDiff(addDays(week.start, 6), p.raceDate) >=
        ENVELOPE_TAPER_POLICY.enduranceDays &&
      runs.every((run) => taperFactor(p, run.date) === 1) &&
      new Set(runs.map((run) => run.date)).size >= p.days.length
    );
  });
  if (!reference) return limits;
  for (const run of plan.workouts.filter(
    (run) =>
      run.week === reference.index &&
      run.kind !== 'race' &&
      run.status !== 'skipped',
  )) {
    const day = weekday(run.date);
    limits.set(day, (limits.get(day) ?? 0) + run.minutes);
  }
  return limits;
}

function familiarDaySeconds(
  plan: Plan,
  run: Workout,
  limits: Map<number, number>,
) {
  // A familiar-day taper ceiling must not cap an ordinary training day. Recipes
  // change length, so freezing the earlier daily distribution can otherwise make
  // an unchanged weekly baseline impossible even with ample user availability.
  if (taperFactor(plan.profile, run.date) >= 1) return Infinity;
  return dayDiff(run.date, plan.profile.raceDate) <=
    ENVELOPE_TAPER_POLICY.enduranceDays
    ? (limits.get(weekday(run.date)) ?? Infinity) * SECONDS_PER_MINUTE
    : Infinity;
}

/** Use easy outings first, then aerobic time around an intact quality recipe.
 * Long-run targets and paired-session recovery are never funding reserves. */
function fundingCandidates(runs: Workout[]) {
  return [
    ...runs.filter((run) => run.kind === 'easy' && !run.hard),
    ...runs.filter((run) => run.hard && run.kind !== 'long' && !run.pairId),
  ];
}

function fundingCapKm(
  plan: Plan,
  run: Workout,
  runs: Workout[],
  balance = true,
) {
  const long =
    runs.find((w) => w.kind === 'long') ??
    (balance && usesDistinctLongBalance(plan)
      ? balanceReferenceLong(plan, run.week)
      : undefined);
  const roleCap =
    (isRoadRaceProfile(plan.profile) ||
      (balance && usesDistinctLongBalance(plan))) &&
    !run.hard
      ? long && balance && usesDistinctLongBalance(plan)
        ? easyLongRoleCapKm(plan.profile, run.date, long, run.role)
        : (long?.estimatedKm ?? Infinity)
      : Infinity;
  return run.hard && run.kind !== 'long'
    ? (plan.profile.qualityLimitKm ?? Infinity)
    : Math.min(plan.profile.easyLimitKm ?? Infinity, roleCap);
}

function fundingPace(run: Workout, fallback: number) {
  // A declared scheduling estimate may be slower than the benchmark's actual
  // easy band. Once a continuous easy prescription has that band, fund its
  // duration using the executable endpoint, not an incompatible estimate.
  const target =
    run.steps.length === 1 && !run.hard ? run.steps[0].target : undefined;
  return target && target.mode === 'pace' ? target.high : fallback;
}

function fundedSeconds(run: Workout, metres: number, pace: number) {
  pace = fundingPace(run, pace);
  return run.hard && run.kind !== 'long'
    ? Math.round(run.minutes * SECONDS_PER_MINUTE) +
        Math.round(
          ((metres - Math.round(run.estimatedKm * METRES_PER_KM)) /
            METRES_PER_KM) *
            pace,
        )
    : Math.round((metres / METRES_PER_KM) * pace);
}

function fundedMetres(run: Workout, seconds: number, pace: number) {
  pace = fundingPace(run, pace);
  return run.hard
    ? Math.round(run.estimatedKm * METRES_PER_KM) +
        metresWithinSeconds(
          seconds - Math.round(run.minutes * SECONDS_PER_MINUTE),
          pace,
        )
    : metresWithinSeconds(seconds, pace);
}

/** Maximum easy-running funding with complete faster blocks and existing long
 * targets fixed. Temporary second budgets do not mutate the plan or workouts. */
export function maximumFundedWeekKm(
  plan: Plan,
  runs: Workout[],
  balance = true,
) {
  const p = plan.profile;
  const familiar = familiarDayLimits(plan);
  const pace = Math.max(
    schedulingEasyPace(p) * SECONDS_PER_MINUTE,
    p.workoutTargets?.mode === 'pace'
      ? (p.workoutTargets.pace?.easy?.high ?? 0)
      : 0,
  );
  const candidates = fundingCandidates(runs);
  const fixed = runs.filter((run) => !candidates.includes(run));
  const metres = new Map(
    candidates.map((run) => [
      run,
      run.hard
        ? Math.round(run.estimatedKm * METRES_PER_KM)
        : Math.ceil(
            (minimumAdjustableSeconds(run) / fundingPace(run, pace)) *
              METRES_PER_KM,
          ),
    ]),
  );
  const seconds = (run: Workout) =>
    metres.has(run)
      ? fundedSeconds(run, metres.get(run)!, pace)
      : run.minutes * SECONDS_PER_MINUTE;
  const available = (run: Workout) =>
    Math.min(
      p.weekdayMinutes * SECONDS_PER_MINUTE,
      roadWorkoutMinutesCap(p, run) * SECONDS_PER_MINUTE,
      Math.min(
        runningDayLimit(p, weekday(run.date)) * SECONDS_PER_MINUTE,
        familiarDaySeconds(plan, run, familiar),
      ) -
        runs
          .filter((other) => other !== run && other.date === run.date)
          .reduce((sum, other) => sum + seconds(other), 0),
      (p.weeklyMinutesLimit ?? Infinity) * SECONDS_PER_MINUTE -
        runs
          .filter((other) => other !== run)
          .reduce((sum, other) => sum + seconds(other), 0),
    );
  for (const run of candidates) {
    if (seconds(run) > available(run) + SECOND_TOLERANCE + NUMERIC_TOLERANCE)
      return -Infinity;
    const capacity = Math.min(
      Math.floor(fundingCapKm(plan, run, runs, balance) * METRES_PER_KM),
      fundedMetres(run, available(run), pace),
    );
    if (capacity < metres.get(run)!) return -Infinity;
    if (run.hard && fundedSeconds(run, capacity, pace) === seconds(run))
      continue;
    metres.set(run, capacity);
  }
  return Math.min(
    p.peakWeeklyKm ?? Infinity,
    fixed.reduce((sum, run) => sum + run.estimatedKm, 0) +
      [...metres.values()].reduce((sum, value) => sum + value, 0) /
        METRES_PER_KM,
  );
}

/** Fund one existing week in metres and seconds. Only relaxed blocks absorb
 * the remainder; complete faster repetitions and long-run targets stay intact. */
export function fundWeek(
  plan: Plan,
  runs: Workout[],
  targetKm: number,
  failureMessage: string,
  openingLongKm?: number,
  balance = true,
) {
  const p = plan.profile;
  const familiar = familiarDayLimits(plan);
  const fail = (): never => {
    throw new PlanError(failureMessage);
  };
  const pace = Math.max(
    schedulingEasyPace(p) * SECONDS_PER_MINUTE,
    p.workoutTargets?.mode === 'pace'
      ? (p.workoutTargets.pace?.easy?.high ?? 0)
      : 0,
  );
  const limit = (w: Workout) =>
    Math.min(
      w.kind === 'long' ? p.longMinutes : p.weekdayMinutes,
      roadWorkoutMinutesCap(p, w),
      Math.min(
        runningDayLimit(p, weekday(w.date)),
        familiarDaySeconds(plan, w, familiar) / SECONDS_PER_MINUTE,
      ) -
        runs
          .filter((r) => r !== w && r.date === w.date)
          .reduce((n, r) => n + r.minutes, 0),
      (p.weeklyMinutesLimit ?? Infinity) -
        runs.filter((r) => r !== w).reduce((n, r) => n + r.minutes, 0),
    ) * SECONDS_PER_MINUTE;
  const capKm = (w: Workout) =>
    w.kind === 'long'
      ? Math.min(
          p.longLimitKm ?? Infinity,
          trainingFamily(p) === 'marathon'
            ? TRAINING_POLICY.family.marathon.longCeilingKm
            : Infinity,
        )
      : fundingCapKm(plan, w, runs, balance);
  const assign = (w: Workout, km: number) => {
    if (km > capKm(w) + NUMERIC_TOLERANCE) fail();
    const executable = executableDistanceRange(w.steps);
    if (
      w.prescriptionVersion === 'pace-resolved-v1' &&
      w.steps.some((s) => s.target?.mode === 'pace') &&
      Math.abs(km - w.estimatedKm) < NUMERIC_TOLERANCE &&
      executable &&
      km >= executable.lowerKm - DISTANCE_TOLERANCE_KM &&
      km <= executable.upperKm + DISTANCE_TOLERANCE_KM &&
      w.minutes * SECONDS_PER_MINUTE <= limit(w) + SECOND_TOLERANCE &&
      w.minutes * SECONDS_PER_MINUTE >= MINIMUM_SESSION_SECONDS
    )
      return;
    const seconds = fundedSeconds(w, Math.round(km * METRES_PER_KM), pace);
    if (
      seconds > limit(w) + SECOND_TOLERANCE + NUMERIC_TOLERANCE ||
      seconds < MINIMUM_SESSION_SECONDS
    )
      fail();
    const difference = seconds - w.steps.reduce((n, s) => n + s.seconds, 0);
    if (w.hard && w.kind !== 'long') {
      // Only add easy aerobic running. Do not resize work bouts, recoveries,
      // warm-up/cool-down minima or any prescribed distance repetitions.
      if (difference < 0) fail();
      if (difference === 0) return;
      if (difference > 0) {
        const index = w.steps.findIndex(
          (step) => step.kind === 'aerobic' && step.intensity <= 3,
        );
        if (index >= 0) {
          w.steps = w.steps.map((step, i) => {
            if (i !== index) return step;
            const {
              metres: _metres,
              planningPaceSecondsPerKm: _pace,
              ...timed
            } = step;
            return { ...timed, seconds: step.seconds + difference };
          });
        } else {
          const index = w.steps.findIndex((step) => step.kind === 'work');
          w.steps = [...w.steps];
          w.steps.splice(index < 0 ? 0 : index, 0, {
            kind: 'aerobic',
            label: 'Easy running before the main set',
            seconds: difference,
            intensity: 3,
            effort: 'Conversational · full sentences · 2–3 / 10',
            movement: 'run',
          });
        }
      }
      w.minutes = seconds / SECONDS_PER_MINUTE;
      w.estimatedKm = km;
      w.distanceEstimate = distanceEstimate(w.steps, p);
      Object.assign(w, withSpecificWorkoutName(w));
      return;
    }
    // Keep complete repetitions and run/walk jogging intervals. Only a relaxed
    // continuous block or walking recovery can absorb the remaining seconds.
    const adjustable = adjustableRelaxedBlock(w);
    if (!adjustable || adjustable.step.seconds + difference <= 0) fail();
    w.steps = w.steps.map((s, i) => {
      const { metres: _metres, planningPaceSecondsPerKm: _pace, ...step } = s;
      return {
        ...step,
        seconds: step.seconds + (i === adjustable.index ? difference : 0),
      };
    });
    // Simple continuous runs carry an exact executable target. Run/walk and
    // structured quality retain their timed blocks and an estimated distance.
    if (
      p.runMeasure === 'distance' &&
      w.steps.length === 1 &&
      w.steps[0].movement !== 'walk'
    )
      Object.assign(w.steps[0], {
        metres: Math.round(km * METRES_PER_KM),
        planningPaceSecondsPerKm: fundingPace(w, pace),
      });
    w.minutes = seconds / SECONDS_PER_MINUTE;
    w.estimatedKm = km;
    w.distanceEstimate = distanceEstimate(w.steps, p);
    w.title = w.title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, '');
    Object.assign(w, withSpecificWorkoutName(w));
    if (w.steps.every((s) => s.metres !== undefined))
      w.title = `${Number((p.units === 'mi' ? km / 1.609344 : km).toFixed(1))} ${p.units} · ${w.title}`;
  };
  const long = runs.find((w) => w.kind === 'long');
  if (long && openingLongKm !== undefined && openingLongKm > 0)
    assign(long, openingLongKm);
  // Remove unused display-rounding allowances before allocating the remainder.
  const candidates = fundingCandidates(runs);
  for (const w of candidates.filter((run) => !run.hard)) {
    // Earlier display rounding can leave a five-minute outing at e.g. 0.8 km
    // instead of its 0.834 km funding minimum. Restore that metre allowance
    // before sharing a small remainder; otherwise adding distance can calculate
    // fewer than five minutes and incorrectly reject an otherwise funded week.
    if (
      w.steps.length === 1 &&
      w.steps[0].movement !== 'walk' &&
      w.estimatedKm * fundingPace(w, pace) < MINIMUM_SESSION_SECONDS
    )
      assign(
        w,
        Math.ceil(
          (MINIMUM_SESSION_SECONDS / fundingPace(w, pace)) * METRES_PER_KM,
        ) / METRES_PER_KM,
      );
    if (w.estimatedKm * fundingPace(w, pace) >= MINIMUM_SESSION_SECONDS)
      assign(
        w,
        Math.min(
          w.estimatedKm,
          capKm(w),
          metresWithinSeconds(limit(w), fundingPace(w, pace)) / METRES_PER_KM,
        ),
      );
  }
  let remaining = Math.round(
    (targetKm - runs.reduce((n, w) => n + w.estimatedKm, 0)) * METRES_PER_KM,
  );
  // Share a reduction across supporting runs. Taking the entire correction
  // from the first outing makes it seesaw whenever the long run advances.
  if (balance && usesDistinctLongBalance(plan) && remaining < 0) {
    let active = candidates.filter((w) => !w.hard);
    while (remaining < 0 && active.length) {
      const room = (w: Workout) =>
        Math.max(
          0,
          Math.round(w.estimatedKm * METRES_PER_KM) -
            Math.ceil(
              (minimumAdjustableSeconds(w) / fundingPace(w, pace)) *
                METRES_PER_KM,
            ),
        );
      const totalRoom = active.reduce((sum, w) => sum + room(w), 0);
      if (!totalRoom) break;
      const deficit = -remaining;
      let removed = 0;
      for (const w of active) {
        const delta = Math.min(
          -remaining,
          room(w),
          Math.ceil((deficit * room(w)) / totalRoom),
        );
        if (!delta) continue;
        assign(
          w,
          (Math.round(w.estimatedKm * METRES_PER_KM) - delta) / METRES_PER_KM,
        );
        remaining += delta;
        removed += delta;
      }
      if (!removed) break;
      active = active.filter((w) => room(w) > 0);
    }
  }
  // Road recipes can leave different amounts of easy distance to fund. Share
  // that remainder among eligible easy outings instead of dumping it into the
  // first recovery slot. Fixed long runs and complete quality sets stay intact.
  if (isRoadRaceProfile(p) && remaining > 0) {
    let active = candidates.filter((w) => !w.hard);
    while (remaining > 0 && active.length) {
      const share = Math.ceil(remaining / active.length);
      let added = 0;
      for (const w of active) {
        const current = Math.round(w.estimatedKm * METRES_PER_KM);
        const capacity = Math.min(
          Math.floor(capKm(w) * METRES_PER_KM),
          fundedMetres(w, limit(w), pace),
        );
        const delta = Math.max(
          0,
          Math.min(share, remaining, capacity - current),
        );
        if (delta) {
          assign(w, (current + delta) / METRES_PER_KM);
          remaining -= delta;
          added += delta;
        }
      }
      if (!added) break;
      active = active.filter(
        (w) =>
          Math.round(w.estimatedKm * METRES_PER_KM) <
          Math.min(
            Math.floor(capKm(w) * METRES_PER_KM),
            fundedMetres(w, limit(w), pace),
          ),
      );
    }
  }
  for (const w of candidates) {
    if (!remaining) break;
    if (w.hard && remaining < 0) continue;
    const current = Math.round(w.estimatedKm * METRES_PER_KM);
    const capacityMetres = Math.min(
      Math.floor(capKm(w) * METRES_PER_KM),
      fundedMetres(w, limit(w), pace),
    );
    const target =
      remaining > 0
        ? Math.min(current + remaining, capacityMetres)
        : Math.max(
            current + remaining,
            Math.ceil(
              (minimumAdjustableSeconds(w) / fundingPace(w, pace)) *
                METRES_PER_KM,
            ),
          );
    if (target === current) continue;
    assign(w, target / METRES_PER_KM);
    remaining -= Math.round(w.estimatedKm * METRES_PER_KM) - current;
  }
  if (
    Math.abs(remaining) > 1 ||
    (p.peakWeeklyKm != null && targetKm > p.peakWeeklyKm + NUMERIC_TOLERANCE)
  )
    fail();
}

/** Finish the opening allocation after recipes and distance formatting. Conflicting
 * ceilings are explicit errors instead of a different starting weekly or long distance. */
export function openingBaselineTargetKm(plan: Plan) {
  const declared = plan.profile.weeklyKm;
  if (!usesDistinctLongBalance(plan)) return declared;
  const opening = plan.workouts.filter(
    (w) => w.week === plan.weeks[0]?.index && w.kind !== 'race',
  );
  // A role correction is not permission to hide an unrelated time/cap conflict.
  if (
    maximumFundedWeekKm(plan, opening, false) + DISTANCE_TOLERANCE_KM <
    declared
  )
    return declared;
  const capacities = plan.weeks
    .filter(
      (week) =>
        week.start >= plan.profile.startDate &&
        addDays(week.start, 6) <= plan.profile.raceDate &&
        !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
        !weekIncludesTaper(plan.profile, week.start),
    )
    .map((week) =>
      maximumFundedWeekKm(
        plan,
        plan.workouts.filter(
          (w) =>
            w.week === week.index &&
            w.kind !== 'race' &&
            w.status !== 'skipped',
        ),
      ),
    );
  const capacity = Math.min(declared, ...capacities);
  return Number.isFinite(capacity) && capacity > 0
    ? Math.floor((capacity + NUMERIC_TOLERANCE) * METRES_PER_KM) / METRES_PER_KM
    : declared;
}

export function reconcileOpeningBaseline(plan: Plan, allowDeclared = false) {
  if (!hasOpeningBaseline(plan, allowDeclared)) return;
  const runs = plan.workouts.filter(
    (w) => w.week === plan.weeks[0].index && w.kind !== 'race',
  );
  const target = openingBaselineTargetKm(plan);
  fundWeek(
    plan,
    runs,
    target,
    OPENING_CAPACITY_ERROR +
      (isRoadRaceProfile(plan.profile)
        ? ' Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.'
        : ''),
    plan.profile.longestKm,
  );
  if (usesDistinctLongBalance(plan)) plan.openingWeekKm = target;
  const prefix = 'Opening-week balance ·';
  plan.notes = plan.notes.filter((note) => !note.startsWith(prefix));
  if (target + DISTANCE_TOLERANCE_KM < plan.profile.weeklyKm) {
    const note = `${prefix} You reported ${plan.profile.weeklyKm} km/week and a long run of ${plan.profile.longestKm} km. This plan starts at ${Number(target.toFixed(2))} km, keeping that familiar long run and shorter supporting runs. Your recorded baseline stays unchanged; unused mileage is not forced into easy runs or extra workouts.`;
    plan.notes.unshift(note);
  }
  const conflict = longUltraOpeningBaselineMessage(
    plan.profile,
    runs.reduce((sum, run) => sum + run.minutes, 0),
    runs.find((run) => run.kind === 'long')?.minutes ?? 0,
  );
  if (conflict) throw new PlanError(conflict);
  refreshWeekTotals(plan);
}

/** Reapply easy roles after recovery/taper envelopes shorten the long run.
 * Saved history, manual edits and retained timed pace reviews are not resized. */
export function reconcileEasyLongBalance(
  plan: Plan,
  from: string,
  protectedIds: readonly string[] = [],
) {
  if (!usesDistinctLongBalance(plan) || plan.returnState) return;
  for (const week of plan.weeks) {
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.status !== 'skipped',
    );
    const long = balanceReferenceLong(plan, week.index);
    if (
      !long ||
      long.returnRole ||
      long.distanceRevision === 'pace-edited-time' ||
      (long.changed && long.changeSource !== 'preferences')
    )
      continue;
    for (const run of runs) {
      if (
        run.kind !== 'easy' ||
        run.hard ||
        run.pairId ||
        run.status !== 'planned' ||
        run.date < from ||
        run.returnRole ||
        protectedIds.includes(run.id) ||
        run.distanceRevision === 'pace-edited-time' ||
        (run.changed && run.changeSource !== 'preferences')
      )
        continue;
      const cap = easyLongRoleCapKm(plan.profile, run.date, long, run.role);
      if (run.estimatedKm <= cap + NUMERIC_TOLERANCE) continue;
      fundWeek(
        plan,
        [run, long],
        cap + long.estimatedKm,
        'The easy-run role cannot fit the minimum session duration. Review the long-run distance and available time.',
      );
    }
  }
  refreshWeekTotals(plan);
}

/** Keep complete ordinary forecast weeks non-decreasing without changing history,
 * deliberate edits, or return plans. Recovery and taper retain their reduced loads. */
export function reconcileOrdinaryWeeklyProgression(
  plan: Plan,
  allowDeclared = false,
) {
  if (
    plan.policyVersion !== TRAINING_POLICY.version ||
    plan.returnState ||
    (plan.constraintsFrom && plan.constraintsFrom !== plan.profile.startDate) ||
    (plan.baselineEvidence &&
      (!allowDeclared ||
        plan.baselineEvidence.source !== 'declared-baseline' ||
        plan.baselineEvidence.asOf > plan.profile.startDate)) ||
    plan.workouts.some(
      (w) =>
        w.status !== 'planned' ||
        w.returnRole ||
        (w.changed && w.changeSource !== 'preferences'),
    )
  )
    return;

  const ordinary = [...plan.weeks]
    .sort((a, b) => a.index - b.index)
    .flatMap((week) => {
      if (
        week.start < plan.profile.startDate ||
        addDays(week.start, 6) > plan.profile.raceDate ||
        ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
        weekIncludesTaper(plan.profile, week.start)
      )
        return [];
      const runs = plan.workouts.filter(
        (run) => run.week === week.index && run.kind !== 'race',
      );
      const dates = new Set(runs.map((run) => run.date));
      if (
        dates.size !== plan.profile.days.length ||
        !plan.profile.days.every((day) => dates.has(addDays(week.start, day)))
      )
        return [];
      return [
        {
          week,
          runs,
          originalKm: runs.reduce((sum, run) => sum + run.estimatedKm, 0),
          capacityKm: maximumFundedWeekKm(plan, runs),
          targetKm: 0,
        },
      ];
    });
  if (!ordinary.length) return;
  // A partial entry week has no exact full-week anchor. Do not freeze the first
  // complete week's incidental recipe allocation above the declared baseline.
  const openingKm = Math.min(
    ordinary[0].week.start === plan.profile.startDate
      ? ordinary[0].originalKm
      : Math.min(ordinary[0].originalKm, plan.profile.weeklyKm),
    usesDistinctLongBalance(plan)
      ? Math.min(
          ...ordinary.map((record) =>
            Number.isFinite(record.capacityKm)
              ? record.capacityKm
              : ordinary[0].originalKm,
          ),
        )
      : Infinity,
  );
  const failMessage = (index: number, targetKm: number) =>
    `Week ${index + 1} cannot maintain ${Number(targetKm.toFixed(3))} km within the selected running days, session limits and weekly time ceiling. Review these limits together.`;
  let futureCapacity = Infinity;
  for (const record of [...ordinary].reverse()) {
    futureCapacity = Math.min(futureCapacity, record.capacityKm);
    if (record.capacityKm + DISTANCE_TOLERANCE_KM < openingKm)
      throw new PlanError(failMessage(record.week.index, openingKm));
    record.targetKm =
      plan.profile.volume === 'maintain'
        ? openingKm
        : Math.min(record.originalKm, futureCapacity);
  }
  let previousOrdinaryKm = openingKm;
  let changed = false;
  for (const record of ordinary) {
    let targetKm =
      plan.profile.volume === 'maintain'
        ? openingKm
        : Math.max(previousOrdinaryKm, record.targetKm);
    if (
      usesDistinctLongBalance(plan) &&
      isRoadRaceProfile(plan.profile) &&
      record !== ordinary[0]
    ) {
      const policy = roadTrainingPolicy(plan.profile);
      // Growth is measured from the actual balanced week, not mileage we
      // deliberately left unallocated. A 1 km long-run step is not a licence
      // to add another kilometre to every supporting outing at the same time.
      targetKm = Math.min(
        targetKm,
        previousOrdinaryKm +
          Math.min(
            policy.weeklyStep,
            previousOrdinaryKm * policy.growthFraction,
          ),
      );
      targetKm =
        Math.floor((targetKm + NUMERIC_TOLERANCE) * METRES_PER_KM) /
        METRES_PER_KM;
    }
    if (
      Math.abs(record.originalKm - targetKm) >
        (isRoadRaceProfile(plan.profile) ? 0.00001 : DISTANCE_TOLERANCE_KM) ||
      (isRoadRaceProfile(plan.profile) &&
        record.runs.some(
          (run) =>
            run.kind === 'easy' &&
            !run.hard &&
            run.estimatedKm >
              fundingCapKm(plan, run, record.runs) + NUMERIC_TOLERANCE,
        ))
    ) {
      fundWeek(
        plan,
        record.runs,
        targetKm,
        failMessage(record.week.index, targetKm),
      );
      changed = true;
    }
    // A high-water mark prevents repeated one-metre tolerances from drifting down.
    previousOrdinaryKm =
      plan.profile.volume === 'maintain'
        ? openingKm
        : Math.max(
            previousOrdinaryKm,
            record.runs.reduce((sum, run) => sum + run.estimatedKm, 0),
          );
  }
  if (changed) refreshWeekTotals(plan);
}
