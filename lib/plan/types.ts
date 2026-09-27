/** Plan types responsibilities; extracted without changing policy or behavior. */
import type { TrainingMethod } from '../advanced-methods.ts';
import type { ActivityTime } from '../activity-time.ts';
import type { RecentRace } from '../fitness-pacing.ts';
import type { distanceEstimate } from '../prescription.ts';
import type { DayPreference } from '../runner-customization.ts';
import type {
  EffortRole,
  StepTarget,
  WorkoutTargets,
} from '../workout-targets.ts';

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
  /** Explicit programme choice; omitted preserves existing adaptive plans. */
  planLevel?: 'beginner' | 'standard';
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
  /** Prescription role is independent of the wording of the effort cue. */
  effortRole?: EffortRole;
  label: string;
  seconds: number;
  metres?: number;
  planningPaceSecondsPerKm?: number;
  effort: string;
  intensity: number;
  kind: 'warmup' | 'aerobic' | 'work' | 'recovery' | 'cooldown';
  movement?: 'run' | 'walk';
};

export type Feedback = ActivityTime & {
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
  /** Derived accounting is checked only for explicitly resolved prescriptions. */
  prescriptionVersion?: 'pace-resolved-v1';
  /** Easy-pace basis used by this snapshot, in minutes/km; history never borrows new fitness. */
  prescriptionPaceBasis?: number;
  /** A reviewed pace changed the estimate of fixed timed endpoints. Explicit
   * distance conversion retains this origin; newly allocated runs do not. */
  distanceRevision?: 'pace-edited-time';
  beginnerLesson?: { stage: number; lesson: number; stageStarted: string };
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

export type FeasibilityCheck = {
  code: 'training-exposure' | 'long-ultra-capacity' | 'retained-constraint';
  message: string;
};
export type FeasibilityEvidence = {
  unit: 'km' | 'minutes';
  required: number;
  phase: 'before-start' | 'active' | 'after-event';
  /** Completed long-run slots (or easy slots in two-day plans), not all journal
   * activity. Extra runs remain in weekly review and baseline evidence. */
  recorded: {
    sessions: number;
    longest: number;
    unknownDistanceSessions: number;
    /** Planning-pace conversion only; never credited as measured distance. */
    longestEstimatedKm: number;
  };
  remaining: { sessions: number; longest: number };
  unresolved: { sessions: number };
};

export type Plan = {
  firstRace?: {
    program: 'first-race-v1';
    goal: '5k' | '10k' | 'half' | 'marathon';
  };
  beginner?: {
    program: 'nhs-c25k-v1';
    pausedUntil?: string;
    breaks?: { from: string; to: string }[];
    stage: number;
    stageStarted: string;
    completedAt?: string;
  };
  id: string;
  activationRequestId?: string;
  activationInput?: string;
  engineVersion: string;
  policyVersion: string;
  /** New standard road plans keep supporting easy runs clearly shorter. */
  sessionBalanceVersion?: 'distinct-long-v1';
  /** Accepted opening allocation; future edits cannot rewrite this baseline. */
  openingWeekKm?: number;
  /** Reviewed budget before the returning-runner factor and session-role clipping.
   * Carries frequency/time reductions forward; not evidence of completed running. */
  allocationBaseline?: { weeklyKm: number; weeklyMinutes: number };
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
    checks?: FeasibilityCheck[];
    evidence?: FeasibilityEvidence;
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

export type ExtraRun = ActivityTime & {
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
  acknowledgedMutationId?: string;
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
