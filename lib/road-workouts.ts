import type { Phase, Profile, Step, Workout } from './plan/types.ts';
import type {
  SelectionContext,
  TemplateDecision,
  WorkoutTemplate,
} from './workout-library.ts';
import { isShortRoadRaceProfile, roadAbility } from './road-training-policy.ts';

// Independently authored doses. Published plans inform the roles and progression,
// not these recipes; see docs/research/half-road-plans-2026-09-23.md.
const phases: Phase[] = [
  'Foundation',
  'Build',
  'Race preparation',
  'Maintenance',
  'Taper',
  'Race week',
];
type RoadRole = 'threshold' | '5k' | '10k' | 'half';
const roles: Record<
  RoadRole,
  Pick<
    WorkoutTemplate,
    'kind' | 'stimulus' | 'goals' | 'cue' | 'purpose' | 'intensity'
  >
> = {
  threshold: {
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k', 'half'],
    intensity: 6,
    cue: 'Controlled threshold effort · 6 / 10 · finish each repetition with reserve',
    purpose:
      'Build sustained aerobic strength in controlled blocks with easy recoveries.',
  },
  '5k': {
    kind: 'fartlek',
    stimulus: 'race-rhythm',
    goals: ['5k'],
    intensity: 7,
    cue: 'Current sustainable 5K effort · smooth and repeatable, never sprint',
    purpose:
      'Practise controlled 5K rhythm in short repetitions while preserving running form.',
  },
  '10k': {
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['10k'],
    intensity: 6,
    cue: 'Current sustainable 10K effort · even repetitions, not a time trial',
    purpose:
      'Develop the ability to hold current 10K effort in longer repeatable blocks.',
  },
  half: {
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['half'],
    intensity: 6,
    cue: 'Current half-marathon effort · patient, measured and controlled',
    purpose:
      'Build race-effort endurance in sustained half-marathon blocks without racing the session.',
  },
};

function repeated(
  role: RoadRole,
  seconds: number,
  recovery: number,
  minimum: number,
  maximum: number,
): WorkoutTemplate {
  return {
    ...roles[role],
    id: `road-${role}-${seconds}s`,
    title: `${seconds / 60}-minute ${role === 'threshold' ? 'threshold' : `${role} effort`} repetitions`,
    phases,
    workSeconds: [seconds],
    recoverySeconds: recovery,
    minimumReps: minimum,
    maximumReps: maximum,
    warmupSeconds: 600,
    cooldownSeconds: 300,
  };
}

function pyramid(
  role: RoadRole,
  minutes: number[],
  recovery: number,
): WorkoutTemplate {
  return {
    ...roles[role],
    id: `road-${role}-pyramid-${minutes.join('-')}`,
    title: `${role === 'threshold' ? 'Threshold' : `${role} effort`} pyramid`,
    purpose: `${roles[role].purpose} Vary the length of each effort while keeping the same controlled effort throughout.`,
    phases: phases.filter((phase) => !['Taper', 'Race week'].includes(phase)),
    workSeconds: minutes.map((value) => value * 60),
    completeSet: true,
    recoverySeconds: recovery,
    minimumReps: minutes.length,
    maximumReps: minutes.length,
    warmupSeconds: 600,
    cooldownSeconds: 300,
  };
}

export const ROAD_WORKOUTS: WorkoutTemplate[] = [
  repeated('threshold', 90, 60, 4, 12),
  repeated('threshold', 120, 60, 3, 8),
  repeated('threshold', 180, 60, 2, 8),
  repeated('threshold', 240, 75, 2, 7),
  repeated('threshold', 300, 90, 2, 6),
  repeated('threshold', 360, 90, 2, 5),
  repeated('threshold', 480, 120, 2, 4),
  repeated('5k', 60, 60, 6, 16),
  repeated('5k', 90, 75, 4, 12),
  repeated('5k', 120, 90, 3, 10),
  repeated('5k', 180, 120, 2, 7),
  repeated('10k', 120, 75, 3, 10),
  repeated('10k', 180, 90, 2, 8),
  repeated('10k', 240, 90, 2, 7),
  repeated('10k', 300, 120, 2, 6),
  repeated('10k', 360, 120, 2, 5),
  repeated('half', 180, 60, 2, 8),
  repeated('half', 240, 90, 2, 7),
  repeated('half', 360, 90, 2, 6),
  repeated('half', 480, 120, 2, 4),
  repeated('half', 600, 120, 2, 3),
  repeated('half', 720, 150, 2, 3),
  // Complete, independently authored shapes. A pyramid must fit in full;
  // shortening it never leaves only the ascending half of its main set.
  pyramid('threshold', [1, 2, 2, 2, 1], 60),
  pyramid('threshold', [1.5, 2, 2.5, 2.5, 2, 1.5], 60),
  pyramid('threshold', [2, 3, 4, 3, 2], 75),
  pyramid('threshold', [3, 4, 6, 4, 3], 90),
  pyramid('5k', [1, 1.5, 1.5, 1.5, 1], 75),
  pyramid('5k', [1, 2, 3, 2, 1], 120),
  pyramid('10k', [1.5, 2, 3, 2, 1.5], 90),
  pyramid('10k', [2, 3, 4, 3, 2], 90),
  pyramid('half', [2, 3, 3, 3, 2], 90),
  pyramid('half', [3, 4, 4, 4, 3], 90),
  pyramid('half', [3, 5, 8, 5, 3], 120),
];

for (const [role, metres, recovery] of [
  ['threshold', 600, 60],
  ['threshold', 800, 75],
  ['threshold', 1000, 90],
  ['5k', 200, 60],
  ['5k', 400, 90],
  ['5k', 600, 120],
  ['10k', 600, 90],
  ['10k', 800, 90],
  ['10k', 1000, 120],
  ['half', 800, 90],
  ['half', 1000, 90],
  ['half', 1600, 120],
] as const) {
  ROAD_WORKOUTS.push({
    ...roles[role],
    id: `road-${role}-${metres}m`,
    title: `${metres} m ${role === 'threshold' ? 'threshold' : `${role} effort`} repetitions`,
    phases,
    workSeconds: [],
    workMetres: [metres],
    recoverySeconds: recovery,
    minimumReps: 2,
    maximumReps: role === '5k' && metres === 200 ? 16 : 8,
    warmupSeconds: 600,
    cooldownSeconds: 300,
  });
}

type Helpers = {
  resolve: (
    template: WorkoutTemplate,
    existingSteps?: Step[],
  ) => WorkoutTemplate | null;
  savedTemplate: (id: string) => WorkoutTemplate | undefined;
  fits: (
    template: WorkoutTemplate,
    budget: number,
  ) => { qualityMinutes: number; steps: Step[] } | null;
  economy: WorkoutTemplate;
};

function roleOf(workout: Workout, goal: Profile['goal']): RoadRole | null {
  if (workout.stimulus === 'threshold') return 'threshold';
  if (
    workout.stimulus === 'race-rhythm' ||
    workout.stimulus === 'aerobic-power'
  )
    return goal === '5k' || goal === '10k' || goal === 'half' ? goal : null;
  return null;
}

// Compare executable work and recovery, not titles, IDs or easy filler.
function mainSetShape(steps: Step[]) {
  return JSON.stringify(
    steps
      .filter((step) => step.kind === 'work' || step.kind === 'recovery')
      .map((step) => [
        step.kind,
        step.metres ?? step.seconds,
        step.metres === undefined ? 'seconds' : 'metres',
        step.intensity,
        step.movement,
      ]),
  );
}

/** Quality roles and doses progress independently of the allocator's spare time. */
export function selectRoadWorkout(
  p: Profile,
  phase: Phase,
  context: SelectionContext,
  helpers: Helpers,
): TemplateDecision {
  const prior = context.previous.filter(
    (w) =>
      w.status !== 'skipped' &&
      w.kind !== 'long' &&
      w.kind !== 'race' &&
      w.stimulus !== 'economy' &&
      w.steps.some((s) => s.kind === 'work' && s.intensity >= 4),
  );
  const taper = phase === 'Taper' || phase === 'Race week';
  const explicit = p.qualityMode === 'custom' && (p.qualitySessions ?? 0) > 0;
  if (taper && !prior.length)
    return {
      template: helpers.economy,
      exposure: 0,
      targetWorkMinutes: 0,
      reason:
        'Keep this taper outing easy: there is no familiar workout in this block to reduce.',
    };
  const ability = roadAbility(p);
  const controlled =
    ability === 'developing' ||
    p.intent === 'finish' ||
    p.difficulty === 'gentle';
  const threshold = prior.filter((w) => w.stimulus === 'threshold');
  const last = prior.at(-1);
  const two =
    (context.qualitySlots ?? (explicit ? p.qualitySessions : 1) ?? 1) >= 2;
  let role: RoadRole = 'threshold';
  if (taper) role = roleOf(last!, p.goal) ?? 'threshold';
  else if (context.slot > 0) role = p.goal as Exclude<RoadRole, 'threshold'>;
  else if (!two && threshold.length >= 2 && last?.stimulus === 'threshold')
    role = p.goal as Exclude<RoadRole, 'threshold'>;
  else if (
    p.goal === '5k' &&
    !controlled &&
    (p.recentQualitySessions ?? 0) > 0 &&
    ((two && phase !== 'Foundation') ||
      (!two && phase === 'Race preparation' && prior.length % 3 !== 2))
  )
    role = '5k';
  else if (
    p.goal === '10k' &&
    !two &&
    phase === 'Race preparation' &&
    threshold.length >= 2 &&
    prior.length % 3 !== 2
  )
    role = '10k';
  // When 5K speed occupies the first role, the second role supplies controlled threshold.
  if (
    two &&
    context.slot > 0 &&
    p.goal === '5k' &&
    !controlled &&
    phase !== 'Foundation' &&
    (p.recentQualitySessions ?? 0) > 0
  )
    role = 'threshold';
  const related = prior.filter((w) => roleOf(w, p.goal) === role);
  const recentSessions = Math.max(1, p.recentQualitySessions ?? 1);
  const reported =
    (p.recentQualitySessions ?? 0) > 0 && p.recentQualityMinutes != null
      ? p.recentQualityMinutes / recentSessions
      : 0;
  const seed = Math.max(
    6,
    Math.min(
      controlled ? 10 : ability === 'advanced' ? 18 : 14,
      reported * (role === '5k' ? 0.55 : role === '10k' ? 0.7 : 0.8),
    ),
  );
  const maximum = controlled
    ? role === 'half'
      ? 18
      : 16
    : role === '5k'
      ? 21
      : role === '10k'
        ? 30
        : role === 'half'
          ? 36
          : 30;
  const increment = controlled ? 2 : role === 'half' ? 4 : 3;
  // The first two exposures consolidate a dose; availability never enters this expression.
  let budget = Math.min(
    maximum,
    seed + Math.floor(related.length / 2) * increment,
  );
  if (phase === 'Foundation' || phase === 'Maintenance') budget = seed;
  if (context.introduction) budget = 6;
  if (taper)
    budget = Math.max(
      2,
      (related.at(-1)?.qualityMinutes ?? 6) *
        (phase === 'Race week' ? 0.4 : 0.65),
    );
  const allowance = Math.min(budget, context.workAllowanceMinutes ?? Infinity);

  // A second taper week may no longer fit the most recent long repetition.
  // Reuse an earlier familiar short-race recipe before considering a new one;
  // keep the existing half-marathon selection unchanged.
  const taperHistory = isShortRoadRaceProfile(p)
    ? [...prior].reverse()
    : last
      ? [last]
      : [];
  for (const previous of taper ? taperHistory : []) {
    if (!previous.templateId) continue;
    const remembered = helpers.savedTemplate(previous.templateId);
    const lastWork = previous.steps.find((s) => s.kind === 'work');
    const familiar =
      remembered &&
      helpers.resolve(
        {
          ...remembered,
          intensity: Math.min(
            remembered.intensity,
            lastWork?.intensity ?? remembered.intensity,
          ),
          cue: lastWork?.effort ?? remembered.cue,
        },
        previous.steps,
      );
    if (
      familiar &&
      !familiar.completeSet &&
      Math.max(...familiar.workSeconds) <= 360 &&
      helpers.fits(familiar, allowance)
    )
      return {
        template: familiar,
        exposure: related.length + 1,
        targetWorkMinutes: budget,
        reason:
          'A reduced dose of the familiar session preserves its recorded repetition distances and pace while taper volume falls.',
      };
  }

  const count = related.length;
  const preferredSeconds =
    role === '5k'
      ? [90, 120, 180]
      : role === '10k'
        ? [180, 240, 300, 360]
        : role === 'half'
          ? [180, 240, 360, 480, 600, 720]
          : [120, 180, 240, 300, 360, 480];
  const stage = Math.min(
    preferredSeconds.length - 1,
    Math.floor(count / (controlled ? 3 : 2)),
  );
  const maxRep = taper
    ? Math.min(180, preferredSeconds[stage])
    : preferredSeconds[stage];
  const preferred = preferredSeconds[stage];
  const templates = ROAD_WORKOUTS.filter((t) =>
    t.id.startsWith(`road-${role}-`),
  );
  const familiar = p.workoutVariety === 'familiar';
  const timed = templates
    .filter(
      (t) =>
        !t.workMetres &&
        Math.max(...t.workSeconds) <= maxRep &&
        t.phases.includes(phase) &&
        (!familiar || (!t.completeSet && t.id !== 'road-threshold-90s')),
    )
    .sort(
      (a, b) =>
        Math.abs(Math.max(...a.workSeconds) - preferred) -
        Math.abs(Math.max(...b.workSeconds) - preferred),
    );
  // Different repeat lengths retain the role and dose; no cosmetic variety can add work.
  if (!taper && !familiar && timed.length > 1 && count % 2)
    timed.unshift(...timed.splice(1, 1));
  if (!taper && !familiar && count % 3 === 2)
    timed.sort((a, b) => Number(!!b.completeSet) - Number(!!a.completeSet));
  const distance = templates.filter((t) => t.workMetres);
  const useDistance =
    !taper &&
    p.workoutFormat !== 'time' &&
    (p.workoutFormat === 'distance' || count % 2 === 1);
  const candidates = useDistance ? [...distance, ...timed] : timed;
  // An exclusion is a variety preference, not permission to discard every
  // feasible recipe and fall back to the same two-minute session indefinitely.
  if (!familiar && !taper)
    candidates.sort(
      (a, b) =>
        Number(context.excludeTemplateIds?.has(a.id) ?? false) -
        Number(context.excludeTemplateIds?.has(b.id) ?? false),
    );
  const choices: {
    decision: TemplateDecision;
    shape: string;
    fullDose: boolean;
  }[] = [];
  for (const authored of candidates) {
    const steady = controlled
      ? {
          ...authored,
          intensity: 5,
          cue: 'Steady and comfortable · 5 / 10 · controlled breathing, with reserve',
        }
      : authored;
    let template = helpers.resolve(steady);
    if (!template || Math.max(...template.workSeconds) > maxRep + 1) continue;
    if (template.workMetres && !taper)
      template = {
        ...template,
        minimumReps: Math.max(
          template.minimumReps,
          Math.ceil(360 / template.workSeconds[0]),
        ),
      };
    const dose = helpers.fits(template, allowance);
    if (!dose || (!taper && dose.qualityMinutes < 6 - 1e-6)) continue;
    const decision = {
      template,
      exposure: related.length + 1,
      targetWorkMinutes: budget,
      reason: taper
        ? `A shorter familiar ${role === 'threshold' ? 'threshold' : 'race-effort'} session keeps rhythm as training volume falls.`
        : `${template.purpose} ${
            context.introduction
              ? 'Begin with six controlled minutes.'
              : related.length
                ? 'The planned dose progresses after repeated exposures to this role; scheduled sessions are not evidence of completion.'
                : reported > 0
                  ? 'The opening allowance respects your reported recent workout minutes.'
                  : 'Begin with six controlled minutes because recent work volume is unknown.'
          }`,
    };
    choices.push({
      decision,
      shape: mainSetShape(dose.steps),
      fullDose: dose.qualityMinutes >= allowance * 0.75 || taper,
    });
  }
  const full = choices.filter((choice) => choice.fullDose);
  const suitable = full.length ? full : choices;
  if (suitable.length) {
    const previousShape = related.length
      ? mainSetShape(related.at(-1)!.steps)
      : undefined;
    return (
      (!familiar && !taper
        ? suitable.find((choice) => choice.shape !== previousShape)
        : undefined) ?? suitable[0]
    ).decision;
  }
  // Preserve the promised role even when capacity cannot fund it. The allocator
  // and validator must report that conflict, rather than silently substitute strides.
  const fallbackTemplate = ROAD_WORKOUTS.find(
    (t) =>
      t.id ===
      `road-${role}-${role === 'threshold' || role === '10k' ? 120 : role === '5k' ? 60 : 180}s`,
  )!;
  return {
    template: controlled
      ? {
          ...fallbackTemplate,
          intensity: 5,
          cue: 'Steady and comfortable · 5 / 10 · finish with reserve',
        }
      : fallbackTemplate,
    exposure: related.length + 1,
    targetWorkMinutes: taper ? budget : Math.max(6, budget),
    reason:
      'A complete controlled main set needs its warm-up, recoveries and cool-down; adjust conflicting time or frequency limits if it cannot fit.',
  };
}
