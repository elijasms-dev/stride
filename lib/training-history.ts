import { recordedWorkoutDate, trainingRecords } from './run-records.ts';
export {
  recordedWorkoutDate,
  trainingRecords,
  type RunRecord,
} from './run-records.ts';
import { isLongUltra } from './ultra-policy.ts';
import {
  addDays,
  dayDiff,
  round,
  todayInZone,
  type Plan,
  type Workout,
} from './engine.ts';
export function recordingCandidates(workouts: Workout[], date: string) {
  return workouts.filter(
    (w) =>
      recordedWorkoutDate(w) === date &&
      w.status !== 'skipped' &&
      !w.feedback?.activityId,
  );
}
export function workloadSummary(
  plan: Plan,
  asOf = todayInZone(plan.profile.timezone),
) {
  const records = trainingRecords(plan);
  const start = addDays(asOf, -28),
    end = addDays(asOf, -1);
  const recent = records.filter((r) => r.date >= start && r.date <= end);
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const from = addDays(start, i * 7),
      to = addDays(from, 6),
      runs = recent.filter((r) => r.date >= from && r.date <= to);
    const due = plan.workouts.filter(
      (w) => w.week >= 0 && w.date >= from && w.date <= to,
    );
    return {
      from,
      to,
      runs: runs.length,
      km: round(runs.reduce((n, r) => n + (r.km ?? 0), 0)),
      minutes: round(runs.reduce((n, r) => n + r.minutes, 0)),
      plannedMinutes: due.reduce((n, w) => n + w.minutes, 0),
      unknownDistances: runs.filter((r) => r.km === null).length,
    };
  });
  const last30 = records.filter(
    (r) => r.date >= addDays(asOf, -29) && r.date <= asOf,
  );
  const totalMinutes = recent.reduce((n, r) => n + r.minutes, 0),
    totalKm = recent.reduce((n, r) => n + (r.km ?? 0), 0);
  const fatigue = records
    .filter((r) => r.date >= addDays(asOf, -13) && r.date <= asOf)
    .filter((r) => r.feeling === 'tired' || (r.expectedEasy && r.effort >= 7));
  const unlogged = plan.workouts.filter(
    (w) =>
      w.week >= 0 &&
      w.status === 'planned' &&
      w.date < asOf &&
      w.date >= addDays(asOf, -13),
  );
  const missingDistance = recent.some((r) => r.km === null);
  const evidenceSpan = records.length
    ? Math.max(0, dayDiff(records.at(-1)!.date, asOf) + 1)
    : 0;
  return {
    start,
    end,
    weeks,
    recent,
    records,
    totalMinutes: round(totalMinutes),
    totalKm: round(totalKm),
    averageWeeklyKm: missingDistance ? null : round(totalKm / 4),
    averageWeeklyRuns: round(recent.length / 4),
    longestKm: Math.max(0, ...last30.map((r) => r.km ?? 0)),
    missingDistance,
    evidenceSpan,
    recordedLoad: round(recent.reduce((n, r) => n + r.minutes * r.effort, 0)),
    fatigue,
    unlogged,
    today: records.filter((r) => r.date === asOf),
    canReviewBaseline:
      recent.length >= 8 && weeks.every((w) => w.runs > 0) && !missingDistance,
  };
}

/** Evidence has a denominator: unlogged prescriptions are unknown, never automatic rest. */
export function currentTrainingBaseline(plan: Plan, asOf: string) {
  const start = [plan.profile.startDate, addDays(asOf, -28)].sort().at(-1)!;
  const elapsed = Math.max(1, dayDiff(start, asOf));
  const due = plan.workouts.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.date >= start && w.date < asOf,
  );
  const resolved = due.filter(
    (w) => w.status === 'completed' || w.status === 'skipped',
  );
  const allRecords = trainingRecords(plan);
  const records = allRecords.filter((r) => r.date >= start && r.date < asOf);
  const coverage = due.length ? resolved.length / due.length : 0;
  const enough = elapsed >= 14 && due.length >= 6 && coverage >= 0.8;
  const declaredKm =
    (plan.baselineEvidence?.weeklyKm ??
      plan.profile.weeklyKm *
        Math.min(
          1,
          plan.profile.days.length / Math.max(1, plan.profile.currentRuns),
        )) ||
    5;
  const declaredMinutes =
    plan.baselineEvidence?.weeklyMinutes ??
    Math.min(
      declaredKm * (plan.profile.easyPace ?? 7),
      isLongUltra(plan.profile)
        ? (plan.profile.ultraWeeklyMinutes ?? Infinity) *
            Math.min(
              1,
              plan.profile.days.length / Math.max(1, plan.profile.currentRuns),
            )
        : Infinity,
    );
  const observedMinutes =
    (records.reduce((n, r) => n + r.minutes, 0) * 7) / elapsed;
  const observedKm = records.some((r) => r.km === null)
    ? null
    : (records.reduce((n, r) => n + (r.km ?? 0), 0) * 7) / elapsed;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[1] + sorted[2]) / 2;
  };
  const buckets = Array.from({ length: 4 }, (_, i) =>
    records.filter(
      (r) =>
        r.date >= addDays(asOf, -28 + i * 7) &&
        r.date < addDays(asOf, -21 + i * 7),
    ),
  );
  // Today's feedback can hold an increase; an incomplete day cannot establish capacity.
  const fatigue = allRecords.filter(
    (r) =>
      r.date >= addDays(asOf, -14) &&
      r.date <= asOf &&
      (r.feeling === 'tired' || (r.expectedEasy && r.effort >= 7)),
  );
  const raceIds = new Set(
    plan.workouts.filter((w) => w.kind === 'race').map((w) => w.id),
  );
  const capacityBuckets = buckets.map((rows) =>
    rows.filter((r) => !r.workoutId || !raceIds.has(r.workoutId)),
  );
  const strong =
    elapsed >= 28 &&
    coverage >= 0.9 &&
    records.length >= 8 &&
    capacityBuckets.every((rows) => rows.length >= 2) &&
    !fatigue.length &&
    !(plan.returnState && plan.returnState.stage < 3);
  const repeatedMinutes = strong
    ? median(
        capacityBuckets.map((rows) => rows.reduce((n, r) => n + r.minutes, 0)),
      )
    : 0;
  const repeatedKm =
    strong && !records.some((r) => r.km === null)
      ? median(
          capacityBuckets.map((rows) =>
            rows.reduce((n, r) => n + (r.km ?? 0), 0),
          ),
        )
      : null;
  // Two different weeks must support long-session capacity; one exceptional run is not a new baseline.
  const comfortable = capacityBuckets.map((rows) =>
    rows.filter((r) => r.feeling !== 'tired' && r.effort <= 6),
  );
  const repeatedLongKm =
    comfortable
      .map((rows) => Math.max(0, ...rows.map((r) => r.km ?? 0)))
      .sort((a, b) => b - a)[1] || 0;
  const repeatedLongMinutes =
    comfortable
      .map((rows) => Math.max(0, ...rows.map((r) => r.minutes)))
      .sort((a, b) => b - a)[1] || 0;
  const weeklyMinutes = strong
    ? repeatedMinutes
    : enough
      ? Math.min(declaredMinutes, observedMinutes)
      : declaredMinutes;
  const weeklyKm =
    strong && repeatedKm !== null
      ? repeatedKm
      : enough
        ? Math.min(
            declaredKm,
            observedKm ?? weeklyMinutes / (plan.profile.easyPace ?? 7),
          )
        : declaredKm;
  const priorLong = plan.baselineEvidence?.longestKm ?? plan.profile.longestKm;
  const priorLongMinutes =
    plan.baselineEvidence?.longestMinutes ??
    Math.min(
      priorLong * (plan.profile.easyPace ?? 7),
      isLongUltra(plan.profile)
        ? (plan.profile.ultraLongestMinutes ?? Infinity)
        : Infinity,
    );
  const longestKm =
    strong && repeatedKm !== null
      ? repeatedLongKm
      : enough
        ? Math.min(
            priorLong,
            Math.max(
              0,
              ...records.map(
                (r) => r.km ?? r.minutes / (plan.profile.easyPace ?? 7),
              ),
            ),
          )
        : priorLong;
  return {
    from: start,
    asOf,
    coverage: Math.round(coverage * 100),
    known: resolved.length,
    due: due.length,
    weeklyKm: round(Math.max(1, weeklyKm), 3),
    weeklyMinutes: round(Math.max(7, weeklyMinutes)),
    longestKm: round(Math.max(1, longestKm), 3),
    source: enough
      ? ('recorded-plan-history' as const)
      : ('declared-baseline' as const),
    supportsProgression:
      strong &&
      due.filter(
        (w) =>
          w.status === 'completed' &&
          w.feedback &&
          w.feedback.actualMinutes >= w.minutes * 0.9,
      ).length >=
        due.length * 0.9 &&
      repeatedMinutes >= declaredMinutes * 0.9 &&
      repeatedLongMinutes >= priorLongMinutes * 0.9,
    longestMinutes: strong
      ? repeatedLongMinutes
      : Math.min(priorLongMinutes, longestKm * (plan.profile.easyPace ?? 7)),
    explanation: fatigue.length
      ? 'Recent running, including today, includes tired feedback or unexpectedly high effort on an easy run. Hold increases and review recovery; today’s distance and time do not establish a higher baseline.'
      : strong
        ? 'Four well-recorded weeks support the median weekly workload and a long session repeated across separate weeks. Original declarations remain unchanged; these observations do not prove fitness or capture all outside running.'
        : enough
          ? 'Recent resolved running supports a cautious reduction or hold. One large run, fatigue or partial recording does not establish increased capacity.'
          : 'Recent history is incomplete. Unknown sessions are not assumed completed or rested; future changes cannot advance beyond the last declared baseline.',
  };
}
