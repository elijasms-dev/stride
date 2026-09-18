import type { Plan, Workout } from './plan/types.ts';
import { addDays, dayDiff } from './plan/calendar.ts';
import { journalEntries } from './journal-view.ts';
import { trainingPhaseOn } from './plan/generation-calendar.ts';
import { calendarSessions, orderedCalendarSessions } from './day-sessions.ts';

/** Older saved plans may label an entire boundary week as taper. Resolve the
 * opening in-block day consistently in the schedule, chart, and export. */
export function planWeekPhase(plan: Plan, weekIndex: number) {
  const week = plan.weeks.find((item) => item.index === weekIndex);
  if (!week) return undefined;
  return trainingPhaseOn(
    plan.profile,
    week.phase,
    week.start < plan.profile.startDate ? plan.profile.startDate : week.start,
  );
}

/** Read-only presentation of saved prescriptions. Journal records never fund a
 * forecast total, and a completed workout appears on its recorded calendar day. */
export function planCalendarDays(plan: Plan, weekIndex: number) {
  const week = plan.weeks.find((item) => item.index === weekIndex);
  if (!week) return [];
  const records = journalEntries(plan);
  const workouts = calendarSessions(plan).filter(
    (run) => run.status === 'completed' || run.week === weekIndex,
  );
  const extras = records.flatMap((entry) =>
    entry.kind === 'extra' ? [entry.run] : [],
  );
  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(week.start, offset);
    const sessions = orderedCalendarSessions(workouts, date);
    return {
      date,
      inBlock: date >= plan.profile.startDate && date <= plan.profile.raceDate,
      sessions,
      extras: extras.filter((run) => run.date === date),
    };
  });
}

export function planWeekSummary(plan: Plan, weekIndex: number) {
  const runs = plan.workouts.filter(
    (run) => run.week === weekIndex && run.status !== 'skipped',
  );
  const training = runs.filter((run) => run.kind !== 'race');
  const long = training.filter((run) => run.kind === 'long');
  const quality = training.filter((run) => run.hard && run.kind !== 'long');
  return {
    trainingKm: training.reduce((sum, run) => sum + run.estimatedKm, 0),
    trainingMinutes: training.reduce((sum, run) => sum + run.minutes, 0),
    longKm: Math.max(0, ...long.map((run) => run.estimatedKm)),
    runningDays: new Set(runs.map((run) => run.date)).size,
    sessions: runs.length,
    raceKm: runs
      .filter((run) => run.kind === 'race')
      .reduce((sum, run) => sum + run.estimatedKm, 0),
    keySessions: [...quality, ...long].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    skipped: plan.workouts.filter(
      (run) => run.week === weekIndex && run.status === 'skipped',
    ).length,
  };
}

export function nearestPlanWeek(plan: Plan, date: string) {
  const containing = plan.weeks.find(
    (week) => date >= week.start && date <= addDays(week.start, 6),
  );
  if (containing) return containing.index;
  return (
    [...plan.weeks].sort(
      (a, b) =>
        Math.abs(dayDiff(date, a.start)) - Math.abs(dayDiff(date, b.start)),
    )[0]?.index ?? 0
  );
}

export function calendarWorkoutStatus(workout: Workout) {
  if (workout.status === 'completed')
    return workout.week < 0 ? 'Completed · previous plan' : 'Completed';
  if (workout.status === 'skipped') return 'Skipped';
  if (workout.kind === 'race') return 'Race day';
  if (workout.kind === 'long') return 'Long run';
  return workout.hard ? 'Quality workout' : 'Easy effort';
}
