import { schedulingEasyPace } from '../fitness-pacing.ts';
import { qualityWorkMinutes } from '../prescription.ts';
import { runningDayLimit } from '../runner-customization.ts';
import {
  qualitySchedule,
  usesMarathonRhythm,
  usesStandardQualityRhythm,
} from '../training-structure.ts';
import {
  resizeWorkout,
  scaleTemplate,
  WORKOUT_LIBRARY,
} from '../workout-library.ts';
import { withWorkoutTargets } from '../workout-targets.ts';
import { addDays, weekday } from './calendar.ts';
import { PlanError } from './errors.ts';
import { taperFactor } from './generation-calendar.ts';
import { round } from './math.ts';
import { PLAN_LOAD_LIMITS } from './policy-constants.ts';
import { TRAINING_POLICY } from './policy.ts';
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import type { Plan, Workout } from './types.ts';

/** Only untouched complete ordinary weeks carry the generated rhythm contract.
 * Deliberate changes, observed history and return plans have their own allocation. */
function eligibleWeeks(plan: Plan, from: string) {
  if (
    plan.policyVersion !== TRAINING_POLICY.version ||
    plan.returnState ||
    (plan.baselineEvidence?.source === 'recorded-plan-history' &&
      plan.baselineEvidence.supportsProgression !== true) ||
    !usesStandardQualityRhythm(plan.profile)
  )
    return [];
  return plan.weeks.flatMap((week) => {
    if (
      week.start < from ||
      week.start < plan.profile.startDate ||
      addDays(week.start, 6) > plan.profile.raceDate ||
      ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
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
  const p = plan.profile;
  const qualityDay = qualitySchedule(p)[0];
  const pace = Math.max(
    schedulingEasyPace(p),
    p.runMeasure === 'distance' && p.workoutTargets?.mode === 'pace'
      ? (p.workoutTargets.pace?.easy?.high ?? 0) / 60
      : 0,
  );
  for (const { week, runs } of eligibleWeeks(plan, from)) {
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
    for (const other of runs.filter((w) => w !== tempo && w !== long && w.hard))
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
    const donors = runs.filter((w) => w !== tempo && w !== long && !w.hard);
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
    const otherWork = runs
      .filter((w) => w !== tempo && w !== long)
      .reduce((n, w) => n + qualityWorkMinutes(w), 0);
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
          .reduce((n, w) => n + qualityWorkMinutes(w), 0),
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
