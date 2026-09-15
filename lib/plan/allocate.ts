import { ENVELOPE_TAPER_POLICY, PLAN_LOAD_LIMITS } from './policy-constants.ts';
/** Plan allocate responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import {
  marathonRecoveryFactor,
  marathonTaperDays,
  usesMarathonBook,
} from '../marathon-book.ts';
import { distanceEstimate, qualityWorkMinutes } from '../prescription.ts';
import { runningDayLimit } from '../runner-customization.ts';
import { trainingRecords } from '../training-history.ts';
import {
  allocateRunningMinutes,
  longRunShareLimit,
} from '../training-structure.ts';
import { isLongUltra } from '../ultra-policy.ts';
import { resizeWorkout } from '../workout-library.ts';
import { withWorkoutTargets } from '../workout-targets.ts';
import { addDays, dateLabel, dayDiff, dayNames, weekday } from './calendar.ts';
import { PlanError } from './errors.ts';
import {
  marathonRaceWeekRunCount,
  taperFactor,
  trainingPhaseOn,
} from './generation-calendar.ts';
import { TRAINING_POLICY } from './policy.ts';
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import { type Plan, type Workout } from './types.ts';

export function applyActualTrainingEnvelope(
  plan: Plan,
  asOf?: string,
  allocationPrefix: Workout[] = [],
) {
  const p = plan.profile;
  const update = (w: Workout, minutes: number) => {
    if (asOf && (w.date < asOf || w.status !== 'planned')) return;
    if (asOf && w.changed && w.changeSource !== 'preferences')
      throw new PlanError(
        `Your deliberate edit on ${dateLabel(w.date)} conflicts with the lower weekly allocation. Review that workout before applying these limits.`,
      );
    Object.assign(
      w,
      resizeWorkout(
        w,
        p,
        trainingPhaseOn(p, plan.weeks[w.week].phase, w.date),
        Math.max(PLAN_LOAD_LIMITS.minimumSessionMinutes, Math.floor(minutes)),
      ),
    );
    if (usesMarathonBook(p)) Object.assign(w, withWorkoutTargets(w, p));
    w.distanceEstimate = distanceEstimate(w.steps, p);
    if (asOf) {
      w.changed = true;
      w.changeSource = 'preferences';
      w.reason =
        'The surrounding weekly allocation is lower. This reduction keeps recovery, long-run balance and taper within the revised workload; it does not reset your training phase.';
    }
  };
  // Apply custom ceilings to executable allocations, including paired runs.
  // Deduplicated actual records use their calendar date, including extra runs
  // and completed workouts carried from a previous block. Elapsed unlogged
  // prescriptions also reserve time, so missing logs never fund catch-up.
  const context = [
    ...new Map(
      [...allocationPrefix, ...plan.workouts].map((w) => [w.id, w]),
    ).values(),
  ];
  const records = trainingRecords({
    workouts: context,
    extraRuns: plan.extraRuns,
  }).filter(
    (r) =>
      !r.workoutId ||
      context.find((w) => w.id === r.workoutId)?.kind !== 'race',
  );
  const constrainBudget = (
    from: string,
    to: string,
    limit: number,
    label: string,
  ) => {
    if (!Number.isFinite(limit)) return;
    const runs = running.filter((w) => w.date >= from && w.date <= to);
    const editable = runs.filter(
      (w) => w.status === 'planned' && (!asOf || w.date >= asOf),
    );
    if (!editable.length) return;
    const actual = records
      .filter((r) => r.date >= from && r.date <= to)
      .reduce((n, r) => n + Math.max(r.minutes, r.prescribedMinutes ?? 0), 0);
    const retained =
      actual +
      context
        .filter(
          (w) =>
            w.kind !== 'race' &&
            w.status !== 'skipped' &&
            w.date >= from &&
            w.date <= to &&
            !editable.some((e) => e.id === w.id) &&
            !(w.status === 'completed' && w.feedback),
        )
        .reduce((n, w) => n + w.minutes, 0);
    const remaining = Math.floor(limit - retained);
    if (remaining < editable.length * PLAN_LOAD_LIMITS.minimumSessionMinutes)
      throw new PlanError(
        `${label} leaves too little time for the remaining runs after your saved running. Increase the ceiling or review the remaining running days.`,
      );
    if (editable.reduce((n, w) => n + w.minutes, 0) <= remaining + 0.01) return;
    const allocated = allocateRunningMinutes(
      remaining,
      editable.map((w) => ({ key: w.id, weight: w.minutes, cap: w.minutes })),
    );
    for (const w of editable)
      if (w.minutes > allocated.get(w.id)! + 0.01)
        update(w, allocated.get(w.id)!);
  };
  const running = plan.workouts.filter(
    (w) => w.kind !== 'race' && w.status !== 'skipped',
  );
  for (const date of new Set(
    running
      .filter((w) => Number.isFinite(runningDayLimit(p, weekday(w.date))))
      .map((w) => w.date),
  ))
    constrainBudget(
      date,
      date,
      runningDayLimit(p, weekday(date)),
      `${dayNames[weekday(date)]}’s running-time limit`,
    );
  for (const week of p.weeklyMinutesLimit != null ? plan.weeks : [])
    constrainBudget(
      week.start,
      addDays(week.start, 6),
      p.weeklyMinutesLimit ?? Infinity,
      'Your weekly running-time ceiling',
    );
  const constrainLongShares = () => {
    // The long run is constrained by allocated running, not mileage that caps removed.
    for (const week of plan.weeks) {
      const runs = plan.workouts.filter(
        (w) =>
          w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
      );
      const long = runs.find((w) => w.kind === 'long');
      if (long) {
        const others = [
          ...runs.filter((w) => w !== long),
          ...allocationPrefix.filter(
            (w) =>
              w.week === week.index &&
              w.kind !== 'race' &&
              w.status !== 'skipped',
          ),
        ].reduce((n, w) => n + w.minutes, 0);
        const share = longRunShareLimit(p);
        const maximum = (others * share) / (1 - share);
        if (long.minutes > maximum) update(long, maximum);
      }
    }
  };
  constrainLongShares();
  if (trainingFamily(p) === 'marathon') {
    const longs = plan.workouts
      .filter((w) => w.kind === 'long' && w.status !== 'skipped')
      .sort((a, b) => a.date.localeCompare(b.date));
    const pace = schedulingEasyPace(p);
    const declaredFrom = plan.baselineEvidence?.asOf ?? p.startDate;
    const declaredKm = plan.baselineEvidence?.longestKm ?? p.longestKm;
    for (const [index, run] of longs.entries()) {
      if (run.status !== 'planned' || (asOf && run.date < asOf)) continue;
      const recent = longs
        .slice(0, index)
        .filter(
          (w) =>
            dayDiff(w.date, run.date) <=
            PLAN_LOAD_LIMITS.familiarLongWindowDays,
        );
      const km = (w: Workout) =>
        w.status === 'completed'
          ? Math.min(
              w.feedback?.actualKm ?? Infinity,
              (w.feedback?.actualMinutes ?? w.minutes) / pace,
            )
          : w.estimatedKm;
      const baseline =
        dayDiff(declaredFrom, run.date) <=
        PLAN_LOAD_LIMITS.familiarLongWindowDays
          ? declaredKm
          : 0;
      const familiar = Math.max(baseline, 0, ...recent.map(km));
      const last = recent.findLast(
        (w) => plan.weeks[w.week]?.phase !== 'Recovery',
      );
      const ceiling =
        plan.weeks[run.week]?.phase === 'Recovery' && last
          ? km(last) * PLAN_LOAD_LIMITS.marathonRecoveryLongFraction
          : familiar > 0
            ? Math.min(
                PLAN_LOAD_LIMITS.maximumMarathonLongKm,
                Math.floor(familiar) + PLAN_LOAD_LIMITS.marathonLongStepKm,
              )
            : Infinity;
      // Check the final executable allocation too: earlier per-week caps may
      // have reduced the reference used during the first scheduling pass.
      if (run.estimatedKm > ceiling + 0.001)
        update(
          run,
          Math.ceil((run.minutes * ceiling) / run.estimatedKm - 1e-9),
        );
    }
  }
  // A mileage reduction can disappear when both weeks hit the same session caps.
  // Bound recovery by a complete preceding executable week, only reducing the
  // existing prescription. In a replan, missing references wait for history merge.
  const trainingRuns = (index: number) =>
    plan.workouts.filter(
      (w) => w.week === index && w.kind !== 'race' && w.status !== 'skipped',
    );
  for (const week of plan.weeks.filter((w) => w.phase === 'Recovery')) {
    const runs = trainingRuns(week.index);
    const upcoming = runs.filter(
      (w) => !asOf || (w.date >= asOf && w.status === 'planned'),
    );
    if (!upcoming.length) continue;
    const editable = upcoming.filter(
      (w) => !asOf || !w.changed || w.changeSource === 'preferences',
    );
    const reference = plan.weeks
      .slice(0, week.index)
      .reverse()
      .find(
        (w) =>
          w.phase !== 'Recovery' &&
          new Set(trainingRuns(w.index).map((r) => r.date)).size >=
            p.days.length,
      );
    if (!reference) continue;
    const target =
      trainingRuns(reference.index).reduce((n, w) => n + w.minutes, 0) *
      marathonRecoveryFactor(p) *
      Math.min(1, new Set(runs.map((w) => w.date)).size / p.days.length);
    if (runs.reduce((n, w) => n + w.minutes, 0) <= target + 0.01) continue;
    const retained = runs
      .filter((w) => !editable.includes(w))
      .reduce((n, w) => n + w.minutes, 0);
    if (
      !editable.length ||
      Math.floor(target - retained) <
        editable.length * PLAN_LOAD_LIMITS.minimumSessionMinutes
    )
      throw new PlanError(
        'This recovery week cannot fit the remaining five-minute sessions around your completed running or deliberate edits. Review the remaining running days or rest individual sessions; your saved workouts have not changed.',
      );
    const allocation = allocateRunningMinutes(
      target - retained,
      editable.map((w) => ({ key: w.id, weight: w.minutes, cap: w.minutes })),
    );
    for (const w of editable)
      if (allocation.get(w.id)! < w.minutes) {
        update(w, allocation.get(w.id)!);
        w.purpose =
          'A shorter easy session to absorb your recent training. Keep the effort comfortable.';
        w.reason =
          'Recovery · Reduced from the preceding full training week, using the running time that fits your session limits.';
      }
  }
  // Taper each familiar outing as well as the weekly total. Removing quality or
  // the long run must not create longer easy runs. Future-only replans wait for
  // the completed reference week to be merged before enforcing this bound.
  if (p.goal !== 'base') {
    const reference = plan.weeks
      .slice()
      .reverse()
      .find((week) => {
        const runs = plan.workouts.filter(
          (s) =>
            s.week === week.index &&
            s.kind !== 'race' &&
            s.status !== 'skipped',
        );
        return (
          week.phase !== 'Recovery' &&
          (!usesMarathonBook(p) ||
            dayDiff(addDays(week.start, 6), p.raceDate) >=
              ENVELOPE_TAPER_POLICY.enduranceDays) &&
          runs.every((s) => taperFactor(p, s.date) === 1) &&
          new Set(runs.map((s) => s.date)).size >= p.days.length
        );
      });
    if (reference) {
      const familiar = new Map<number, number>();
      const dailyTotals = new Map<string, number>();
      for (const run of plan.workouts.filter((s) => s.status !== 'skipped'))
        dailyTotals.set(
          run.date,
          (dailyTotals.get(run.date) ?? 0) + run.minutes,
        );
      for (const run of plan.workouts.filter(
        (s) =>
          s.week === reference.index &&
          s.kind !== 'race' &&
          s.status !== 'skipped',
      ))
        familiar.set(
          weekday(run.date),
          (familiar.get(weekday(run.date)) ?? 0) + run.minutes,
        );
      for (const run of plan.workouts.filter(
        (s) =>
          s.kind !== 'race' &&
          s.status === 'planned' &&
          (!asOf || s.date >= asOf),
      )) {
        const factor = taperFactor(p, run.date);
        const typical = familiar.get(weekday(run.date));
        if (
          (factor < 1 ||
            (usesMarathonBook(p) &&
              dayDiff(run.date, p.raceDate) <=
                ENVELOPE_TAPER_POLICY.enduranceDays)) &&
          typical != null
        ) {
          const total = dailyTotals.get(run.date)!;
          // Book allocation already applies the taper fraction to weekly volume.
          // This guard only prevents an outing from exceeding its familiar length.
          const cap =
            (typical * (usesMarathonBook(p) ? 1 : factor) * run.minutes) /
            total;
          if (run.minutes > cap + 0.01) update(run, cap);
        }
      }
    }
  }
  const firstTaper = plan.weeks.findIndex((w) =>
    ['Taper', 'Race week'].includes(w.phase),
  );
  if (firstTaper > 0) {
    const reference = plan.weeks
      .slice(0, firstTaper)
      .reverse()
      .find((w) => {
        const runs = plan.workouts.filter(
          (s) =>
            s.week === w.index && s.kind !== 'race' && s.status !== 'skipped',
        );
        return (
          w.phase !== 'Recovery' &&
          runs.every((s) => taperFactor(p, s.date) === 1) &&
          new Set(runs.map((s) => s.date)).size >= p.days.length
        );
      });
    // Short blocks may have no complete untapered week to measure. Recompute
    // the starting routine on every pass, including later preference edits.
    const startingWeeklyMinutes = Math.min(
      Math.min(
        (p.weeklyKm || PLAN_LOAD_LIMITS.fallbackWeeklyKm) *
          schedulingEasyPace(p),
        isLongUltra(p) ? p.ultraWeeklyMinutes! : Infinity,
      ) *
        (p.experience === 'returning'
          ? TRAINING_POLICY.returningRunnerFactor
          : 1) *
        Math.min(1, p.days.length / Math.max(1, p.currentRuns)),
      p.weeklyMinutesLimit ?? Infinity,
    );
    const peakReferenceMinutes = usesMarathonBook(p)
      ? Math.max(
          0,
          ...plan.weeks
            .filter((week) => week.phase !== 'Recovery')
            .map((week) => {
              const runs = plan.workouts.filter(
                (w) =>
                  w.week === week.index &&
                  w.kind !== 'race' &&
                  w.status !== 'skipped',
              );
              return new Set(runs.map((w) => w.date)).size >= p.days.length &&
                runs.every((w) => taperFactor(p, w.date) === 1)
                ? runs.reduce((n, w) => n + w.minutes, 0)
                : 0;
            }),
        )
      : 0;
    const baseline =
      peakReferenceMinutes ||
      plan.workouts
        .filter(
          (w) => reference && w.week === reference.index && w.kind !== 'race',
        )
        .reduce((n, w) => n + w.minutes, 0) ||
      plan.baselineEvidence?.weeklyMinutes ||
      startingWeeklyMinutes;
    const taperWeeks = usesMarathonBook(p)
      ? marathonTaperDays(p) / 7
      : ['half', 'marathon', 'ultra'].includes(trainingFamily(p))
        ? ENVELOPE_TAPER_POLICY.enduranceWeeks
        : ENVELOPE_TAPER_POLICY.shortEventWeeks;
    for (let bucket = 1; bucket <= taperWeeks; bucket++) {
      const boundaryOffset = usesMarathonBook(p) ? 1 : 0;
      const from = addDays(p.raceDate, -bucket * 7 + boundaryOffset);
      const through = addDays(
        p.raceDate,
        -(bucket - 1) * 7 - 1 + boundaryOffset,
      );
      const runs = plan.workouts.filter(
        (w) =>
          w.kind !== 'race' &&
          w.status !== 'skipped' &&
          w.date >= from &&
          w.date <= through,
      );
      const target =
        baseline *
        (usesMarathonBook(p)
          ? bucket === 1
            ? ENVELOPE_TAPER_POLICY.finalWeekFraction
            : bucket === 2
              ? ENVELOPE_TAPER_POLICY.bookSecondWeekFraction
              : ENVELOPE_TAPER_POLICY.bookThirdWeekFraction
          : bucket === 1
            ? ENVELOPE_TAPER_POLICY.finalWeekFraction
            : bucket === 2
              ? ENVELOPE_TAPER_POLICY.standardSecondWeekFraction
              : ENVELOPE_TAPER_POLICY.standardThirdWeekFraction) *
        Math.min(
          1,
          new Set(runs.map((w) => w.date)).size /
            (usesMarathonBook(p) && bucket === 1
              ? marathonRaceWeekRunCount(p)
              : p.days.length),
        );
      const actual = runs.reduce((n, w) => n + w.minutes, 0);
      if (actual > target) {
        const editable = runs.filter(
          (w) => !asOf || (w.date >= asOf && w.status === 'planned'),
        );
        const retained = runs
          .filter((w) => !editable.includes(w))
          .reduce((n, w) => n + w.minutes, 0);
        const adjustable = editable.reduce((n, w) => n + w.minutes, 0);
        for (const w of editable)
          update(w, (w.minutes * Math.max(0, target - retained)) / adjustable);
      }
    }
  }
  // Final reductions can change long-run share; references are already stable.
  constrainLongShares();
  return refreshWeekTotals(plan);
}

export function rebalanceFutureQuality(plan: Plan, asOf: string): Plan {
  plan.constraintsFrom = asOf;
  for (let pass = 0; pass < PLAN_LOAD_LIMITS.qualityRebalancePasses; pass++)
    for (const week of plan.weeks) {
      const runs = plan.workouts.filter(
        (w) =>
          w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
      );
      const editable = runs.filter(
        (w) =>
          w.status === 'planned' &&
          w.date >= asOf &&
          qualityWorkMinutes(w) > 0 &&
          (!w.changed || w.changeSource === 'preferences'),
      );
      if (!editable.length) continue;
      const immutableWork = runs
        .filter((w) => !editable.includes(w))
        .reduce((n, w) => n + qualityWorkMinutes(w), 0);
      const fraction = ['threshold-singles', 'double-threshold'].includes(
        plan.profile.method ?? '',
      )
        ? PLAN_LOAD_LIMITS.thresholdMethodQualityFraction
        : PLAN_LOAD_LIMITS.standardQualityFraction;
      let budget = Math.max(
        0,
        runs.reduce((n, w) => n + w.minutes, 0) * fraction - immutableWork,
      );
      const requested = editable.reduce((n, w) => n + qualityWorkMinutes(w), 0);
      if (requested <= budget + 0.01) continue;
      // Only reduce; falling back to easy is legitimate if a complete quality set cannot fit.
      const originalBudget = budget;
      for (const w of editable) {
        const allocation = Math.min(
          qualityWorkMinutes(w),
          usesMarathonBook(plan.profile)
            ? (originalBudget * qualityWorkMinutes(w)) / requested
            : budget / editable.length,
        );
        const replacement = resizeWorkout(
          w,
          plan.profile,
          trainingPhaseOn(plan.profile, week.phase, w.date),
          w.minutes,
          allocation,
        );
        Object.assign(w, replacement, {
          changed: true,
          changeSource: 'preferences',
          reason: `${w.reason} Quality reduced after a change in available weekly running; no extra mileage was added.`,
        });
        w.distanceEstimate = distanceEstimate(w.steps, plan.profile);
        budget -= qualityWorkMinutes(w);
      }
    }
  return refreshWeekTotals(plan);
}
