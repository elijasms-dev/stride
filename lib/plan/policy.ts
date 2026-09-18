/** Plan policy responsibilities; extracted without changing policy or behavior. */
import { HUNDRED_MILES_KM } from '../ultra-policy.ts';

/** Declared starting loads and whole-kilometre long-run progression. */
export const ENGINE_VERSION = 'stride-0.10.1';

// Supported runnable-course ceiling; longer events need preparation outside this model.
export const MAX_EVENT_KM = HUNDRED_MILES_KM;

/** Product heuristics for review, not scientifically established safety thresholds. */
export const TRAINING_POLICY = {
  version: 'provisional-2026-09-16-v32',
  reviewStatus: 'Awaiting independent coaching review',
  // A conservative fallback estimates time when current easy pace is unknown.
  estimatedEasyMinutesPerKm: 7,
  // Returning runners initially retain less load to allow reacclimation.
  returningRunnerFactor: 0.8,
  // Forecast growth remains tied to demonstrated baseline capacity.
  maximumForecastFactor: 1.45,
  // Regular lighter weeks interrupt accumulated training load.
  recoveryEveryWeeks: 4,
  // Recovery reduces volume while preserving a familiar running routine.
  recoveryVolumeFactor: 0.82,
  // Demanding outings retain intervening recovery time.
  minimumDemandingSpacingDays: 2,
  family: {
    '5k': {
      // A bounded distance step provides gradual event-specific volume development.
      weeklyStepKm: 1.5,
      // Long-run increments develop endurance without making abrupt exposure jumps.
      longStepKm: 0.5,
      // The authored endurance ceiling balances preparation exposure and recovery cost.
      longCeilingKm: 11,
      // This preparation screen requires familiar endurance exposure; it does not prove readiness.
      minimumTrainingExposureKm: 4,
      // The event block requires an established aerobic baseline; base building has no entry minimum.
      minWeekly: 10,
      // A familiar long outing anchors progression; base building can begin without one.
      minLong: 3,
      // The required routine distributes training load; introductory base work is exempt.
      minRuns: 2,
      // The authored preparation window leaves time for progression, recovery and taper.
      recommendedDays: 41,
      // The family forecast stays proportional to the declared training baseline.
      maxForecast: 1.45,
    },
    '10k': {
      // A bounded distance step provides gradual event-specific volume development.
      weeklyStepKm: 2,
      // Long-run increments develop endurance without making abrupt exposure jumps.
      longStepKm: 0.75,
      // The authored endurance ceiling balances preparation exposure and recovery cost.
      longCeilingKm: 16,
      // This preparation screen requires familiar endurance exposure; it does not prove readiness.
      minimumTrainingExposureKm: 7.5,
      // The event block requires an established aerobic baseline; base building has no entry minimum.
      minWeekly: 18,
      // A familiar long outing anchors progression; base building can begin without one.
      minLong: 5,
      // The required routine distributes training load; introductory base work is exempt.
      minRuns: 2,
      // The authored preparation window leaves time for progression, recovery and taper.
      recommendedDays: 41,
      // The family forecast stays proportional to the declared training baseline.
      maxForecast: 1.45,
    },
    half: {
      // A bounded distance step provides gradual event-specific volume development.
      weeklyStepKm: 2.5,
      // Long-run increments develop endurance without making abrupt exposure jumps.
      longStepKm: 1,
      // The authored endurance ceiling balances preparation exposure and recovery cost.
      longCeilingKm: 21,
      // This preparation screen requires familiar endurance exposure; it does not prove readiness.
      minimumTrainingExposureKm: 16,
      // The event block requires an established aerobic baseline; base building has no entry minimum.
      minWeekly: 24,
      // A familiar long outing anchors progression; base building can begin without one.
      minLong: 8,
      // The required routine distributes training load; introductory base work is exempt.
      minRuns: 3,
      // The authored preparation window leaves time for progression, recovery and taper.
      recommendedDays: 83,
      // The family forecast stays proportional to the declared training baseline.
      maxForecast: 1.45,
    },
    marathon: {
      // A bounded distance step provides gradual event-specific volume development.
      weeklyStepKm: 3,
      // Long-run increments develop endurance without making abrupt exposure jumps.
      longStepKm: 2,
      // The authored endurance ceiling balances preparation exposure and recovery cost.
      longCeilingKm: 35,
      // This preparation screen requires familiar endurance exposure; it does not prove readiness.
      minimumTrainingExposureKm: 26,
      // The event block requires an established aerobic baseline; base building has no entry minimum.
      minWeekly: 32,
      // A familiar long outing anchors progression; base building can begin without one.
      minLong: 12,
      // The required routine distributes training load; introductory base work is exempt.
      minRuns: 4,
      // The authored preparation window leaves time for progression, recovery and taper.
      recommendedDays: 111,
      // The family forecast stays proportional to the declared training baseline.
      maxForecast: 1.4,
    },
    ultra: {
      // A bounded distance step provides gradual event-specific volume development.
      weeklyStepKm: 3,
      // Long-run increments develop endurance without making abrupt exposure jumps.
      longStepKm: 1.5,
      // The authored endurance ceiling balances preparation exposure and recovery cost.
      longCeilingKm: 45,
      // This preparation screen requires familiar endurance exposure; it does not prove readiness.
      minimumTrainingExposureKm: 28,
      // The event block requires an established aerobic baseline; base building has no entry minimum.
      minWeekly: 40,
      // A familiar long outing anchors progression; base building can begin without one.
      minLong: 16,
      // The required routine distributes training load; introductory base work is exempt.
      minRuns: 4,
      // The authored preparation window leaves time for progression, recovery and taper.
      recommendedDays: 139,
      // The family forecast stays proportional to the declared training baseline.
      maxForecast: 1.45,
    },
    base: {
      // A bounded distance step provides gradual event-specific volume development.
      weeklyStepKm: 1.5,
      // Long-run increments develop endurance without making abrupt exposure jumps.
      longStepKm: 0.5,
      // The authored endurance ceiling balances preparation exposure and recovery cost.
      longCeilingKm: 11,
      // This preparation screen requires familiar endurance exposure; it does not prove readiness.
      minimumTrainingExposureKm: 0,
      // The event block requires an established aerobic baseline; base building has no entry minimum.
      minWeekly: 0,
      // A familiar long outing anchors progression; base building can begin without one.
      minLong: 0,
      // The required routine distributes training load; introductory base work is exempt.
      minRuns: 0,
      // The authored preparation window leaves time for progression, recovery and taper.
      recommendedDays: 27,
      // The family forecast stays proportional to the declared training baseline.
      maxForecast: 1.45,
    },
  },
} as const;
