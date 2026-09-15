import { type Workout } from './plan/types.ts';
import { recordedWorkoutDate, trainingRecords } from './training-history.ts';
import { qualityWorkMinutes } from './prescription.ts';
import { validStepTarget } from './workout-targets.ts';

/** Completion evidence follows the saved executable target. Scheduling still
 * uses conservative planning seconds; never rewrite the prescription from feedback.
 */
export function executableQualityMinutes(workout: Workout) {
  return workout.steps
    .filter(
      (s) =>
        s.kind === 'work' && s.intensity >= 4 && workout.stimulus !== 'aerobic',
    )
    .reduce(
      (n, step) =>
        n +
        (Number.isFinite(step.metres) &&
        step.metres! > 0 &&
        validStepTarget(step.target) &&
        step.target.mode === 'pace'
          ? Math.min(step.seconds, (step.metres! * step.target.low) / 1000)
          : step.seconds) /
          60,
      0,
    );
}

/** Preserve the journal's canonical recording identity and original prescription. */
export function canonicalCompletedWorkouts(workouts: Workout[]): Workout[] {
  const originals = new Map<string, Workout>();
  for (const w of workouts)
    if (w.status === 'completed' && w.feedback && !originals.has(w.id))
      originals.set(w.id, w);
  return trainingRecords({ workouts })
    .map((r) => originals.get(r.workoutId!)!)
    .sort((a, b) =>
      recordedWorkoutDate(a).localeCompare(recordedWorkoutDate(b)),
    );
}

export type QualityEvidenceStatus =
  | 'reported-complete'
  | 'execution-unknown'
  | 'dose-unknown'
  | 'feedback-unknown'
  | 'partial'
  | 'easy-substitute'
  | 'not-attempted'
  | 'below-dose'
  | 'recovery-hold';

/** Actual prior-day evidence, never a scheduled date or a total-duration inference. */
export function qualityTrainingEvidence(
  workouts: Workout[],
  asOf: string,
  from?: string,
) {
  return canonicalCompletedWorkouts(workouts)
    .filter((w) => {
      const date = recordedWorkoutDate(w);
      return (
        date < asOf &&
        (!from || date >= from) &&
        w.kind !== 'race' &&
        (w.hard || w.stimulus === 'economy') &&
        qualityWorkMinutes(w) > 0
      );
    })
    .map((workout) => {
      const f = workout.feedback!;
      let status: QualityEvidenceStatus;
      if (!f.execution || f.execution === 'unknown')
        status = 'execution-unknown';
      else if (f.execution !== 'as-planned') status = f.execution;
      else if (!Number.isFinite(f.completedQualityMinutes))
        status = 'dose-unknown';
      else if (
        !Number.isInteger(f.effort) ||
        f.effort < 1 ||
        !['good', 'okay', 'tired'].includes(f.feeling)
      )
        status = 'feedback-unknown';
      else if (
        f.completedQualityMinutes! <
        executableQualityMinutes(workout) * 0.9
      )
        status = 'below-dose';
      else if (f.feeling === 'tired' || f.effort > 7) status = 'recovery-hold';
      else status = 'reported-complete';
      return {
        workout,
        date: recordedWorkoutDate(workout),
        status,
        eligible: status === 'reported-complete',
      };
    });
}
