import {
  EVENT_DISTANCE_POLICY,
  EXPOSURE_ANCHORS,
  HALF_PREPARATION_MINIMUM_RUNS,
  MARATHON_PREPARATION_MINIMUM_RUNS,
  MAXIMUM_CUSTOM_EXPOSURE_KM,
  MINIMUM_DEMANDING_SPACING_DAYS,
  PLAN_LOAD_LIMITS,
  PROFILE_TRAINING_LIMITS,
  READINESS_ANCHORS,
} from './policy-constants.ts';
/** Plan profile responsibilities; extracted without changing policy or behavior. */
import { advancedEligibility } from '../advanced-methods.ts';
import { validateRecentRace } from '../fitness-pacing.ts';
import { usesMarathonBook } from '../marathon-book.ts';
import { customizationError } from '../runner-customization.ts';
import {
  availableRunningDays,
  classicQualityCount,
  desiredRuns,
  qualitySchedule,
  resolveRunningDays,
  usesStandardQualityRhythm,
} from '../training-structure.ts';
import { isLongUltra, LONG_ULTRA_POLICY } from '../ultra-policy.ts';
import { validateWorkoutTargets } from '../workout-targets.ts';
import { dayDiff, validDate } from './calendar.ts';
import { PlanError } from './errors.ts';
import { round } from './math.ts';
import { MAX_EVENT_KM, TRAINING_POLICY } from './policy.ts';
import { type Profile, type TrainingFamily } from './types.ts';

export function raceDistance(
  p: Pick<Profile, 'goal' | 'raceDistanceKm'>,
): number {
  return p.goal === 'base'
    ? 0
    : p.goal === '5k'
      ? EVENT_DISTANCE_POLICY.fiveKm
      : p.goal === '10k'
        ? EVENT_DISTANCE_POLICY.tenKm
        : p.goal === 'half'
          ? EVENT_DISTANCE_POLICY.halfMarathonKm
          : p.goal === 'marathon'
            ? EVENT_DISTANCE_POLICY.marathonKm
            : (p.raceDistanceKm ??
              (p.goal === 'ultra'
                ? EVENT_DISTANCE_POLICY.defaultUltraKm
                : EVENT_DISTANCE_POLICY.tenKm));
}

export function trainingFamily(
  p: Pick<Profile, 'goal' | 'raceDistanceKm'>,
): TrainingFamily {
  if (!['custom', 'ultra'].includes(p.goal)) return p.goal as TrainingFamily;
  const d = raceDistance(p);
  // Preparation bands describe a model, not a measurement or finish-time prediction.
  return d <= EVENT_DISTANCE_POLICY.fiveKFamilyCeilingKm
    ? '5k'
    : d <= EVENT_DISTANCE_POLICY.tenKFamilyCeilingKm
      ? '10k'
      : d <= EVENT_DISTANCE_POLICY.halfFamilyCeilingKm
        ? 'half'
        : d <= EVENT_DISTANCE_POLICY.marathonFamilyCeilingKm
          ? 'marathon'
          : 'ultra';
}

export function extendedUltra(p: Pick<Profile, 'goal' | 'raceDistanceKm'>) {
  return (
    trainingFamily(p) === 'ultra' &&
    raceDistance(p) > EVENT_DISTANCE_POLICY.extendedUltraFromKm
  );
}

/** Keep the setup's guidance and the server's frequency boundary in agreement. */
export function runningDayRange(
  p: Pick<Profile, 'currentRuns' | 'goal' | 'raceDistanceKm'>,
) {
  return {
    min:
      trainingFamily(p) === 'ultra'
        ? PROFILE_TRAINING_LIMITS.ultraMinimumRuns
        : PROFILE_TRAINING_LIMITS.minimumRuns,
    max: Number.isFinite(p.currentRuns)
      ? p.currentRuns === 0
        ? PROFILE_TRAINING_LIMITS.noviceMaximumRuns
        : Math.min(
            7,
            p.currentRuns + PROFILE_TRAINING_LIMITS.maximumAddedRunningDays,
          )
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
      ? raceDistance(p) <= EVENT_DISTANCE_POLICY.longUltraBandKm
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
        ? PROFILE_TRAINING_LIMITS.extendedPreparationDays
        : policy.recommendedDays,
    minWeekly: ['custom', 'ultra'].includes(p.goal)
      ? round(interpolateReadiness(raceDistance(p), 2), 1)
      : extended
        ? PROFILE_TRAINING_LIMITS.extendedMinimumWeeklyKm
        : policy.minWeekly,
    minLong: ['custom', 'ultra'].includes(p.goal)
      ? round(interpolateReadiness(raceDistance(p), 3), 1)
      : extended
        ? PROFILE_TRAINING_LIMITS.extendedMinimumLongKm
        : policy.minLong,
    minRuns: ['custom', 'ultra'].includes(p.goal)
      ? raceDistance(p) > EVENT_DISTANCE_POLICY.defaultUltraKm
        ? PROFILE_TRAINING_LIMITS.ultraMinimumRuns
        : raceDistance(p) > EVENT_DISTANCE_POLICY.halfFamilyCeilingKm
          ? MARATHON_PREPARATION_MINIMUM_RUNS
          : raceDistance(p) > EVENT_DISTANCE_POLICY.tenKm
            ? HALF_PREPARATION_MINIMUM_RUNS
            : PROFILE_TRAINING_LIMITS.minimumRuns
      : extended
        ? PROFILE_TRAINING_LIMITS.ultraMinimumRuns
        : policy.minRuns,
  };
}

export function interpolateReadiness(distance: number, column: number) {
  // Authored continuous readiness between existing named-event anchors; templates are separate.
  const anchors = READINESS_ANCHORS;
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
  const anchors = EXPOSURE_ANCHORS;
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i],
      [a, b] = anchors[i - 1];
    if (distance <= x) return b + ((y - b) * (distance - a)) / (x - a);
  }
  return MAXIMUM_CUSTOM_EXPOSURE_KM;
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
      raceDistance(p) < EVENT_DISTANCE_POLICY.minimumCustomKm ||
      raceDistance(p) > MAX_EVENT_KM ||
      (p.goal === 'ultra' &&
        raceDistance(p) <= EVENT_DISTANCE_POLICY.marathonKm))
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
  if (length > PROFILE_TRAINING_LIMITS.maximumPlanDayDifference)
    throw new PlanError(
      'Plans can cover up to 52 weeks. Choose an earlier finish date.',
    );
  const nums: [keyof Profile, number, number, string][] = [
    [
      'weeklyKm',
      0,
      usesMarathonBook(p)
        ? PROFILE_TRAINING_LIMITS.marathonWeeklyKm
        : PROFILE_TRAINING_LIMITS.extendedUltraWeeklyKm,
      'recent weekly distance',
    ],
    [
      'longestKm',
      0,
      PROFILE_TRAINING_LIMITS.maximumRecordedLongKm,
      'recent longest run',
    ],
    ['currentRuns', 0, 7, 'current running frequency'],
    [
      'weekdayMinutes',
      PROFILE_TRAINING_LIMITS.minimumWeekdayMinutes,
      PROFILE_TRAINING_LIMITS.maximumWeekdayMinutes,
      'weekday time limit',
    ],
    [
      'longMinutes',
      PROFILE_TRAINING_LIMITS.minimumLongMinutes,
      PROFILE_TRAINING_LIMITS.maximumLongMinutes,
      'long-run time limit',
    ],
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
      p.availableDays.length < PROFILE_TRAINING_LIMITS.minimumRuns ||
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
      p.preferredHardDays.length > PROFILE_TRAINING_LIMITS.twoQualitySessions ||
      new Set(p.preferredHardDays).size !== p.preferredHardDays.length ||
      p.preferredHardDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
  )
    throw new PlanError('Choose up to two distinct preferred workout days.');
  if (
    p.crossTraining !== undefined &&
    (!Array.isArray(p.crossTraining) ||
      p.crossTraining.length >
        PROFILE_TRAINING_LIMITS.maximumCrossTrainingDays ||
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
          s.minutes < PROFILE_TRAINING_LIMITS.minimumCrossTrainingMinutes ||
          s.minutes > PROFILE_TRAINING_LIMITS.maximumCrossTrainingMinutes,
      ))
  )
    throw new PlanError(
      'Choose up to three separate cross-training days, each with 10–60 minutes of easy activity.',
    );
  if (
    p.carbsPerHour != null &&
    (!Number.isFinite(p.carbsPerHour) ||
      p.carbsPerHour < PROFILE_TRAINING_LIMITS.minimumCarbsPerHour ||
      p.carbsPerHour > PROFILE_TRAINING_LIMITS.maximumCarbsPerHour)
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
  if (
    !Number.isInteger(runs) ||
    runs < PROFILE_TRAINING_LIMITS.minimumRuns ||
    runs > 7
  )
    throw new PlanError('Choose between 2 and 7 runs per week.');
  if (runs > available.length)
    throw new PlanError(
      `You want ${runs} runs but have only ${available.length} available days. Add available days or reduce runs per week.`,
    );
  if (!available.includes(p.longDay))
    throw new PlanError(
      'Your preferred long-run day must be one of your available days.',
    );
  if (
    p.currentRuns > 0 &&
    runs > p.currentRuns + PROFILE_TRAINING_LIMITS.maximumAddedRunningDays
  )
    throw new PlanError(
      `You entered ${p.currentRuns} current running ${p.currentRuns === 1 ? 'day' : 'days'} and requested ${runs} runs. Choose at most ${runningDayRange(p).max} runs for this block, or review your recent routine if it was entered incorrectly. Available days do not increase your running frequency.`,
    );
  if (p.currentRuns === 0 && runs > PROFILE_TRAINING_LIMITS.noviceMaximumRuns)
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
      p.ultraWeeklyMinutes! <
        PROFILE_TRAINING_LIMITS.minimumUltraWeeklyMinutes ||
      p.ultraWeeklyMinutes! >
        PROFILE_TRAINING_LIMITS.maximumUltraWeeklyMinutes ||
      p.ultraLongestMinutes! <
        PROFILE_TRAINING_LIMITS.minimumUltraLongestMinutes ||
      p.ultraLongestMinutes! >
        PROFILE_TRAINING_LIMITS.maximumUltraLongestMinutes ||
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
    if (
      p.qualityMode === 'custom' &&
      (p.qualitySessions ?? 0) > PLAN_LOAD_LIMITS.maximumUltraQualitySessions
    )
      throw new PlanError(
        'Beyond 50 miles, choose zero or one quality session. The remaining training supports easy endurance.',
      );
    p.qualitySessions = Math.min(
      PLAN_LOAD_LIMITS.maximumUltraQualitySessions,
      p.qualitySessions ?? PLAN_LOAD_LIMITS.maximumUltraQualitySessions,
    ) as 0 | 1;
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
    ? PROFILE_TRAINING_LIMITS.marathonWeeklyKm
    : family === 'ultra'
      ? extendedUltra(p)
        ? PROFILE_TRAINING_LIMITS.extendedUltraWeeklyKm
        : PROFILE_TRAINING_LIMITS.standardWeeklyKm
      : family === 'marathon' || family === '10k'
        ? PROFILE_TRAINING_LIMITS.standardWeeklyKm
        : PROFILE_TRAINING_LIMITS.shorterEventWeeklyKm;
  if (p.weeklyKm > absoluteCeiling)
    throw new PlanError(
      `This policy supports a baseline up to ${absoluteCeiling} km per week. Higher-volume plans need an individually reviewed policy.`,
    );
  if (
    usesMarathonBook(p) &&
    p.weeklyKm > PROFILE_TRAINING_LIMITS.highMileageThresholdKm &&
    (p.experience !== 'established' ||
      p.currentRuns < PROFILE_TRAINING_LIMITS.highMileageRunningDays ||
      p.days.length < PROFILE_TRAINING_LIMITS.highMileageRunningDays ||
      p.longestKm < PROFILE_TRAINING_LIMITS.highMileageLongKm)
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
  if (
    family === 'ultra' &&
    p.days.length < PROFILE_TRAINING_LIMITS.ultraMinimumRuns
  )
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
      (!Number.isFinite(p[key]) ||
        p[key]! < PROFILE_TRAINING_LIMITS.minimumDistanceLimitKm ||
        p[key]! > PROFILE_TRAINING_LIMITS.maximumDistanceLimitKm)
    )
      throw new PlanError(
        'Distance limits must be between 1 and 150 km, or left blank.',
      );
  }
  if (
    p.peakWeeklyKm != null &&
    p.peakWeeklyKm <
      p.weeklyKm *
        (p.experience === 'returning'
          ? PROFILE_TRAINING_LIMITS.returningBaselineFraction
          : 1)
  )
    throw new PlanError(
      'The peak-week ceiling cannot be below the starting baseline. Reduce the baseline deliberately in runner inputs.',
    );
  if (
    p.easyPace !== null &&
    (typeof p.easyPace !== 'number' ||
      !Number.isFinite(p.easyPace) ||
      p.easyPace < PROFILE_TRAINING_LIMITS.minimumEasyMinutesPerKm ||
      p.easyPace > PROFILE_TRAINING_LIMITS.maximumEasyMinutesPerKm)
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
  p.qualitySessions ??=
    p.goal === 'base' ? 0 : PLAN_LOAD_LIMITS.weekdayQualitySessions;
  if (p.days.length === PROFILE_TRAINING_LIMITS.minimumRuns)
    p.qualitySessions = 0;
  p.recoveryWeeks ??= PROFILE_TRAINING_LIMITS.defaultRecoveryWeeks;
  p.terrain ??= 'flat';
  if (
    ![0, 1, 2].includes(p.qualitySessions) ||
    ![
      PROFILE_TRAINING_LIMITS.minimumRecoveryWeeks,
      PROFILE_TRAINING_LIMITS.maximumRecoveryWeeks,
    ].includes(p.recoveryWeeks) ||
    !['flat', 'hills'].includes(p.terrain)
  )
    throw new PlanError(
      'Check your quality, recovery, and terrain preferences.',
    );
  if (
    p.qualityMode === 'custom' &&
    p.qualitySessions === PROFILE_TRAINING_LIMITS.twoQualitySessions &&
    ((p.recentQualitySessions ?? 0) <
      PROFILE_TRAINING_LIMITS.twoQualitySessions ||
      p.days.length < PROFILE_TRAINING_LIMITS.enduranceRunningDays ||
      p.weeklyKm < PROFILE_TRAINING_LIMITS.twoQualityMinimumKm ||
      p.currentRuns < PROFILE_TRAINING_LIMITS.enduranceRunningDays ||
      p.experience !== 'established')
  )
    throw new PlanError(
      'Two quality sessions need an established routine of at least 5 runs, 45 km and two quality sessions per week. Choose one quality session for now.',
    );
  if (
    p.goal === 'base' ||
    p.days.length === PROFILE_TRAINING_LIMITS.minimumRuns
  )
    p.qualitySessions = 0;
  if (
    p.marathonApproach !== undefined &&
    !['balanced', 'endurance'].includes(p.marathonApproach)
  )
    throw new PlanError('Choose a supported marathon approach.');
  if (
    p.marathonApproach === 'endurance' &&
    (trainingFamily(p) !== 'marathon' ||
      p.experience !== 'established' ||
      p.weeklyKm < PROFILE_TRAINING_LIMITS.enduranceMinimumKm ||
      p.currentRuns < PROFILE_TRAINING_LIMITS.enduranceRunningDays ||
      p.days.length < PROFILE_TRAINING_LIMITS.enduranceRunningDays ||
      ['double-threshold', 'easy-doubles'].includes(p.method ?? ''))
  )
    throw new PlanError(
      'The medium-long marathon approach needs an established five-day, 50 km routine and a single-session training method.',
    );
  const methodErrors = advancedEligibility(p);
  if (methodErrors.length) throw new PlanError(methodErrors[0]);
  if (p.method === 'double-threshold') {
    p.qualitySessions = PLAN_LOAD_LIMITS.weekdayQualitySessions;
    const chosen = p.doubleDays![0];
    if (
      Math.min(Math.abs(chosen - p.longDay), 7 - Math.abs(chosen - p.longDay)) <
      MINIMUM_DEMANDING_SPACING_DAYS
    )
      throw new PlanError(
        'Place the paired threshold day at least one easy or rest day away from the long run.',
      );
  }
  if (usesStandardQualityRhythm(p)) {
    // This legacy field counts weekday workouts; the long run is the other quality session.
    p.qualitySessions = PLAN_LOAD_LIMITS.weekdayQualitySessions;
    if (
      p.days.length < PROFILE_TRAINING_LIMITS.minimumMarathonRhythmDays ||
      qualitySchedule(p).length !== PLAN_LOAD_LIMITS.weekdayQualitySessions
    )
      throw new PlanError(
        'A standard training week needs a long run, one quality workout of at least 30 minutes, and easy running. Choose a workout day separated from the long run by an easy or rest day.',
      );
  }
  p.days.sort((a, b) => a - b);
  p.name = p.name.trim();
  p.raceName = p.raceName.trim();
  return p;
}
