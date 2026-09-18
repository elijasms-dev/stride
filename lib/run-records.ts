import type { Plan, ExtraRun, Workout } from './plan/types.ts';

// Canonical actual-running ledger; no runtime dependency on plan generation.
export function recordedWorkoutDate(workout: Workout) {
  return workout.status === 'completed'
    ? (workout.feedback?.actualDate ?? workout.date)
    : workout.date;
}
export type RunRecord = ExtraRun & {
  workoutId?: string;
  expectedEasy?: boolean;
  prescribedMinutes?: number;
};
export function trainingRecords(
  plan: Pick<Plan, 'workouts' | 'extraRuns'>,
): RunRecord[] {
  const candidates: RunRecord[] = [
    ...plan.workouts
      .filter((w) => w.status === 'completed' && w.feedback)
      .map((w) => ({
        id: w.id,
        workoutId: w.id,
        date: recordedWorkoutDate(w),
        minutes: w.feedback!.actualMinutes,
        km: w.feedback!.actualKm,
        effort: w.feedback!.effort,
        feeling: w.feedback!.feeling,
        note: w.feedback!.note,
        activityId: w.feedback!.activityId,
        source: w.feedback!.source,
        recordedAt: w.feedback!.recordedAt,
        expectedEasy: !w.hard,
        prescribedMinutes: w.minutes,
      })),
    ...(plan.extraRuns ?? []),
  ];
  const external = new Set<string>(),
    ids = new Set<string>();
  return candidates
    .filter((r) => {
      if (ids.has(r.id) || (r.activityId && external.has(r.activityId)))
        return false;
      ids.add(r.id);
      if (r.activityId) external.add(r.activityId);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
