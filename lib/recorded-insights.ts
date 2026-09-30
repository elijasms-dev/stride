import { addDays } from './plan/calendar.ts';
import type { Plan } from './plan/types.ts';
import { trainingRecords } from './run-records.ts';
import { qualityTrainingEvidence } from './training-evidence.ts';
import { recordedHeartRate } from './recorded-heart-rate.ts';

/** Observations from four completed seven-day periods, never inferred training. */
export function recordedTrainingInsights(plan: Plan, today: string) {
  const start = addDays(today, -28);
  const end = addDays(today, -1);
  const records = trainingRecords(plan).filter(
    (record) => record.date >= start && record.date <= end,
  );
  const distances = records.filter(
    (record) => Number.isFinite(record.km) && record.km! >= 0,
  );
  const timed = records.filter(
    (record) => Number.isFinite(record.minutes) && record.minutes >= 0,
  );
  const rated = records.filter(
    (record) =>
      Number.isInteger(record.effort) &&
      record.effort >= 1 &&
      record.effort <= 10,
  );
  const feelings = {
    good: records.filter((record) => record.feeling === 'good').length,
    okay: records.filter((record) => record.feeling === 'okay').length,
    tired: records.filter((record) => record.feeling === 'tired').length,
  };
  const heartRates = records.map((record) => ({
    date: record.date,
    ...recordedHeartRate(record),
  }));
  const averageRates = heartRates.flatMap((record) =>
    record.averageHeartRate === undefined ? [] : [record.averageHeartRate],
  );
  const highestRate = heartRates.reduce<{ bpm: number; date: string } | null>(
    (highest, record) =>
      record.maxHeartRate !== undefined &&
      (!highest || record.maxHeartRate > highest.bpm)
        ? { bpm: record.maxHeartRate, date: record.date }
        : highest,
    null,
  );
  const periods = Array.from({ length: 4 }, (_, index) => {
    const from = addDays(start, index * 7);
    const to = addDays(from, 6);
    const runs = records.filter(
      (record) => record.date >= from && record.date <= to,
    );
    const known = distances.filter(
      (record) => record.date >= from && record.date <= to,
    );
    const knownTimes = timed.filter(
      (record) => record.date >= from && record.date <= to,
    );
    return {
      from,
      to,
      runs: runs.length,
      days: new Set(runs.map((record) => record.date)).size,
      km: known.length
        ? known.reduce((sum, record) => sum + record.km!, 0)
        : null,
      minutes: knownTimes.length
        ? knownTimes.reduce((sum, record) => sum + record.minutes, 0)
        : null,
      missingDistances: runs.length - known.length,
      missingTimes: runs.length - knownTimes.length,
    };
  });
  const canonicalIds = new Set(records.map((record) => record.workoutId));
  const quality = qualityTrainingEvidence(plan.workouts, today, start).filter(
    ({ workout }) => canonicalIds.has(workout.id),
  );
  const qualityMinutes = quality.filter(
    ({ workout }) =>
      Number.isFinite(workout.feedback?.completedQualityMinutes) &&
      workout.feedback!.completedQualityMinutes! >= 0,
  );
  const missingExecution = quality.filter(
    ({ workout }) =>
      !workout.feedback?.execution || workout.feedback.execution === 'unknown',
  );
  const due = plan.workouts.filter(
    (workout) =>
      workout.week >= 0 && workout.date >= start && workout.date <= end,
  );
  return {
    start,
    end,
    records,
    periods,
    recordedDays: new Set(records.map((record) => record.date)).size,
    recordedWeeks: periods.filter((period) => period.runs > 0).length,
    km: distances.length
      ? distances.reduce((sum, record) => sum + record.km!, 0)
      : null,
    minutes: timed.length
      ? timed.reduce((sum, record) => sum + record.minutes, 0)
      : null,
    missingDistances: records.length - distances.length,
    missingTimes: records.length - timed.length,
    longest: distances.reduce<(typeof distances)[number] | null>(
      (longest, record) =>
        !longest || record.km! > longest.km! ? record : longest,
      null,
    ),
    effort: {
      count: rated.length,
      mean: rated.length
        ? rated.reduce((sum, record) => sum + record.effort, 0) / rated.length
        : null,
      distribution: Array.from(
        { length: 10 },
        (_, index) =>
          rated.filter((record) => record.effort === index + 1).length,
      ),
    },
    feelings,
    feelingCount: feelings.good + feelings.okay + feelings.tired,
    heartRate: {
      count: heartRates.filter(
        (record) =>
          record.averageHeartRate !== undefined ||
          record.maxHeartRate !== undefined,
      ).length,
      averageCount: averageRates.length,
      averageLow: averageRates.length ? Math.min(...averageRates) : null,
      averageHigh: averageRates.length ? Math.max(...averageRates) : null,
      highest: highestRate,
    },
    quality: {
      count: quality.length,
      asPlanned: quality.filter(
        ({ workout }) => workout.feedback?.execution === 'as-planned',
      ).length,
      changed: quality.filter(({ workout }) =>
        ['partial', 'easy-substitute', 'not-attempted'].includes(
          workout.feedback?.execution ?? '',
        ),
      ).length,
      missingExecution: missingExecution.map(({ workout }) => workout),
      knownMinutes: qualityMinutes.length
        ? qualityMinutes.reduce(
            (sum, { workout }) =>
              sum + workout.feedback!.completedQualityMinutes!,
            0,
          )
        : null,
      missingMinutes: quality.length - qualityMinutes.length,
    },
    scheduled: {
      count: due.length,
      completed: due.filter((workout) => workout.status === 'completed').length,
      skipped: due.filter((workout) => workout.status === 'skipped').length,
      unlogged: due.filter((workout) => workout.status === 'planned').length,
    },
  };
}
