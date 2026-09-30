import type { Profile, Step, Workout } from './plan/types.ts';
import type { RecentRace } from './fitness-pacing.ts';
import { validateRecentRace } from './fitness-pacing.ts';
import {
  manualTargetRange,
  resolveEffortRole,
  validStepTarget,
  type StepTarget,
} from './workout-targets.ts';

export const SOURCE_PACING_VERSION = 'source-pacing-v1' as const;
export const PACING_ROLES = [
  'easy',
  'steady',
  'tempo',
  'threshold',
  'interval',
  'repetition',
  'race',
  'current-mile',
  'current-1500m',
  'current-5k',
  'current-10k',
  'current-half',
  'current-marathon',
  'current-race',
  'goal-race',
  'progressive',
  'recovery',
  'strides',
  'hills',
  'run-walk',
  'effort',
] as const;
export type PacingRole = (typeof PACING_ROLES)[number];
export const pacingRoleLabel: Record<PacingRole, string> = {
  easy: 'Conversational running',
  steady: 'Steady effort',
  tempo: 'Controlled tempo effort',
  threshold: 'Threshold effort',
  interval: 'Controlled interval effort',
  repetition: 'Repetition effort',
  race: 'Race effort',
  'current-mile': 'Current mile pace',
  'current-1500m': 'Current 1500 m pace',
  'current-5k': 'Current 5K pace',
  'current-10k': 'Current 10K pace',
  'current-half': 'Current half-marathon pace',
  'current-marathon': 'Current marathon pace',
  'current-race': 'Current race pace',
  'goal-race': 'Goal race pace',
  progressive: 'Progressive effort',
  recovery: 'Easy recovery',
  strides: 'Relaxed strides',
  hills: 'Controlled hill effort',
  'run-walk': 'Comfortable run/walk',
  effort: 'By effort',
};
export type PaceInstruction = {
  sourceId:
    | 'stride-adaptive'
    | 'nhs-c25k'
    | 'higdon-5k-intermediate'
    | 'higdon-10k-intermediate'
    | 'higdon-marathon-intermediate'
    | 'higdon-half-intermediate-2';
  sourceVersion: 'adaptive-v1' | 'nhs-c25k-v1' | 'public-2026-09-28';
  kind:
    | 'conversational'
    | 'progressive'
    | 'current-race'
    | 'goal-race'
    | 'effort';
  distanceKm?: number;
};
export type PacingSource = {
  id: string;
  version: string;
  title: string;
  url?: string;
  scope: 'pace-instruction' | 'stride-recipe';
};
export type StepPacing = {
  version: typeof SOURCE_PACING_VERSION;
  role: PacingRole;
  label: string;
  guidance: string;
  source: PacingSource;
  method:
    | 'effort'
    | 'same-distance-benchmark'
    | 'explicit-goal'
    | 'manual-override';
  reason: string;
  evidence?: RecentRace;
  referenceDistanceKm?: number;
  goal?: { distanceKm: number; timeMinutes: number };
  target?: StepTarget;
};
const sources: Record<PaceInstruction['sourceId'], PacingSource> = {
  'stride-adaptive': {
    id: 'stride-adaptive',
    version: 'adaptive-v1',
    title: 'Stride adaptive recipe',
    scope: 'stride-recipe',
  },
  'nhs-c25k': {
    id: 'nhs-c25k',
    version: 'nhs-c25k-v1',
    title: 'NHS Couch to 5K effort guidance',
    url: 'https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/',
    scope: 'pace-instruction',
  },
  'higdon-5k-intermediate': {
    id: 'higdon-5k-intermediate',
    version: 'public-2026-09-28',
    title: 'Hal Higdon intermediate 5K pacing instructions',
    url: 'https://www.halhigdon.com/training-programs/5k-training/intermediate-5k/',
    scope: 'pace-instruction',
  },
  'higdon-10k-intermediate': {
    id: 'higdon-10k-intermediate',
    version: 'public-2026-09-28',
    title: 'Hal Higdon intermediate 10K pacing instructions',
    url: 'https://www.halhigdon.com/training-programs/10k-training/intermediate-10k/',
    scope: 'pace-instruction',
  },
  'higdon-half-intermediate-2': {
    id: 'higdon-half-intermediate-2',
    version: 'public-2026-09-28',
    title: 'Hal Higdon intermediate 2 half-marathon pace instructions',
    url: 'https://www.halhigdon.com/training-programs/half-marathon-training/intermediate-2-half-marathon/',
    scope: 'pace-instruction',
  },
  'higdon-marathon-intermediate': {
    id: 'higdon-marathon-intermediate',
    version: 'public-2026-09-28',
    title: 'Hal Higdon intermediate marathon pace instructions',
    url: 'https://www.halhigdon.com/training-programs/marathon-training/intermediate-1-marathon/',
    scope: 'pace-instruction',
  },
};
export function validPaceInstruction(value: unknown): value is PaceInstruction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as PaceInstruction;
  const source = sources[p.sourceId];
  if (
    !source ||
    p.sourceVersion !== source.version ||
    ![
      'conversational',
      'progressive',
      'current-race',
      'goal-race',
      'effort',
    ].includes(p.kind)
  )
    return false;
  if (
    Object.keys(p).some(
      (key) =>
        !['sourceId', 'sourceVersion', 'kind', 'distanceKm'].includes(key),
    )
  )
    return false;
  if (p.kind === 'current-race' || p.kind === 'goal-race') {
    if (
      !Number.isFinite(p.distanceKm) ||
      p.distanceKm! < 1 ||
      p.distanceKm! > 100
    )
      return false;
  } else if (p.distanceKm !== undefined) return false;
  if (p.sourceId === 'nhs-c25k')
    return p.kind === 'conversational' || p.kind === 'effort';
  if (p.sourceId === 'higdon-5k-intermediate')
    return (
      ['conversational', 'progressive', 'effort'].includes(p.kind) ||
      (p.kind === 'current-race' && [1.5, 1.609344].includes(p.distanceKm!))
    );
  if (p.sourceId === 'higdon-10k-intermediate')
    return (
      ['conversational', 'progressive', 'effort'].includes(p.kind) ||
      (p.kind === 'current-race' && p.distanceKm === 5)
    );
  if (p.sourceId === 'higdon-half-intermediate-2')
    return (
      ['conversational', 'progressive', 'effort'].includes(p.kind) ||
      (p.kind === 'current-race' && p.distanceKm === 5) ||
      (p.kind === 'goal-race' && p.distanceKm === 21.0975)
    );
  if (p.sourceId === 'higdon-marathon-intermediate')
    return (
      p.kind === 'conversational' ||
      (p.kind === 'goal-race' && p.distanceKm === 42.195)
    );
  return true;
}
export function currentRaceInstruction(distanceKm: number): PaceInstruction {
  return {
    sourceId: 'stride-adaptive',
    sourceVersion: 'adaptive-v1',
    kind: 'current-race',
    distanceKm,
  };
}
export function eventPacingDistance(
  profile: Pick<Profile, 'goal' | 'raceDistanceKm'>,
): number | undefined {
  const named: Partial<Record<Profile['goal'], number>> = {
    '5k': 5,
    '10k': 10,
    half: 21.0975,
    marathon: 42.195,
  };
  return named[profile.goal] ?? profile.raceDistanceKm;
}
function roleForDistance(distance?: number): PacingRole {
  return (
    (
      {
        1.5: 'current-1500m',
        1.609344: 'current-mile',
        5: 'current-5k',
        10: 'current-10k',
        21.0975: 'current-half',
        42.195: 'current-marathon',
      } as Record<number, PacingRole>
    )[distance ?? 0] ?? 'current-race'
  );
}
type PacingWorkout = Pick<
  Workout,
  'kind' | 'stimulus' | 'templateId' | 'pairType'
> &
  Partial<Pick<Workout, 'beginnerLesson' | 'eventDistanceKm'>> & {
    steps?: Pick<Step, 'movement'>[];
  };
type PacingStep = Pick<
  Step,
  'kind' | 'intensity' | 'seconds' | 'metres' | 'movement' | 'effortRole'
> &
  Partial<Pick<Step, 'effort' | 'paceInstruction'>>;
type PacingProfile = Pick<Profile, 'goal' | 'raceDistanceKm'> &
  Partial<Pick<Profile, 'recentRace' | 'workoutTargets'>>;

/** Pacing provenance covers instructions only; it never claims a copied schedule. */
export function resolveStepPacing(
  workout: PacingWorkout,
  step: PacingStep,
  profile: PacingProfile,
): StepPacing {
  const band = resolveEffortRole(workout, step, profile);
  let role: PacingRole = band;
  let instruction = validPaceInstruction(step.paceInstruction)
    ? step.paceInstruction
    : undefined;
  // Earlier saved versions of these original Stride recipes already specified
  // current 5K effort, but did not store a machine-readable instruction. Keep
  // that meaning on explicit review without interpreting arbitrary cue text.
  if (
    !step.paceInstruction &&
    step.kind === 'work' &&
    step.intensity >= 6 &&
    workout.stimulus === 'aerobic-power' &&
    /^marathon-book-(?:(?:controlled-fartlek|six-hundred|split-repeats|pyramid|long-into-short)-(?:timed|metres)|vo2-(?:600m|800m|1000m|1200m|1600m|180s|240s|300s))$/.test(
      workout.templateId ?? '',
    )
  )
    instruction = currentRaceInstruction(5);
  const runWalk =
    !!workout.beginnerLesson ||
    (['easy', 'long'].includes(workout.kind) &&
      workout.steps?.some((s) => s.movement === 'walk'));
  const locked =
    runWalk ||
    step.movement === 'walk' ||
    step.kind === 'recovery' ||
    workout.pairType === 'double-threshold' ||
    /hill/i.test(workout.templateId ?? '') ||
    (band === 'effort' && !instruction);
  if (runWalk) role = 'run-walk';
  else if (step.kind === 'recovery' || step.movement === 'walk')
    role = 'recovery';
  else if (/hill/i.test(workout.templateId ?? '')) role = 'hills';
  else if (band === 'effort' && workout.stimulus === 'economy')
    role = 'strides';
  if (locked) instruction = undefined;
  if (!locked && !instruction && band === 'race') {
    const distance = workout.eventDistanceKm ?? eventPacingDistance(profile);
    if (distance !== undefined && distance >= 1 && distance <= 100)
      instruction = currentRaceInstruction(distance);
  }
  if (instruction?.kind === 'current-race')
    role = roleForDistance(instruction.distanceKm);
  else if (instruction?.kind === 'goal-race') role = 'goal-race';
  else if (instruction?.kind === 'conversational') role = 'easy';
  else if (instruction?.kind === 'progressive') role = 'progressive';
  const source = workout.beginnerLesson
    ? sources['nhs-c25k']
    : instruction
      ? sources[instruction.sourceId]
      : sources['stride-adaptive'];
  const guidance =
    instruction?.kind === 'progressive'
      ? 'Begin easily, build gradually by feel, then ease back. This is not one constant pace.'
      : instruction?.kind === 'conversational'
        ? 'Run comfortably at a pace that lets you hold a conversation.'
        : step.effort || pacingRoleLabel[role];
  const result: StepPacing = {
    ...(instruction?.distanceKm !== undefined
      ? { referenceDistanceKm: instruction.distanceKm }
      : {}),
    version: SOURCE_PACING_VERSION,
    role,
    label: pacingRoleLabel[role],
    guidance,
    source: { ...source },
    method: 'effort',
    reason: locked
      ? 'This step retains its effort instruction; a benchmark does not prescribe a pace here.'
      : instruction?.kind === 'progressive'
        ? 'The source describes a changing effort, not a numerical pace band.'
        : 'No verified numerical rule is attached to this instruction. Follow the stated effort.',
  };
  if (step.paceInstruction && !validPaceInstruction(step.paceInstruction)) {
    result.reason =
      'The saved pacing instruction or source version is unsupported. Keep the effort cue until reviewed.';
    return result;
  }
  if (locked || instruction?.kind === 'progressive' || source.id === 'nhs-c25k')
    return result;
  const config = profile.workoutTargets;
  const scope = `${profile.goal}:${profile.raceDistanceKm ?? ''}`;
  const roleScopeMatches =
    !['race', 'current-race', 'goal-race'].includes(role) ||
    config?.raceScope === scope;
  const override = roleScopeMatches ? config?.overrides?.[role] : undefined;
  if (override?.mode === 'effort' || config?.mode === 'effort') {
    result.reason = 'You chose effort guidance for this step.';
    return result;
  }
  const legacy =
    config &&
    ['pace', 'heart-rate'].includes(config.mode) &&
    band !== 'effort' &&
    (band !== 'race' || config.raceScope === scope)
      ? manualTargetRange(
          config,
          config.mode === 'pace' ? 'pace' : 'heartRate',
          band,
        )
      : undefined;
  const manual =
    override?.mode === 'pace' || override?.mode === 'heart-rate'
      ? override
      : legacy && config
        ? { ...legacy, mode: config.mode as 'pace' | 'heart-rate' }
        : undefined;
  if (manual) {
    if (
      manual.mode === 'heart-rate' &&
      step.kind === 'work' &&
      workout.kind !== 'race' &&
      (step.seconds <= 120 || (step.metres !== undefined && step.metres < 1000))
    ) {
      result.reason =
        'This short effort keeps its effort cue; heart rate responds too slowly to guide it.';
      return result;
    }
    if (validStepTarget(manual))
      return {
        ...result,
        method: 'manual-override',
        reason: 'Your manual target overrides this role only.',
        target: { ...manual, source: 'manual' },
      };
    return {
      ...result,
      reason:
        'The manual target is invalid. Keep effort guidance until corrected.',
    };
  }
  // Legacy manual configurations intentionally leave omitted bands on effort.
  if (config && config.mode !== 'automatic')
    return {
      ...result,
      reason: 'No manual target is saved for this role. Follow the effort cue.',
    };
  if (instruction?.kind === 'goal-race') {
    const minutes =
      config?.raceScope === scope &&
      instruction.distanceKm === eventPacingDistance(profile)
        ? config.goalTimeMinutes
        : undefined;
    const pace =
      minutes === undefined
        ? NaN
        : Math.round((minutes * 60) / instruction.distanceKm!);
    const target: StepTarget = {
      mode: 'pace',
      low: pace,
      high: pace,
      source: 'goal',
      model: SOURCE_PACING_VERSION,
    };
    return validStepTarget(target)
      ? {
          ...result,
          method: 'explicit-goal',
          goal: { distanceKm: instruction.distanceKm!, timeMinutes: minutes! },
          reason:
            'This source explicitly asks for goal race pace. This is your selected goal, not a prediction.',
          target,
        }
      : {
          ...result,
          reason:
            'This source asks for goal race pace. Add an explicit goal finish time for this event, or use effort.',
        };
  }
  if (instruction?.kind !== 'current-race') return result;
  let benchmark: RecentRace;
  try {
    benchmark = validateRecentRace(profile.recentRace);
  } catch {
    return {
      ...result,
      reason:
        'Add a representative race or time trial at this exact distance to show a numerical pace.',
    };
  }
  result.evidence = { ...benchmark };
  if (benchmark.distanceKm !== instruction.distanceKm)
    return {
      ...result,
      reason: `This step uses ${instruction.distanceKm} km race effort. Your ${benchmark.distanceKm} km result is a different distance; no race-equivalence model has been substituted.`,
    };
  if (benchmark.representative !== true)
    return {
      ...result,
      reason:
        'Confirm that this result represents your current fitness before using its numerical pace.',
    };
  if (benchmark.course === 'trail' || benchmark.course === 'treadmill')
    return {
      ...result,
      reason:
        'This road-pace instruction cannot use a trail or treadmill result without a verified comparison rule. Follow effort.',
    };
  const pace = Math.round((benchmark.timeMinutes * 60) / benchmark.distanceKm);
  const target: StepTarget = {
    mode: 'pace',
    low: pace,
    high: pace,
    source: 'benchmark',
    model: 'same-distance-result-v1',
  };
  return validStepTarget(target)
    ? {
        ...result,
        method: 'same-distance-benchmark',
        reason:
          'Your confirmed result at this same distance supplies the pace. No equivalence or additional tolerance is applied.',
        target,
      }
    : {
        ...result,
        reason:
          'The benchmark pace is outside supported target limits. Follow effort.',
      };
}

export function sourcePacingOptions(
  profile: Profile,
  workouts: Workout[] = [],
) {
  const rows = new Map<PacingRole, StepPacing>();
  for (const workout of workouts)
    for (const step of workout.steps) {
      const resolved = resolveStepPacing(workout, step, profile);
      if (!rows.has(resolved.role)) rows.set(resolved.role, resolved);
    }
  return [...rows.values()];
}
export function sourcePacingSummary(workout: Workout, profile: Profile) {
  return sourcePacingOptions(profile, [workout]);
}

/** Validate saved provenance structurally without reinterpreting historical fitness. */
export function validStepPacing(
  value: unknown,
  target?: StepTarget,
): value is StepPacing {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as StepPacing;
  if (
    Object.keys(p).some(
      (key) =>
        ![
          'version',
          'role',
          'label',
          'guidance',
          'source',
          'method',
          'reason',
          'evidence',
          'referenceDistanceKm',
          'goal',
          'target',
        ].includes(key),
    )
  )
    return false;
  if (
    p.version !== SOURCE_PACING_VERSION ||
    !PACING_ROLES.includes(p.role) ||
    ![
      'effort',
      'same-distance-benchmark',
      'explicit-goal',
      'manual-override',
    ].includes(p.method)
  )
    return false;
  if (
    ![p.label, p.guidance, p.reason].every(
      (s) => typeof s === 'string' && s.length > 0 && s.length <= 2000,
    )
  )
    return false;
  const source =
    p.source && sources[p.source.id as PaceInstruction['sourceId']];
  if (
    !source ||
    Object.keys(p.source).some(
      (key) => !['id', 'version', 'title', 'url', 'scope'].includes(key),
    ) ||
    ['id', 'version', 'title', 'url', 'scope'].some(
      (key) =>
        p.source[key as keyof PacingSource] !==
        source[key as keyof PacingSource],
    )
  )
    return false;
  if (p.target && !validStepTarget(p.target)) return false;
  if (
    p.target &&
    (source.id === 'nhs-c25k' ||
      [
        'progressive',
        'recovery',
        'strides',
        'hills',
        'run-walk',
        'effort',
      ].includes(p.role))
  )
    return false;
  if ((p.method === 'effort') !== (p.target === undefined)) return false;
  if (p.method === 'manual-override' && p.target?.source !== 'manual')
    return false;
  if (
    p.method === 'same-distance-benchmark' &&
    p.target?.source !== 'benchmark'
  )
    return false;
  if (p.method === 'explicit-goal' && p.target?.source !== 'goal') return false;
  if (p.evidence) {
    try {
      validateRecentRace(p.evidence);
    } catch {
      return false;
    }
  }
  if (
    p.referenceDistanceKm !== undefined &&
    (!Number.isFinite(p.referenceDistanceKm) ||
      p.referenceDistanceKm < 1 ||
      p.referenceDistanceKm > 100)
  )
    return false;
  if (
    p.method === 'same-distance-benchmark' &&
    (!p.evidence ||
      p.evidence.representative !== true ||
      ['trail', 'treadmill'].includes(p.evidence.course ?? '') ||
      p.referenceDistanceKm !== p.evidence.distanceKm ||
      p.role !== roleForDistance(p.referenceDistanceKm) ||
      !validPaceInstruction({
        sourceId: p.source.id,
        sourceVersion: p.source.version,
        kind: 'current-race',
        distanceKm: p.referenceDistanceKm,
      }) ||
      p.target?.mode !== 'pace' ||
      p.target.model !== 'same-distance-result-v1' ||
      p.target.low !== p.target.high ||
      p.target.low !==
        Math.round((p.evidence.timeMinutes * 60) / p.evidence.distanceKm))
  )
    return false;
  if (
    p.method === 'explicit-goal' &&
    (!p.goal ||
      p.role !== 'goal-race' ||
      !validPaceInstruction({
        sourceId: p.source.id,
        sourceVersion: p.source.version,
        kind: 'goal-race',
        distanceKm: p.referenceDistanceKm,
      }) ||
      !Number.isFinite(p.goal.timeMinutes) ||
      p.goal.timeMinutes <= 0 ||
      p.referenceDistanceKm !== p.goal.distanceKm ||
      p.target?.mode !== 'pace' ||
      p.target.model !== SOURCE_PACING_VERSION ||
      p.target.low !== p.target.high ||
      p.target.low !==
        Math.round((p.goal.timeMinutes * 60) / p.goal.distanceKm))
  )
    return false;
  if (p.goal && p.method !== 'explicit-goal') return false;
  if (arguments.length < 2) return true;
  if (!p.target || !target) return p.target === target;
  return ['mode', 'low', 'high', 'source', 'model'].every(
    (key) =>
      p.target![key as keyof StepTarget] === target[key as keyof StepTarget],
  );
}
