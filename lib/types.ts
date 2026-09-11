/**
 * Stride training-engine contracts.
 * Cloudflare Workers compatible: no DOM, Node, or filesystem types.
 */

export type Goal = '5k' | '10k' | 'half' | 'marathon' | 'ultra';

export type RunType = 'long' | 'speed' | 'tempo' | 'recovery' | 'race';

export type TrainingPhase = 'build' | 'peak' | 'taper' | 'race-week';

export type DaysPerWeek = 3 | 4 | 5 | 6 | 7;

export interface PeakLongRunBand {
  readonly low: number;
  readonly high: number;
}

export interface UserTrainingInput {
  /** Current comfortable long-run distance in kilometres. Must be > 0. */
  currentLongRun: number;
  /** Optional recent weekly volume (km). Week 1 will not drop below this. */
  currentWeeklyVolume?: number;
  /** Whole weeks remaining until race day. Must be >= 2. */
  weeksUntilRace: number;
  /** Requested running days. Five-day weeks are structurally enforced. */
  daysPerWeek: DaysPerWeek;
  goal: Goal;
  /** Optional exact race distance (km). Used on race week only. */
  raceDistanceKm?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  kind: 'speed' | 'tempo';
  /** Warmup share of targetKm. Default 0.18 (clamped to 0.15–0.20). */
  warmupRatio?: number;
  /** Main-set share of targetKm. Default 0.64 (clamped to 0.60–0.70). */
  mainRatio?: number;
  /** Cooldown share of targetKm. Default 0.18 (clamped to 0.15–0.20). */
  cooldownRatio?: number;
  /** Work portion of the main set; the rest is intra-set recovery jogging. */
  workShareOfMain?: number;
  minReps?: number;
  maxReps?: number;
}

export interface WorkoutStep {
  label: string;
  kind: 'warmup' | 'interval' | 'recovery' | 'cooldown';
  km: number;
}

export interface ScaledWorkout {
  templateId: string;
  templateName: string;
  targetKm: number;
  warmupKm: number;
  mainKm: number;
  cooldownKm: number;
  reps: number;
  intervalKm: number;
  recoveryKm: number;
  steps: WorkoutStep[];
  /** Sum of step distances; equals targetKm within 0.001 km. */
  totalKm: number;
}

export interface DailyWorkout {
  dayIndex: number;
  type: RunType;
  km: number;
  title: string;
  templateId?: string;
  scaled?: ScaledWorkout;
}

export interface TrainingWeek {
  weekIndex: number;
  weekNumber: number;
  phase: TrainingPhase;
  /** Planned weekly training volume (km), excluding the race itself. */
  weeklyTotalVolume: number;
  longRunKm: number;
  dailySplits: DailyWorkout[];
  /** Volume relative to the plan's peak week (1 in the peak week). */
  volumeFraction: number;
}

export interface TrainingPlan {
  goal: Goal;
  weeksUntilRace: number;
  daysPerWeek: DaysPerWeek;
  week1LongRunKm: number;
  peakLongRunTargetKm: number;
  peakLongRunAchievedKm: number;
  peakWeeklyVolumeKm: number;
  weeks: TrainingWeek[];
  notes: string[];
}

export interface TrainingEngineErrorOptions {
  code: TrainingEngineErrorCode;
  details?: Record<string, number | string | boolean | null>;
}

export type TrainingEngineErrorCode =
  | 'INVALID_WEEKS'
  | 'INVALID_LONG_RUN'
  | 'INVALID_GOAL'
  | 'INVALID_DAYS'
  | 'INVALID_VOLUME';
