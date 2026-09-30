import { addDays, monday } from './plan/calendar.ts';
import type { Plan } from './plan/types.ts';
import { journalEntries, journalSummary } from './journal-view.ts';
import { planWeekPhase } from './plan-explorer.ts';
import { workoutDistanceValue } from './plan/display.ts';

function completeTotal(values: (number | null)[]) {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + value!, 0);
}

/** The chart compares saved prescriptions with actual-date journal records.
 * Missing measurements remain null, including weeks with no logged runs. */
export function progressChartWeeks(plan: Plan, today: string, showPlan = true) {
  const entries = journalEntries(plan);
  const weeks = showPlan
    ? plan.weeks.map((week) => ({
        index: week.index,
        start: week.start,
        phase: planWeekPhase(plan, week.index) ?? week.phase,
      }))
    : Array.from({ length: 12 }, (_, index) => ({
        index,
        start: addDays(monday(today), (index - 11) * 7),
        phase: null,
      }));
  return weeks.map((week) => {
    const end = addDays(week.start, 6);
    const actual = journalSummary(
      entries.filter(
        ({ record }) => record.date >= week.start && record.date <= end,
      ),
    );
    const scheduled = showPlan
      ? plan.workouts.filter(
          (run) => run.week === week.index && run.status !== 'skipped',
        )
      : [];
    const long = scheduled.filter((run) => run.kind === 'long');
    // Keep the same estimate availability as workout details. Allocation values
    // alone cannot supply a distance for an effort-only beginner lesson.
    const plannedDistance = (run: (typeof scheduled)[number]) =>
      workoutDistanceValue(run, plan.profile) === '—' ||
      !Number.isFinite(run.estimatedKm) ||
      run.estimatedKm < 0
        ? null
        : run.estimatedKm;
    const plannedTime = (run: (typeof scheduled)[number]) =>
      run.kind === 'race' || !Number.isFinite(run.minutes) || run.minutes <= 0
        ? null
        : run.minutes;
    const distances = scheduled.map(plannedDistance);
    const times = scheduled.map(plannedTime);
    const longDistances = long.map(plannedDistance);
    const longTimes = long.map(plannedTime);
    return {
      ...week,
      end,
      planned: showPlan
        ? {
            km: completeTotal(distances),
            minutes: completeTotal(times),
            longKm: longDistances.some((km) => km === null)
              ? null
              : Math.max(0, ...(longDistances as number[])),
            longMinutes: longTimes.some((minutes) => minutes === null)
              ? null
              : Math.max(0, ...(longTimes as number[])),
            missingDistances: distances.filter((km) => km === null).length,
            missingTimes: times.filter((minutes) => minutes === null).length,
          }
        : null,
      recorded: {
        km: actual.km,
        minutes: actual.count ? actual.minutes : null,
        runs: actual.count,
        missingDistances: actual.missingDistances,
      },
    };
  });
}
