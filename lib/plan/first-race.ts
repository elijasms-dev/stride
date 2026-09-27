import {
  FIRST_RACE_POLICY,
  firstRaceProfileError,
  firstRaceTaperFactor,
  isFirstRaceProfile,
  type FirstRaceGoal,
} from '../first-race-policy.ts';
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { distanceEstimate } from '../prescription.ts';
import { trainingRecords } from '../run-records.ts';
import {
  applyPreferredStartTimes,
  clockMinutes,
  runningDayLimit,
} from '../runner-customization.ts';
import { withAllocatedWorkoutTargets as withWorkoutTargets } from '../workout-targets.ts';
import { addDays, dayDiff, monday, weekday } from './calendar.ts';
import { PlanError } from './errors.ts';
import type { ReplanContext } from './generation-policy.ts';
import { ENGINE_VERSION, TRAINING_POLICY } from './policy.ts';
import { RETURN_TRAINING_POLICY } from './policy-constants.ts';
import { refreshWeekTotals } from './totals.ts';
import type { Plan, Profile, Week, Workout } from './types.ts';
import { validatePlan } from './validate.ts';
export { firstRacePlanErrors } from '../first-race-policy.ts';

const raceKm: Record<FirstRaceGoal, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
};
const metres = (km: number) => Math.round(km * 1000);
const floorMetres = (km: number) => Math.floor(km * 1000 + 1e-7);

function capacity(p: Profile, day: number, pace: number, long: boolean) {
  const start = p.dayPreferences?.find((d) => d.day === day)?.startTime;
  const minutes = Math.min(
    long ? p.longMinutes : p.weekdayMinutes,
    runningDayLimit(p, day),
    start ? 1440 - clockMinutes(start) : Infinity,
  );
  return Math.max(
    0,
    Math.min(
      floorMetres(minutes / pace),
      floorMetres((long ? p.longLimitKm : p.easyLimitKm) ?? Infinity),
    ),
  );
}

/** Integer metres keep the declared opening total exact. Water filling respects
 * each selected day's cap rather than losing volume through independent rounding. */
function distribute(
  total: number,
  caps: number[],
  minimum: number,
): number[] | null {
  if (
    total < minimum * caps.length ||
    caps.some((c) => c < minimum) ||
    total > caps.reduce((a, b) => a + b, 0)
  )
    return null;
  const result = caps.map(() => minimum);
  let remaining = total - minimum * caps.length;
  while (remaining > 0) {
    const free = result
      .map((n, i) => (caps[i] > n ? i : -1))
      .filter((i) => i >= 0);
    if (!free.length) return null;
    const portion = Math.max(1, Math.floor(remaining / free.length));
    for (const i of free) {
      const addition = Math.min(portion, caps[i] - result[i], remaining);
      result[i] += addition;
      remaining -= addition;
    }
  }
  return result;
}

function workout(
  p: Profile,
  date: string,
  week: number,
  km: number,
  kind: 'easy' | 'long' | 'race',
  phase: Week['phase'],
): Workout {
  const pace = schedulingEasyPace(p),
    seconds = Math.max(1, Math.ceil(km * pace * 60 - 1e-8));
  const exact = kind === 'race' || p.runMeasure !== 'time';
  const steps: Workout['steps'] = [
    {
      label:
        kind === 'race'
          ? 'Race distance'
          : kind === 'long'
            ? 'Easy endurance'
            : 'Easy running',
      seconds,
      ...(exact ? { metres: km * 1000 } : {}),
      ...(exact && kind !== 'race'
        ? { planningPaceSecondsPerKm: pace * 60 }
        : {}),
      kind: 'work',
      movement: 'run',
      intensity: kind === 'race' ? 5 : 3,
      effort:
        kind === 'race'
          ? 'Start comfortably; finishing is the goal. Use familiar walk breaks.'
          : 'Conversational · full sentences · 2–3 / 10; walk briefly when needed',
    },
  ];
  return withWorkoutTargets(
    {
      id: `first-race:${date}`,
      date,
      originalDate: date,
      week,
      title:
        kind === 'race'
          ? p.raceName || 'First race'
          : kind === 'long'
            ? 'Easy long run'
            : 'Easy run',
      kind,
      minutes: seconds / 60,
      estimatedKm: km,
      hard: kind === 'race',
      purpose:
        kind === 'race'
          ? 'Finish with controlled effort, using the routine practised in training.'
          : kind === 'long'
            ? 'Build comfortable endurance and practise familiar fueling and walk breaks.'
            : 'Build a repeatable easy-running routine and support the longer outing.',
      reason:
        kind === 'race'
          ? 'The event distance is exact. The planning duration is not a finish-time prediction or proof of readiness.'
          : phase === 'Recovery'
            ? 'A designated lighter week supports recovery; the next build returns to familiar training.'
            : ['Taper', 'Race week'].includes(phase)
              ? 'Reduce familiar easy running before the event; no missed distance is made up.'
              : 'All training stays easy. Progression is funded by the whole week and remains subject to your actual recovery.',
      steps,
      status: 'planned',
      stimulus: kind === 'race' ? undefined : 'aerobic',
      qualityMinutes: 0,
      distanceEstimate: distanceEstimate(steps, p),
    },
    p,
  );
}

export function makeFirstRacePlan(
  profile: Profile,
  asOf = profile.startDate,
  replan?: ReplanContext,
): Plan {
  const entryError = firstRaceProfileError(profile);
  if (entryError) throw new PlanError(entryError);
  if (!isFirstRaceProfile(profile))
    throw new PlanError(
      'Choose an existing running baseline for a first-race plan.',
    );
  const p: Profile = {
    ...profile,
    runMeasure: profile.runMeasure ?? 'distance',
    workoutTargets: profile.workoutTargets ?? { mode: 'effort' },
    qualitySessions: 0,
  };
  const policy = FIRST_RACE_POLICY[profile.goal];
  const start = monday(p.startDate),
    count = Math.floor(dayDiff(start, p.raceDate) / 7) + 1;
  const firstFull = weekday(p.startDate) ? 1 : 0;
  const reviewWeek = replan
    ? Math.max(0, Math.floor(dayDiff(start, replan.from) / 7))
    : 0;
  const clockStart =
    replan && !replan.preserveProgression ? reviewWeek : firstFull;
  const usableWeeks = Array.from({ length: count }, (_, i) =>
    addDays(start, i * 7),
  ).filter(
    (date) =>
      date >= p.startDate &&
      addDays(date, 6) < p.raceDate &&
      p.days.every((day) => firstRaceTaperFactor(p, addDays(date, day)) === 1),
  ).length;
  const extra =
    replan && !replan.preserveProgression
      ? 0
      : Math.max(0, usableWeeks - (policy.weeks - policy.taperDays / 7));
  const pace = schedulingEasyPace(p),
    minimum = Math.ceil(5000 / pace);
  const supportDays = p.days
    .filter((d) => d !== p.longDay)
    .sort((a, b) => a - b);
  if (!p.days.includes(p.longDay) || supportDays.length !== p.days.length - 1)
    throw new PlanError(
      'Choose a long-run day within your selected running days.',
    );
  const supportCaps = supportDays.map((d) => capacity(p, d, pace, false));
  const longCapacity = capacity(p, p.longDay, pace, true);
  const volumeCapacity = Math.min(
    supportCaps.reduce((a, b) => a + b, 0) + longCapacity,
    floorMetres(p.peakWeeklyKm ?? Infinity),
    floorMetres((p.weeklyMinutesLimit ?? Infinity) / pace),
  );
  let anchorWeekly = metres(p.weeklyKm),
    anchorLong = metres(p.longestKm);
  if (
    !replan &&
    (anchorLong > longCapacity ||
      anchorWeekly > volumeCapacity ||
      !distribute(
        anchorWeekly - anchorLong,
        supportCaps.map((cap) => Math.min(cap, anchorLong)),
        minimum,
      ))
  )
    throw new PlanError(
      'The declared opening weekly and long-run distances do not fit your selected days and time/distance limits. Review those limits; the first week will not be silently changed.',
    );
  const plan: Plan = {
    id: crypto.randomUUID(),
    engineVersion: ENGINE_VERSION,
    policyVersion: TRAINING_POLICY.version,
    profile: p,
    weeks: [],
    workouts: [],
    createdAt: new Date().toISOString(),
    firstRace: { program: 'first-race-v1', goal: profile.goal },
    ...(replan
      ? {
          baselineEvidence: structuredClone(replan.baseline),
          constraintsFrom: replan.from,
        }
      : {}),
    notes: [
      `First ${profile.goal} plan: an independently authored ${policy.weeks}-week preparation model for an existing runner. Reference: ${policy.source}`,
      'The declared opening weekly and long-run distances are retained. All training is easy; the long run is an endurance exposure, not an extra speed workout.',
      `Build weeks rise by at most 10% from the previous build anchor, with a lighter week every ${p.recoveryWeeks ?? 4} weeks. These are product rules, not universal safety guarantees. Extra calendar weeks initially hold the baseline.`,
      'Long runs grow in funded whole kilometres; session limits can cause a hold. Taper follows the actual event date. Missed training never becomes catch-up mileage.',
      ...(p.goal === 'marathon'
        ? [
            'A first-marathon peak of 32 km is followed by a lighter week before another peak. This product rule adds recovery between the largest outings while retaining the prior build baseline.',
          ]
        : []),
    ],
  };
  for (let index = 0; index < count; index++) {
    const weekStart = addDays(start, index * 7),
      age = index - clockStart - extra;
    const reviewing = !!replan && index === reviewWeek;
    if (reviewing) {
      anchorWeekly = floorMetres(
        Math.min(
          replan!.baseline.weeklyKm,
          replan!.baseline.weeklyMinutes / pace,
        ),
      );
      anchorLong = floorMetres(
        Math.min(
          replan!.baseline.longestKm,
          (replan!.baseline.longestMinutes ??
            replan!.baseline.longestKm * pace) / pace,
        ),
      );
      anchorLong = Math.min(anchorLong, anchorWeekly);
    }
    const days = [...p.days].sort((a, b) => a - b);
    const dates = days.map((d) => addDays(weekStart, d));
    const preTaper = dates.some(
      (d) => d < p.raceDate && firstRaceTaperFactor(p, d) === 1,
    );
    const tapering = dates.some(
      (d) =>
        d >= p.startDate && d < p.raceDate && firstRaceTaperFactor(p, d) < 1,
    );
    const afterMarathonPeak =
      p.goal === 'marathon' &&
      index > firstFull &&
      anchorLong >= 32000 &&
      [...plan.workouts, ...(replan?.retainedPrefix ?? [])].some((w) => {
        const date = w.feedback?.actualDate ?? w.date;
        const km =
          w.status === 'completed'
            ? (w.feedback?.actualKm ?? 0)
            : w.estimatedKm;
        return (
          w.kind === 'long' &&
          w.status !== 'skipped' &&
          monday(date) === addDays(weekStart, -7) &&
          firstRaceTaperFactor(p, date) === 1 &&
          km >= 32
        );
      });
    const recovery =
      preTaper &&
      !tapering &&
      (afterMarathonPeak ||
        (age > 0 &&
          age % (p.recoveryWeeks ?? 4) === (p.recoveryWeeks ?? 4) - 1));
    const phase: Week['phase'] =
      monday(p.raceDate) === weekStart
        ? 'Race week'
        : !preTaper || tapering
          ? 'Taper'
          : recovery
            ? 'Recovery'
            : age <= 0
              ? 'Foundation'
              : 'Build';
    if (
      age > 0 &&
      !recovery &&
      preTaper &&
      !tapering &&
      !reviewing &&
      (!replan || index > reviewWeek)
    ) {
      const nextWeekly =
        p.volume === 'maintain'
          ? anchorWeekly
          : Math.min(
              Math.floor((anchorWeekly * 1.1) / 100) * 100,
              volumeCapacity,
              metres(Math.max(p.weeklyKm, policy.peakWeeklyKm)),
            );
      anchorWeekly = Math.max(anchorWeekly, nextWeekly);
      const step =
        profile.goal === 'marathon' && anchorLong >= 20000
          ? 3000
          : policy.longStepKm * 1000;
      const funded = Math.min(
        anchorLong + step,
        longCapacity,
        metres(Math.max(p.longestKm, policy.targetLongKm)),
        Math.floor(anchorWeekly * 0.5),
        anchorWeekly - minimum * supportDays.length,
      );
      if (p.volume !== 'maintain')
        anchorLong = Math.max(anchorLong, Math.floor(funded / 1000) * 1000);
      anchorWeekly = Math.min(
        anchorWeekly,
        supportCaps.reduce(
          (total, cap) => total + Math.min(cap, anchorLong),
          anchorLong,
        ),
      );
    }
    let weekly = Math.min(anchorWeekly, volumeCapacity),
      long = Math.min(anchorLong, longCapacity);
    if (recovery) {
      weekly = Math.floor((weekly * 0.8) / 100) * 100;
      long = Math.min(
        long,
        Math.max(minimum, Math.floor((long * 0.75) / 1000) * 1000),
      );
    }
    const weekSupportCaps = supportCaps.map((cap) => Math.min(cap, long));
    weekly = Math.min(
      weekly,
      weekSupportCaps.reduce((total, cap) => total + cap, long),
    );
    long = Math.min(long, Math.max(0, weekly - minimum * supportDays.length));
    // Small reviewed baselines can fall below entry requirements. Keep the
    // reduced forecast without manufacturing the old minimum workload.
    let supports = distribute(
      Math.max(0, weekly - long),
      weekSupportCaps,
      minimum,
    );
    if (!supports && replan) {
      weekly = Math.min(
        weekly,
        long + weekSupportCaps.reduce((a, b) => a + b, 0),
      );
      supports = distribute(Math.max(0, weekly - long), weekSupportCaps, 0);
    }
    if (!supports)
      throw new PlanError(
        'The weekly allocation cannot fit the selected easy-run limits while preserving its long-run anchor.',
      );
    const distanceByDay = new Map(supportDays.map((d, i) => [d, supports![i]]));
    distanceByDay.set(p.longDay, long);
    const rows: Workout[] = [];
    for (const date of dates) {
      if (
        date < p.startDate ||
        date >= p.raceDate ||
        (replan && date < replan.from)
      )
        continue;
      const taper = firstRaceTaperFactor(p, date);
      if (!taper) continue;
      const distance = Math.floor(distanceByDay.get(weekday(date))! * taper);
      if (distance < minimum) continue;
      const sessionPhase =
        taper < 1
          ? dayDiff(date, p.raceDate) < 7
            ? 'Race week'
            : 'Taper'
          : phase;
      rows.push(
        workout(
          p,
          date,
          index,
          distance / 1000,
          weekday(date) === p.longDay && dayDiff(date, p.raceDate) >= 7
            ? 'long'
            : 'easy',
          sessionPhase,
        ),
      );
    }
    const reserved = (replan?.retainedPrefix ?? []).filter(
      (w) =>
        w.kind !== 'race' &&
        w.status !== 'skipped' &&
        monday(w.feedback?.actualDate ?? w.date) === weekStart,
    );
    const reservedKm = reserved.reduce(
      (n, w) =>
        n +
        (w.status === 'completed'
          ? (w.feedback?.actualKm ?? w.estimatedKm)
          : w.estimatedKm),
      0,
    );
    const reservedMinutes = reserved.reduce(
      (n, w) => n + (w.feedback?.actualMinutes ?? w.minutes),
      0,
    );
    let availableKm = Math.max(0, weekly / 1000 - reservedKm);
    let availableMinutes = Math.max(
      0,
      (p.weeklyMinutesLimit ?? Infinity) - reservedMinutes,
    );
    // Reserve the familiar long slot first; replan remainder cannot replace
    // already completed running with new hypothetical budget.
    rows.sort(
      (a, b) =>
        Number(b.kind === 'long') - Number(a.kind === 'long') ||
        a.date.localeCompare(b.date),
    );
    for (let row of rows) {
      const fitted = Math.min(
        metres(row.estimatedKm),
        floorMetres(availableKm),
        floorMetres(availableMinutes / pace),
      );
      if (fitted < minimum) continue;
      if (fitted < metres(row.estimatedKm)) {
        if (!replan && age <= 0 && firstRaceTaperFactor(p, row.date) === 1)
          throw new PlanError(
            'The exact opening distances exceed the weekly time limit after rounding to executable seconds.',
          );
        row = workout(
          p,
          row.date,
          index,
          fitted / 1000,
          row.kind as 'easy' | 'long',
          phase,
        );
      }
      if (row.minutes > availableMinutes + 0.001) {
        if (!replan && age <= 0)
          throw new PlanError(
            'Allow enough weekly time for the exact opening distances.',
          );
        continue;
      }
      availableKm -= row.estimatedKm;
      availableMinutes -= row.minutes;
      plan.workouts.push(row);
    }
    plan.weeks.push({
      index,
      start: weekStart,
      phase,
      targetKm: 0,
      longKm: 0,
      focus:
        phase === 'Recovery'
          ? 'A deliberate lighter week; retain easy effort and familiar running.'
          : ['Taper', 'Race week'].includes(phase)
            ? 'Reduce familiar easy running before the actual event date.'
            : 'Build easy endurance from your declared routine; all running remains conversational.',
    });
  }
  const raceIndex = Math.floor(dayDiff(start, p.raceDate) / 7);
  plan.workouts.push(
    workout(
      p,
      p.raceDate,
      raceIndex,
      raceKm[profile.goal],
      'race',
      'Race week',
    ),
  );
  plan.workouts.sort((a, b) => a.date.localeCompare(b.date));
  const timeError = applyPreferredStartTimes(plan.workouts, p);
  if (timeError) throw new PlanError(timeError);
  refreshWeekTotals(plan);
  plan.feasibility = firstRaceFeasibility(plan, asOf);
  const issues = validatePlan(plan, replan?.retainedPrefix);
  if (issues.length) throw new PlanError(issues[0]);
  return plan;
}

export function firstRaceFeasibility(
  plan: Plan,
  asOf: string,
): Plan['feasibility'] {
  if (!plan.firstRace) return plan.feasibility;
  if (plan.feasibility?.status === 'event-deferred') return plan.feasibility;
  const policy = FIRST_RACE_POLICY[plan.firstRace.goal],
    reasons: string[] = [];
  const duration = dayDiff(plan.profile.startDate, plan.profile.raceDate) + 1;
  if (duration < policy.weeks * 7)
    reasons.push(
      `This first-race model allows at least ${policy.weeks} weeks; ${duration} calendar days are available. The short block is not a compressed substitute for the missing preparation.`,
    );
  const rows = plan.workouts.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.status !== 'skipped',
  );
  const evidence = rows.map((w) => ({
    w,
    date: w.feedback?.actualDate ?? w.date,
    km:
      w.status === 'completed' && (w.feedback?.actualDate ?? w.date) <= asOf
        ? (w.feedback?.actualKm ?? 0)
        : w.status === 'planned' && w.date >= asOf
          ? w.estimatedKm
          : 0,
  }));
  const longs = evidence.filter(
    ({ w, date }) =>
      w.kind === 'long' &&
      dayDiff(date, plan.profile.raceDate) >= policy.taperDays,
  );
  const peak = Math.max(0, ...longs.map((r) => r.km));
  if (peak + 0.001 < policy.minimumPeakKm)
    reasons.push(
      `Recorded distance and remaining planned long runs reach ${Number(peak.toFixed(2))} km before taper; this first-race policy needs at least ${policy.minimumPeakKm} km of preparation exposure. Review the event date, current base and session limits.`,
    );
  const repeatedLongs = new Set(
    longs
      .filter((r) => r.km + 0.001 >= policy.minimumPeakKm * 0.8)
      .map((r) => monday(r.date)),
  ).size;
  const supportWeeks = plan.weeks.filter((week) => {
    const runs = evidence.filter(
      (r) =>
        monday(r.date) === week.start &&
        r.km > 0 &&
        firstRaceTaperFactor(plan.profile, r.date) === 1,
    );
    return (
      new Set(runs.map((r) => r.date)).size >= plan.profile.days.length &&
      runs.reduce((n, r) => n + r.km, 0) + 0.001 >= policy.supportWeeklyKm
    );
  }).length;
  if (repeatedLongs < 2 || supportWeeks < 2)
    reasons.push(
      `The emitted plan provides ${repeatedLongs} substantial long-run weeks and ${supportWeeks} supporting weeks of at least ${policy.supportWeeklyKm} km. This preparation screen needs two of each; a single peak does not establish a repeatable routine.`,
    );
  const unknown = rows.filter(
    (w) =>
      (w.status === 'planned' && w.date < asOf) ||
      (w.status === 'completed' && w.feedback?.actualKm == null),
  ).length;
  // A distant prescribed peak cannot overrule recent evidence that the current
  // routine was missed or was not tolerated. Reuse the return-review thresholds;
  // this flags a review, and never invents completed work or catch-up mileage.
  const recentFrom = addDays(
    asOf,
    -RETURN_TRAINING_POLICY.suggestionWindowDays,
  );
  const missing = plan.workouts.filter(
    (w) =>
      w.week >= 0 &&
      w.kind !== 'race' &&
      w.date >= recentFrom &&
      w.date < asOf &&
      ['planned', 'skipped'].includes(w.status),
  );
  if (missing.length >= RETURN_TRAINING_POLICY.suggestionTriggerRuns)
    reasons.push(
      `${missing.length} recent sessions are skipped or overdue without a log. Review the running routine before relying on the remaining first-race progression; an unlogged run is unknown, not completed training.`,
    );
  const recent = trainingRecords(plan)
    .filter((r) => r.date >= recentFrom && r.date <= asOf)
    .slice(0, RETURN_TRAINING_POLICY.suggestionSampleRuns);
  const fatigued = recent.filter(
    (r) =>
      r.feeling === 'tired' ||
      (r.expectedEasy && r.effort >= RETURN_TRAINING_POLICY.fatigueEffort),
  );
  if (fatigued.length >= RETURN_TRAINING_POLICY.suggestionTriggerRuns)
    reasons.push(
      'At least two of the last three recorded runs show tiredness or unexpectedly high effort on an easy day. Review recovery before continuing the first-race build; future long-run targets do not establish that the present load is comfortable.',
    );
  const incomplete = recent.filter((r) => {
    const w = r.workoutId
      ? plan.workouts.find((w) => w.id === r.workoutId && w.kind !== 'race')
      : undefined;
    if (!w) return false;
    return (
      ['partial', 'not-attempted'].includes(w.feedback?.execution ?? '') ||
      r.minutes < w.minutes * RETURN_TRAINING_POLICY.returnCompletionFraction ||
      (r.km != null &&
        r.km < w.estimatedKm * RETURN_TRAINING_POLICY.returnCompletionFraction)
    );
  });
  if (incomplete.length >= RETURN_TRAINING_POLICY.suggestionTriggerRuns)
    reasons.push(
      'At least two of the last three recorded runs were partial or substantially shorter than prescribed. Review the actual weekly and long-run baseline before relying on the remaining first-race progression.',
    );
  if (unknown && reasons.length)
    reasons.push(
      `${unknown} past sessions are unlogged or have no measured distance. Calendar prescriptions and duration estimates do not establish completed mileage; no catch-up running is added.`,
    );
  if (plan.returnState && plan.returnState.stage < 3)
    reasons.push(
      'Complete the current return review before treating this first-race forecast as adequate preparation.',
    );
  return {
    status: reasons.length ? 'review-required' : 'forecast',
    asOf,
    reasons: reasons.length
      ? reasons
      : [
          'The remaining forecast meets this first-race preparation screen if completed comfortably. It is not a prediction or guarantee of race readiness.',
        ],
    checks: reasons.map((message) => ({
      code: 'training-exposure' as const,
      message,
    })),
  };
}
