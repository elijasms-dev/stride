/** Plan generate responsibilities; extracted without changing policy or behavior. */
import { applyAdvancedMethod } from '../advanced-methods.ts';
import { marathonBookNote } from '../marathon-book.ts';
import { distanceEstimate, qualityWorkMinutes } from '../prescription.ts';
import { runMeasureNote } from '../run-distance.ts';
import { applyPreferredStartTimes } from '../runner-customization.ts';
import {
  longRunShareLimit,
  usesStandardQualityRhythm,
} from '../training-structure.ts';
import {
  isLongUltra,
  LONG_ULTRA_POLICY,
  longUltraCapacityMessage,
} from '../ultra-policy.ts';
import { scaleTemplate, WORKOUT_LIBRARY } from '../workout-library.ts';
import { withSpecificWorkoutName } from '../workout-names.ts';
import { withWorkoutTargets } from '../workout-targets.ts';
import {
  applyActualTrainingEnvelope,
  rebalanceFutureQuality,
} from './allocate.ts';
import { addDays, dateLabel, dayDiff } from './calendar.ts';
import { PlanError } from './errors.ts';
import {
  taperFactor,
  trainingPhaseOn,
  usesDailyTaperPhase,
} from './generation-calendar.ts';
import {
  DAYS_PER_WEEK,
  FEASIBILITY_POLICY,
  RUN_WALK_VARIANT_STRIDE,
  SESSION_POLICY,
} from './generation-constants.ts';
import {
  type ReplanContext,
  resolveGenerationPolicy,
} from './generation-policy.ts';
import {
  reconcileOpeningBaseline,
  reconcileOrdinaryWeeklyProgression,
} from './generation-baseline.ts';
import { buildSteps } from './generation-prescription.ts';
import {
  ensureGeneratedMarathonRhythm,
  normalizeGeneratedLongRuns,
} from './generation-reconcile.ts';
import { generatePlanWeeks } from './generation-weeks.ts';
import { round } from './math.ts';
import { ENGINE_VERSION, TRAINING_POLICY } from './policy.ts';
import {
  customExposureKm,
  preparationRequirements,
  raceDistance,
  trainingFamily,
  validateProfile,
} from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import { type Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { refreshWorkoutVariety } from './variety.ts';

// Numerical allocation must settle before a plan is accepted. This is a bounded
// computation guard, not a training progression or load allowance.
const MAX_FINAL_ALLOCATION_PASSES = 6;

export function makePlan(
  input: unknown,
  asOf?: string,
  findAlternative = true,
  replan?: ReplanContext,
): Plan {
  const context = resolveGenerationPolicy(validateProfile(input, asOf), replan);
  const {
    p,
    bookMarathon,
    shortBlock,
    familyPolicy,
    start,
    count,
    pace,
    isNovice,
    policy,
    base,
    family,
    longPace,
    absoluteCeiling,
    qualityDays,
    requestedQuality,
  } = context;
  const allowDeclaredOpening =
    replan?.baseline.source === 'declared-baseline' &&
    replan.from === p.startDate &&
    (replan.referenceRuns ?? p.days.length) === p.days.length;
  const { weeks, workouts } = generatePlanWeeks(context, replan);
  // Apply the quality-work fraction to actual capped sessions, not the requested mileage.
  for (const week of weeks) {
    const sessions = workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    const quality = sessions.filter((w) => w.templateId);
    const prescribedQuality = quality.reduce(
      (n, w) => n + qualityWorkMinutes(w),
      0,
    );
    const ceiling = Math.min(
      sessions.reduce((n, w) => n + w.minutes, 0) *
        (p.method === 'threshold-singles'
          ? SESSION_POLICY.thresholdSinglesWorkFraction
          : SESSION_POLICY.qualityWorkFraction),
      p.method === 'threshold-singles'
        ? (p.recentQualityMinutes ?? 0)
        : Infinity,
    );
    const guaranteed =
      usesStandardQualityRhythm(p) &&
      !['Recovery', 'Taper', 'Race week'].includes(week.phase);
    if (guaranteed && prescribedQuality <= ceiling + 0.01) continue;
    let remainingWork = ceiling;
    const orderedQuality = guaranteed
      ? [...quality].sort(
          (a, b) =>
            Number(b.kind !== 'long' && b.stimulus === 'threshold') -
            Number(a.kind !== 'long' && a.stimulus === 'threshold'),
        )
      : quality;
    for (const w of orderedQuality) {
      const template = WORKOUT_LIBRARY.find((t) => t.id === w.templateId);
      if (!template) continue;
      const dose = scaleTemplate(
        template,
        w.minutes,
        p.difficulty === 'gentle',
        trainingPhaseOn(p, week.phase, w.date),
        guaranteed
          ? Math.min(qualityWorkMinutes(w), remainingWork)
          : bookMarathon && prescribedQuality > 0
            ? (ceiling * qualityWorkMinutes(w)) / prescribedQuality
            : ceiling / quality.length,
        w.targetWorkMinutes,
        p,
        w.steps,
        guaranteed ? { capBasis: 'prescribed' } : {},
      );
      if (dose) {
        remainingWork -= dose.qualityMinutes;
        w.steps = dose.steps;
        w.minutes = dose.minutes;
        w.estimatedKm =
          w.kind === 'long'
            ? Math.min(w.estimatedKm, round(dose.minutes / longPace, 3))
            : round(dose.minutes / pace, 3);
        w.distanceEstimate = distanceEstimate(dose.steps, p);
        w.qualityMinutes = dose.qualityMinutes;
      } else {
        w.kind = w.kind === 'long' ? 'long' : 'easy';
        w.hard = false;
        w.title = w.kind === 'long' ? 'Easy long run' : 'Easy run';
        w.stimulus = 'aerobic';
        w.templateId = undefined;
        w.qualityMinutes = 0;
        w.steps = buildSteps(
          'easy',
          w.minutes,
          isNovice
            ? (p.runWalkStage ?? 0) * RUN_WALK_VARIANT_STRIDE
            : week.index,
          false,
          isNovice,
        );
        w.purpose = 'Easy volume while leaving enough room for recovery.';
      }
    }
  }
  const expanded = applyAdvancedMethod(
    workouts,
    p,
    weeks.map((w) => w.phase),
    usesDailyTaperPhase(p)
      ? (workout) => trainingPhaseOn(p, weeks[workout.week].phase, workout.date)
      : undefined,
  );
  workouts.splice(0, workouts.length, ...expanded);
  const timingError = applyPreferredStartTimes(workouts, p);
  if (timingError) throw new PlanError(timingError);
  if (
    p.method === 'double-threshold' &&
    !shortBlock &&
    !workouts.some((w) => w.pairType === 'double-threshold')
  )
    throw new PlanError(
      'Your existing volume allocation does not provide 64 minutes for the paired day, or a session cap is too low. Keep threshold singles until that daily workload is established; a larger time limit alone cannot create extra volume.',
    );
  if (
    p.method === 'easy-doubles' &&
    !shortBlock &&
    !workouts.some((w) => w.pairType === 'easy-doubles')
  )
    throw new PlanError(
      'The selected easy day needs at least 50 minutes to split into two useful sessions.',
    );
  const plan: Plan = {
    id: `plan-${start}-${p.goal}`,
    engineVersion: ENGINE_VERSION,
    policyVersion: TRAINING_POLICY.version,
    profile: p,
    weeks,
    workouts,
    notes: [
      runMeasureNote(p.runMeasure),
      ...(bookMarathon ? [marathonBookNote(p)] : []),
      ...(p.goal === '5k' && policy.longCeilingKm > familyPolicy.longCeilingKm
        ? [
            '5K endurance keeps room for your familiar longer easy run. It does not extend beyond your recent long-run baseline or a 90-minute planning allowance. Your weekly balance, time limits, recovery weeks and taper can make it shorter.',
          ]
        : []),
      ...(shortBlock
        ? [
            `Short block · ${dayDiff(p.startDate, p.raceDate) + 1} calendar days. Training starts from your current routine and stays within these dates.${p.goal === 'base' ? '' : ' The phase follows time remaining to race day; starting distances follow your current routine. Race taper is retained; earlier preparation is not squeezed into this block.'}`,
            ...(['easy-doubles', 'double-threshold'].includes(p.method ?? '') &&
            !workouts.some((w) => w.pairId)
              ? [
                  'No paired sessions fit this short block. Your method preference is retained; extra sessions have not been added to force it into the schedule.',
                ]
              : []),
          ]
        : []),
      'Progression is a forecast. Missed sessions are never added to later workouts.',
      ...(['custom', 'ultra'].includes(p.goal)
        ? [
            `Preparation band: ${preparationRequirements(p).band}. Templates use preparation bands; recommended build-up time and baseline mileage vary gradually with exact distance. There is no minimum block length. Running-day requirements remain explicit whole-day gates. Review the full block before activating. Event distance stays exact.`,
          ]
        : []),
      ...(isLongUltra(p)
        ? [
            'Long-ultra preparation spreads endurance across single runs, with one controlled workout at most and a long run capped at four hours. Race-preparation long runs rehearse walk breaks, fueling and equipment; a three-week taper reduces training. The six-week time check is a planning heuristic, not proof of race readiness.',
          ]
        : []),
      'Independent training rules; coaching review and real-watch validation are still pending.',
      ...(qualityDays.length < requestedQuality
        ? [
            `Your available days and preferred long-run day fit ${qualityDays.length} of ${requestedQuality} requested quality sessions with an easy or rest day between key efforts. Add availability or move the preferred long-run day to fit more; the remaining runs stay easy.`,
          ]
        : []),
      ...(p.days.length === 2
        ? [
            'Two-run weeks contain two easy outings, without a separate speed session or long run.',
          ]
        : []),
    ],
    createdAt: p.startDate,
    baselineEvidence: replan?.baseline,
    ...(replan?.returnState ? { returnState: replan.returnState } : {}),
    feasibility: {
      status: 'forecast',
      reasons: [],
      asOf: replan?.from ?? p.startDate,
    },
  };
  reconcileOpeningBaseline(plan, allowDeclaredOpening);
  applyActualTrainingEnvelope(plan, undefined, replan?.retainedPrefix);
  rebalanceFutureQuality(plan, replan?.from ?? p.startDate);
  normalizeGeneratedLongRuns(plan, replan?.from ?? p.startDate);
  reconcileOpeningBaseline(plan, allowDeclaredOpening);
  reconcileOrdinaryWeeklyProgression(plan, allowDeclaredOpening);
  const requiredExposure = isLongUltra(p)
    ? LONG_ULTRA_POLICY.rehearsalMinutes
    : ['custom', 'ultra'].includes(p.goal)
      ? customExposureKm(raceDistance(p))
      : policy.minimumTrainingExposureKm;
  const exposure = Math.max(
    0,
    ...workouts
      .filter(
        (w) => w.kind === 'long' || (p.days.length === 2 && w.kind === 'easy'),
      )
      .map((w) => (isLongUltra(p) ? w.minutes : w.estimatedKm)),
  );
  const exposureUnit = isLongUltra(p) ? 'minutes' : 'km';
  if (
    p.goal !== 'base' &&
    exposure + 0.01 < requiredExposure &&
    (replan || shortBlock)
  ) {
    plan.feasibility = {
      status: 'review-required',
      asOf: replan?.from ?? p.startDate,
      reasons: [
        shortBlock
          ? `This short block reaches ${round(exposure)} ${exposureUnit} for its longest training session. It does not include the full event build-up; preparation before the start date is outside this plan.`
          : `The remaining block reaches ${round(exposure)} ${exposureUnit} for its longest training session, below this event policy's ${round(requiredExposure)} ${exposureUnit} preparation exposure. Review the event or date; the old forecast is not evidence of readiness.`,
      ],
    };
  }
  if (
    p.goal !== 'base' &&
    exposure + 0.01 < requiredExposure &&
    !replan &&
    !shortBlock
  ) {
    const maximumFromBaseline =
      Math.min(
        absoluteCeiling,
        p.peakWeeklyKm ?? Infinity,
        (p.weeklyMinutesLimit ?? Infinity) / pace,
        base * (p.volume === 'gradual' ? policy.maxForecast : 1),
      ) *
      longRunShareLimit(p) *
      (pace / longPace);
    if (family === 'marathon' && maximumFromBaseline + 0.01 < requiredExposure)
      throw new PlanError(
        `Your current baseline and volume limits leave a longest training exposure of at most ${round(maximumFromBaseline)} km; this model needs room for ${requiredExposure} km. More available time or a later race cannot overcome this volume limit. Start with a base-building plan, or review your recent mileage and volume preference if entered incorrectly.`,
      );
    let alternative = '';
    if (findAlternative)
      for (
        let extra = 1;
        extra <= FEASIBILITY_POLICY.maximumAlternativeWeeks;
        extra++
      ) {
        const nextDate = addDays(p.raceDate, extra * DAYS_PER_WEEK);
        if (dayDiff(p.startDate, nextDate) > FEASIBILITY_POLICY.maximumPlanDays)
          break;
        try {
          makePlan({ ...p, raceDate: nextDate }, asOf, false);
          alternative = ` With these inputs, try a race on or after ${dateLabel(nextDate, { day: 'numeric', month: 'long', year: 'numeric' })}.`;
          break;
        } catch {}
      }
    throw new PlanError(
      `These limits leave a longest training exposure of ${round(exposure)} ${exposureUnit}; this policy requires room for ${round(requiredExposure)} ${exposureUnit}. Allow more session time, review distance caps, or build a base first.${alternative}`,
    );
  }
  if (
    replan &&
    !isLongUltra(p) &&
    p.goal !== 'base' &&
    replan.baseline.source === 'recorded-plan-history' &&
    replan.baseline.weeklyKm < preparationRequirements(p).minWeekly
  ) {
    plan.feasibility = {
      status: 'review-required',
      asOf: replan.from,
      reasons: [
        ...(plan.feasibility?.reasons ?? []),
        'Your recorded recent weekly volume is below this event’s preparation baseline. The reduced forecast is retained; review the event and current running capacity before progressing.',
      ],
    };
  }
  let capacityReason = '';
  if (isLongUltra(p) && !replan)
    capacityReason = longUltraCapacityMessage(plan) ?? '';
  if (trainingFamily(p) === 'ultra' && !isLongUltra(p) && !replan) {
    const peakHours = weeks.map((w) => {
      const runs = workouts.filter(
        (s) => s.week === w.index && s.kind !== 'race',
      );
      // A partially tapered week cannot establish a full pre-taper capacity week.
      // Keep its zero in place so separated weeks cannot become consecutive.
      return runs.some((s) => taperFactor(p, s.date) < 1)
        ? 0
        : runs.reduce((n, s) => n + s.minutes, 0);
    });
    const candidates = peakHours.slice(
      Math.max(0, count - FEASIBILITY_POLICY.ultraCapacityLookbackWeeks),
      Math.max(0, count - FEASIBILITY_POLICY.ultraTaperWeeks),
    );
    if (
      !candidates.some(
        (m, i) =>
          i >= FEASIBILITY_POLICY.ultraConsecutiveCapacityWeeks - 1 &&
          m >= FEASIBILITY_POLICY.ultraCapacityMinutes &&
          candidates[i - 1] >= FEASIBILITY_POLICY.ultraCapacityMinutes &&
          candidates[i - 2] >= FEASIBILITY_POLICY.ultraCapacityMinutes,
      )
    )
      capacityReason = shortBlock
        ? 'This short ultra block does not include three consecutive six-hour training weeks before taper. Preparation before the start date is outside this plan; the shorter schedule does not establish race readiness.'
        : 'The generated ultra block cannot fit three consecutive six-hour training weeks before taper. Increase available time or choose a shorter distance; a longer race does not justify compressing the workload.';
  }
  if (capacityReason) {
    if (!shortBlock) throw new PlanError(capacityReason);
    plan.feasibility = {
      status: 'review-required',
      asOf: p.startDate,
      reasons: [...(plan.feasibility?.reasons ?? []), capacityReason],
    };
  }
  ensureGeneratedMarathonRhythm(plan, replan?.from ?? p.startDate);
  normalizeGeneratedLongRuns(plan, replan?.from ?? p.startDate);
  reconcileOpeningBaseline(plan, allowDeclaredOpening);
  reconcileOrdinaryWeeklyProgression(plan, allowDeclaredOpening);
  const varied = refreshWorkoutVariety(plan, replan?.from ?? p.startDate);
  normalizeGeneratedLongRuns(varied, replan?.from ?? p.startDate);
  reconcileOpeningBaseline(varied, allowDeclaredOpening);
  reconcileOrdinaryWeeklyProgression(varied, allowDeclaredOpening);
  const errors = validatePlan(varied);
  if (errors.length) throw new PlanError(errors[0]);
  varied.workouts = varied.workouts.map((w) =>
    withWorkoutTargets(withSpecificWorkoutName(w), varied.profile),
  );
  // Funding can change the familiar outing used by recovery and taper. Settle
  // those bounds against the final executable distances so a harmless later
  // preference review cannot discover another reduction in the accepted plan.
  const allocationSnapshot = () =>
    JSON.stringify(
      varied.workouts.map((w) => [w.minutes, w.estimatedKm, w.steps]),
    );
  let allocationSettled = false;
  for (let pass = 0; pass < MAX_FINAL_ALLOCATION_PASSES; pass++) {
    const before = allocationSnapshot();
    applyActualTrainingEnvelope(varied, undefined, replan?.retainedPrefix);
    rebalanceFutureQuality(varied, replan?.from ?? p.startDate);
    ensureGeneratedMarathonRhythm(varied, replan?.from ?? p.startDate);
    normalizeGeneratedLongRuns(varied, replan?.from ?? p.startDate);
    reconcileOpeningBaseline(varied, allowDeclaredOpening);
    reconcileOrdinaryWeeklyProgression(varied, allowDeclaredOpening);
    if (allocationSnapshot() === before) {
      allocationSettled = true;
      break;
    }
  }
  if (!allocationSettled)
    throw new PlanError(
      'The weekly progression and session limits cannot settle into a consistent plan. Review the starting load and available training time together.',
    );
  refreshWeekTotals(varied);
  const finalErrors = validatePlan(varied);
  if (finalErrors.length) throw new PlanError(finalErrors[0]);
  return varied;
}
