import type { Plan } from './plan/types.ts';
import { addDays } from './plan/calendar.ts';
import { trainingRecords } from './run-records.ts';
import { qualityTrainingEvidence } from './training-evidence.ts';

/** Review saved prescriptions against canonical actual records; no training changes. */
export function weeklyTrainingReview(
  plan: Plan,
  weekIndex: number,
  asOf: string,
) {
  const week = plan.weeks.find((w) => w.index === weekIndex);
  if (!week || week.start > asOf) return null;
  const start = week.start;
  const end = addDays(start, 6);
  const through = asOf < end ? asOf : end;
  const races = plan.workouts.filter((w) => w.kind === 'race');
  const raceIds = new Set(races.map((w) => w.id));
  const raceActivities = new Set(
    races.flatMap((w) =>
      w.feedback?.activityId ? [w.feedback.activityId] : [],
    ),
  );
  const prescribed = plan.workouts.filter(
    (w) => w.week >= 0 && w.kind !== 'race' && w.date >= start && w.date <= end,
  );
  const records = trainingRecords(plan).filter(
    (r) =>
      r.date >= start &&
      r.date <= through &&
      !raceIds.has(r.workoutId ?? '') &&
      !(r.activityId && raceActivities.has(r.activityId)),
  );
  const unresolved = prescribed.filter(
    (w) => w.status === 'planned' && w.date < asOf,
  );
  const missingFeedback = prescribed.filter(
    (w) => w.status === 'completed' && !w.feedback && w.date <= through,
  );
  const quality = qualityTrainingEvidence(
    plan.workouts,
    addDays(through, 1),
    start,
  ).filter(
    ({ workout }) =>
      !raceIds.has(workout.id) &&
      !(
        workout.feedback?.activityId &&
        raceActivities.has(workout.feedback.activityId)
      ),
  );
  const unknownDistances = records.filter((r) => r.km === null).length;
  const tired = records.filter(
    (r) => r.feeling === 'tired' || (r.expectedEasy && r.effort >= 7),
  ).length;
  return {
    start,
    end,
    through,
    finished: asOf > end,
    prescribedMinutes: prescribed
      .filter((w) => w.status !== 'skipped')
      .reduce((n, w) => n + w.minutes, 0),
    prescribedKm: prescribed
      .filter((w) => w.status !== 'skipped')
      .reduce((n, w) => n + w.estimatedKm, 0),
    records,
    recordedMinutes: records.reduce((n, r) => n + r.minutes, 0),
    knownKm: records.reduce((n, r) => n + (r.km ?? 0), 0),
    unknownDistances,
    unresolved,
    missingFeedback,
    skipped: prescribed.filter((w) => w.status === 'skipped').length,
    quality,
    qualityComplete: quality.filter((r) =>
      ['reported-complete', 'recovery-hold'].includes(r.status),
    ).length,
    tired,
    nextStep:
      unresolved.length || missingFeedback.length
        ? 'Review the missing records before changing your plan. Unlogged sessions are unknown; they are not counted as completed running or rest.'
        : tired
          ? 'Recent feedback includes tired running or a hard-feeling easy run. Review your recovery before requesting more training.'
          : records.length
            ? 'Your recorded running is available for your next plan review. Pace, mileage and workout frequency only change through their reviewed controls.'
            : 'Log a run or review a recording from your watch to start comparing your plan with what you ran.',
  };
}
