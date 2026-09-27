import { schedulingEasyPace } from '../fitness-pacing.ts';
import { qualityWorkMinutes } from '../prescription.ts';
import { runningDayLimit } from '../runner-customization.ts';
import {
  isRoadRaceProfile,
  isShortRoadRaceProfile,
} from '../road-training-policy.ts';
import {
  qualitySchedule,
  requestedQualityCount,
  weeklyQualityCount,
  usesMarathonRhythm,
  usesStandardQualityRhythm,
} from '../training-structure.ts';
import {
  resizeWorkout,
  scaleTemplate,
  WORKOUT_LIBRARY,
} from '../workout-library.ts';
import { withAllocatedWorkoutTargets as withWorkoutTargets } from '../workout-targets.ts';
import { addDays, dayDiff, weekday } from './calendar.ts';
import { PlanError } from './errors.ts';
import { taperFactor, weekIncludesTaper } from './generation-calendar.ts';
import { round } from './math.ts';
import { PLAN_LOAD_LIMITS } from './policy-constants.ts';
import { TRAINING_POLICY } from './policy.ts';
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import type { Plan, Workout } from './types.ts';

/** Only untouched complete ordinary weeks carry the generated rhythm contract.
 * Deliberate changes, observed history and return plans have their own allocation. */
function eligibleWeeks(plan: Plan, from: string, customChoice = false) {
  if (
    plan.firstRace ||
    plan.policyVersion !== TRAINING_POLICY.version ||
    plan.returnState ||
    (plan.baselineEvidence?.source === 'recorded-plan-history' &&
      plan.baselineEvidence.supportsProgression !== true) ||
    (customChoice
      ? plan.profile.qualityMode !== 'custom' ||
        plan.profile.goal === 'base' ||
        !!(plan.profile.method && plan.profile.method !== 'balanced')
      : !usesStandardQualityRhythm(plan.profile))
  )
    return [];
  return plan.weeks.flatMap((week) => {
    if (
      week.start < from ||
      week.start < plan.profile.startDate ||
      addDays(week.start, 6) > plan.profile.raceDate ||
      ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
      // The generation contract intentionally keeps a returning/new runner's
      // non-marathon foundation easy. Enforce their saved count once the
      // ordinary workout phase begins, without changing declared mileage.
      (customChoice &&
        (plan.profile.qualitySessions ?? 1) > 0 &&
        week.phase === 'Foundation' &&
        plan.profile.experience !== 'established' &&
        !usesMarathonRhythm(plan.profile)) ||
      taperFactor(plan.profile, addDays(week.start, 6)) < 1
    )
      return [];
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    if (
      runs.length !== plan.profile.days.length ||
      new Set(runs.map((w) => w.date)).size !== plan.profile.days.length ||
      runs.some(
        (w) =>
          w.status !== 'planned' ||
          w.returnRole ||
          (w.changed && w.changeSource !== 'preferences') ||
          w.steps.some((s) => s.movement === 'walk' && s.kind !== 'recovery'),
      )
    )
      return [];
    return [{ week, runs }];
  });
}

const usefulQuality = (w: Workout) =>
  w.kind !== 'long' &&
  w.hard &&
  ['tempo', 'intervals', 'fartlek'].includes(w.kind) &&
  qualityWorkMinutes(w) >= PLAN_LOAD_LIMITS.minimumTempoWorkMinutes - 1e-6;

/** Validate the same eligible weeks that generation can repair, without mutation. */
export function standardQualityRhythmErrors(plan: Plan): string[] {
  if (isRoadRaceProfile(plan.profile)) return [];
  const errors: string[] = [];
  for (const { week, runs } of eligibleWeeks(
    plan,
    plan.constraintsFrom ?? plan.profile.startDate,
  )) {
    const quality = runs.filter((w) => w.hard || w.kind === 'long');
    if (
      quality.length !== 2 ||
      quality.filter((w) => w.kind === 'long').length !== 1 ||
      quality.filter(usefulQuality).length !== 1
    )
      errors.push(
        `Week ${week.index + 1} needs one complete weekday quality workout and one long run. Review the workout time and weekly allocation together.`,
      );
  }
  return errors;
}

/** An explicit ordinary-week count cannot disappear into an easy/strides recipe.
 * Deliberate edits, recorded history, returns and specialist paired methods keep
 * their existing exceptions; constraints are surfaced instead of relaxing choice. */
export function explicitQualityFrequencyErrors(plan: Plan): string[] {
  if (isRoadRaceProfile(plan.profile)) return [];
  const expected = plan.profile.qualitySessions ?? 1;
  return eligibleWeeks(
    plan,
    plan.constraintsFrom ?? plan.profile.startDate,
    true,
  ).flatMap(({ week, runs }) => {
    const actual = runs.filter(
      (w) => w.kind !== 'long' && w.hard && qualityWorkMinutes(w) > 0,
    ).length;
    return actual === expected
      ? []
      : [
          `Week ${week.index + 1} cannot retain your selected ${expected} weekday workouts within the current allocation. Review the workout count, running days and session limits together.`,
        ];
  });
}

/** Count the executable work, not a cached quality total or a stale hard flag. */
const roadWorkMinutes = (workout: Workout) =>
  workout.steps.reduce(
    (minutes, step) =>
      minutes +
      (step.kind === 'work' && step.intensity >= 4 && step.movement !== 'walk'
        ? step.seconds / 60
        : 0),
    0,
  );

/** Named road plans retain the resolved choice throughout complete ordinary weeks.
 * Missing sessions and walking substitutions are errors, not eligibility escapes. */
export function roadQualityFrequencyErrors(
  plan: Plan,
  observedWorkouts: Workout[] = [],
): string[] {
  const p = plan.profile;
  if (
    !isRoadRaceProfile(p) ||
    plan.policyVersion !== TRAINING_POLICY.version ||
    plan.returnState ||
    (p.method && p.method !== 'balanced') ||
    (plan.baselineEvidence?.source === 'recorded-plan-history' &&
      plan.baselineEvidence.supportsProgression !== true)
  )
    return [];
  const from = plan.constraintsFrom ?? p.startDate;
  const errors: string[] = [];
  // A replan can reserve a recorded day before the caller merges its immutable
  // journal prefix. Only actual completed records qualify as this context;
  // forecast prescriptions and arbitrary missing days never do.
  const observed = [...plan.workouts, ...observedWorkouts].filter(
    (run) =>
      run.status === 'completed' &&
      run.feedback &&
      Number.isFinite(run.feedback.actualMinutes) &&
      run.feedback.actualMinutes > 0,
  );
  const recordedDates = observed.flatMap((run) => [
    run.feedback!.actualDate ?? run.date,
    run.date,
  ]);
  const demandingDates = observed
    .filter(
      (run) => run.hard || run.kind === 'long' || run.feedback!.effort >= 7,
    )
    .map((run) => run.feedback!.actualDate ?? run.date);
  for (const run of plan.extraRuns ?? []) {
    if (!Number.isFinite(run.minutes) || run.minutes <= 0) continue;
    recordedDates.push(run.date);
    if (
      run.effort >= 7 ||
      run.minutes >= Math.max(45, p.longestKm * schedulingEasyPace(p) * 0.9)
    )
      demandingDates.push(run.date);
  }
  for (const week of plan.weeks) {
    const end = addDays(week.start, 6);
    if (
      week.start < from ||
      week.start < p.startDate ||
      recordedDates.some((date) => date >= week.start && date <= end) ||
      demandingDates.some((date) => addDays(date, 1) === week.start)
    )
      continue;
    const runs = plan.workouts.filter(
      (workout) => workout.week === week.index && workout.kind !== 'race',
    );
    if (
      runs.some(
        (workout) =>
          workout.status !== 'planned' ||
          workout.returnRole ||
          (workout.changed && workout.changeSource !== 'preferences'),
      )
    )
      continue;
    const reducedWeek =
      end >= p.raceDate ||
      ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
      weekIncludesTaper(p, week.start);
    if (reducedWeek) {
      // The supplied eight-week intermediate reference retains a familiar
      // stimulus in taper/race weeks. Partial race weeks without an eligible
      // pre-race slot and separate beginner/return courses are not that contract.
      if (
        isShortRoadRaceProfile(p) &&
        !plan.firstRace &&
        !plan.beginner &&
        (!plan.constraintsFrom || plan.constraintsFrom === p.startDate) &&
        !plan.baselineEvidence &&
        !runs.some((run) => run.changed) &&
        dayDiff(p.startDate, p.raceDate) >= 55 &&
        requestedQualityCount(p) > 0 &&
        qualitySchedule(p, week.index).some(
          (day) => dayDiff(addDays(week.start, day), p.raceDate) >= 3,
        )
      ) {
        const quality = runs.filter(
          (run) =>
            ['tempo', 'intervals', 'fartlek'].includes(run.kind) &&
            run.hard &&
            !['aerobic', 'economy'].includes(run.stimulus ?? '') &&
            roadWorkMinutes(run) > 0,
        );
        if (!quality.length)
          errors.push(
            `Week ${week.index + 1} must retain a running quality session during short-race consolidation or taper.`,
          );
        if (week.phase === 'Recovery')
          errors.push(
            `Week ${week.index + 1} cannot use a full recovery week in this short-race block.`,
          );
      }
      continue;
    }
    const expectedDates = Array.from({ length: 7 }, (_, day) =>
      addDays(week.start, day),
    ).filter((date) => p.days.includes(weekday(date)));
    if (
      runs.length !== expectedDates.length ||
      expectedDates.some(
        (date) => runs.filter((run) => run.date === date).length !== 1,
      )
    )
      errors.push(
        `Week ${week.index + 1} must retain all ${p.days.length} selected running days; a missing or duplicated run cannot satisfy the workout frequency.`,
      );
    const expected = weeklyQualityCount(p, week.index);
    const weekdayRuns = runs.filter((run) => run.kind !== 'long');
    const useful = weekdayRuns.filter(
      (run) =>
        ['tempo', 'intervals', 'fartlek'].includes(run.kind) &&
        run.hard &&
        !['aerobic', 'economy'].includes(run.stimulus ?? '') &&
        roadWorkMinutes(run) >= PLAN_LOAD_LIMITS.minimumTempoWorkMinutes - 1e-6,
    );
    const invalidQuality = weekdayRuns.some((run) => {
      const dose = roadWorkMinutes(run);
      const complete = useful.includes(run);
      const relaxedStrides =
        run.kind === 'easy' &&
        !run.hard &&
        run.stimulus === 'economy' &&
        dose <= 3 + 1e-6 &&
        run.steps
          .filter((step) => step.kind === 'work' && step.intensity >= 4)
          .every((step) => step.seconds <= 30);
      return (
        (run.hard && !complete) ||
        (['tempo', 'intervals', 'fartlek'].includes(run.kind) && !complete) ||
        (dose > 0 && !complete && !relaxedStrides)
      );
    });
    if (useful.length !== expected || invalidQuality)
      errors.push(
        `Week ${week.index + 1} needs exactly ${expected} complete weekday workouts, each with at least ${PLAN_LOAD_LIMITS.minimumTempoWorkMinutes} minutes of running work. Easy running, walking, strides and stale workout labels do not satisfy this choice.`,
      );
    const longRuns = runs.filter((run) => run.kind === 'long');
    if (
      p.days.length > 2 &&
      (longRuns.length !== 1 ||
        longRuns.some((run) => run.hard || roadWorkMinutes(run) > 0))
    )
      errors.push(
        `Week ${week.index + 1} needs one separate easy long run alongside the selected weekday workouts.`,
      );
  }
  return errors;
}

function fallbackTemplate(plan: Plan) {
  const family = trainingFamily(plan.profile);
  const id =
    family === 'ultra'
      ? 'ultra-steady'
      : usesMarathonRhythm(plan.profile)
        ? 'marathon-book-lt-6'
        : 'threshold-cruise';
  return WORKOUT_LIBRARY.find((t) => t.id === id)!;
}

/** Restore the weekday stimulus using existing aerobic minutes. No long-run time,
 * completed work, explicit edits, or new weekly minutes fund the guarantee. */
export function ensureGeneratedQualityRhythm(plan: Plan, from: string) {
  // Named road plans fund their complete sessions during allocation. The legacy
  // post-generation repair would replace their distance-specific prescriptions.
  if (isRoadRaceProfile(plan.profile)) return;
  const p = plan.profile;
  const customTwo = p.qualityMode === 'custom' && p.qualitySessions === 2;
  const qualityDays = qualitySchedule(p).slice(0, customTwo ? 2 : 1);
  const pace = Math.max(
    schedulingEasyPace(p),
    p.runMeasure === 'distance' && p.workoutTargets?.mode === 'pace'
      ? (p.workoutTargets.pace?.easy?.high ?? 0) / 60
      : 0,
  );
  for (const { week, runs, qualityDay } of eligibleWeeks(
    plan,
    from,
    customTwo,
  ).flatMap(({ week, runs }) =>
    qualityDays.map((qualityDay) => ({ week, runs, qualityDay })),
  )) {
    const long = runs.find((w) => w.kind === 'long');
    const tempo = runs.find((w) => weekday(w.date) === qualityDay);
    if (!long || !tempo)
      throw new PlanError(
        `Week ${week.index + 1} cannot place a weekday workout with an easy or rest day before the long run. Review the available running days.`,
      );
    const originalMinutes = runs.reduce((n, w) => n + w.minutes, 0);
    const cap = Math.min(
      p.weekdayMinutes,
      runningDayLimit(p, qualityDay),
      (p.qualityLimitKm ?? Infinity) * pace,
    );
    if (cap < PLAN_LOAD_LIMITS.minimumTempoSessionMinutes)
      throw new PlanError(
        `Week ${week.index + 1} cannot fit a 30-minute quality workout within the selected time and distance limits.`,
      );
    // A rebuilt routine can contain an old extra weekday stimulus. Its minutes
    // remain on that day as easy running before the selected slot is funded.
    for (const other of runs.filter(
      (w) =>
        w !== tempo &&
        w !== long &&
        w.hard &&
        !qualityDays.includes(weekday(w.date)),
    ))
      Object.assign(
        other,
        resizeWorkout(other, p, week.phase, other.minutes, 0),
      );
    const previousTempoMinutes = tempo.minutes;
    const targetMinutes = Math.max(
      PLAN_LOAD_LIMITS.minimumTempoSessionMinutes,
      tempo.minutes,
    );
    let missing = targetMinutes - tempo.minutes;
    const donors = runs.filter(
      (w) =>
        w !== tempo &&
        w !== long &&
        !w.hard &&
        !qualityDays.includes(weekday(w.date)),
    );
    if (
      donors.reduce(
        (n, w) =>
          n + Math.max(0, w.minutes - PLAN_LOAD_LIMITS.minimumSessionMinutes),
        0,
      ) <
      missing - 1e-6
    )
      throw new PlanError(
        `Week ${week.index + 1} cannot fund a complete weekday quality workout alongside its long run and minimum easy outings. Review the baseline, running days or session limits.`,
      );
    for (const donor of donors) {
      if (missing <= 1e-6) break;
      const take = Math.min(
        missing,
        donor.minutes - PLAN_LOAD_LIMITS.minimumSessionMinutes,
      );
      const before = donor.minutes;
      if (take > 0)
        Object.assign(
          donor,
          resizeWorkout(donor, p, week.phase, donor.minutes - take),
        );
      missing -= before - donor.minutes;
    }
    const ceiling = originalMinutes * PLAN_LOAD_LIMITS.standardQualityFraction;
    const template = fallbackTemplate(plan);
    const minimumWork =
      template.workSeconds
        .slice(0, template.minimumReps)
        .reduce((n, s) => n + s, 0) / 60 ||
      (template.workSeconds[0] * template.minimumReps) / 60;
    const fallbackWork = Math.max(
      PLAN_LOAD_LIMITS.minimumTempoWorkMinutes,
      template.workSeconds.length === 1
        ? (template.workSeconds[0] * template.minimumReps) / 60
        : minimumWork,
    );
    // A missing selected workout still owns its minimum complete dose. Do not
    // spend that allowance on the first slot or on a faster long-run finish.
    const reservedOtherWork = (w: Workout) =>
      qualityDays.includes(weekday(w.date)) && w !== tempo
        ? Math.max(fallbackWork, qualityWorkMinutes(w))
        : qualityWorkMinutes(w);
    const otherWork = runs
      .filter((w) => w !== tempo && w !== long)
      .reduce((n, w) => n + reservedOtherWork(w), 0);
    if (qualityWorkMinutes(long) > ceiling - otherWork - fallbackWork)
      Object.assign(
        long,
        resizeWorkout(
          long,
          p,
          week.phase,
          long.minutes,
          Math.max(0, ceiling - otherWork - fallbackWork),
        ),
      );
    const allowance = Math.max(
      0,
      ceiling -
        runs
          .filter((w) => w !== tempo)
          .reduce((n, w) => n + reservedOtherWork(w), 0),
    );
    if (usefulQuality(tempo) && qualityWorkMinutes(tempo) <= allowance + 0.01) {
      const addedSeconds = Math.round(
        (targetMinutes - previousTempoMinutes) * 60,
      );
      if (addedSeconds > 0) {
        const relaxed = tempo.steps
          .map((step, index) => ({ step, index }))
          .filter(({ step }) => step.intensity <= 3)
          .sort((a, b) => b.step.seconds - a.step.seconds)[0];
        if (!relaxed)
          throw new PlanError(
            `Week ${week.index + 1} has no relaxed block to fund its complete weekday workout.`,
          );
        tempo.steps = tempo.steps.map((step, index) => ({
          ...step,
          seconds: step.seconds + (index === relaxed.index ? addedSeconds : 0),
        }));
        tempo.minutes = tempo.steps.reduce((n, s) => n + s.seconds, 0) / 60;
        tempo.estimatedKm = round(
          tempo.estimatedKm + addedSeconds / (pace * 60),
          3,
        );
        Object.assign(tempo, withWorkoutTargets(tempo, p));
      }
      continue;
    }
    const dose = scaleTemplate(
      template,
      targetMinutes,
      p.difficulty === 'gentle',
      week.phase,
      allowance,
      fallbackWork,
      p,
      undefined,
      { capBasis: 'prescribed' },
    );
    if (!dose || dose.qualityMinutes < PLAN_LOAD_LIMITS.minimumTempoWorkMinutes)
      throw new PlanError(
        `Week ${week.index + 1} cannot fit a complete controlled workout within its weekly work allowance.`,
      );
    Object.assign(tempo, {
      steps: dose.steps,
      minutes: dose.minutes,
      estimatedKm: round(dose.minutes / pace, 3),
      kind: template.kind,
      hard: true,
      templateId: template.id,
      stimulus: template.stimulus,
      role: template.stimulus,
      qualityMinutes: dose.qualityMinutes,
      targetWorkMinutes: fallbackWork,
      title: template.title,
      purpose: template.purpose,
      reason:
        'A complete controlled workout and the long run preserve the weekly rhythm within the existing running allocation.',
    });
    Object.assign(tempo, withWorkoutTargets(tempo, p));
    if (
      runs.reduce((n, w) => n + w.minutes, 0) >
      originalMinutes + 1 / 60 + 1e-6
    )
      throw new PlanError(
        `Week ${week.index + 1} cannot restore its quality workout without adding weekly running time.`,
      );
  }
  refreshWeekTotals(plan);
}
