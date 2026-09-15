import { PLAN_LOAD_LIMITS } from './policy-constants.ts';
/** Plan generation-reconcile responsibilities; extracted without changing policy or behavior. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { qualityWorkMinutes } from '../prescription.ts';
import { runningDayLimit } from '../runner-customization.ts';
import { qualitySchedule, usesMarathonRhythm } from '../training-structure.ts';
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
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import { type Plan } from './types.ts';

/** Intersect the whole-kilometre forecast with every final session capacity.
 * A backward pass lowers earlier targets when a later ordinary week cannot fund
 * them; it never adds minutes, alters history, or creates an unmarked cutback. */
export function normalizeGeneratedMarathonLongRuns(plan: Plan, from: string) {
  if (trainingFamily(plan.profile) !== 'marathon' || plan.returnState) return;
  let nextBuildCeiling: number = PLAN_LOAD_LIMITS.maximumMarathonLongKm;
  for (const week of [...plan.weeks].reverse()) {
    if (week.start < from) continue;
    const long = plan.workouts.find(
      (w) => w.week === week.index && w.kind === 'long',
    );
    if (
      !long ||
      long.status !== 'planned' ||
      long.returnRole ||
      (long.changed && long.changeSource !== 'preferences')
    )
      continue;
    const ordinary =
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      taperFactor(plan.profile, addDays(week.start, 6)) >= 1;
    const km = Math.min(
      PLAN_LOAD_LIMITS.maximumMarathonLongKm,
      Math.floor(long.estimatedKm + 1e-6),
      ordinary ? nextBuildCeiling : PLAN_LOAD_LIMITS.maximumMarathonLongKm,
    );
    if (ordinary) nextBuildCeiling = km;
    if (long.estimatedKm !== km) {
      long.estimatedKm = km;
      Object.assign(long, withWorkoutTargets(long, plan.profile));
    }
  }
  refreshWeekTotals(plan);
}

/** Final allocation check for generated full weeks. History and deliberate adaptations
 * are handled by the existing state reducers; missing work is never caught up. */
export function ensureGeneratedMarathonRhythm(plan: Plan, from: string) {
  const p = plan.profile;
  if (!usesMarathonRhythm(p) || plan.returnState) return;
  const qualityDay = qualitySchedule(p)[0];
  for (const week of plan.weeks) {
    if (
      week.start < from ||
      ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
      taperFactor(p, addDays(week.start, 6)) < 1
    )
      continue;
    const runs = plan.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    if (
      runs.length !== p.days.length ||
      runs.some((w) => w.status !== 'planned' || w.returnRole)
    )
      continue;
    const tempo = runs.find((w) => weekday(w.date) === qualityDay);
    const long = runs.find((w) => w.kind === 'long');
    if (!tempo || !long) continue; // validatePlan reports an unfillable schedule.
    const timeCap = Math.min(
      p.weekdayMinutes,
      runningDayLimit(p, qualityDay),
      (p.qualityLimitKm ?? Infinity) * schedulingEasyPace(p),
    );
    if (
      tempo.minutes < PLAN_LOAD_LIMITS.minimumTempoSessionMinutes &&
      timeCap >= PLAN_LOAD_LIMITS.minimumTempoSessionMinutes
    ) {
      let missing = PLAN_LOAD_LIMITS.minimumTempoSessionMinutes - tempo.minutes;
      const donors = runs.filter((w) => w !== tempo && w !== long && !w.hard);
      if (
        donors.reduce(
          (sum, w) =>
            sum +
            Math.max(0, w.minutes - PLAN_LOAD_LIMITS.minimumSessionMinutes),
          0,
        ) >= missing
      ) {
        for (const donor of donors) {
          const take = Math.min(
            missing,
            donor.minutes - PLAN_LOAD_LIMITS.minimumSessionMinutes,
          );
          if (take > 0)
            Object.assign(
              donor,
              resizeWorkout(donor, p, week.phase, donor.minutes - take),
            );
          missing -= take;
        }
        tempo.minutes = PLAN_LOAD_LIMITS.minimumTempoSessionMinutes;
      }
    }
    if (
      tempo.minutes < PLAN_LOAD_LIMITS.minimumTempoSessionMinutes ||
      timeCap < PLAN_LOAD_LIMITS.minimumTempoSessionMinutes
    )
      throw new PlanError(
        `Week ${week.index + 1} cannot fit a 30-minute tempo workout within the selected time and distance limits.`,
      );
    const ceiling =
      runs.reduce((sum, w) => sum + w.minutes, 0) *
      PLAN_LOAD_LIMITS.standardQualityFraction;
    // Protect the weekday's useful minimum before allocating any faster long-run work.
    const otherWork = runs
      .filter((w) => w !== tempo && w !== long)
      .reduce((sum, w) => sum + qualityWorkMinutes(w), 0);
    if (
      qualityWorkMinutes(long) >
      ceiling - otherWork - PLAN_LOAD_LIMITS.minimumTempoWorkMinutes
    ) {
      Object.assign(
        long,
        resizeWorkout(
          long,
          p,
          week.phase,
          long.minutes,
          Math.max(
            0,
            ceiling - otherWork - PLAN_LOAD_LIMITS.minimumTempoWorkMinutes,
          ),
        ),
      );
    }
    const allowance = Math.max(
      0,
      ceiling -
        runs
          .filter((w) => w !== tempo)
          .reduce((sum, w) => sum + qualityWorkMinutes(w), 0),
    );
    if (
      tempo.hard &&
      tempo.stimulus === 'threshold' &&
      qualityWorkMinutes(tempo) >= PLAN_LOAD_LIMITS.minimumTempoWorkMinutes &&
      qualityWorkMinutes(tempo) <= allowance + 0.01
    )
      continue;
    const template = WORKOUT_LIBRARY.find(
      (t) => t.id === 'marathon-book-lt-6',
    )!;
    const dose = scaleTemplate(
      template,
      tempo.minutes,
      p.difficulty === 'gentle',
      week.phase,
      allowance,
      PLAN_LOAD_LIMITS.minimumTempoWorkMinutes,
      p,
      undefined,
      { capBasis: 'prescribed' },
    );
    if (!dose)
      throw new PlanError(
        `Week ${week.index + 1} cannot fit a complete tempo workout within its weekly work allowance.`,
      );
    Object.assign(tempo, {
      steps: dose.steps,
      minutes: dose.minutes,
      estimatedKm: round(dose.minutes / schedulingEasyPace(p), 3),
      kind: 'tempo',
      hard: true,
      templateId: template.id,
      stimulus: 'threshold',
      role: 'threshold',
      qualityMinutes: dose.qualityMinutes,
      targetWorkMinutes: PLAN_LOAD_LIMITS.minimumTempoWorkMinutes,
      title: template.title,
      purpose: template.purpose,
      reason:
        'A short controlled tempo preserves the two-session marathon rhythm within the existing weekly allocation.',
    });
    Object.assign(tempo, withWorkoutTargets(tempo, p));
  }
  refreshWeekTotals(plan);
}
