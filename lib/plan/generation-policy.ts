import {
  GENERATION_POLICY,
  ABSOLUTE_WEEKLY_KM,
  PREPARATION_WEEKS,
  DAYS_PER_WEEK,
  SECONDS_PER_MINUTE,
} from './generation-constants.ts';
import { schedulingEasyPace } from '../fitness-pacing.ts';

import { fiveKEnduranceCeiling } from '../five-k-endurance.ts';

import {
  usesMarathonBook,
  marathonReference,
  marathonRecoveryFactor,
} from '../marathon-book.ts';

import { isLongUltra, LONG_ULTRA_POLICY } from '../ultra-policy.ts';
import {
  qualitySchedule,
  usesMarathonRhythm,
  requestedQualityCount,
  aerobicSupportDay,
  longRunShareLimit,
} from '../training-structure.ts';

import { qualityTrainingEvidence } from '../training-evidence.ts';

import {
  anchoredLongRunKm,
  mandatoryTaperWeeks,
  peakLongRunKm,
  peakLongWeekIndex,
} from '../progression-engine.ts';
import { monday, dayDiff } from './calendar.ts';
import {
  preparationRequirements,
  trainingFamily,
  extendedUltra,
} from './profile.ts';
import { PlanError } from './errors.ts';
import { TRAINING_POLICY } from './policy.ts';
import { type Plan, type Profile, type Workout } from './types.ts';
export type ReplanContext = {
  from: string;
  baseline: NonNullable<Plan['baselineEvidence']>;
  history: Workout[];
  retainedPrefix?: Workout[];
  preserveProgression?: boolean;
  referenceRuns?: number;
};

/** Resolve policy once from the declared profile and recorded baseline; no schedule is mutated. */
export function resolveGenerationPolicy(
  profile: Profile,
  replan?: ReplanContext,
) {
  const p = { ...profile, runMeasure: profile.runMeasure ?? 'distance' };
  const bookMarathon = usesMarathonBook(p);
  const recoveryFactor = marathonRecoveryFactor(p);
  const shortBlock =
    dayDiff(p.startDate, p.raceDate) <
    preparationRequirements(p).recommendedDays;
  const familyPolicy = isLongUltra(p)
    ? {
        ...TRAINING_POLICY.family.ultra,
        longCeilingKm: LONG_ULTRA_POLICY.longCeilingKm,
      }
    : bookMarathon
      ? {
          ...TRAINING_POLICY.family.marathon,
          longCeilingKm: marathonReference(p).longCeilingKm,
        }
      : TRAINING_POLICY.family[trainingFamily(p)];
  const start = monday(p.startDate),
    count = Math.floor(dayDiff(start, p.raceDate) / DAYS_PER_WEEK) + 1;
  const recordedQuality = replan
    ? qualityTrainingEvidence(replan.history, replan.from)
        .filter((e) => e.eligible)
        .map((e) => ({
          ...e.workout,
          date: e.date,
          week: Math.floor(dayDiff(start, e.date) / DAYS_PER_WEEK),
        }))
    : [];
  const pace = schedulingEasyPace(p);
  // Scheduling must respect recorded time as well as distance. A supplied pace
  // cannot turn faster actual running into extra tolerated training minutes.
  const reviewedBaseKm = replan
    ? Math.min(replan.baseline.weeklyKm, replan.baseline.weeklyMinutes / pace)
    : undefined;
  const reviewedLongKm = replan
    ? Math.min(
        replan.baseline.longestKm,
        (replan.baseline.longestMinutes ?? replan.baseline.longestKm * pace) /
          pace,
      )
    : undefined;
  const baseKm = replan?.preserveProgression
    ? p.weeklyKm || GENERATION_POLICY.fallbackWeeklyKm
    : (reviewedBaseKm ?? (p.weeklyKm || GENERATION_POLICY.fallbackWeeklyKm));
  const progressionStart =
    replan && !replan.preserveProgression
      ? Math.max(0, Math.floor(dayDiff(start, replan.from) / DAYS_PER_WEEK))
      : 0;
  const isNovice =
    p.experience === 'new' || p.weeklyKm < GENERATION_POLICY.noviceWeeklyKm;
  const initialFactor =
    p.experience === 'returning' ? TRAINING_POLICY.returningRunnerFactor : 1;
  if (
    replan &&
    !replan.preserveProgression &&
    (reviewedBaseKm! * pace * initialFactor <
      p.days.length * GENERATION_POLICY.minimumSessionMinutes ||
      reviewedLongKm! * pace < GENERATION_POLICY.minimumSessionMinutes)
  )
    throw new PlanError(
      'Your recent recorded running is too limited for an automatic replan on these training days. Review your starting routine before creating a new schedule. Your saved journal has not changed.',
    );
  // Fewer outings must not concentrate the former week into much longer runs.
  const referenceRuns =
    replan && !replan.preserveProgression
      ? (replan.referenceRuns ?? p.days.length)
      : p.currentRuns;
  const policy = {
    ...familyPolicy,
    longCeilingKm: fiveKEnduranceCeiling(p, familyPolicy.longCeilingKm, {
      longestKm: reviewedLongKm ?? p.longestKm,
      longestMinutes:
        replan?.baseline.longestMinutes ??
        (reviewedLongKm ?? p.longestKm) * pace,
      // Allocation frequency can include a newly requested day. It is not
      // evidence that the runner already had that routine before this block.
      currentRuns: Math.min(
        p.currentRuns,
        replan?.referenceRuns ?? p.currentRuns,
      ),
    }),
  };
  const frequencyFactor = Math.min(
    1,
    p.days.length / Math.max(1, referenceRuns),
  );
  const base = Math.min(
    (isLongUltra(p)
      ? Math.min(
          baseKm,
          (replan && !replan.preserveProgression
            ? replan.baseline.weeklyMinutes
            : p.ultraWeeklyMinutes!) / pace,
        )
      : baseKm) *
      initialFactor *
      frequencyFactor,
    (p.weeklyMinutesLimit ?? Infinity) / pace,
  );
  const family = trainingFamily(p);
  // Distance-ended long runs must fit at the slow edge of an explicit easy
  // target. This changes their share of the existing budget, not weekly minutes.
  const longPace =
    family === 'marathon' && p.workoutTargets?.mode === 'pace'
      ? Math.max(
          pace,
          (p.workoutTargets.pace?.easy?.high ?? 0) / SECONDS_PER_MINUTE,
        )
      : pace;
  const absoluteCeiling = bookMarathon
    ? Math.max(p.weeklyKm, marathonReference(p).peakCeilingKm)
    : family === 'ultra'
      ? extendedUltra(p)
        ? ABSOLUTE_WEEKLY_KM.extendedUltra
        : ABSOLUTE_WEEKLY_KM.ultra
      : family === 'marathon' || family === '10k'
        ? ABSOLUTE_WEEKLY_KM.higherRoad
        : ABSOLUTE_WEEKLY_KM.other;
  const weeksUntilRace = count;
  const taperWeeks = mandatoryTaperWeeks(
    trainingFamily(p),
    weeksUntilRace,
    p.goal,
  );
  const declaredLong =
    (replan?.preserveProgression ? p.longestKm : reviewedLongKm) ??
    (p.longestKm || GENERATION_POLICY.fallbackLongKm);
  const startLong =
    family === 'marathon'
      ? Math.min(
          TRAINING_POLICY.family.marathon.longCeilingKm,
          Math.ceil(declaredLong),
        )
      : anchoredLongRunKm(declaredLong, policy.minLong);
  const peakLong = Math.min(
    peakLongRunKm(trainingFamily(p), startLong, p.intent),
    // Keep the opening run anchored to history, but allow later whole sessions
    // to progress toward the existing long-ultra time ceiling.
    isLongUltra(p) ? LONG_ULTRA_POLICY.longMinutes / pace : Infinity,
    p.longLimitKm ?? Infinity,
    p.longMinutes / longPace,
  );
  const peakWeek = peakLongWeekIndex(count, taperWeeks);
  const initialLoad = Math.min(
    Math.max(base, startLong / longRunShareLimit(p)),
    // A retained long-run baseline cannot undo a reduced running-frequency budget.
    replan && usesMarathonRhythm(p) ? base : Infinity,
    // A high long-run/weekly ratio cannot create an opening load that later
    // falls when the ordinary forecast ceiling is applied.
    family === 'marathon' ? base * policy.maxForecast : Infinity,
    absoluteCeiling,
    p.peakWeeklyKm ?? Infinity,
    (p.weeklyMinutesLimit ?? Infinity) / pace,
  );
  const initialLong = Math.min(
    startLong,
    isLongUltra(p)
      ? (replan && !replan.preserveProgression
          ? (replan.baseline.longestMinutes ?? p.ultraLongestMinutes!)
          : p.ultraLongestMinutes!) / pace
      : Infinity,
    Math.max(startLong, policy.longCeilingKm),
    p.longLimitKm ?? Infinity,
  );
  const marathonLongBaseline = initialLong;
  const qualityDays = qualitySchedule(p);
  const requestedQuality = requestedQualityCount(p);
  const mediumDay = aerobicSupportDay(p, family, qualityDays);
  if (p.marathonApproach === 'endurance' && mediumDay === undefined)
    throw new PlanError(
      'Your available days cannot fit a medium-long run away from the long run and quality session.',
    );
  const preparationWeeks =
    family === 'ultra'
      ? isLongUltra(p)
        ? PREPARATION_WEEKS.longUltra
        : PREPARATION_WEEKS.ultra
      : family === 'marathon'
        ? bookMarathon
          ? PREPARATION_WEEKS.bookMarathon
          : PREPARATION_WEEKS.marathon
        : family === 'half'
          ? PREPARATION_WEEKS.half
          : PREPARATION_WEEKS.shortRoad;
  const longProgressionStart =
    family === 'marathon'
      ? Math.max(progressionStart, count - preparationWeeks)
      : progressionStart;
  return {
    p,
    bookMarathon,
    recoveryFactor,
    shortBlock,
    familyPolicy,
    start,
    count,
    recordedQuality,
    pace,
    baseKm,
    progressionStart,
    isNovice,
    initialFactor,
    policy,
    base,
    family,
    longPace,
    absoluteCeiling,
    weeksUntilRace,
    taperWeeks,
    startLong,
    peakLong,
    peakWeek,
    initialLoad,
    initialLong,
    marathonLongBaseline,
    qualityDays,
    requestedQuality,
    mediumDay,
    preparationWeeks,
    longProgressionStart,
  };
}
export type GenerationPolicy = ReturnType<typeof resolveGenerationPolicy>;
