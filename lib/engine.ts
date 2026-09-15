import {
  SESSION_POLICY,
  FEASIBILITY_POLICY,
  DAYS_PER_WEEK,
  RUN_WALK_VARIANT_STRIDE,
} from './plan/generation-constants.ts';
import {
  resolveGenerationPolicy,
  type ReplanContext,
} from './plan/generation-policy.ts';
import { generatePlanWeeks } from './plan/generation-weeks.ts';
import { buildSteps } from './plan/generation-prescription.ts';
import {
  taperFactor,
  trainingPhaseOn,
  usesDailyTaperPhase,
  marathonRaceWeekRunCount,
} from './plan/generation-calendar.ts';
export {
  taperFactor,
  trainingPhaseOn,
  usesDailyTaperPhase,
} from './plan/generation-calendar.ts';
import {
  schedulingEasyPace,
  validateRecentRace,
  type RecentRace,
} from './fitness-pacing.ts';
import {
  withSpecificWorkoutName,
  withSteadyRaceInstructions,
} from './workout-names.ts';
import { isSteadyRaceAdaptation } from './steady-race-workout.ts';

import {
  customWorkoutEventDistance,
  eventContextText,
} from './workout-event-context.ts';
import {
  usesMarathonBook,
  marathonTaperDays,
  marathonRecoveryFactor,
  marathonBookNote,
} from './marathon-book.ts';
import {
  customizationError,
  runningDayLimit,
  applyPreferredStartTimes,
  validStartTime,
  clockMinutes,
  type DayPreference,
} from './runner-customization.ts';
import {
  validateWorkoutTargets,
  withWorkoutTargets,
  type StepTarget,
  type WorkoutTargets,
} from './workout-targets.ts';
import {
  FIFTY_MILES_KM,
  HUNDRED_MILES_KM,
  isLongUltra,
  LONG_ULTRA_POLICY,
  longUltraCapacityMessage,
} from './ultra-policy.ts';
import {
  qualitySchedule,
  usesMarathonRhythm,
  desiredRuns,
  availableRunningDays,
  resolveRunningDays,
  classicQualityCount,
  allocateRunningMinutes,
  longRunShareLimit,
} from './training-structure.ts';
import { runWalkIntervalSeconds } from './prescription.ts';
import { isRunWalkWorkout } from './run-walk.ts';

import {
  currentTrainingBaseline,
  trainingRecords,
} from './training-history.ts';
import { distanceEstimate, qualityWorkMinutes } from './prescription.ts';
import { prescribedDistanceKm, runMeasureNote } from './run-distance.ts';
import {
  advancedEligibility,
  applyAdvancedMethod,
  type TrainingMethod,
} from './advanced-methods.ts';
import {
  variedWorkoutPrescription,
  scaleTemplate,
  resizeWorkout,
  WORKOUT_LIBRARY,
} from './workout-library.ts';

/** Independent coaching heuristics. See outputs/Stride-Algorithm-Research.md. */
export const ENGINE_VERSION = 'stride-0.10.0';
export const MAX_EVENT_KM = HUNDRED_MILES_KM; // Exact 100 miles, on runnable courses.
/** Product heuristics for review, not scientifically established safety thresholds. */
export const TRAINING_POLICY = {
  version: 'provisional-2026-09-11-v30',
  reviewStatus: 'Awaiting independent coaching review',
  estimatedEasyMinutesPerKm: 7,
  returningRunnerFactor: 0.8,
  maximumForecastFactor: 1.45,
  recoveryEveryWeeks: 4,
  recoveryVolumeFactor: 0.82,
  minimumDemandingSpacingDays: 2,
  family: {
    '5k': {
      weeklyStepKm: 1.5,
      longStepKm: 0.5,
      longCeilingKm: 11,
      minimumTrainingExposureKm: 4,
      minWeekly: 10,
      minLong: 3,
      minRuns: 2,
      recommendedDays: 41,
      maxForecast: 1.45,
    },
    '10k': {
      weeklyStepKm: 2,
      longStepKm: 0.75,
      longCeilingKm: 16,
      minimumTrainingExposureKm: 7.5,
      minWeekly: 18,
      minLong: 5,
      minRuns: 2,
      recommendedDays: 41,
      maxForecast: 1.45,
    },
    half: {
      weeklyStepKm: 2.5,
      longStepKm: 1,
      longCeilingKm: 21,
      minimumTrainingExposureKm: 16,
      minWeekly: 24,
      minLong: 8,
      minRuns: 3,
      recommendedDays: 83,
      maxForecast: 1.45,
    },
    marathon: {
      weeklyStepKm: 3,
      longStepKm: 2,
      longCeilingKm: 35,
      minimumTrainingExposureKm: 26,
      minWeekly: 32,
      minLong: 12,
      minRuns: 4,
      recommendedDays: 111,
      maxForecast: 1.4,
    },
    ultra: {
      weeklyStepKm: 3,
      longStepKm: 1.5,
      longCeilingKm: 45,
      minimumTrainingExposureKm: 28,
      minWeekly: 40,
      minLong: 16,
      minRuns: 4,
      recommendedDays: 139,
      maxForecast: 1.45,
    },
    base: {
      weeklyStepKm: 1.5,
      longStepKm: 0.5,
      longCeilingKm: 11,
      minimumTrainingExposureKm: 0,
      minWeekly: 0,
      minLong: 0,
      minRuns: 0,
      recommendedDays: 27,
      maxForecast: 1.45,
    },
  },
} as const;
export type Goal =
  | '5k'
  | '10k'
  | 'half'
  | 'marathon'
  | 'ultra'
  | 'custom'
  | 'base';
export type TrainingFamily =
  | '5k'
  | '10k'
  | 'half'
  | 'marathon'
  | 'ultra'
  | 'base';
export type Phase =
  | 'Foundation'
  | 'Maintenance'
  | 'Build'
  | 'Race preparation'
  | 'Recovery'
  | 'Taper'
  | 'Race week';
export type WorkoutKind =
  | 'easy'
  | 'long'
  | 'intervals'
  | 'tempo'
  | 'fartlek'
  | 'race';
export type Profile = {
  recentRace?: RecentRace;
  dayPreferences?: DayPreference[];
  weeklyMinutesLimit?: number | null;
  workoutFormat?: 'automatic' | 'time' | 'distance';
  workoutVariety?: 'varied' | 'familiar';
  runMeasure?: 'distance' | 'time';
  workoutTargets?: WorkoutTargets;
  name: string;
  goal: Goal;
  raceName: string;
  raceDate: string;
  startDate: string;
  weeklyKm: number;
  longestKm: number;
  currentRuns: number;
  days: number[];
  availableDays?: number[];
  runsPerWeek?: number;
  qualityMode?: 'automatic' | 'custom';
  longDay: number;
  weekdayMinutes: number;
  longMinutes: number;
  experience: 'returning' | 'established' | 'new';
  difficulty: 'gentle' | 'balanced';
  volume: 'maintain' | 'gradual';
  timezone: string;
  units: 'km' | 'mi';
  easyPace: number | null;
  runWalkStage?: 0 | 1 | 2 | 3 | 4;
  qualitySessions?: 0 | 1 | 2;
  recoveryWeeks?: 3 | 4;
  terrain?: 'flat' | 'hills';
  raceDistanceKm?: number;
  raceTerrain?: 'road' | 'rolling' | 'mountain';
  easyLimitKm?: number | null;
  qualityLimitKm?: number | null;
  longLimitKm?: number | null;
  peakWeeklyKm?: number | null;
  intent?: 'finish' | 'improve';
  recentQualitySessions?: 0 | 1 | 2 | 3 | 4 | null;
  marathonApproach?: 'balanced' | 'endurance';
  method?: TrainingMethod;
  stableWeeks?: number;
  ultraWeeklyMinutes?: number;
  ultraLongestMinutes?: number;
  easyDoubleWeeks?: number | null;
  recentSessionsPerWeek?: number;
  recentQualityMinutes?: number | null;
  doubleDays?: number[];
  doubleGapHours?: number | null;
  thresholdControl?: 'effort' | 'heart-rate' | 'lactate';
  thresholdCeiling?: number;
  preferredHardDays?: number[];
  crossTraining?: {
    day: number;
    activity: 'strength' | 'cycling' | 'swimming' | 'mobility';
    minutes: number;
  }[];
  carbsPerHour?: number | null;
  practiceInDark?: boolean;
};
export type Step = {
  target?: StepTarget;
  label: string;
  seconds: number;
  metres?: number;
  planningPaceSecondsPerKm?: number;
  effort: string;
  intensity: number;
  kind: 'warmup' | 'aerobic' | 'work' | 'recovery' | 'cooldown';
  movement?: 'run' | 'walk';
};
export type Feedback = {
  effort: number;
  feeling: 'good' | 'okay' | 'tired';
  enjoyment?: 'yes' | 'maybe' | 'no';
  actualMinutes: number;
  actualKm: number | null;
  note: string;
  recordedAt: string;
  activityId?: string;
  source?: string;
  actualDate?: string;
  execution?:
    | 'as-planned'
    | 'partial'
    | 'easy-substitute'
    | 'not-attempted'
    | 'unknown';
  completedQualityMinutes?: number;
  executionSource?: 'self-report';
};
export type Workout = {
  id: string;
  date: string;
  originalDate: string;
  week: number;
  title: string;
  kind: WorkoutKind;
  minutes: number;
  estimatedKm: number;
  hard: boolean;
  purpose: string;
  reason: string;
  steps: Step[];
  status: 'planned' | 'completed' | 'skipped';
  feedback?: Feedback;
  skipReason?: string;
  changed?: boolean;
  changeSource?: 'manual' | 'preferences';
  templateId?: string;
  varietyVersion?: string;
  varietySourceTemplateId?: string;
  /** Saved event identity for custom race-rhythm cues; never a pace estimate. */
  eventDistanceKm?: number;
  stimulus?: string;
  qualityMinutes?: number;
  targetWorkMinutes?: number;
  distanceEstimate?: ReturnType<typeof distanceEstimate>;
  role?: string;
  returnRole?: WorkoutKind;
  returnCeilingMinutes?: number;
  /** Stage identity belongs to the saved prescription, including after completion. */
  returnStage?: 1 | 2;
  returnStageStarted?: string;
  session?: 'AM' | 'PM';
  pairId?: string;
  pairType?: 'easy-doubles' | 'double-threshold';
  startTime?: string;
};
export type Week = {
  index: number;
  start: string;
  phase: Phase;
  targetKm: number;
  longKm: number;
  focus: string;
  raceKm?: number;
  trainingMinutes?: number;
  qualityMinutes?: number;
  rationale?: string[];
};
export type Plan = {
  id: string;
  activationRequestId?: string;
  activationInput?: string;
  engineVersion: string;
  policyVersion: string;
  profile: Profile;
  weeks: Week[];
  workouts: Workout[];
  notes: string[];
  createdAt: string;
  constraintsFrom?: string;
  baselineEvidence?: {
    from: string;
    asOf: string;
    coverage: number;
    known: number;
    due: number;
    weeklyKm: number;
    weeklyMinutes: number;
    longestKm: number;
    longestMinutes?: number;
    supportsProgression?: boolean;
    source: 'recorded-plan-history' | 'declared-baseline';
    explanation: string;
  };
  feasibility?: {
    status: 'forecast' | 'review-required' | 'event-deferred';
    reasons: string[];
    asOf: string;
  };
  returnState?: {
    from: string;
    to: string;
    stage: 1 | 2 | 3;
    stageStarted: string;
    baselineKm: number;
    longestKm: number;
    baselineMinutes?: number;
    longestMinutes?: number;
    reason: string;
  };
  extraRuns?: ExtraRun[];
};
export type ExtraRun = {
  id: string;
  corrections?: {
    at: string;
    reason: string;
    date: string;
    minutes: number;
    km: number | null;
    effort: number;
    feeling: string;
    note: string;
  }[];
  date: string;
  minutes: number;
  km: number | null;
  effort: number;
  feeling: 'good' | 'okay' | 'tired';
  note: string;
  activityId?: string;
  source?: string;
  recordedAt: string;
};
export type State = {
  accountId?: string;
  accountEpoch?: number;
  accountStatus?: string;
  standaloneRuns?: ExtraRun[];
  version: number;
  plan: Plan | null;
  updatedAt: string | null;
  lastChange?: string;
};
export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanError';
  }
}
export const dayNames = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export const round = (n: number, digits = 1) =>
  Math.round(n * 10 ** digits) / 10 ** digits;
export function validDate(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s
  );
}
export function addDays(date: string, days: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string) {
  return Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000,
  );
}
export function weekday(date: string) {
  return (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
}
export function monday(date: string) {
  return addDays(date, -weekday(date));
}
export function todayInZone(zone: string, instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  return ['year', 'month', 'day']
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join('-');
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  return new Intl.DateTimeFormat('en-GB', {
    ...options,
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'));
}
export const goalLabel = (goal: Goal) =>
  ({
    base: 'Build a running habit',
    '5k': '5K training',
    '10k': '10K training',
    half: 'Half-marathon training',
    marathon: 'Marathon training',
    ultra: 'Ultra training',
    custom: 'Custom-distance training',
  })[goal];
export function raceDistance(
  p: Pick<Profile, 'goal' | 'raceDistanceKm'>,
): number {
  return p.goal === 'base'
    ? 0
    : p.goal === '5k'
      ? 5
      : p.goal === '10k'
        ? 10
        : p.goal === 'half'
          ? 21.0975
          : p.goal === 'marathon'
            ? 42.195
            : (p.raceDistanceKm ?? (p.goal === 'ultra' ? 50 : 10));
}
export function trainingFamily(
  p: Pick<Profile, 'goal' | 'raceDistanceKm'>,
): TrainingFamily {
  if (!['custom', 'ultra'].includes(p.goal)) return p.goal as TrainingFamily;
  const d = raceDistance(p);
  // Preparation bands describe a model, not a measurement or finish-time prediction.
  return d <= 7.5
    ? '5k'
    : d <= 15
      ? '10k'
      : d <= 30
        ? 'half'
        : d <= 45
          ? 'marathon'
          : 'ultra';
}
export function extendedUltra(p: Pick<Profile, 'goal' | 'raceDistanceKm'>) {
  return trainingFamily(p) === 'ultra' && raceDistance(p) > 60;
}
/** Keep the setup's guidance and the server's frequency boundary in agreement. */
export function runningDayRange(
  p: Pick<Profile, 'currentRuns' | 'goal' | 'raceDistanceKm'>,
) {
  return {
    min: trainingFamily(p) === 'ultra' ? 5 : 2,
    max: Number.isFinite(p.currentRuns)
      ? p.currentRuns === 0
        ? 3
        : Math.min(7, p.currentRuns + 1)
      : 7,
  };
}
export function preparationRequirements(
  p: Pick<Profile, 'goal' | 'raceDistanceKm'>,
) {
  const family = trainingFamily(p),
    policy = TRAINING_POLICY.family[family],
    extended = extendedUltra(p);
  const bands = {
    '5k': '1–7.5 km',
    '10k': 'over 7.5–15 km',
    half: 'over 15–30 km',
    marathon: 'over 30–45 km',
    ultra: isLongUltra(p)
      ? raceDistance(p) <= 100
        ? 'over 50 miles–100 km'
        : 'over 100 km–100 miles'
      : extended
        ? 'over 60 km–50 miles'
        : 'over 45–60 km',
    base: 'Base building',
  };
  return {
    family,
    band: bands[family],
    recommendedDays: ['custom', 'ultra'].includes(p.goal)
      ? Math.ceil(interpolateReadiness(raceDistance(p), 1))
      : extended
        ? 167
        : policy.recommendedDays,
    minWeekly: ['custom', 'ultra'].includes(p.goal)
      ? round(interpolateReadiness(raceDistance(p), 2), 1)
      : extended
        ? 50
        : policy.minWeekly,
    minLong: ['custom', 'ultra'].includes(p.goal)
      ? round(interpolateReadiness(raceDistance(p), 3), 1)
      : extended
        ? 20
        : policy.minLong,
    minRuns: ['custom', 'ultra'].includes(p.goal)
      ? raceDistance(p) > 50
        ? 5
        : raceDistance(p) > 30
          ? 4
          : raceDistance(p) > 10
            ? 3
            : 2
      : extended
        ? 5
        : policy.minRuns,
  };
}
function interpolateReadiness(distance: number, column: number) {
  // Authored continuous readiness between existing named-event anchors; templates are separate.
  const anchors = [
    [1, 41, 10, 3],
    [5, 41, 10, 3],
    [10, 41, 18, 5],
    [21.0975, 83, 24, 8],
    [42.195, 111, 32, 12],
    [50, 139, 40, 16],
    [80, 167, 50, 20],
    [FIFTY_MILES_KM, 167, 50, 20],
    [100, 167, 60, 24],
    [MAX_EVENT_KM, 195, 70, 28],
  ];
  for (let i = 1; i < anchors.length; i++) {
    if (distance <= anchors[i][0]) {
      const a = anchors[i - 1],
        b = anchors[i];
      return (
        a[column] +
        ((b[column] - a[column]) * (distance - a[0])) / (b[0] - a[0])
      );
    }
  }
  return anchors.at(-1)![column];
}
export function customExposureKm(distance: number) {
  // Authored interpolation through the existing named-event exposure policies.
  const anchors = [
    [1, 0.8],
    [5, 4],
    [10, 7.5],
    [21.0975, 16],
    [42.195, 26],
    [50, 28],
    [80, 32],
    [FIFTY_MILES_KM, 32],
    [MAX_EVENT_KM, 32],
  ];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i],
      [a, b] = anchors[i - 1];
    if (distance <= x) return b + ((y - b) * (distance - a)) / (x - a);
  }
  return 32;
}
export function eventDistanceDisplay(km: number, units: 'km' | 'mi') {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: units === 'km' ? 4 : 5,
  }).format(units === 'mi' ? km / 1.609344 : km);
}
export function workoutDistanceValue(
  w: Workout,
  p: Pick<Profile, 'units' | 'easyPace'>,
) {
  if (w.kind === 'race') return eventDistanceDisplay(w.estimatedKm, p.units);
  const exact = prescribedDistanceKm(w);
  if (exact !== null) return String(kmDisplay(exact, p.units));
  const estimate = distanceEstimate(w.steps, p);
  return estimate.lowerKm === null
    ? '—'
    : `${kmDisplay(estimate.lowerKm, p.units)}–${kmDisplay(estimate.upperKm!, p.units)}`;
}
export function workoutDistanceLabel(
  w: Workout,
  p: Pick<Profile, 'units' | 'easyPace'>,
) {
  const value = workoutDistanceValue(w, p);
  return value === '—'
    ? 'Distance not estimated'
    : `${value} ${p.units}${w.kind === 'race' || prescribedDistanceKm(w) !== null ? '' : ' est.'}`;
}
export function kmDisplay(km: number, units: 'km' | 'mi') {
  return round(units === 'mi' ? km / 1.609344 : km);
}
export function validateProfile(
  input: unknown,
  _asOf?: string,
  historicalEligibility = false,
): Profile {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new PlanError('Enter your running background to build a plan.');
  const p = structuredClone(input) as Profile;
  // JSON must distinguish an explicit cleared answer from an omitted patch.
  for (const key of [
    'recentQualitySessions',
    'recentQualityMinutes',
    'easyDoubleWeeks',
    'doubleGapHours',
  ] as const)
    if (p[key] === null) delete p[key];
  if (p.recentRace === null) delete p.recentRace;
  if (p.recentRace !== undefined) {
    try {
      p.recentRace = validateRecentRace(p.recentRace);
    } catch (error) {
      throw new PlanError((error as Error).message);
    }
  }
  if (p.workoutTargets !== undefined) {
    try {
      p.workoutTargets = validateWorkoutTargets(p.workoutTargets);
    } catch (e) {
      throw new PlanError((e as Error).message);
    }
  }
  if (
    !['5k', '10k', 'half', 'marathon', 'ultra', 'custom', 'base'].includes(
      p.goal,
    )
  )
    throw new PlanError('Choose a supported race distance or a base plan.');
  if (
    ['custom', 'ultra'].includes(p.goal) &&
    (!Number.isFinite(p.raceDistanceKm) ||
      raceDistance(p) < 1 ||
      raceDistance(p) > MAX_EVENT_KM ||
      (p.goal === 'ultra' && raceDistance(p) <= 42.195))
  )
    throw new PlanError(
      'Custom races support 1 km–100 miles; ultra plans support runnable distances above a marathon up to 100 miles. Longer or technical mountain events need a different preparation model.',
    );
  if (typeof p.timezone !== 'string' || !p.timezone)
    throw new PlanError('Choose a valid timezone.');
  if (
    p.recentQualitySessions != null &&
    ![0, 1, 2, 3, 4].includes(p.recentQualitySessions)
  )
    throw new PlanError(
      'Choose a recent quality-session count from zero to four.',
    );
  if (['custom', 'ultra'].includes(p.goal))
    p.raceDistanceKm = round(p.raceDistanceKm!, 4);
  const family = trainingFamily(p);
  p.raceTerrain ??= 'road';
  p.intent ??= 'improve';
  if (
    !['road', 'rolling', 'mountain'].includes(p.raceTerrain) ||
    !['finish', 'improve'].includes(p.intent)
  )
    throw new PlanError('Check your race terrain and training intention.');
  if (p.raceTerrain === 'mountain')
    throw new PlanError(
      'Steep mountain races need a terrain-specific plan. Choose a road or runnable rolling course for this engine.',
    );
  if (!validDate(p.startDate) || !validDate(p.raceDate))
    throw new PlanError('Enter valid start and finish dates.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: p.timezone }).format();
  } catch {
    throw new PlanError('Choose a valid timezone, such as Europe/London.');
  }
  const length = dayDiff(p.startDate, p.raceDate);
  const requirements = preparationRequirements(p);
  if (length < 0)
    throw new PlanError('Choose a finish date on or after your start date.');
  if (length > 363)
    throw new PlanError(
      'Plans can cover up to 52 weeks. Choose an earlier finish date.',
    );
  const nums: [keyof Profile, number, number, string][] = [
    ['weeklyKm', 0, usesMarathonBook(p) ? 150 : 120, 'recent weekly distance'],
    ['longestKm', 0, 45, 'recent longest run'],
    ['currentRuns', 0, 7, 'current running frequency'],
    ['weekdayMinutes', 20, 120, 'weekday time limit'],
    ['longMinutes', 30, 300, 'long-run time limit'],
  ];
  for (const [key, min, max, label] of nums)
    if (
      typeof p[key] !== 'number' ||
      !Number.isFinite(p[key]) ||
      Number(p[key]) < min ||
      Number(p[key]) > max
    )
      throw new PlanError(
        `Check your ${label}; enter a number between ${min} and ${max}.`,
      );
  if (!Number.isInteger(p.currentRuns))
    throw new PlanError('Current runs per week must be a whole number.');
  if (p.longestKm > p.weeklyKm && p.weeklyKm > 0)
    throw new PlanError(
      'Your longest run exceeds your typical weekly total. Check the recent training inputs.',
    );
  if (
    !Array.isArray(p.days) ||
    p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(p.days).size !== p.days.length ||
    p.days.length > 7
  )
    throw new PlanError('Choose distinct running days from Monday to Sunday.');
  if (
    p.availableDays !== undefined &&
    (!Array.isArray(p.availableDays) ||
      p.availableDays.length < 2 ||
      p.availableDays.length > 7 ||
      p.availableDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
      new Set(p.availableDays).size !== p.availableDays.length)
  )
    throw new PlanError('Choose 2–7 distinct available days.');
  const runs = desiredRuns(p),
    available = availableRunningDays(p);
  const customError = customizationError(p);
  if (customError) throw new PlanError(customError);
  if (
    p.preferredHardDays !== undefined &&
    (!Array.isArray(p.preferredHardDays) ||
      p.preferredHardDays.length > 2 ||
      new Set(p.preferredHardDays).size !== p.preferredHardDays.length ||
      p.preferredHardDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
  )
    throw new PlanError('Choose up to two distinct preferred workout days.');
  if (
    p.crossTraining !== undefined &&
    (!Array.isArray(p.crossTraining) ||
      p.crossTraining.length > 3 ||
      new Set(p.crossTraining.map((s) => s?.day)).size !==
        p.crossTraining.length ||
      p.crossTraining.some(
        (s) =>
          !s ||
          typeof s !== 'object' ||
          !Number.isInteger(s.day) ||
          s.day < 0 ||
          s.day > 6 ||
          !['strength', 'cycling', 'swimming', 'mobility'].includes(
            s.activity,
          ) ||
          !Number.isInteger(s.minutes) ||
          s.minutes < 10 ||
          s.minutes > 60,
      ))
  )
    throw new PlanError(
      'Choose up to three separate cross-training days, each with 10–60 minutes of easy activity.',
    );
  if (
    p.carbsPerHour != null &&
    (!Number.isFinite(p.carbsPerHour) ||
      p.carbsPerHour < 15 ||
      p.carbsPerHour > 120)
  )
    throw new PlanError(
      'Enter a carbohydrate intake you already tolerate, from 15–120 g/hour, or leave it blank.',
    );
  if (p.practiceInDark !== undefined && typeof p.practiceInDark !== 'boolean')
    throw new PlanError(
      'Choose whether you want short equipment practice in darkness.',
    );
  const crossDays = p.crossTraining?.map((s) => s.day) ?? [];
  if (
    crossDays.includes(p.longDay) ||
    p.doubleDays?.some((d) => crossDays.includes(d))
  )
    throw new PlanError(
      'Keep cross-training days separate from your long run and paired running day.',
    );
  if (runs > available.filter((d) => !crossDays.includes(d)).length)
    throw new PlanError(
      'Your cross-training days are reserved without running. Add other available running days, remove a cross-training day, or request fewer runs.',
    );
  if (!Number.isInteger(runs) || runs < 2 || runs > 7)
    throw new PlanError('Choose between 2 and 7 runs per week.');
  if (runs > available.length)
    throw new PlanError(
      `You want ${runs} runs but have only ${available.length} available days. Add available days or reduce runs per week.`,
    );
  if (!available.includes(p.longDay))
    throw new PlanError(
      'Your preferred long-run day must be one of your available days.',
    );
  if (p.currentRuns > 0 && runs > p.currentRuns + 1)
    throw new PlanError(
      `You entered ${p.currentRuns} current running ${p.currentRuns === 1 ? 'day' : 'days'} and requested ${runs} runs. Choose at most ${runningDayRange(p).max} runs for this block, or review your recent routine if it was entered incorrectly. Available days do not increase your running frequency.`,
    );
  if (p.currentRuns === 0 && runs > 3)
    throw new PlanError(
      'Start with two or three runs per week when you have no recent running history.',
    );
  if (
    p.qualityMode !== undefined &&
    !['automatic', 'custom'].includes(p.qualityMode)
  )
    throw new PlanError('Choose automatic or custom workout structure.');
  if (p.qualityMode === 'automatic') p.qualitySessions = classicQualityCount(p);
  if (isLongUltra(p)) {
    p.practiceInDark ??= true;
    if (
      !Number.isFinite(p.ultraWeeklyMinutes) ||
      !Number.isFinite(p.ultraLongestMinutes) ||
      p.ultraWeeklyMinutes! < 60 ||
      p.ultraWeeklyMinutes! > 1260 ||
      p.ultraLongestMinutes! < 30 ||
      p.ultraLongestMinutes! > 600 ||
      p.ultraLongestMinutes! > p.ultraWeeklyMinutes!
    )
      throw new PlanError(
        'Enter your recent weekly running minutes and longest-run minutes for this long-ultra block. The long run cannot exceed the weekly total.',
      );
    if (
      p.experience !== 'established' ||
      !Number.isInteger(p.stableWeeks) ||
      (p.stableWeeks ?? 0) < LONG_ULTRA_POLICY.stableWeeks
    )
      throw new PlanError(
        'For ultras beyond 50 miles, enter at least 12 weeks of consistent recent running and an established routine. Build a base first if you are returning or still building consistency.',
      );
    if (p.method && p.method !== 'balanced')
      throw new PlanError(
        'Beyond 50 miles, use balanced race-specific training. This model uses single runs and at most one controlled workout each week.',
      );
    if (p.qualityMode === 'custom' && (p.qualitySessions ?? 0) > 1)
      throw new PlanError(
        'Beyond 50 miles, choose zero or one quality session. The remaining training supports easy endurance.',
      );
    p.qualitySessions = Math.min(1, p.qualitySessions ?? 1) as 0 | 1;
  }
  p.days = resolveRunningDays(p);
  if (p.days.length !== runs)
    throw new PlanError(
      'Your selected runs and paired-session days cannot fit the available days. Review your schedule.',
    );
  if (
    !['returning', 'established', 'new'].includes(p.experience) ||
    !['gentle', 'balanced'].includes(p.difficulty) ||
    !['maintain', 'gradual'].includes(p.volume) ||
    !['km', 'mi'].includes(p.units)
  )
    throw new PlanError('Check the training preferences.');
  const absoluteCeiling = usesMarathonBook(p)
    ? 150
    : family === 'ultra'
      ? extendedUltra(p)
        ? 120
        : 100
      : family === 'marathon' || family === '10k'
        ? 100
        : 80;
  if (p.weeklyKm > absoluteCeiling)
    throw new PlanError(
      `This policy supports a baseline up to ${absoluteCeiling} km per week. Higher-volume plans need an individually reviewed policy.`,
    );
  if (
    usesMarathonBook(p) &&
    p.weeklyKm > 100 &&
    (p.experience !== 'established' ||
      p.currentRuns < 6 ||
      p.days.length < 6 ||
      p.longestKm < 24)
  )
    throw new PlanError(
      'Above 100 km per week, this marathon model needs an established six-day routine and a recent long run of at least 24 km. Extra availability alone does not establish that baseline.',
    );
  if (
    !historicalEligibility &&
    p.goal !== 'base' &&
    (p.weeklyKm < requirements.minWeekly ||
      p.longestKm < requirements.minLong ||
      p.currentRuns < requirements.minRuns ||
      p.experience === 'new')
  )
    throw new PlanError(
      `This block needs a recent baseline of ${requirements.minWeekly} km per week, a ${requirements.minLong} km longest run and ${requirements.minRuns} running days. Build a base or choose a shorter distance first.`,
    );
  if (family === 'ultra' && p.days.length < 5)
    throw new PlanError(
      'Ultra preparation needs five available running days in this first policy.',
    );
  for (const key of [
    'easyLimitKm',
    'qualityLimitKm',
    'longLimitKm',
    'peakWeeklyKm',
  ] as const) {
    if (
      p[key] != null &&
      (!Number.isFinite(p[key]) || p[key]! < 1 || p[key]! > 150)
    )
      throw new PlanError(
        'Distance limits must be between 1 and 150 km, or left blank.',
      );
  }
  if (
    p.peakWeeklyKm != null &&
    p.peakWeeklyKm < p.weeklyKm * (p.experience === 'returning' ? 0.8 : 1)
  )
    throw new PlanError(
      'The peak-week ceiling cannot be below the starting baseline. Reduce the baseline deliberately in runner inputs.',
    );
  if (
    p.easyPace !== null &&
    (typeof p.easyPace !== 'number' ||
      !Number.isFinite(p.easyPace) ||
      p.easyPace < 3 ||
      p.easyPace > 15)
  )
    throw new PlanError(
      'Easy pace must be between 3 and 15 minutes per kilometre, or left blank.',
    );
  if (
    typeof p.name !== 'string' ||
    p.name.length > 60 ||
    typeof p.raceName !== 'string' ||
    p.raceName.length > 100
  )
    throw new PlanError(
      'Keep your name and race name under 60 and 100 characters.',
    );
  if (p.runWalkStage !== undefined && ![0, 1, 2, 3, 4].includes(p.runWalkStage))
    throw new PlanError('Choose a valid current run-walk stage.');
  p.qualitySessions ??= p.goal === 'base' ? 0 : 1;
  if (p.days.length === 2) p.qualitySessions = 0;
  p.recoveryWeeks ??= 4;
  p.terrain ??= 'flat';
  if (
    ![0, 1, 2].includes(p.qualitySessions) ||
    ![3, 4].includes(p.recoveryWeeks) ||
    !['flat', 'hills'].includes(p.terrain)
  )
    throw new PlanError(
      'Check your quality, recovery, and terrain preferences.',
    );
  if (
    !usesMarathonRhythm(p) &&
    p.qualityMode !== 'automatic' &&
    p.qualitySessions === 2 &&
    ((p.recentQualitySessions ?? 0) < 2 ||
      p.days.length < 5 ||
      p.weeklyKm < 45 ||
      p.currentRuns < 5 ||
      p.experience !== 'established')
  )
    throw new PlanError(
      'Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now.',
    );
  if (p.goal === 'base' || p.days.length === 2) p.qualitySessions = 0;
  if (
    p.marathonApproach !== undefined &&
    !['balanced', 'endurance'].includes(p.marathonApproach)
  )
    throw new PlanError('Choose a supported marathon approach.');
  if (
    p.marathonApproach === 'endurance' &&
    (trainingFamily(p) !== 'marathon' ||
      p.experience !== 'established' ||
      p.weeklyKm < 50 ||
      p.currentRuns < 5 ||
      p.days.length < 5 ||
      ['double-threshold', 'easy-doubles'].includes(p.method ?? ''))
  )
    throw new PlanError(
      'The medium-long marathon approach needs an established five-day, 50 km routine and a single-session training method.',
    );
  const methodErrors = advancedEligibility(p);
  if (methodErrors.length) throw new PlanError(methodErrors[0]);
  if (p.method === 'double-threshold') {
    p.qualitySessions = 1;
    const chosen = p.doubleDays![0];
    if (
      Math.min(Math.abs(chosen - p.longDay), 7 - Math.abs(chosen - p.longDay)) <
      2
    )
      throw new PlanError(
        'Place the paired threshold day at least one easy or rest day away from the long run.',
      );
  }
  if (usesMarathonRhythm(p)) {
    // This legacy field counts weekday workouts; the long run is the other quality session.
    p.qualitySessions = 1;
    if (p.days.length < 3 || qualitySchedule(p).length !== 1)
      throw new PlanError(
        'A standard marathon week needs a long run, one tempo workout of at least 30 minutes, and easy running. Choose a workout day separated from the long run by an easy or rest day.',
      );
  }
  p.days.sort((a, b) => a - b);
  p.name = p.name.trim();
  p.raceName = p.raceName.trim();
  return p;
}
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
      usesMarathonRhythm(p) &&
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
          w.kind === 'long' && family === 'marathon'
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
    feasibility: {
      status: 'forecast',
      reasons: [],
      asOf: replan?.from ?? p.startDate,
    },
  };
  applyActualTrainingEnvelope(plan, undefined, replan?.retainedPrefix);
  rebalanceFutureQuality(plan, replan?.from ?? p.startDate);
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
  const varied = refreshWorkoutVariety(plan, replan?.from ?? p.startDate);
  normalizeGeneratedMarathonLongRuns(varied, replan?.from ?? p.startDate);
  const errors = validatePlan(varied);
  if (errors.length) throw new PlanError(errors[0]);
  varied.workouts = varied.workouts.map((w) =>
    withWorkoutTargets(withSpecificWorkoutName(w), varied.profile),
  );
  // Whole-kilometre rounding can change the preceding long-run reference.
  // Recheck the executable distance targets, not only pre-rounding estimates.
  if (bookMarathon) {
    applyActualTrainingEnvelope(varied, undefined, replan?.retainedPrefix);
    rebalanceFutureQuality(varied, replan?.from ?? p.startDate);
  }
  ensureGeneratedMarathonRhythm(varied, replan?.from ?? p.startDate);
  normalizeGeneratedMarathonLongRuns(varied, replan?.from ?? p.startDate);
  refreshWeekTotals(varied);
  const finalErrors = validatePlan(varied);
  if (finalErrors.length) throw new PlanError(finalErrors[0]);
  return varied;
}
/** Intersect the whole-kilometre forecast with every final session capacity.
 * A backward pass lowers earlier targets when a later ordinary week cannot fund
 * them; it never adds minutes, alters history, or creates an unmarked cutback. */
function normalizeGeneratedMarathonLongRuns(plan: Plan, from: string) {
  if (trainingFamily(plan.profile) !== 'marathon' || plan.returnState) return;
  let nextBuildCeiling = 35;
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
      35,
      Math.floor(long.estimatedKm + 1e-6),
      ordinary ? nextBuildCeiling : 35,
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
function ensureGeneratedMarathonRhythm(plan: Plan, from: string) {
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
    if (tempo.minutes < 30 && timeCap >= 30) {
      let missing = 30 - tempo.minutes;
      const donors = runs.filter((w) => w !== tempo && w !== long && !w.hard);
      if (
        donors.reduce((sum, w) => sum + Math.max(0, w.minutes - 5), 0) >=
        missing
      ) {
        for (const donor of donors) {
          const take = Math.min(missing, donor.minutes - 5);
          if (take > 0)
            Object.assign(
              donor,
              resizeWorkout(donor, p, week.phase, donor.minutes - take),
            );
          missing -= take;
        }
        tempo.minutes = 30;
      }
    }
    if (tempo.minutes < 30 || timeCap < 30)
      throw new PlanError(
        `Week ${week.index + 1} cannot fit a 30-minute tempo workout within the selected time and distance limits.`,
      );
    const ceiling = runs.reduce((sum, w) => sum + w.minutes, 0) * 0.22;
    // Protect the weekday's useful minimum before allocating any faster long-run work.
    const otherWork = runs
      .filter((w) => w !== tempo && w !== long)
      .reduce((sum, w) => sum + qualityWorkMinutes(w), 0);
    if (qualityWorkMinutes(long) > ceiling - otherWork - 6) {
      Object.assign(
        long,
        resizeWorkout(
          long,
          p,
          week.phase,
          long.minutes,
          Math.max(0, ceiling - otherWork - 6),
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
      qualityWorkMinutes(tempo) >= 6 &&
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
      6,
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
      targetWorkMinutes: 6,
      title: template.title,
      purpose: template.purpose,
      reason:
        'A short controlled tempo preserves the two-session marathon rhythm within the existing weekly allocation.',
    });
    Object.assign(tempo, withWorkoutTargets(tempo, p));
  }
  refreshWeekTotals(plan);
}

export function validatePlan(plan: Plan): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const w of plan.workouts) {
    if (ids.has(w.id))
      errors.push(
        'Duplicate workout identity. Rebuild the affected future schedule.',
      );
    ids.add(w.id);
  }
  const ordered = plan.workouts
    .filter((w) => w.week >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = new Set<string>();
  let lastHard: Workout | undefined;
  let lastDemanding: Workout | undefined;
  for (const s of ordered) {
    if (
      dates.has(s.date) &&
      !(
        s.pairId &&
        ordered.filter((w) => w.date === s.date).length === 2 &&
        ordered
          .filter((w) => w.date === s.date)
          .every((w) => w.pairId === s.pairId)
      )
    )
      errors.push(
        `Two sessions would fall on ${dateLabel(s.date)}. Choose another date.`,
      );
    dates.add(s.date);
    if (
      isLongUltra(plan.profile) &&
      s.kind === 'long' &&
      s.status === 'planned' &&
      s.minutes > LONG_ULTRA_POLICY.longMinutes
    )
      errors.push('Long-ultra training runs are capped at four hours.');
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      plan.profile.crossTraining?.some((c) => c.day === weekday(s.date))
    )
      errors.push(
        'That day is reserved for cross-training without running. Move the run or revise your cross-training days.',
      );
    if (!Number.isFinite(s.estimatedKm) || s.estimatedKm < 0)
      errors.push(
        'Workout distance estimates must be finite and non-negative.',
      );
    if (
      !Number.isFinite(s.minutes) ||
      s.minutes <= 0 ||
      s.steps.some((x) => !Number.isFinite(x.seconds) || x.seconds <= 0)
    )
      errors.push('The session must contain positive, timed steps.');
    if (
      s.steps.some(
        (x) =>
          x.metres !== undefined &&
          (!Number.isFinite(x.metres) || x.metres <= 0 || x.metres > 250000),
      )
    )
      errors.push('Workout distances must be positive, finite metres.');
    if (
      s.steps.some(
        (x) =>
          x.planningPaceSecondsPerKm !== undefined &&
          (x.metres === undefined ||
            !Number.isFinite(x.planningPaceSecondsPerKm) ||
            x.planningPaceSecondsPerKm < 120 ||
            x.planningPaceSecondsPerKm > 1200 ||
            (x.metres * x.planningPaceSecondsPerKm) / 1000 > x.seconds + 1),
      )
    )
      errors.push('Distance repetitions need a valid planning-time allowance.');
    if (
      Math.abs(s.steps.reduce((n, x) => n + x.seconds, 0) - s.minutes * 60) > 1
    )
      errors.push('Workout steps do not match the total duration.');
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      s.minutes >
        (s.kind === 'long'
          ? plan.profile.longMinutes
          : plan.profile.weekdayMinutes)
    )
      errors.push('This workout exceeds your session time limit.');
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      s.startTime !== undefined &&
      (!validStartTime(s.startTime) ||
        clockMinutes(s.startTime) + s.minutes > 1440)
    )
      errors.push(
        'Choose a valid start time that leaves the whole run on the same day.',
      );
    const distanceCap =
      s.kind === 'long'
        ? plan.profile.longLimitKm
        : s.hard
          ? plan.profile.qualityLimitKm
          : plan.profile.easyLimitKm;
    if (
      s.kind !== 'race' &&
      s.status === 'planned' &&
      s.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      distanceCap != null &&
      s.estimatedKm > distanceCap + 0.01
    )
      errors.push(
        'A distance cap is too short for this session. Allow at least five minutes at your estimated easy pace, or increase the cap.',
      );
    if (s.date < plan.profile.startDate || s.date > plan.profile.raceDate)
      errors.push('Keep sessions inside the plan dates.');
    if (s.hard && s.status !== 'skipped') {
      if (
        lastHard &&
        !(s.pairId && s.pairId === lastHard.pairId) &&
        dayDiff(lastHard.date, s.date) <
          TRAINING_POLICY.minimumDemandingSpacingDays
      )
        errors.push(
          'Keep at least one easy or rest day between hard sessions.',
        );
      lastHard = s;
    }
    if ((s.hard || s.kind === 'long') && s.status !== 'skipped') {
      if (
        lastDemanding &&
        !(s.pairId && s.pairId === lastDemanding.pairId) &&
        dayDiff(lastDemanding.date, s.date) <
          TRAINING_POLICY.minimumDemandingSpacingDays
      )
        errors.push(
          'Keep at least one easy or rest day between long or hard sessions.',
        );
      lastDemanding = s;
    }
  }
  const pairs = new Map<string, Workout[]>();
  for (const w of ordered)
    if (w.pairId) pairs.set(w.pairId, [...(pairs.get(w.pairId) ?? []), w]);
  for (const pair of pairs.values()) {
    if (
      pair.length !== 2 ||
      pair[0].date !== pair[1].date ||
      new Set(pair.map((w) => w.session)).size !== 2 ||
      pair.some(
        (w) =>
          !['AM', 'PM'].includes(w.session ?? '') ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.startTime ?? '') ||
          !['easy-doubles', 'double-threshold'].includes(w.pairType ?? ''),
      ) ||
      pair[0].pairType !== pair[1].pairType
    ) {
      errors.push(
        'A paired day needs exactly one morning and one evening session on the same date.',
      );
      continue;
    }
    const am = pair.find((w) => w.session === 'AM')!,
      pm = pair.find((w) => w.session === 'PM')!;
    const minute = (v: string) => {
      const [h, m] = v.split(':').map(Number);
      return h * 60 + m;
    };
    if (
      minute(pm.startTime!) - minute(am.startTime!) - am.minutes < 360 ||
      minute(pm.startTime!) + pm.minutes > 1440
    )
      errors.push(
        'Keep at least six hours after the morning session, with both runs finishing on the same day.',
      );
    if (pair.some((w) => w.kind === 'long' || w.kind === 'race'))
      errors.push('Long runs and races cannot be split into ordinary doubles.');
    if (
      pair.every((w) => w.status === 'planned') &&
      pair[0].date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
      am.minutes + pm.minutes > plan.profile.weekdayMinutes
    )
      errors.push('Both sessions together exceed the weekday time budget.');
    if (
      pair[0].pairType === 'double-threshold' &&
      pair.reduce((n, w) => n + (w.qualityMinutes ?? 0), 0) > 40
    )
      errors.push(
        'The paired threshold day exceeds the 40-minute work ceiling.',
      );
  }
  // Validate prescriptions, never observed overruns: truthful logging must save.
  // Actual running reserves capacity when a future-plan review is requested.
  const running = ordered.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.status !== 'skipped',
  );
  const checkBudget = (runs: Workout[], limit: number, message: string) => {
    if (
      !Number.isFinite(limit) ||
      !runs.some(
        (w) =>
          w.status === 'planned' &&
          w.date >= (plan.constraintsFrom ?? plan.profile.startDate),
      )
    )
      return;
    const total = runs.reduce((n, w) => n + w.minutes, 0);
    if (total > limit + 0.01) errors.push(message);
  };
  for (const date of new Set(
    running
      .filter((w) =>
        Number.isFinite(runningDayLimit(plan.profile, weekday(w.date))),
      )
      .map((w) => w.date),
  ))
    checkBudget(
      running.filter((w) => w.date === date),
      runningDayLimit(plan.profile, weekday(date)),
      `${dayNames[weekday(date)]}’s runs exceed your daily time ceiling. Move or shorten the run, or review that day’s limit.`,
    );
  for (const week of plan.profile.weeklyMinutesLimit != null ? plan.weeks : [])
    checkBudget(
      running.filter(
        (w) => w.date >= week.start && w.date <= addDays(week.start, 6),
      ),
      plan.profile.weeklyMinutesLimit ?? Infinity,
      'This week exceeds your running-time ceiling. Review the remaining sessions or increase the ceiling.',
    );
  errors.push(...qualityBudgetErrors(plan));
  return [...new Set(errors)];
}
function qualityBudgetErrors(plan: Plan): string[] {
  const errors: string[] = [];
  for (const week of plan.weeks) {
    if (
      addDays(week.start, 6) < (plan.constraintsFrom ?? plan.profile.startDate)
    )
      continue;
    const sessions = plan.workouts.filter(
      (w) =>
        w.week === week.index && w.kind !== 'race' && w.status !== 'skipped',
    );
    const minutes = sessions.reduce((n, w) => n + w.minutes, 0),
      work = sessions.reduce((n, w) => n + qualityWorkMinutes(w), 0);
    const upcoming = sessions.filter(
      (w) =>
        w.status === 'planned' &&
        w.date >= (plan.constraintsFrom ?? plan.profile.startDate),
    );
    if (!upcoming.some((w) => qualityWorkMinutes(w) > 0)) continue;
    const fraction = ['threshold-singles', 'double-threshold'].includes(
      plan.profile.method ?? '',
    )
      ? 0.18
      : 0.22;
    if (work > minutes * fraction + 0.1)
      errors.push(
        'This change leaves too much quality work for the remaining weekly volume. Reduce quality work or review the week together.',
      );
  }
  if (
    plan.engineVersion === ENGINE_VERSION &&
    usesMarathonRhythm(plan.profile) &&
    !plan.returnState
  ) {
    let previousLongKm = 0;
    for (const week of plan.weeks) {
      if (
        ['Recovery', 'Taper', 'Race week'].includes(week.phase) ||
        week.start < (plan.constraintsFrom ?? plan.profile.startDate) ||
        taperFactor(plan.profile, addDays(week.start, 6)) < 1
      )
        continue;
      const sessions = plan.workouts.filter((w) => w.week === week.index);
      if (
        sessions.some(
          (w) => w.status !== 'planned' || w.changed || w.returnRole,
        )
      )
        continue;
      const quality = sessions.filter((w) => w.hard || w.kind === 'long');
      const long = quality.find((w) => w.kind === 'long');
      if (long && long.estimatedKm + 0.001 < previousLongKm)
        errors.push(
          `Week ${week.index + 1} cannot retain the preceding long-run distance within its allocated volume. Review the weekly and session limits.`,
        );
      if (long) previousLongKm = long.estimatedKm;
      if (
        quality.length !== 2 ||
        quality.filter((w) => w.kind === 'long').length !== 1 ||
        quality.filter((w) => w.kind !== 'long' && w.stimulus === 'threshold')
          .length !== 1
      )
        errors.push(
          `Week ${week.index + 1} needs one tempo/threshold workout and one long run. Increase available workout time or review the weekly limits.`,
        );
    }
  }
  return errors;
}
function applyActualTrainingEnvelope(
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
        Math.max(5, Math.floor(minutes)),
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
    if (remaining < editable.length * 5)
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
        .filter((w) => dayDiff(w.date, run.date) <= 30);
      const km = (w: Workout) =>
        w.status === 'completed'
          ? Math.min(
              w.feedback?.actualKm ?? Infinity,
              (w.feedback?.actualMinutes ?? w.minutes) / pace,
            )
          : w.estimatedKm;
      const baseline = dayDiff(declaredFrom, run.date) <= 30 ? declaredKm : 0;
      const familiar = Math.max(baseline, 0, ...recent.map(km));
      const last = recent.findLast(
        (w) => plan.weeks[w.week]?.phase !== 'Recovery',
      );
      const ceiling =
        plan.weeks[run.week]?.phase === 'Recovery' && last
          ? km(last) * 0.8
          : familiar > 0
            ? Math.min(35, Math.floor(familiar) + 2)
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
    if (!editable.length || Math.floor(target - retained) < editable.length * 5)
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
            dayDiff(addDays(week.start, 6), p.raceDate) >= 21) &&
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
            (usesMarathonBook(p) && dayDiff(run.date, p.raceDate) <= 21)) &&
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
        (p.weeklyKm || 5) * schedulingEasyPace(p),
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
        ? 3
        : 2;
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
            ? 0.4
            : bucket === 2
              ? 0.6
              : 0.75
          : bucket === 1
            ? 0.4
            : bucket === 2
              ? 0.65
              : 0.85) *
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
export function refreshFeasibility(plan: Plan, asOf: string) {
  if (
    plan.profile.goal === 'base' ||
    plan.feasibility?.status === 'event-deferred'
  )
    return;
  if (isLongUltra(plan.profile)) {
    const exposure = Math.max(
      0,
      ...plan.workouts
        .filter((w) => w.kind === 'long' && w.status !== 'skipped')
        .map((w) =>
          w.status === 'completed'
            ? (w.feedback?.actualMinutes ?? 0)
            : w.date >= asOf
              ? w.minutes
              : 0,
        ),
    );
    const previousReasons = (plan.feasibility?.reasons ?? []).filter(
      (r) =>
        !r.startsWith('The six weeks before taper') &&
        !r.startsWith('The remaining long-ultra block') &&
        !r.startsWith('The remaining block reaches'),
    );
    const reasons = [
      ...previousReasons,
      exposure < LONG_ULTRA_POLICY.rehearsalMinutes
        ? 'The remaining long-ultra block no longer includes a three-hour endurance rehearsal. Review the event or available time; missing training is not made up.'
        : null,
      longUltraCapacityMessage(plan, asOf),
    ].filter((s): s is string => !!s);
    plan.feasibility = {
      status: reasons.length ? 'review-required' : 'forecast',
      asOf,
      reasons,
    };
    return;
  }
  const required = ['custom', 'ultra'].includes(plan.profile.goal)
    ? customExposureKm(raceDistance(plan.profile))
    : TRAINING_POLICY.family[trainingFamily(plan.profile)]
        .minimumTrainingExposureKm;
  const exposure = Math.max(
    0,
    ...plan.workouts
      .filter((w) => w.kind === 'long' && w.status !== 'skipped')
      .map((w) =>
        w.status === 'completed'
          ? (w.feedback?.actualKm ??
            (w.feedback?.actualMinutes ?? 0) / schedulingEasyPace(plan.profile))
          : w.estimatedKm,
      ),
  );
  if (exposure + 0.01 < required)
    plan.feasibility = {
      status: 'review-required',
      asOf,
      reasons: [
        `These limits leave a longest training exposure of ${round(exposure)} km, below this event policy's ${round(required)} km. Consider more available time, a later event, a shorter distance or a base block. Distance without recorded pace remains an estimate.`,
      ],
    };
}
export function rebalanceFutureQuality(plan: Plan, asOf: string): Plan {
  plan.constraintsFrom = asOf;
  for (let pass = 0; pass < 4; pass++)
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
        ? 0.18
        : 0.22;
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
export function shortenWorkout(
  plan: Plan,
  id: string,
  minutes: number,
  asOf: string,
): Plan {
  const next = structuredClone(plan),
    w = next.workouts.find((w) => w.id === id);
  if (
    !w ||
    w.status !== 'planned' ||
    w.date < asOf ||
    w.kind === 'race' ||
    !Number.isInteger(minutes) ||
    minutes < 5 ||
    minutes > w.minutes
  )
    throw new PlanError(
      'Choose an upcoming training session and a shorter duration of at least five minutes.',
    );
  Object.assign(
    w,
    resizeWorkout(
      w,
      next.profile,
      trainingPhaseOn(next.profile, next.weeks[w.week].phase, w.date),
      minutes,
    ),
    {
      changed: true,
      changeSource: 'manual',
    },
  );
  w.distanceEstimate = distanceEstimate(w.steps, next.profile);
  rebalanceFutureQuality(next, asOf);
  const errors = validatePlan(next);
  if (errors.length) throw new PlanError(errors[0]);
  return next;
}
export function moveWorkout(
  plan: Plan,
  id: string,
  date: string,
  asOf: string,
): Plan {
  const next = structuredClone(plan),
    s = next.workouts.find((s) => s.id === id);
  if (!s || s.status !== 'planned' || s.kind === 'race')
    throw new PlanError('Only upcoming training sessions can be moved.');
  if (s.date < asOf)
    throw new PlanError(
      'Past sessions stay in your history. Mark a missed run as skipped.',
    );
  if (!validDate(date) || date < asOf || monday(date) !== monday(s.date))
    throw new PlanError(
      'Move a session to today or later within the same week. Use plan adjustments for a longer break.',
    );
  if (s.pairId) {
    const pair = next.workouts.filter((w) => w.pairId === s.pairId);
    if (
      pair.some((w) => w.status !== 'planned') ||
      next.workouts.some((w) => w.date === date && w.pairId !== s.pairId)
    )
      throw new PlanError(
        'Move both paired sessions to an empty day before either is completed.',
      );
    for (const w of pair) {
      w.date = date;
      w.changed = true;
      w.changeSource = 'manual';
    }
    const timingError = applyPreferredStartTimes(pair, next.profile);
    if (timingError) throw new PlanError(timingError);
    const errors = validatePlan(next);
    if (errors.length) throw new PlanError(errors[0]);
    return next;
  }
  const previousDate = s.date;
  const other = next.workouts.find((w) => w.date === date && w.id !== id);
  if (other) {
    if (other.status !== 'planned' || other.kind === 'race' || other.pairId)
      throw new PlanError('That date has a completed session or race.');
    other.date = s.date;
    other.changed = true;
    other.changeSource = 'manual';
  }
  s.date = date;
  s.changed = true;
  s.changeSource = 'manual';
  const moved = [s, ...(other ? [other] : [])];
  for (const w of moved) {
    const oldPreference = next.profile.dayPreferences?.find(
      (d) => d.day === weekday(w === s ? previousDate : date),
    );
    if (oldPreference?.startTime === w.startTime) delete w.startTime;
  }
  const timingError = applyPreferredStartTimes(moved, next.profile);
  if (timingError) throw new PlanError(timingError);
  const errors = validatePlan(next);
  if (errors.length) throw new PlanError(errors[0]);
  return next;
}
export function adjustPlan(
  plan: Plan,
  from: string,
  to: string,
  mode: 'easy' | 'rest',
  asOf: string,
): Plan {
  if (
    !validDate(from) ||
    !validDate(to) ||
    from < plan.profile.startDate ||
    to < from ||
    dayDiff(from, to) > 20 ||
    from > plan.profile.raceDate ||
    to < addDays(asOf, -28)
  )
    throw new PlanError(
      'Choose a break of 1–21 days beginning within the plan, or a recent break to record.',
    );
  const next = structuredClone(plan),
    baseline = currentTrainingBaseline(plan, from > asOf ? asOf : from);
  for (const w of next.workouts) {
    if (w.status !== 'planned' || w.date < from || w.date > to) continue;
    if (mode === 'rest' || w.kind === 'race') {
      w.status = 'skipped';
      w.skipReason =
        w.kind === 'race'
          ? 'Race deferred during requested recovery'
          : 'Planned break';
    } else {
      w.returnRole ??= w.kind;
      w.returnCeilingMinutes ??= w.minutes;
      const minutes = Math.max(
        5,
        Math.floor(
          Math.min(
            w.minutes * 0.7,
            next.profile.weekdayMinutes,
            (next.profile.easyLimitKm ?? Infinity) *
              schedulingEasyPace(next.profile),
          ),
        ),
      );
      Object.assign(
        w,
        resizeWorkout(
          { ...w, templateId: undefined, kind: 'easy' },
          next.profile,
          'Recovery',
          minutes,
        ),
        { title: 'Gentle easy run' },
      );
    }
    w.changed = true;
    w.changeSource = 'manual';
    w.distanceEstimate = distanceEstimate(w.steps, next.profile);
  }
  next.returnState = {
    from,
    to,
    stage: 1,
    stageStarted: addDays(to, 1),
    baselineKm: baseline.weeklyKm,
    longestKm: baseline.longestKm,
    baselineMinutes: baseline.weeklyMinutes,
    longestMinutes: baseline.longestMinutes,
    reason:
      mode === 'rest'
        ? 'Return after time away'
        : 'Return after reduced training',
  };
  next.feasibility = {
    status: to >= plan.profile.raceDate ? 'event-deferred' : 'review-required',
    asOf,
    reasons: [
      to >= plan.profile.raceDate
        ? 'Your recovery decision includes race day. The event is deferred; choose a new date or a new block when ready.'
        : 'Training restarts below the recent baseline. Advance through the return stages only after logged comfortable running; the old peak forecast is paused.',
    ],
  };
  next.notes.push(
    'Return stages: short easy running → easy running with a capped long run → a reviewed, newly based training block. Missing logs never advance a stage.',
  );
  return applyReturnStage(next, asOf);
}
function applyReturnStage(plan: Plan, asOf: string) {
  const state = plan.returnState!;
  const pace = schedulingEasyPace(plan.profile);
  const factor = state.stage === 1 ? 0.65 : 0.8;
  // Keep recorded time and distance as independent ceilings. Older saved
  // stages predate time evidence and retain their distance-based fallback.
  const baselineMinutes = Math.min(
    state.baselineKm * pace,
    state.baselineMinutes ?? Infinity,
  );
  const longestMinutes = Math.min(
    state.longestKm * pace,
    state.longestMinutes ?? Infinity,
  );
  const insufficientDuration = () =>
    new PlanError(
      'Your recent recorded running is too limited for an automatic return on these training days. Review your starting routine before creating a return schedule. Your saved journal has not changed.',
    );
  if (baselineMinutes * factor < plan.profile.days.length * 5)
    throw insufficientDuration();
  for (const week of plan.weeks) {
    const upcoming = plan.workouts.filter(
      (w) =>
        w.week === week.index &&
        w.status === 'planned' &&
        w.kind !== 'race' &&
        w.date > state.to &&
        w.date >= asOf,
    );
    for (const w of upcoming) {
      w.returnRole ??= w.kind;
      w.returnCeilingMinutes ??= w.minutes;
      if (w.session === 'PM') {
        w.status = 'skipped';
        w.skipReason = 'Return stage: single sessions only';
        w.changeSource = 'preferences';
        continue;
      }
      const long = state.stage === 2 && w.returnRole === 'long' && !w.pairId;
      const roleCap = long
        ? Math.min(
            longestMinutes * 0.75,
            plan.profile.longMinutes,
            (plan.profile.longLimitKm ?? Infinity) * pace,
          )
        : Math.min(
            plan.profile.weekdayMinutes,
            (plan.profile.easyLimitKm ?? Infinity) * pace,
          );
      const normal = (baselineMinutes * factor) / plan.profile.days.length;
      const minutes = Math.floor(
        Math.min(
          w.returnCeilingMinutes,
          roleCap,
          long ? longestMinutes * 0.75 : normal,
        ),
      );
      if (minutes < 5) throw insufficientDuration();
      Object.assign(
        w,
        resizeWorkout(
          {
            ...w,
            minutes: w.returnCeilingMinutes,
            estimatedKm: w.returnCeilingMinutes / pace,
            templateId: undefined,
            kind: long ? 'long' : 'easy',
          },
          plan.profile,
          'Recovery',
          minutes,
        ),
        {
          title: long ? 'Return: easy long run' : 'Return: short easy run',
          returnStage: state.stage,
          returnStageStarted: state.stageStarted,
          purpose:
            state.stage === 1
              ? 'Short, conversational running. Stay at this stage until recent logs show comfortable tolerance.'
              : 'Reintroduce an easy long run within the reduced baseline; intensity remains paused.',
          changed: true,
        },
      );
      if (w.changeSource !== 'manual') w.changeSource = 'preferences';
      w.distanceEstimate = distanceEstimate(w.steps, plan.profile);
    }
    const remaining = upcoming.filter((w) => w.status === 'planned');
    const total = remaining.reduce((n, w) => n + w.minutes, 0),
      ceiling = baselineMinutes * factor;
    if (total > ceiling)
      for (const w of remaining) {
        const minutes = Math.floor((w.minutes * ceiling) / total);
        if (minutes < 5) throw insufficientDuration();
        Object.assign(w, resizeWorkout(w, plan.profile, 'Recovery', minutes));
      }
  }
  return rebalanceFutureQuality(plan, asOf);
}
/** Three observed outings must fit the selected routine without adding runs.
 * This observation window is a product heuristic, not a rehabilitation rule. */
function progressionReviewWindow(
  plan: Plan,
  asOf: string,
  stageStarted: string,
) {
  const windowDays = desiredRuns(plan.profile) === 2 ? 14 : 7;
  return {
    windowDays,
    from: [stageStarted, addDays(asOf, -windowDays)].sort().at(-1)!,
    period: windowDays === 14 ? 'the last two weeks' : 'the last week',
  };
}
export function returnReview(plan: Plan, asOf: string) {
  const state = plan.returnState;
  if (!state || state.stage === 3 || asOf <= state.to) return null;
  const { from, windowDays, period } = progressionReviewWindow(
    plan,
    asOf,
    state.stageStarted,
  );
  const recent = trainingRecords(plan).filter(
    (r) => r.date >= from && r.date <= asOf,
  );
  const prescriptions = new Map(plan.workouts.map((w) => [w.id, w]));
  const runs = recent.filter((r) => {
    if (!r.workoutId || r.date >= asOf) return false;
    const workout = prescriptions.get(r.workoutId);
    if (workout?.returnStage !== undefined)
      return (
        workout.returnStage === state.stage &&
        workout.returnStageStarted === state.stageStarted
      );
    // Legacy prescriptions have no stage stamp. The transition date may hold
    // a completed prior-stage run; do not infer that it belongs to stage two.
    return state.stage === 1 || r.date > state.stageStarted;
  });
  const comfortable = runs.filter(
    (r) =>
      r.expectedEasy &&
      r.feeling !== 'tired' &&
      r.effort <= 5 &&
      r.minutes >= r.prescribedMinutes! * 0.8,
  );
  const fatigue = recent.some((r) => r.feeling === 'tired' || r.effort >= 7);
  const enough =
    dayDiff(state.stageStarted, asOf) >= 7 &&
    comfortable.length >= 3 &&
    new Set(comfortable.map((r) => r.date)).size >= 3 &&
    !fatigue;
  return {
    ready: enough,
    stage: state.stage,
    completed: comfortable.length,
    required: 3,
    windowDays,
    evidence: `return:${state.stage}:${recent.map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort].join(':')).join('|')}`,
    reason: enough
      ? `At least three completed easy runs at this stage during ${period} felt comfortable. Preview the next stage.`
      : fatigue
        ? 'Recent running, including today and any extra runs, includes tired feedback or a high effort. Stay at this stage and review recovery before progressing.'
        : `Log three comfortable easy runs on separate days at this stage during ${period}, with at least a week at this stage. Keep your usual running days; unlogged sessions and today's run do not count toward progression.`,
  };
}
export function advanceReturn(plan: Plan, asOf: string): Plan {
  const review = returnReview(plan, asOf);
  if (!review?.ready)
    throw new PlanError(
      review?.reason ?? 'There is no active return stage to advance.',
    );
  if (plan.returnState!.stage === 1) {
    const next = structuredClone(plan);
    next.returnState!.stage = 2;
    next.returnState!.stageStarted = asOf;
    return applyReturnStage(next, asOf);
  }
  const next = revisePreferences(
    { ...plan, returnState: undefined },
    {
      method: 'balanced',
      difficulty: 'gentle',
      volume: 'maintain',
      marathonApproach: 'balanced',
    } as PreferencePatch,
    asOf,
    true,
  );
  next.returnState = { ...plan.returnState!, stage: 3, stageStarted: asOf };
  next.notes.push(
    'Return review completed. The next block of work uses the recorded baseline, gentle quality and maintained volume. Advanced pairs remain off until deliberately reviewed again.',
  );
  return next;
}
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

export function refreshWeekTotals(plan: Plan) {
  for (const w of plan.weeks) {
    const runs = plan.workouts.filter(
      (s) => s.week === w.index && s.status !== 'skipped',
    );
    const training = runs.filter((s) => s.kind !== 'race');
    w.targetKm = round(training.reduce((n, s) => n + s.estimatedKm, 0));
    w.raceKm = runs
      .filter((s) => s.kind === 'race')
      .reduce((n, s) => n + s.estimatedKm, 0);
    w.trainingMinutes = training.reduce((n, s) => n + s.minutes, 0);
    w.qualityMinutes = training.reduce((n, s) => n + qualityWorkMinutes(s), 0);
    w.rationale = [
      w.focus,
      `${training.length} sessions, ${Math.round(w.trainingMinutes)} ${plan.profile.runMeasure === 'distance' ? 'planning' : 'prescribed'} minutes; quality-work allocation ${Math.round(w.qualityMinutes)} minutes.`,
      'Long and demanding work are separated by easy or rest days; there is no catch-up mileage.',
      ...(w.phase === 'Taper' || w.phase === 'Race week'
        ? [
            'Training totals exclude the race. Familiar work is reduced while recovery increases.',
          ]
        : []),
    ];
    w.longKm = Math.max(
      0,
      ...runs.filter((s) => s.kind === 'long').map((s) => s.estimatedKm),
    );
  }
  return plan;
}
export function demoProfile(date: string): Profile {
  const start = monday(date);
  return {
    name: '',
    goal: '10k',
    raceName: 'Autumn 10K',
    startDate: start,
    raceDate: addDays(start, 83),
    weeklyKm: 30,
    longestKm: 10,
    currentRuns: 4,
    days: [0, 2, 4, 6],
    longDay: 6,
    weekdayMinutes: 65,
    longMinutes: 100,
    experience: 'established',
    difficulty: 'balanced',
    volume: 'gradual',
    timezone: 'Europe/London',
    units: 'km',
    easyPace: 6,
  };
}
export function demoPlan(date: string): Plan {
  const p = demoProfile(date);
  return makePlan(p, p.startDate);
}
export function suggestedAdjustment(
  plan: Plan,
  asOf = todayInZone(plan.profile.timezone),
) {
  const recent = trainingRecords(plan)
    .filter((r) => r.date <= asOf && dayDiff(r.date, asOf) <= 14)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (
    recent.length >= 2 &&
    recent.filter(
      (r) => r.feeling === 'tired' || (r.expectedEasy && r.effort >= 7),
    ).length >= 2
  )
    return {
      title: 'Make some room to recover',
      reason:
        'At least two of your last three runs included tiredness or unexpectedly high effort on an easy day. Review a lighter stretch.',
      evidence: recent
        .map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort].join(':'))
        .join('|'),
    };
  const missed = plan.workouts.filter(
    (s) =>
      s.week >= 0 &&
      s.status === 'skipped' &&
      s.date <= asOf &&
      dayDiff(s.date, asOf) <= 14,
  );
  if (missed.length >= 2)
    return {
      title: 'Find your rhythm again',
      reason:
        'You skipped at least two runs in the last fortnight. Review a lighter stretch before continuing the forecast.',
      evidence: 'missed:' + missed.map((s) => s.id).join(':'),
    };
  return null;
}

export type PreferencePatch = Pick<
  Profile,
  | 'days'
  | 'longDay'
  | 'weekdayMinutes'
  | 'longMinutes'
  | 'volume'
  | 'difficulty'
  | 'qualitySessions'
  | 'availableDays'
  | 'runsPerWeek'
  | 'qualityMode'
  | 'recoveryWeeks'
  | 'terrain'
  | 'easyLimitKm'
  | 'qualityLimitKm'
  | 'longLimitKm'
  | 'peakWeeklyKm'
  | 'intent'
  | 'recentQualitySessions'
  | 'marathonApproach'
  | 'method'
  | 'stableWeeks'
  | 'easyDoubleWeeks'
  | 'recentSessionsPerWeek'
  | 'recentQualityMinutes'
  | 'doubleDays'
  | 'doubleGapHours'
  | 'thresholdControl'
  | 'thresholdCeiling'
  | 'preferredHardDays'
  | 'crossTraining'
  | 'carbsPerHour'
  | 'practiceInDark'
  | 'dayPreferences'
  | 'weeklyMinutesLimit'
  | 'workoutFormat'
  | 'workoutVariety'
> & { recentRace?: RecentRace | null };
export function revisePreferences(
  plan: Plan,
  patch: PreferencePatch,
  asOf: string,
  forceReplan = false,
): Plan {
  if (asOf > plan.profile.raceDate)
    throw new PlanError('This block has finished. Start a new plan.');
  // A reviewed policy upgrade must rebuild upcoming prescriptions even when
  // the runner keeps the same preferences. Preview and apply share this path.
  forceReplan ||= plan.policyVersion !== TRAINING_POLICY.version;
  const allowed = [
    'days',
    'longDay',
    'weekdayMinutes',
    'longMinutes',
    'volume',
    'difficulty',
    'qualitySessions',
    'availableDays',
    'runsPerWeek',
    'qualityMode',
    'recoveryWeeks',
    'terrain',
    'easyLimitKm',
    'qualityLimitKm',
    'longLimitKm',
    'peakWeeklyKm',
    'intent',
    'recentQualitySessions',
    'marathonApproach',
    'method',
    'stableWeeks',
    'easyDoubleWeeks',
    'recentSessionsPerWeek',
    'recentQualityMinutes',
    'doubleDays',
    'doubleGapHours',
    'thresholdControl',
    'thresholdCeiling',
    'preferredHardDays',
    'crossTraining',
    'carbsPerHour',
    'practiceInDark',
    'dayPreferences',
    'weeklyMinutesLimit',
    'workoutFormat',
    'workoutVariety',
    'recentRace',
  ] as const;
  const profile = { ...plan.profile };
  for (const key of allowed)
    if (patch[key] !== undefined) Object.assign(profile, { [key]: patch[key] });
  const defaults: Partial<Record<keyof Profile, unknown>> = {
    terrain: 'flat',
    qualitySessions: plan.profile.goal === 'base' ? 0 : 1,
    recoveryWeeks: 4,
    intent: 'improve',
    method: 'balanced',
    marathonApproach: 'balanced',
    preferredHardDays: [],
    crossTraining: [],
    carbsPerHour: null,
    practiceInDark: false,
    dayPreferences: [],
    weeklyMinutesLimit: null,
    workoutFormat: 'automatic',
    workoutVariety: 'varied',
  };
  const comparable = (p: Profile, key: (typeof allowed)[number]) => {
    const value = p[key] ?? defaults[key] ?? null;
    return JSON.stringify(
      Array.isArray(value)
        ? [...value].sort((a, b) =>
            typeof a === 'number' && typeof b === 'number'
              ? a - b
              : a.day - b.day,
          )
        : value,
    );
  };
  if (
    !forceReplan &&
    allowed.every(
      (key) => comparable(profile, key) === comparable(plan.profile, key),
    )
  )
    return structuredClone(plan);
  const changedKeys = allowed.filter(
    (key) => comparable(profile, key) !== comparable(plan.profile, key),
  );
  if (
    !forceReplan &&
    changedKeys.every((key) => ['carbsPerHour', 'practiceInDark'].includes(key))
  ) {
    const next = structuredClone(plan);
    next.profile = validateProfile(profile, profile.startDate);
    return next;
  }
  const localKeys = [
    'dayPreferences',
    'weeklyMinutesLimit',
    'terrain',
    'easyLimitKm',
    'qualityLimitKm',
    'longLimitKm',
    'peakWeeklyKm',
    'weekdayMinutes',
    'longMinutes',
    'carbsPerHour',
    'practiceInDark',
  ];
  // Raising a session limit should let a reviewed rebuild use the runner's
  // existing baseline. It does not establish a higher baseline: recent history,
  // elapsed allocations, manual edits and taper still govern the rebuild.
  const moreSessionRoom =
    profile.weekdayMinutes > plan.profile.weekdayMinutes ||
    profile.longMinutes > plan.profile.longMinutes;
  if (
    !forceReplan &&
    !moreSessionRoom &&
    changedKeys.every((key) => localKeys.includes(key))
  ) {
    const next = structuredClone(plan);
    next.profile = validateProfile(profile, profile.startDate);
    next.constraintsFrom = asOf;
    const pace = schedulingEasyPace(profile);
    for (const w of next.workouts) {
      if (w.date < asOf || w.status !== 'planned' || w.kind === 'race')
        continue;
      const cap =
        w.kind === 'long'
          ? Math.min(
              profile.longMinutes,
              (profile.longLimitKm ?? Infinity) * pace,
            )
          : Math.min(
              profile.weekdayMinutes,
              (w.hard
                ? (profile.qualityLimitKm ?? Infinity)
                : (profile.easyLimitKm ?? Infinity)) * pace,
            );
      if (w.minutes <= cap) continue;
      if (w.changed && w.changeSource !== 'preferences')
        throw new PlanError(
          `Your deliberate edit on ${dateLabel(w.date)} exceeds this new limit. Review that workout before lowering the ceiling.`,
        );
      Object.assign(
        w,
        resizeWorkout(
          w,
          profile,
          trainingPhaseOn(next.profile, next.weeks[w.week].phase, w.date),
          Math.max(5, Math.floor(cap)),
        ),
        { changed: true, changeSource: 'preferences' },
      );
      w.reason =
        'Your lower session ceiling reduced this workout. The block phase and other sessions remain in place.';
    }
    for (const week of next.weeks) {
      const upcoming = next.workouts.filter(
        (w) =>
          w.week === week.index &&
          w.date >= asOf &&
          w.status === 'planned' &&
          w.kind !== 'race',
      );
      const retained = next.workouts
        .filter(
          (w) =>
            w.week === week.index &&
            w.kind !== 'race' &&
            w.status !== 'skipped' &&
            !upcoming.includes(w),
        )
        .reduce((n, w) => n + w.minutes, 0);
      const total = upcoming.reduce((n, w) => n + w.minutes, 0);
      const available = (profile.peakWeeklyKm ?? Infinity) * pace - retained;
      if (available < 0 && upcoming.length)
        throw new PlanError(
          'Completed running already exceeds that weekly ceiling. Choose a ceiling that leaves room for the remaining week, or rest individual sessions.',
        );
      if (total > available)
        for (const w of upcoming) {
          if (w.changed && w.changeSource !== 'preferences')
            throw new PlanError(
              'A deliberate future edit conflicts with the new weekly ceiling. Review that workout first.',
            );
          Object.assign(
            w,
            resizeWorkout(
              w,
              profile,
              usesDailyTaperPhase(profile)
                ? trainingPhaseOn(profile, week.phase, w.date)
                : week.phase,
              Math.max(5, Math.floor((w.minutes * available) / total)),
            ),
            { changed: true, changeSource: 'preferences' },
          );
        }
    }
    next.notes.push(
      'Session limits are ceilings. Lower limits affect the relevant upcoming work; larger limits do not automatically add training. Terrain describes routes available for appropriate alternatives.',
    );
    applyActualTrainingEnvelope(next, asOf);
    rebalanceFutureQuality(next, asOf);
    const timeCandidates = structuredClone(
      next.workouts.filter((w) => w.date >= asOf),
    );
    const timingError = applyPreferredStartTimes(
      timeCandidates,
      next.profile,
      plan.profile,
    );
    if (timingError) throw new PlanError(timingError);
    for (const timed of timeCandidates) {
      const saved = next.workouts.find((w) => w.id === timed.id)!;
      if (timed.startTime === saved.startTime) continue;
      if (saved.changed && saved.changeSource !== 'preferences')
        throw new PlanError(
          `Your deliberate edit on ${dateLabel(saved.date)} keeps its start time. Review that workout before changing this day’s timing.`,
        );
      saved.startTime = timed.startTime;
      saved.changed = true;
      saved.changeSource = 'preferences';
      saved.reason =
        'The start time follows your reviewed day-by-day schedule.';
    }
    refreshFeasibility(next, asOf);
    const issues = validatePlan(next);
    if (issues.length) throw new PlanError(issues[0]);
    return next;
  }
  const baseline = currentTrainingBaseline(plan, asOf);
  const generated = makePlan(profile, profile.startDate, false, {
    from: asOf,
    baseline,
    preserveProgression: baseline.supportsProgression,
    referenceRuns: plan.profile.days.length,
    history: plan.workouts.filter((w) => w.status === 'completed'),
    retainedPrefix: plan.workouts.filter(
      (w) => w.date < asOf || w.status === 'completed',
    ),
  });
  generated.notes.push(baseline.explanation);
  const history = plan.workouts.filter(
    (w) => w.date < asOf || w.status === 'completed',
  );
  const overrides = plan.workouts.filter(
    (w) =>
      w.date >= asOf &&
      w.status !== 'completed' &&
      ((w.status === 'skipped' &&
        w.skipReason !== 'Return stage: single sessions only') ||
        (w.changed && w.changeSource !== 'preferences')),
  );
  const retainedDates = new Set(
    [...history, ...overrides]
      .filter((w) => w.week >= 0)
      .flatMap((w) => [w.date, w.originalDate]),
  );
  for (const w of plan.workouts.filter(
    (w) => w.date >= asOf && w.status !== 'completed',
  ))
    if (
      w.pairId &&
      [...history, ...overrides].some((o) => o.pairId === w.pairId) &&
      !overrides.some((o) => o.id === w.id)
    )
      overrides.push(w);
  const reservedIds = new Set(plan.workouts.map((w) => w.id));
  const future = generated.workouts
    .filter((w) => w.date >= asOf && !retainedDates.has(w.date))
    .map((w) => {
      const existing = plan.workouts.find(
        (old) =>
          old.date === w.date &&
          old.week >= 0 &&
          (old.session ?? 'AM') === (w.session ?? 'AM'),
      );
      let id = existing?.id;
      if (!id) {
        let suffix = 0;
        do {
          id = `${plan.id}:revised:${w.date}:${w.session ?? 'single'}:${suffix++}`;
        } while (reservedIds.has(id));
        reservedIds.add(id);
      }
      return { ...w, id, changed: true, changeSource: 'preferences' as const };
    });
  const next = {
    ...generated,
    id: plan.id,
    createdAt: plan.createdAt,
    extraRuns: plan.extraRuns,
    constraintsFrom: asOf,
    workouts: [...history, ...overrides, ...future],
  };
  if (
    plan.feasibility?.status === 'event-deferred' &&
    next.workouts.some((w) => w.kind === 'race' && w.status === 'skipped')
  )
    next.feasibility = plan.feasibility;
  refreshWeekTotals(next);
  if (plan.returnState && plan.returnState.stage < 3) {
    next.returnState = plan.returnState;
    applyReturnStage(next, asOf);
  }
  applyActualTrainingEnvelope(next, asOf);
  rebalanceFutureQuality(next, asOf);
  if (isLongUltra(next.profile)) refreshFeasibility(next, asOf);
  const issues = validatePlan(next);
  if (issues.length) throw new PlanError(issues[0]);
  return next;
}

export function noviceReview(plan: Plan, asOf: string) {
  if (
    plan.profile.experience !== 'new' ||
    (plan.profile.runWalkStage ?? 0) >= 4 ||
    (plan.returnState && plan.returnState.stage < 3)
  )
    return null;
  const stage = plan.profile.runWalkStage ?? 0;
  const changed = plan.baselineEvidence?.asOf ?? plan.profile.startDate;
  const { from, windowDays, period } = progressionReviewWindow(
    plan,
    asOf,
    changed,
  );
  const recent = trainingRecords(plan).filter(
    (r) => r.date >= from && r.date <= asOf,
  );
  const workoutsById = new Map(plan.workouts.map((w) => [w.id, w]));
  const currentStageIds = new Set(
    plan.workouts
      .filter(
        (w) =>
          isRunWalkWorkout(w) &&
          Math.max(
            0,
            ...w.steps
              .filter((s) => s.movement === 'run')
              .map((s) => s.seconds),
          ) === runWalkIntervalSeconds(stage),
      )
      .map((w) => w.id),
  );
  const comfortable = recent.filter(
    (r) =>
      r.workoutId &&
      currentStageIds.has(r.workoutId) &&
      r.expectedEasy &&
      r.date < asOf &&
      r.feeling !== 'tired' &&
      r.effort <= 4 &&
      r.minutes >= r.prescribedMinutes! * 0.9,
  );
  // Total outing time includes walking. Only the runner can confirm that the
  // intended running intervals were completed; provider summaries cannot.
  const executionFor = (id: string | undefined) =>
    id ? workoutsById.get(id)?.feedback?.execution : undefined;
  const runs = comfortable.filter(
    (r) => executionFor(r.workoutId) === 'as-planned',
  );
  const completedDates = new Set(runs.map((r) => r.date));
  const unconfirmedWorkoutIds = comfortable
    .filter((r) => {
      const execution = executionFor(r.workoutId);
      return (
        !completedDates.has(r.date) &&
        (execution === undefined || execution === 'unknown')
      );
    })
    .map((r) => r.workoutId!);
  const fatigue = recent.some((r) => r.feeling === 'tired' || r.effort >= 7);
  return {
    ready: !fatigue && completedDates.size >= 3 && dayDiff(changed, asOf) >= 7,
    stage,
    completed: completedDates.size,
    unconfirmedWorkoutIds,
    required: 3,
    windowDays,
    heldForFatigue: fatigue,
    reason: fatigue
      ? 'Recent running, including today and any extra runs, includes tired feedback or a high effort. Keep the current running intervals and review recovery before progressing.'
      : `Log three comfortable easy sessions on separate days at the current run-walk stage during ${period}, confirming that you completed the running intervals, with at least a week at this stage. Keep your usual running days; today's run does not yet count toward progression.`,
    evidence: `walk:${stage}:${recent.map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort, r.minutes, executionFor(r.workoutId)].join(':')).join('|')}`,
  };
}
export function advanceRunWalk(plan: Plan, asOf: string): Plan {
  const review = noviceReview(plan, asOf);
  if (!review?.ready)
    throw new PlanError(
      review?.reason ?? 'There is no active run-walk stage to advance.',
    );
  const current = {
    ...plan,
    profile: {
      ...plan.profile,
      runWalkStage: Math.min(4, (plan.profile.runWalkStage ?? 0) + 1) as
        | 0
        | 1
        | 2
        | 3
        | 4,
    },
  };
  const next = revisePreferences(
    current,
    { volume: 'maintain' } as PreferencePatch,
    asOf,
    true,
  );
  next.notes.push(
    'Run-walk intervals advanced after completed comfortable sessions. Weekly volume is held during this change.',
  );
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
