/** Existing coaching heuristics, preserved by this refactor; these are not universal safety thresholds. */
export const GENERATION_POLICY = {
  // A small fallback supports a short introductory routine when no weekly distance was declared.
  fallbackWeeklyKm: 5,
  // A short fallback long outing avoids inferring endurance from an absent baseline.
  fallbackLongKm: 2,
  // Low-volume runners retain the introductory run/walk and gentler progression branch.
  noviceWeeklyKm: 10,
  // Every outing retains enough time to remain a useful, complete session.
  minimumSessionMinutes: 5,
  // New runners add a small fixed amount instead of compounding an uncertain baseline.
  noviceWeeklyStepKm: 0.5,
  // Established road-running growth is limited within the separate absolute and baseline ceilings.
  roadWeeklyGrowthFraction: 0.06,
  // Ultra blocks use a smaller proportional increment because their starting workload is larger.
  ultraWeeklyGrowthFraction: 0.05,
  // A newly added day settles before the plan also increases weekly volume.
  addedDaySettlingWeeks: 3,
  // Easy doubles settle before the plan layers on further weekly load.
  easyDoublesSettlingWeeks: 5,
  // Early introductory weeks establish rhythm before ordinary build phases.
  foundationWeeks: 2,
  // Book marathon load alternates growth weeks to allow consolidation between increases.
  marathonLoadStepEveryWeeks: 2,
  // Familiar quality experience is required before distant-event maintenance includes workouts.
  maintenanceQualitySessions: 1,
  // Race-specific preparation occupies the final portion of the reference training block.
  racePreparationFraction: 0.4,
  // Even shorter reference blocks retain a meaningful race-specific preparation window.
  minimumRacePreparationWeeks: 6,
} as const;

export const ABSOLUTE_WEEKLY_KM = {
  // The existing extended-ultra forecast permits more distributed endurance volume.
  extendedUltra: 120,
  // The ordinary ultra branch caps forecast growth independently of available calendar time.
  ultra: 100,
  // Marathon and 10K forecasts retain the established road-family volume ceiling.
  higherRoad: 100,
  // Other preparation families use the existing lower ceiling for automatic volume forecasts.
  other: 80,
} as const;

export const PREPARATION_WEEKS = {
  // Longer ultra events retain more weeks for distributed endurance preparation.
  longUltra: 32,
  // Ordinary ultras retain their established event-specific build window.
  ultra: 28,
  // The book-based marathon schedule concentrates its progression in its existing block length.
  bookMarathon: 18,
  // The independent marathon schedule retains its longer preparatory window.
  marathon: 22,
  // Half-marathon preparation retains time for endurance and race-effort practice.
  half: 16,
  // Short-road preparation retains the existing window for familiar speed and endurance work.
  shortRoad: 12,
} as const;

export const TAPER_POLICY = {
  // The final race week retains a small amount of familiar training while recovery takes priority.
  finalWeekFraction: 0.4,
  // The preceding week reduces training without removing the established rhythm.
  secondWeekFraction: 0.65,
  // Longer events begin with a smaller reduction before the deeper taper.
  thirdWeekFraction: 0.85,
  // A second taper band starts two weeks before race day, independent of calendar-week boundaries.
  secondWeekDays: 14,
  // Half-marathon and longer families retain the existing three-week taper entry band.
  thirdWeekDays: 21,
} as const;

export const RACE_WEEK_CAPS = {
  // The last pre-race day retains only a short easy outing.
  finalDay: { days: 1, minutes: 20 },
  // Two days out, a little more familiar running still leaves room to recover.
  penultimateDay: { days: 2, minutes: 25 },
  // Three days out, the existing cap keeps race-week sessions modest.
  thirdDay: { days: 3, minutes: 30 },
  // Earlier race-week sessions retain a reduced, familiar duration.
  earlierDaysMinutes: 45,
  // The book-marathon final-day cap follows its separate distributed taper budget.
  marathonFinalDayMinutes: 45,
  // The book-marathon two-day cap preserves its existing taper allocation.
  marathonPenultimateDayMinutes: 60,
} as const;

// Calendar arithmetic uses complete seven-day training weeks, rather than a physiological threshold.
export const DAYS_PER_WEEK = 7;
// Calendar weeks are zero-indexed from Monday, so Sunday is the final day offset.
export const FINAL_WEEKDAY_OFFSET = 6;
// Targets store seconds while planning budgets use minutes; this is a unit conversion, not a policy.
export const SECONDS_PER_MINUTE = 60;

export const SESSION_POLICY = {
  // Two outings remain easy; a separate long-run role needs another weekly outing.
  easyOnlyMaximumRuns: 2,
  // Sparse schedules retain equal session weights rather than concentrating their load.
  equalWeightMaximumRuns: 3,
  // A medium-long outing requires enough weekly runs to preserve easy support around it.
  mediumLongMinimumRuns: 4,
  // Book marathon long runs stop when the final six-day preparation window begins.
  bookLongMinimumDaysBeforeRace: 7,
  // Other families retain the established extra day before final-week long-run removal.
  longMinimumDaysBeforeRace: 8,
  // A short opening week does not erase a recently declared familiar long-run baseline.
  openingBaselineRetentionDays: 30,
  // Near-peak recognition treats a small distance/time rounding gap as the same exposure.
  nearPeakFraction: 0.95,
  // Repeated near-peak ultra outings trigger a consolidation wave rather than another peak.
  ultraPeakExposuresBeforeWave: 2,
  // The ultra consolidation wave reduces the longest outing after repeated peak exposure.
  ultraLongWaveFraction: 0.88,
  // A marathon recovery long run backs off the preceding endurance exposure.
  marathonRecoveryLongFraction: 0.8,
  // Long-run time caps tighten during the final two weeks of the independent taper.
  lateLongCapDays: 14,
  // Book marathon-effort practice needs enough easy running around its faster segment.
  bookMixedLongMinimumMinutes: 90,
  // Independent marathon-effort long runs require an established weekly endurance routine.
  mixedLongMinimumWeeklyKm: 50,
  // The independent mixed long run also requires a familiar long-run baseline.
  mixedLongMinimumBaselineKm: 20,
  // Multiple familiar quality sessions are required before replacing one with mixed endurance.
  mixedLongMinimumQualitySessions: 2,
  // Earlier race-specific sessions establish familiarity before mixed long-run practice.
  mixedLongMinimumSpecificSessions: 2,
  // The independent mixed long run reserves substantial easy volume around faster work.
  mixedLongMinimumMinutes: 100,
  // Independent mixed long runs alternate with ordinary endurance weeks.
  mixedLongEveryWeeks: 2,
  // Paired threshold sessions begin after the introductory weeks.
  pairedIntroductionWeeks: 2,
  // A paired day contains two sessions sharing that day's existing allowance.
  pairedSessionCount: 2,
  // A structured introduction must fit its warm-up, recoveries, and cool-down intact.
  introductoryWorkoutMinutes: 30,
  // The primary marathon quality allocation reserves easy running around its work dose.
  qualityAerobicAllowanceMinutes: 25,
  // Familiar threshold singles retain the stricter existing fraction of weekly time.
  thresholdSinglesWorkFraction: 0.18,
  // Other structured work shares the existing weekly work allowance with long-run quality.
  qualityWorkFraction: 0.22,
  // Independent marathon long-run quality retains a smaller share of weekly time.
  independentLongWorkFraction: 0.1,
  // Late race-week quality stops before the final recovery days.
  qualityMinimumDaysBeforeRace: 3,
  // A second quality slot needs prior experience rather than only a newly selected schedule.
  secondaryQualityEvidenceSessions: 2,
  // Medium-long labeling follows the book's existing endurance-distance distinction.
  mediumLongLabelKm: 18,
  // Book marathon-effort recipes begin at their existing minimum work-dose variant.
  marathonPaceMinimumMinutes: 20,
  // Continuous fast finishes require a familiar sustained race-effort segment first.
  continuousRaceEffortEvidenceSeconds: 960,
  // Independent marathon-effort work remains bounded even after repeated exposure.
  independentMarathonPaceMaximumMinutes: 30,
  // Familiar marathon-effort exposure advances by the existing controlled dose increment.
  marathonPaceStepMinutes: 10,
  // Strides require enough session time to keep easy running before and after them.
  stridesMinimumSessionMinutes: 25,
  // Strides retain a small work ceiling rather than becoming another demanding workout.
  stridesWorkCeilingMinutes: 2,
  // The existing four twenty-second strides preserve their fully recovered form practice.
  stridesWorkMinutes: 4 / 3,
  // Distant-event maintenance is reviewed in bounded blocks instead of forecasting endless growth.
  maintenanceReviewWeeks: 8,
} as const;

export const LATE_LONG_CAP_MINUTES = {
  // Ultra taper outings retain easy time on feet while reducing accumulated fatigue.
  ultra: 120,
  // Marathon taper outings retain endurance familiarity with a reduced time commitment.
  marathon: 90,
  // Half-marathon taper outings use the established shorter endurance cap.
  half: 75,
  // Shorter races retain the existing hour ceiling for a late long outing.
  shortRoad: 60,
} as const;

// The legacy prescription helper encodes each run/walk stage as three variant indices.
export const RUN_WALK_VARIANT_STRIDE = 3;

export const SIMPLE_PRESCRIPTION_POLICY = {
  // Introductory run/walk progression stops at the established final interval stage.
  maximumRunWalkStage: 4,
  // Structured work retains an easy warm-up before faster running.
  warmupMinutes: 10,
  // The initial work budget reserves easy time after the final repetition.
  cooldownMinutes: 5,
  // Tempo introductions retain at least two controlled bouts.
  minimumTempoRepetitions: 2,
  // Tempo introductions remain a small set of sustained bouts.
  maximumTempoRepetitions: 3,
  // The tempo count reserves the existing per-bout work and recovery allowance.
  tempoBoutAllowanceMinutes: 6,
  // Other introductions retain enough repetitions to establish a repeatable rhythm.
  minimumRepetitions: 3,
  // Shorter intervals remain a bounded set rather than filling every available minute.
  maximumRepetitions: 8,
  // Fartlek counting reserves a short pickup and its easy recovery.
  fartlekBoutAllowanceMinutes: 3,
  // Interval counting reserves the longer established work/recovery allowance.
  intervalBoutAllowanceMinutes: 5,
  // Fartlek pickups retain their brief easy reset between efforts.
  fartlekRecoveryMinutes: 1,
  // Structured intervals retain the existing longer recovery between repetitions.
  intervalRecoveryMinutes: 2,
  // An introductory work bout remains at least a minute instead of becoming a tiny fragment.
  minimumWorkMinutes: 1,
} as const;

export const FEASIBILITY_POLICY = {
  // Alternative-date search stays bounded instead of presenting unlimited delay as a readiness solution.
  maximumAlternativeWeeks: 12,
  // Automatic forecasts retain the existing maximum calendar horizon rather than extrapolating indefinitely.
  maximumPlanDays: 363,
  // Short-ultra capacity is checked in the established late-preparation window.
  ultraCapacityLookbackWeeks: 10,
  // The capacity window excludes the existing three-week ultra taper.
  ultraTaperWeeks: 3,
  // Repeated substantial weeks provide the existing endurance-capacity signal, not proof of race readiness.
  ultraConsecutiveCapacityWeeks: 3,
  // The existing short-ultra feasibility heuristic requires six hours in each qualifying week.
  ultraCapacityMinutes: 360,
} as const;
