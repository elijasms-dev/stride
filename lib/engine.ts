/** Stable public API. Implementation lives in focused plan modules. */
export {
  type Goal,
  type TrainingFamily,
  type Phase,
  type WorkoutKind,
  type Profile,
  type Step,
  type Feedback,
  type Workout,
  type Week,
  type Plan,
  type ExtraRun,
  type State,
  type PreferencePatch,
} from './plan/types.ts';
export { PlanError } from './plan/errors.ts';
export {
  dayNames,
  validDate,
  addDays,
  dayDiff,
  weekday,
  monday,
  todayInZone,
  dateLabel,
} from './plan/calendar.ts';
export { round } from './plan/math.ts';
export {
  ENGINE_VERSION,
  MAX_EVENT_KM,
  TRAINING_POLICY,
} from './plan/policy.ts';
export {
  raceDistance,
  trainingFamily,
  extendedUltra,
  runningDayRange,
  preparationRequirements,
  customExposureKm,
  validateProfile,
} from './plan/profile.ts';
export {
  goalLabel,
  eventDistanceDisplay,
  workoutDistanceValue,
  workoutDistanceLabel,
  kmDisplay,
} from './plan/display.ts';
export { makePlan } from './plan/generate.ts';
export { rebalanceFutureQuality } from './plan/allocate.ts';
export { refreshWeekTotals } from './plan/totals.ts';
export { refreshFeasibility } from './plan/feasibility.ts';
export { validatePlan } from './plan/validate.ts';
export {
  refreshWorkoutVariety,
  workoutAlternatives,
  substituteWorkout,
} from './plan/variety.ts';
export { returnReview, noviceReview } from './plan/return-state.ts';
export {
  shortenWorkout,
  moveWorkout,
  adjustPlan,
  suggestedAdjustment,
} from './plan/adjust.ts';
export {
  advanceReturn,
  revisePreferences,
  advanceRunWalk,
} from './plan/revise.ts';
export { demoProfile, demoPlan } from './plan/demo.ts';
export {
  taperFactor,
  trainingPhaseOn,
  usesDailyTaperPhase,
} from './plan/generation-calendar.ts';
