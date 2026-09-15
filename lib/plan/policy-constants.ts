/** Existing authored coaching heuristics, preserved verbatim during refactoring.
 * These bounds support gradual load, recovery and observed readiness; they are
 * product policy awaiting independent coaching review, not clinical thresholds.
 */
import { FIFTY_MILES_KM, HUNDRED_MILES_KM } from '../ultra-policy.ts';

export const EVENT_DISTANCE_POLICY = {
  // Named race distances anchor the existing preparation model rather than predicting performance.
  fiveKm: 5,
  tenKm: 10,
  halfMarathonKm: 21.0975,
  marathonKm: 42.195,
  defaultUltraKm: 50,
  // Adjacent distance families share preparation demands within these authored model bands.
  fiveKFamilyCeilingKm: 7.5,
  tenKFamilyCeilingKm: 15,
  halfFamilyCeilingKm: 30,
  marathonFamilyCeilingKm: 45,
  // Longer ultras receive additional baseline and preparation requirements.
  extendedUltraFromKm: 60,
  longUltraBandKm: 100,
  minimumCustomKm: 1,
} as const;

export const PROFILE_TRAINING_LIMITS = {
  // The forecast is bounded to one year so distant training does not imply established fitness.
  maximumPlanDayDifference: 363,
  // Existing weekly ceilings delimit the routines this model can support without individual review.
  marathonWeeklyKm: 150,
  extendedUltraWeeklyKm: 120,
  standardWeeklyKm: 100,
  shorterEventWeeklyKm: 80,
  maximumRecordedLongKm: 45,
  maximumDistanceLimitKm: 150,
  minimumDistanceLimitKm: 1,
  // Session bounds leave room for a useful outing while limiting modelled prolonged loading.
  minimumWeekdayMinutes: 20,
  maximumWeekdayMinutes: 120,
  minimumLongMinutes: 30,
  maximumLongMinutes: 300,
  // Gradual frequency changes build on an observed routine rather than spare calendar availability.
  minimumRuns: 2,
  noviceMaximumRuns: 3,
  ultraMinimumRuns: 5,
  maximumAddedRunningDays: 1,
  // High mileage requires a demonstrated frequent routine and familiar long-run exposure.
  highMileageThresholdKm: 100,
  highMileageRunningDays: 6,
  highMileageLongKm: 24,
  // Additional quality and medium-long work require an established aerobic workload.
  twoQualityMinimumKm: 45,
  twoQualityRunningDays: 5,
  twoQualitySessions: 2,
  enduranceMinimumKm: 50,
  enduranceRunningDays: 5,
  minimumMarathonRhythmDays: 3,
  // Cross-training is kept short and easy so it supplements the running allocation.
  maximumCrossTrainingDays: 3,
  minimumCrossTrainingMinutes: 10,
  maximumCrossTrainingMinutes: 60,
  // These broad declared-input bounds constrain supported fuelling and pace values, not prescriptions.
  minimumCarbsPerHour: 15,
  maximumCarbsPerHour: 120,
  minimumEasyMinutesPerKm: 3,
  maximumEasyMinutesPerKm: 15,
  // Long-ultra histories use time as an independent exposure measure.
  minimumUltraWeeklyMinutes: 60,
  maximumUltraWeeklyMinutes: 1260,
  minimumUltraLongestMinutes: 30,
  maximumUltraLongestMinutes: 600,
  // Recovery is regularly scheduled to reduce accumulated training load.
  defaultRecoveryWeeks: 4,
  minimumRecoveryWeeks: 3,
  maximumRecoveryWeeks: 4,
  // Returning runners initially use a reduced portion of their declared baseline.
  returningBaselineFraction: 0.8,
  // Extended-ultra prerequisites preserve the original longer preparation and endurance baseline.
  extendedPreparationDays: 167,
  extendedMinimumWeeklyKm: 50,
  extendedMinimumLongKm: 20,
} as const;

// Continuous readiness follows the existing event-specific baseline and preparation anchors.
export const READINESS_ANCHORS: readonly (readonly number[])[] = [
  [1, 41, 10, 3],
  [5, 41, 10, 3],
  [10, 41, 18, 5],
  [21.0975, 83, 24, 8],
  [42.195, 111, 32, 12],
  [50, 139, 40, 16],
  [80, 167, 50, 20],
  [FIFTY_MILES_KM, 167, 50, 20],
  [100, 167, 60, 24],
  [HUNDRED_MILES_KM, 195, 70, 28],
];
// Exposure anchors scale rehearsal expectations without requiring the full race distance in training.
export const EXPOSURE_ANCHORS: readonly (readonly number[])[] = [
  [1, 0.8],
  [5, 4],
  [10, 7.5],
  [21.0975, 16],
  [42.195, 26],
  [50, 28],
  [80, 32],
  [FIFTY_MILES_KM, 32],
  [HUNDRED_MILES_KM, 32],
];
// Beyond the final anchor the existing model holds its longest rehearsal expectation steady.
export const MAXIMUM_CUSTOM_EXPOSURE_KM = 32;

export const PLAN_LOAD_LIMITS = {
  // A remaining session must contain a useful minimum outing rather than fractional scraps of time.
  minimumSessionMinutes: 5,
  // A short controlled tempo retains useful work plus warm-up and cool-down within marathon rhythm.
  minimumTempoSessionMinutes: 30,
  minimumTempoWorkMinutes: 6,
  // Standard marathon rhythm pairs one weekday stimulus with one endurance outing.
  marathonQualitySessions: 2,
  weekdayQualitySessions: 1,
  longRunsPerWeek: 1,
  // Longer ultras retain at most one controlled workout alongside endurance volume.
  maximumUltraQualitySessions: 1,
  // Quality work stays a minority of running time to preserve mostly easy training.
  standardQualityFraction: 0.22,
  thresholdMethodQualityFraction: 0.18,
  // Whole-kilometre long-run growth is constrained by recently familiar exposure and a peak ceiling.
  maximumMarathonLongKm: 35,
  marathonLongStepKm: 2,
  familiarLongWindowDays: 30,
  marathonRecoveryLongFraction: 0.8,
  // This fallback supports a minimal baseline when no weekly distance was supplied.
  fallbackWeeklyKm: 5,
  // Bound repeated quality reallocation because each pass may alter the executable dose.
  qualityRebalancePasses: 4,
  // Paired threshold work remains modest and separated to permit between-session recovery.
  pairedThresholdWorkMinutes: 40,
  pairedRecoveryMinutes: 360,
  // Broad pace bounds reject unsupported planning allowances before generating distance repetitions.
  minimumPlanningSecondsPerKm: 120,
  maximumPlanningSecondsPerKm: 1200,
  maximumStepMetres: 250000,
} as const;

export const ENVELOPE_TAPER_POLICY = {
  // The final three weeks protect recovery from long endurance preparation.
  enduranceDays: 21,
  enduranceWeeks: 3,
  shortEventWeeks: 2,
  // Weekly fractions retain familiar running while progressively reducing accumulated fatigue.
  finalWeekFraction: 0.4,
  bookSecondWeekFraction: 0.6,
  bookThirdWeekFraction: 0.75,
  standardSecondWeekFraction: 0.65,
  standardThirdWeekFraction: 0.85,
} as const;

export const RETURN_TRAINING_POLICY = {
  // A bounded recent break can be reviewed without pretending to model prolonged detraining.
  maximumBreakDayDifference: 20,
  recentBreakWindowDays: 28,
  // Reduced training and successive return stages restore easy exposure before intensity.
  easyAdjustmentFraction: 0.7,
  firstStageFraction: 0.65,
  secondStageFraction: 0.8,
  longRunFraction: 0.75,
  // Progression needs several comfortable observed outings, allowing a two-day routine more time.
  lowFrequencyRuns: 2,
  lowFrequencyReviewDays: 14,
  regularReviewDays: 7,
  minimumStageDays: 7,
  requiredComfortableRuns: 3,
  // Easy-effort and completion gates distinguish tolerated training from merely elapsed time.
  comfortableReturnEffort: 5,
  comfortableNoviceEffort: 4,
  fatigueEffort: 7,
  returnCompletionFraction: 0.8,
  noviceCompletionFraction: 0.9,
  // This authored interval ladder stops at its existing final run-walk stage.
  finalRunWalkStage: 4,
  // Suggestions use repeated recent signs of fatigue or missed runs rather than one isolated outing.
  suggestionWindowDays: 14,
  suggestionSampleRuns: 3,
  suggestionTriggerRuns: 2,
} as const;

// Marathon preparation needs enough separate outings to distribute endurance and quality load.
export const MARATHON_PREPARATION_MINIMUM_RUNS = 4;
// Half-distance preparation retains a minimum routine that can support progressive long running.
export const HALF_PREPARATION_MINIMUM_RUNS = 3;

// One easy or rest day between demanding outings supports recovery before the next large stimulus.
export const MINIMUM_DEMANDING_SPACING_DAYS = 2;
