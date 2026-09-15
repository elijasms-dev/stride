/** Plan types responsibilities; extracted without changing policy or behavior. */
import { type TrainingMethod } from '../advanced-methods.ts';
import { type RecentRace } from '../fitness-pacing.ts';
import type { distanceEstimate } from '../prescription.ts';
import { type DayPreference } from '../runner-customization.ts';
import { type StepTarget, type WorkoutTargets } from '../workout-targets.ts';

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
