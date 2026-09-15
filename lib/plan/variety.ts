/** Plan variety responsibilities; extracted without changing policy or behavior. */
import { distanceEstimate, qualityWorkMinutes } from '../prescription.ts';
import { isSteadyRaceAdaptation } from '../steady-race-workout.ts';
import {
  customWorkoutEventDistance,
  eventContextText,
} from '../workout-event-context.ts';
import {
  scaleTemplate,
  variedWorkoutPrescription,
  WORKOUT_LIBRARY,
} from '../workout-library.ts';
import {
  withSpecificWorkoutName,
  withSteadyRaceInstructions,
} from '../workout-names.ts';
import { withWorkoutTargets } from '../workout-targets.ts';
import { rebalanceFutureQuality } from './allocate.ts';
import { PlanError } from './errors.ts';
import {
  taperFactor,
  trainingPhaseOn,
  usesDailyTaperPhase,
} from './generation-calendar.ts';
import { trainingFamily } from './profile.ts';
import { type Plan, type Workout } from './types.ts';
import { validatePlan } from './validate.ts';

/** Pure, opt-in recipe refresh. Schedule, volume and protected prescriptions stay fixed. */
export function refreshWorkoutVariety(
  plan: Plan,
  fromDate: string,
  protectedWorkoutIds: readonly string[] = [],
): Plan {
  const next = structuredClone(plan);
  const profile = { ...next.profile, goal: trainingFamily(next.profile) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return next;
  if (
    profile.experience !== 'established' ||
    profile.intent === 'finish' ||
    !['5k', '10k', 'half', 'marathon'].includes(profile.goal) ||
    (profile.method && profile.method !== 'balanced') ||
    next.returnState
  )
    return next;
  const protectedIds = new Set(protectedWorkoutIds);
  const phaseOn = (workout: Workout) => {
    const phase = next.weeks.find((week) => week.index === workout.week)?.phase;
    return phase && usesDailyTaperPhase(next.profile)
      ? trainingPhaseOn(next.profile, phase, workout.date)
      : phase;
  };
  // The unchanged taper must still refer to a recipe the runner met beforehand.
  // Preserve its most recent pre-taper anchor, including longer race-specific blocks.
  const taper = next.workouts.filter((workout) =>
    ['Taper', 'Race week'].includes(phaseOn(workout) ?? ''),
  );
  for (const reduced of taper) {
    if (!reduced.templateId) continue;
    const anchor = next.workouts
      .filter(
        (workout) =>
          workout.date < reduced.date &&
          workout.status !== 'skipped' &&
          workout.templateId === reduced.templateId &&
          !['Taper', 'Race week'].includes(phaseOn(workout) ?? ''),
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (anchor) protectedIds.add(anchor.id);
  }
  // Keep the preparatory exposure when a new recipe asks for longer continuous work.
  const priorByStimulus = new Map<string, Workout>();
  const seenRecipes = new Set<string>();
  for (const workout of [...next.workouts].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    if (
      !workout.templateId ||
      !workout.stimulus ||
      workout.status === 'skipped' ||
      workout.kind === 'long'
    )
      continue;
    const prior = priorByStimulus.get(workout.stimulus);
    const longest = (w: Workout) =>
      Math.max(
        0,
        ...w.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
      );
    if (
      !seenRecipes.has(workout.templateId) &&
      prior &&
      longest(workout) > longest(prior)
    ) {
      protectedIds.add(prior.id);
      protectedIds.add(workout.id);
    }
    seenRecipes.add(workout.templateId);
    priorByStimulus.set(workout.stimulus, workout);
  }
  const exposures = new Map<string, number>();
  const previous = new Map<string, Workout>();
  const replacements = new Map<string, Workout>();
  const changedWeeks = new Set<number>();
  for (const workout of [...next.workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )) {
    if (
      workout.status === 'skipped' ||
      workout.kind === 'long' ||
      workout.kind === 'race' ||
      workout.kind === 'easy' ||
      !workout.templateId ||
      !['threshold', 'aerobic-power', 'race-rhythm'].includes(
        workout.stimulus ?? '',
      )
    )
      continue;
    const family = workout.stimulus!;
    const exposure = exposures.get(family) ?? 0;
    exposures.set(family, exposure + 1);
    const phase = phaseOn(workout);
    const eligible =
      workout.date >= fromDate &&
      workout.status === 'planned' &&
      !protectedIds.has(workout.id) &&
      !workout.pairId &&
      !workout.returnRole &&
      !(workout.changed && workout.changeSource !== 'preferences') &&
      phase &&
      !(
        profile.goal === 'marathon' &&
        taperFactor(next.profile, workout.date) < 1
      ) &&
      ['Foundation', 'Build', 'Race preparation'].includes(phase);
    const replacement = eligible
      ? variedWorkoutPrescription(
          workout,
          profile,
          phase,
          exposure,
          previous.get(family)?.templateId,
          next.profile,
          profile.goal === 'marathon' ? previous.get(family) : undefined,
        )
      : workout;
    previous.set(family, replacement);
    if (replacement !== workout) {
      replacements.set(
        workout.id,
        withWorkoutTargets(replacement, next.profile),
      );
      changedWeeks.add(workout.week);
    }
  }
  next.workouts = next.workouts.map(
    (workout) => replacements.get(workout.id) ?? workout,
  );
  // Only refresh accounting for weeks whose work changed; do not rebalance their load.
  for (const week of next.weeks.filter((item) =>
    changedWeeks.has(item.index),
  )) {
    const running = next.workouts.filter(
      (workout) =>
        workout.week === week.index &&
        workout.status !== 'skipped' &&
        workout.kind !== 'race',
    );
    week.qualityMinutes = running.reduce(
      (sum, workout) => sum + qualityWorkMinutes(workout),
      0,
    );
    if (week.rationale)
      week.rationale = week.rationale.map((reason) =>
        reason.includes('prescribed minutes; quality-work allocation')
          ? `${running.length} sessions, ${Math.round(running.reduce((sum, workout) => sum + workout.minutes, 0))} prescribed minutes; quality-work allocation ${Math.round(week.qualityMinutes!)} minutes.`
          : reason,
      );
  }
  return next;
}

export function workoutAlternatives(plan: Plan, id: string) {
  const w = plan.workouts.find((w) => w.id === id);
  if (!w || w.status !== 'planned' || w.kind === 'race' || w.pairId) return [];
  const event = customWorkoutEventDistance(plan.profile);
  return WORKOUT_LIBRARY.filter(
    (t) =>
      t.id !== w.templateId &&
      (t.kind === 'long') === (w.kind === 'long') &&
      (t.kind !== 'long' ||
        Math.max(...t.workSeconds) <=
          Math.max(
            0,
            ...w.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
          )) &&
      t.stimulus === w.stimulus &&
      t.goals.includes(trainingFamily(plan.profile)) &&
      t.phases.includes(
        trainingPhaseOn(plan.profile, plan.weeks[w.week].phase, w.date),
      ) &&
      (!t.hills || plan.profile.terrain === 'hills'),
  ).flatMap((t) => {
    const dose = scaleTemplate(
      t,
      w.minutes,
      plan.profile.difficulty === 'gentle',
      trainingPhaseOn(plan.profile, plan.weeks[w.week].phase, w.date),
      w.qualityMinutes ?? 0,
      w.qualityMinutes ?? 0,
      plan.profile,
      undefined,
      { capBasis: 'prescribed' },
    );
    if (!dose) return [];
    const candidate = {
      ...w,
      ...dose,
      templateId: t.id,
      kind: t.kind,
      stimulus: t.stimulus,
    };
    if (isSteadyRaceAdaptation(candidate)) {
      const preview = withSteadyRaceInstructions(candidate);
      return [
        {
          ...t,
          title: preview.title,
          purpose: preview.purpose,
          cue: preview.steps.find((s) => s.kind === 'work')!.effort,
        },
      ];
    }
    return [
      event !== undefined && t.stimulus === 'race-rhythm'
        ? {
            ...t,
            title: eventContextText(t.title, event),
            purpose: eventContextText(t.purpose, event),
            cue: eventContextText(t.cue, event),
          }
        : t,
    ];
  });
}

export function substituteWorkout(
  plan: Plan,
  id: string,
  templateId: string,
  asOf: string,
) {
  const next = structuredClone(plan),
    w = next.workouts.find((w) => w.id === id),
    t = workoutAlternatives(plan, id).find((t) => t.id === templateId);
  if (!w || w.date < asOf || !t)
    throw new PlanError(
      'Choose an available equivalent session with the same training purpose and no larger work dose.',
    );
  const dose = scaleTemplate(
    t,
    w.minutes,
    plan.profile.difficulty === 'gentle',
    trainingPhaseOn(plan.profile, plan.weeks[w.week].phase, w.date),
    w.qualityMinutes ?? 0,
    w.qualityMinutes ?? 0,
    plan.profile,
    undefined,
    { capBasis: 'prescribed' },
  )!;
  Object.assign(w, {
    kind: t.kind,
    hard: t.stimulus !== 'economy',
    stimulus: t.stimulus,
    templateId: t.id,
    title: t.title,
    purpose: t.purpose,
    steps: dose.steps,
    minutes: dose.minutes,
    estimatedKm: (w.estimatedKm * dose.minutes) / w.minutes,
    qualityMinutes: dose.qualityMinutes,
    changed: true,
    changeSource: 'manual',
    reason: `Equivalent ${t.stimulus} session selected within the original time and work budgets.`,
  });
  Object.assign(
    w,
    withWorkoutTargets(withSpecificWorkoutName(w), next.profile),
  );
  w.distanceEstimate = distanceEstimate(w.steps, next.profile);
  rebalanceFutureQuality(next, asOf);
  const errors = validatePlan(next);
  if (errors.length) throw new PlanError(errors[0]);
  return next;
}
