import { createHash } from 'node:crypto';

/** Exact executable training content, independent of identity, target provenance,
 * descriptive copy and derived display ranges. Those stay covered by the new
 * full snapshot; this projection protects the previously approved prescription. */
export function marathonExecution(plan) {
  return {
    profile: plan.profile,
    weeks: plan.weeks.map(
      ({
        index,
        start,
        phase,
        targetKm,
        longKm,
        raceKm,
        trainingMinutes,
        qualityMinutes,
      }) => ({
        index,
        start,
        phase,
        targetKm,
        longKm,
        raceKm,
        trainingMinutes,
        qualityMinutes,
      }),
    ),
    workouts: plan.workouts.map((w) => ({
      date: w.date,
      originalDate: w.originalDate,
      week: w.week,
      kind: w.kind,
      status: w.status,
      hard: w.hard,
      minutes: w.minutes,
      estimatedKm: w.estimatedKm,
      templateId: w.templateId,
      stimulus: w.stimulus,
      qualityMinutes: w.qualityMinutes ?? 0,
      pairType: w.pairType,
      session: w.session,
      steps: w.steps.map(
        ({
          seconds,
          metres,
          intensity,
          kind,
          movement,
          planningPaceSecondsPerKm,
          target,
        }) => ({
          seconds,
          metres,
          intensity,
          kind,
          movement,
          planningPaceSecondsPerKm,
          target: target
            ? { mode: target.mode, low: target.low, high: target.high }
            : undefined,
        }),
      ),
    })),
  };
}

export function marathonExecutionHash(plan) {
  return createHash('sha256')
    .update(JSON.stringify(marathonExecution(plan)))
    .digest('hex');
}
