/**
 * Deterministic Stride training-plan engine.
 * Cloudflare Workers compatible: standard TypeScript only (no fs, path, or Node APIs).
 */

import {
  calculateTrainingPaces,
  validateRecentRace,
} from './fitness-pacing.ts';

import type {
  DailyWorkout,
  DaysPerWeek,
  Goal,
  PeakLongRunBand,
  RunType,
  ScaledWorkout,
  TrainingEngineErrorCode,
  TrainingEngineErrorOptions,
  TrainingPhase,
  TrainingPlan,
  TrainingWeek,
  UserTrainingInput,
  WorkoutStep,
  WorkoutTemplate,
} from './types.ts';

export class TrainingEngineError extends Error {
  readonly code: TrainingEngineErrorCode;
  readonly details: Record<string, number | string | boolean | null>;

  constructor(message: string, options: TrainingEngineErrorOptions) {
    super(message);
    this.name = 'TrainingEngineError';
    this.code = options.code;
    this.details = options.details ?? {};
  }
}

export const PEAK_LONG_RUN_KM: Record<Goal, PeakLongRunBand> = {
  '5k': { low: 10, high: 12 },
  '10k': { low: 14, high: 16 },
  half: { low: 18, high: 21 },
  marathon: { low: 32, high: 35 },
  ultra: { low: 40, high: 45 },
};

export const MINIMUM_LONG_RUN_KM: Record<Goal, number> = {
  '5k': 5,
  '10k': 8,
  half: 10,
  marathon: 12,
  ultra: 16,
};

export const DEFAULT_RACE_KM: Record<Goal, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
  ultra: 50,
};

const MAX_WEEKLY_LONG_STEP_KM = 2;
const MAX_WEEKLY_LONG_GAIN = 0.1;
const KM_DIGITS = 2;
const KM_EPS = 0.001;

const SPEED_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'speed-repeats-a',
    name: 'Aerobic-power repeats',
    kind: 'speed',
    warmupRatio: 0.18,
    mainRatio: 0.64,
    cooldownRatio: 0.18,
    workShareOfMain: 0.7,
    minReps: 4,
    maxReps: 10,
  },
  {
    id: 'speed-repeats-b',
    name: 'Short VO2 intervals',
    kind: 'speed',
    warmupRatio: 0.2,
    mainRatio: 0.62,
    cooldownRatio: 0.18,
    workShareOfMain: 0.68,
    minReps: 5,
    maxReps: 12,
  },
  {
    id: 'speed-fartlek-c',
    name: 'Structured fartlek',
    kind: 'speed',
    warmupRatio: 0.16,
    mainRatio: 0.66,
    cooldownRatio: 0.18,
    workShareOfMain: 0.65,
    minReps: 6,
    maxReps: 12,
  },
  {
    id: 'speed-hills-d',
    name: 'Controlled hill repeats',
    kind: 'speed',
    warmupRatio: 0.2,
    mainRatio: 0.6,
    cooldownRatio: 0.2,
    workShareOfMain: 0.72,
    minReps: 4,
    maxReps: 8,
  },
  {
    id: 'speed-cutdowns-e',
    name: 'Cut-down repetitions',
    kind: 'speed',
    warmupRatio: 0.15,
    mainRatio: 0.7,
    cooldownRatio: 0.15,
    workShareOfMain: 0.74,
    minReps: 4,
    maxReps: 9,
  },
];

const TEMPO_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'tempo-cruise-a',
    name: 'Cruise intervals',
    kind: 'tempo',
    warmupRatio: 0.18,
    mainRatio: 0.64,
    cooldownRatio: 0.18,
    workShareOfMain: 0.78,
    minReps: 3,
    maxReps: 6,
  },
  {
    id: 'tempo-blocks-b',
    name: 'Sustained tempo blocks',
    kind: 'tempo',
    warmupRatio: 0.17,
    mainRatio: 0.66,
    cooldownRatio: 0.17,
    workShareOfMain: 0.8,
    minReps: 2,
    maxReps: 5,
  },
  {
    id: 'tempo-continuous-c',
    name: 'Continuous threshold',
    kind: 'tempo',
    warmupRatio: 0.2,
    mainRatio: 0.6,
    cooldownRatio: 0.2,
    workShareOfMain: 0.92,
    minReps: 1,
    maxReps: 2,
  },
  {
    id: 'tempo-pyramid-d',
    name: 'Tempo pyramid',
    kind: 'tempo',
    warmupRatio: 0.16,
    mainRatio: 0.68,
    cooldownRatio: 0.16,
    workShareOfMain: 0.76,
    minReps: 3,
    maxReps: 5,
  },
  {
    id: 'tempo-progressions-e',
    name: 'Progression tempo',
    kind: 'tempo',
    warmupRatio: 0.15,
    mainRatio: 0.7,
    cooldownRatio: 0.15,
    workShareOfMain: 0.82,
    minReps: 2,
    maxReps: 4,
  },
];

export function roundKm(value: number, digits = KM_DIGITS): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampRatio(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  return clamp(value ?? fallback, min, max);
}

export function week1LongRunKm(input: UserTrainingInput): number {
  return input.goal === 'marathon'
    ? Math.min(35, Math.ceil(input.currentLongRun))
    : Math.max(input.currentLongRun, MINIMUM_LONG_RUN_KM[input.goal]);
}

export function peakLongRunTargetKm(
  goal: Goal,
  currentLongRun: number,
): number {
  if (goal === 'marathon') return 35;
  const band = PEAK_LONG_RUN_KM[goal];
  if (currentLongRun >= band.high) return currentLongRun;
  if (currentLongRun >= band.low) return band.high;
  return band.high;
}

export function safeLongRunStep(
  currentLongKm: number,
  remainingToPeak: number,
): number {
  const cap = Math.min(
    MAX_WEEKLY_LONG_STEP_KM,
    currentLongKm * MAX_WEEKLY_LONG_GAIN,
  );
  if (remainingToPeak <= KM_EPS) return 0;
  return Math.min(cap, remainingToPeak);
}

/**
 * Marathon uses a 3-week taper when at least 4 weeks remain; shorter goals use 2.
 * Blocks under 8 weeks still keep a mandatory taper and never skip race week.
 */
export function taperWeekCount(goal: Goal, weeksUntilRace: number): number {
  if (goal === 'marathon' || goal === 'ultra') {
    return weeksUntilRace >= 4 ? 3 : 2;
  }
  return 2;
}

export function peakWeekIndex(
  weeksUntilRace: number,
  taperWeeks: number,
): number {
  return Math.max(0, weeksUntilRace - taperWeeks - 1);
}

export function phaseForWeek(
  weekIndex: number,
  weeksUntilRace: number,
  taperWeeks: number,
): TrainingPhase {
  if (weekIndex === weeksUntilRace - 1) return 'race-week';
  if (weekIndex >= weeksUntilRace - taperWeeks) return 'taper';
  if (weekIndex === peakWeekIndex(weeksUntilRace, taperWeeks)) return 'peak';
  return 'build';
}

/**
 * Marathon: W-2 = 65% peak volume, W-1 = 40%, race week is a further taper.
 * Other goals use a 2-week 70% / 40% taper.
 */
export function volumeFractionForWeek(
  weekIndex: number,
  weeksUntilRace: number,
  goal: Goal,
): number {
  const taperWeeks = taperWeekCount(goal, weeksUntilRace);
  const fromEnd = weeksUntilRace - 1 - weekIndex;
  if (fromEnd === 0)
    return goal === 'marathon' || goal === 'ultra' ? 0.35 : 0.4;
  if (taperWeeks >= 3 && fromEnd === 1) return 0.4;
  if (taperWeeks >= 3 && fromEnd === 2) return 0.65;
  if (taperWeeks === 2 && fromEnd === 1) return 0.4;
  if (taperWeeks === 2 && fromEnd === 2) return 0.7;
  const peakAt = peakWeekIndex(weeksUntilRace, taperWeeks);
  if (weekIndex >= peakAt) return 1;
  const ramp = peakAt === 0 ? 1 : 0.9 + 0.1 * (weekIndex / peakAt);
  return roundKm(clamp(ramp, 0.85, 1), 3);
}

export function reconcileDailySplits(
  splits: number[],
  weeklyTotalVolume: number,
): number[] {
  if (splits.length === 0) return [];
  const total = roundKm(weeklyTotalVolume, KM_DIGITS);
  const next = splits.map((value) => roundKm(Math.max(0, value), KM_DIGITS));
  const headSum = roundKm(
    next.slice(0, -1).reduce((sum, value) => sum + value, 0),
    KM_DIGITS,
  );
  next[next.length - 1] = roundKm(total - headSum, KM_DIGITS);
  if (next[next.length - 1] < 0) {
    let deficit = -next[next.length - 1];
    next[next.length - 1] = 0;
    for (let i = next.length - 2; i >= 0 && deficit > 0; i--) {
      const take = Math.min(next[i], deficit);
      next[i] = roundKm(next[i] - take, KM_DIGITS);
      deficit = roundKm(deficit - take, KM_DIGITS);
    }
    const repaired = roundKm(
      next.reduce((sum, value) => sum + value, 0),
      KM_DIGITS,
    );
    next[next.length - 1] = roundKm(
      total - (repaired - next[next.length - 1]),
      KM_DIGITS,
    );
  }
  return next;
}

export function scaleWorkout(
  targetKm: number,
  template: WorkoutTemplate,
  paces?: ReturnType<typeof calculateTrainingPaces>,
): ScaledWorkout {
  const safeTarget = Math.max(0.5, targetKm);
  const warmupRatio = clampRatio(template.warmupRatio, 0.18, 0.15, 0.2);
  const cooldownRatio = clampRatio(template.cooldownRatio, 0.18, 0.15, 0.2);
  const mainRatio = clampRatio(template.mainRatio, 0.64, 0.6, 0.7);
  const ratioSum = warmupRatio + mainRatio + cooldownRatio;
  const warmupKm = roundKm((safeTarget * warmupRatio) / ratioSum, 3);
  const cooldownKm = roundKm((safeTarget * cooldownRatio) / ratioSum, 3);
  const mainKm = roundKm(safeTarget - warmupKm - cooldownKm, 3);
  const workShare = clamp(template.workShareOfMain ?? 0.72, 0.55, 0.95);
  const workKm = mainKm * workShare;
  const recoveryBudget = Math.max(0, mainKm - workKm);
  const minReps = Math.max(1, template.minReps ?? 2);
  const maxReps = Math.max(minReps, template.maxReps ?? 8);

  let reps = minReps;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let candidate = minReps; candidate <= maxReps; candidate++) {
    const interval = workKm / candidate;
    const recoveryCount = Math.max(1, candidate - 1);
    const recovery = recoveryBudget / recoveryCount;
    const intervalPenalty =
      interval < 0.2
        ? (0.2 - interval) * 8
        : interval > 2
          ? (interval - 2) * 4
          : 0;
    const recoveryPenalty = recovery > 1.5 ? recovery - 1.5 : 0;
    const score = intervalPenalty + recoveryPenalty;
    if (score < bestScore) {
      bestScore = score;
      reps = candidate;
    }
  }

  const intervalKm = roundKm(workKm / reps, 3);
  const recoveryCount = Math.max(0, reps - 1);
  const recoveryKm =
    recoveryCount === 0 ? 0 : roundKm(recoveryBudget / recoveryCount, 3);

  const steps: WorkoutStep[] = [
    { label: 'Warm up', kind: 'warmup', km: warmupKm },
  ];
  for (let i = 0; i < reps; i++) {
    steps.push({
      label: reps === 1 ? 'Main set' : `Interval ${i + 1} of ${reps}`,
      kind: 'interval',
      km: intervalKm,
    });
    if (i < reps - 1) {
      steps.push({
        label: 'Easy recovery',
        kind: 'recovery',
        km: recoveryKm,
      });
    }
  }
  steps.push({ label: 'Cool down', kind: 'cooldown', km: cooldownKm });

  if (paces)
    for (const step of steps)
      step.paceSecondsPerKm =
        step.kind === 'interval'
          ? template.kind === 'speed'
            ? paces.interval
            : /cruise|threshold/i.test(template.name)
              ? paces.threshold
              : paces.tempo
          : paces.easy;

  const rawTotal = steps.reduce((sum, step) => sum + step.km, 0);
  const delta = roundKm(safeTarget - rawTotal, 3);
  steps[steps.length - 1] = {
    ...steps[steps.length - 1],
    km: roundKm(steps[steps.length - 1].km + delta, 3),
  };
  const totalKm = roundKm(
    steps.reduce((sum, step) => sum + step.km, 0),
    3,
  );

  return {
    templateId: template.id,
    templateName: template.name,
    targetKm: roundKm(safeTarget, 3),
    warmupKm,
    mainKm,
    cooldownKm,
    reps,
    intervalKm,
    recoveryKm,
    steps,
    totalKm,
  };
}

export function recentTemplateIds(
  history: Array<{ weekIndex: number; templateId?: string }>,
  weekIndex: number,
  lookback = 3,
): Set<string> {
  const banned = new Set<string>();
  for (const entry of history) {
    if (
      entry.templateId &&
      entry.weekIndex < weekIndex &&
      entry.weekIndex >= weekIndex - lookback
    ) {
      banned.add(entry.templateId);
    }
  }
  return banned;
}

export function selectTemplate(
  pool: WorkoutTemplate[],
  banned: Set<string>,
  weekIndex: number,
): WorkoutTemplate {
  const fresh = pool.filter((template) => !banned.has(template.id));
  const usable = fresh.length > 0 ? fresh : pool;
  return usable[weekIndex % usable.length];
}

function fiveDayTypes(): RunType[] {
  return ['long', 'speed', 'tempo', 'recovery', 'recovery'];
}

function typesForDays(daysPerWeek: DaysPerWeek): RunType[] {
  if (daysPerWeek === 5) return fiveDayTypes();
  if (daysPerWeek === 3) return ['long', 'tempo', 'recovery'];
  if (daysPerWeek === 4) return ['long', 'speed', 'tempo', 'recovery'];
  if (daysPerWeek === 6) {
    return ['long', 'speed', 'tempo', 'recovery', 'recovery', 'recovery'];
  }
  return [
    'long',
    'speed',
    'tempo',
    'recovery',
    'recovery',
    'recovery',
    'recovery',
  ];
}

function splitRemaining(remainingKm: number, types: RunType[]): number[] {
  const otherTypes = types.filter((type) => type !== 'long');
  if (otherTypes.length === 0) return [];
  const weights = otherTypes.map((type) => {
    if (type === 'speed') return 1.15;
    if (type === 'tempo') return 1.25;
    return 0.8;
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (remainingKm * weight) / weightSum);
}

function titleFor(type: RunType, template?: WorkoutTemplate): string {
  if (type === 'long') return 'Long run';
  if (type === 'speed') return template?.name ?? 'Speed / interval';
  if (type === 'tempo') return template?.name ?? 'Tempo';
  if (type === 'race') return 'Race';
  return 'Recovery run';
}

function baselineWeeklyVolume(
  input: UserTrainingInput,
  week1Long: number,
): number {
  const declared = input.currentWeeklyVolume;
  const derived = week1Long * (input.daysPerWeek <= 4 ? 2.2 : 2.6);
  const floor = week1Long + 2 * (input.daysPerWeek - 1);
  if (declared == null || !Number.isFinite(declared) || declared <= 0) {
    return Math.max(derived, floor);
  }
  return Math.max(declared, floor, week1Long);
}

function longRunSeries(
  weeksUntilRace: number,
  startLong: number,
  peakTarget: number,
  goal: Goal,
): number[] {
  const taperWeeks = taperWeekCount(goal, weeksUntilRace);
  const peakAt = peakWeekIndex(weeksUntilRace, taperWeeks);
  const series: number[] = [];
  let current = startLong;
  for (let week = 0; week < weeksUntilRace; week++) {
    const phase = phaseForWeek(week, weeksUntilRace, taperWeeks);
    if (week > 0 && week <= peakAt) {
      current = roundKm(
        current +
          (goal === 'marathon'
            ? Math.min(2, Math.max(0, peakTarget - current))
            : safeLongRunStep(current, Math.max(0, peakTarget - current))),
        3,
      );
    }
    if (phase === 'taper' || phase === 'race-week') {
      series.push(
        goal === 'marathon' && week > 0
          ? Math.max(
              1,
              Math.floor(
                current * volumeFractionForWeek(week, weeksUntilRace, goal),
              ),
            )
          : Math.max(startLong, current),
      );
    } else {
      series.push(current);
    }
  }
  return series;
}

function validateInput(input: UserTrainingInput): UserTrainingInput {
  if (!input || typeof input !== 'object') {
    throw new TrainingEngineError('Training input is required.', {
      code: 'INVALID_GOAL',
    });
  }
  const goals: Goal[] = ['5k', '10k', 'half', 'marathon', 'ultra'];
  if (!goals.includes(input.goal)) {
    throw new TrainingEngineError('Unsupported training goal.', {
      code: 'INVALID_GOAL',
      details: { goal: String(input.goal) },
    });
  }
  if (
    !Number.isInteger(input.weeksUntilRace) ||
    input.weeksUntilRace < 2 ||
    input.weeksUntilRace > 52
  ) {
    throw new TrainingEngineError(
      'weeksUntilRace must be a whole number from 2 to 52.',
      {
        code: 'INVALID_WEEKS',
        details: { weeksUntilRace: input.weeksUntilRace ?? null },
      },
    );
  }
  if (
    !Number.isFinite(input.currentLongRun) ||
    input.currentLongRun <= 0 ||
    input.currentLongRun > 1000
  ) {
    throw new TrainingEngineError(
      'currentLongRun must be greater than 0 and at most 1000 km.',
      {
        code: 'INVALID_LONG_RUN',
        details: { currentLongRun: input.currentLongRun ?? null },
      },
    );
  }
  const days = input.daysPerWeek;
  if (![3, 4, 5, 6, 7].includes(days)) {
    throw new TrainingEngineError(
      'daysPerWeek must be an integer from 3 to 7.',
      {
        code: 'INVALID_DAYS',
        details: { daysPerWeek: days ?? null },
      },
    );
  }
  if (
    input.currentWeeklyVolume != null &&
    (!Number.isFinite(input.currentWeeklyVolume) ||
      input.currentWeeklyVolume < 0 ||
      input.currentWeeklyVolume > 1000)
  ) {
    throw new TrainingEngineError(
      'currentWeeklyVolume must be between 0 and 1000 km.',
      {
        code: 'INVALID_VOLUME',
        details: { currentWeeklyVolume: input.currentWeeklyVolume },
      },
    );
  }
  return {
    ...input,
    weeksUntilRace: Math.floor(input.weeksUntilRace),
    currentLongRun: input.currentLongRun,
    daysPerWeek: days,
  };
}

export function generateTrainingPlan(raw: UserTrainingInput): TrainingPlan {
  const input = validateInput(raw);
  let paces: ReturnType<typeof calculateTrainingPaces> | undefined;
  if (input.recentRace !== undefined) {
    try {
      paces = calculateTrainingPaces(validateRecentRace(input.recentRace));
    } catch (error) {
      throw new TrainingEngineError((error as Error).message, {
        code: 'INVALID_BENCHMARK',
      });
    }
  }
  const week1Long = week1LongRunKm(input);
  const unconstrainedPeak = peakLongRunTargetKm(input.goal, week1Long);
  const taperWeeks = taperWeekCount(input.goal, input.weeksUntilRace);
  const longs = longRunSeries(
    input.weeksUntilRace,
    week1Long,
    unconstrainedPeak,
    input.goal,
  );
  const peakLongRunAchievedKm = roundKm(
    longs.reduce((peak, km) => Math.max(peak, km), 0),
    3,
  );
  const baselineWeekly = baselineWeeklyVolume(input, week1Long);
  const peakWeeklyVolumeKm = roundKm(
    Math.max(
      baselineWeekly,
      peakLongRunAchievedKm * (input.daysPerWeek <= 4 ? 2.3 : 2.7),
    ),
    KM_DIGITS,
  );

  const notes: string[] = [];
  if (peakLongRunAchievedKm + KM_EPS < unconstrainedPeak) {
    notes.push(
      `Peak long run is ${peakLongRunAchievedKm} km rather than the ${unconstrainedPeak} km benchmark because the available build weeks limit progression before taper.`,
    );
  }
  if (week1Long > input.currentLongRun) {
    notes.push(
      input.goal === 'marathon'
        ? `Week 1 long run was rounded up to ${week1Long} whole kilometres.`
        : `Week 1 long run was raised to the ${input.goal} minimum of ${MINIMUM_LONG_RUN_KM[input.goal]} km.`,
    );
  }

  const templateHistory: Array<{ weekIndex: number; templateId?: string }> = [];
  const types: RunType[] =
    input.goal === 'marathon'
      ? [
          'long',
          'tempo',
          ...Array<RunType>(input.daysPerWeek - 2).fill('recovery'),
        ]
      : typesForDays(input.daysPerWeek);
  const weeks: TrainingWeek[] = [];

  for (let weekIndex = 0; weekIndex < input.weeksUntilRace; weekIndex++) {
    const phase = phaseForWeek(weekIndex, input.weeksUntilRace, taperWeeks);
    const fraction = volumeFractionForWeek(
      weekIndex,
      input.weeksUntilRace,
      input.goal,
    );
    const longKm = roundKm(longs[weekIndex], KM_DIGITS);
    let weeklyTotalVolume = roundKm(
      Math.max(
        peakWeeklyVolumeKm * fraction,
        longKm + 0.8 * (input.daysPerWeek - 1),
      ),
      KM_DIGITS,
    );
    if (weekIndex === 0) {
      weeklyTotalVolume = roundKm(
        Math.max(weeklyTotalVolume, baselineWeekly),
        KM_DIGITS,
      );
    }

    const remaining = Math.max(0, weeklyTotalVolume - longKm);
    const otherKm = splitRemaining(remaining, types);
    const rawSplits: number[] = [];
    let otherCursor = 0;
    for (const type of types) {
      if (type === 'long') rawSplits.push(longKm);
      else rawSplits.push(otherKm[otherCursor++]);
    }
    const reconciled = reconcileDailySplits(rawSplits, weeklyTotalVolume);

    const banned = recentTemplateIds(templateHistory, weekIndex, 3);
    const speedTemplate = selectTemplate(SPEED_TEMPLATES, banned, weekIndex);
    const tempoBanned = new Set(banned);
    tempoBanned.add(speedTemplate.id);
    const tempoTemplate = selectTemplate(
      TEMPO_TEMPLATES,
      tempoBanned,
      weekIndex,
    );

    const dailySplits: DailyWorkout[] = types.map((type, dayIndex) => {
      const km = reconciled[dayIndex];
      const template =
        type === 'speed'
          ? speedTemplate
          : type === 'tempo'
            ? tempoTemplate
            : undefined;
      const scaled =
        template && km > 0 ? scaleWorkout(km, template, paces) : undefined;
      if (template) {
        templateHistory.push({ weekIndex, templateId: template.id });
      }
      return {
        dayIndex,
        ...(paces
          ? {
              paceSecondsPerKm:
                type === 'speed'
                  ? paces.interval
                  : type === 'tempo'
                    ? (scaled?.steps.find((s) => s.kind === 'interval')
                        ?.paceSecondsPerKm ?? paces.tempo)
                    : paces.easy,
            }
          : {}),
        type,
        km,
        title: titleFor(type, template),
        templateId: template?.id,
        scaled,
      };
    });

    weeks.push({
      weekIndex,
      weekNumber: weekIndex + 1,
      phase,
      weeklyTotalVolume,
      longRunKm: longKm,
      dailySplits,
      volumeFraction: fraction,
    });
  }

  return {
    goal: input.goal,
    weeksUntilRace: input.weeksUntilRace,
    daysPerWeek: input.daysPerWeek,
    week1LongRunKm: week1Long,
    peakLongRunTargetKm: unconstrainedPeak,
    peakLongRunAchievedKm,
    peakWeeklyVolumeKm,
    weeks,
    notes,
  };
}

export const WORKOUT_TEMPLATES = {
  speed: SPEED_TEMPLATES,
  tempo: TEMPO_TEMPLATES,
} as const;

export type {
  DailyWorkout,
  Goal,
  ScaledWorkout,
  TrainingPlan,
  TrainingWeek,
  UserTrainingInput,
  WorkoutTemplate,
};
