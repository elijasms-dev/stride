import type { Plan, Profile, Workout } from './plan/types.ts';
import { addDays, dateLabel } from './plan/calendar.ts';
import { eventDistanceDisplay, kmDisplay } from './plan/display.ts';
import { prescribedDistanceKm } from './run-distance.ts';
import { distanceEstimate } from './prescription.ts';
import { runDuration } from './journal-view.ts';
import { mainSetSummary, recoverySummary } from './workout-names.ts';
import { targetLabel } from './workout-targets.ts';

const baseTitle = (w: Workout) =>
  w.title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, '');
const displayTitle = (w: Workout, units: Profile['units']) =>
  baseTitle(w) === w.title
    ? w.title
    : `${kmDisplay(prescribedDistanceKm(w) ?? w.estimatedKm, units)} ${units} · ${baseTitle(w)}`;

const prescriptionSnapshot = (w: Workout) =>
  JSON.stringify([
    w.date,
    w.startTime,
    w.session,
    w.status,
    baseTitle(w),
    w.kind,
    w.hard,
    w.qualityMinutes,
    w.minutes,
    w.estimatedKm,
    w.steps,
    w.purpose,
    w.reason,
  ]);

/** Compare saved prescriptions, never reinterpret completed or manually edited runs. */
export function upcomingPlanChanges(before: Plan, after: Plan, from: string) {
  const oldById = new Map(before.workouts.map((w) => [w.id, w]));
  const newIds = new Set(after.workouts.map((w) => w.id));
  return {
    changes: after.workouts.filter((w) => {
      if (w.date < from) return false;
      const old = oldById.get(w.id);
      return !old || prescriptionSnapshot(old) !== prescriptionSnapshot(w);
    }),
    removed: before.workouts.filter(
      (w) => w.date >= from && w.status !== 'completed' && !newIds.has(w.id),
    ),
  };
}

export function previewDistance(w: Workout, profile: Profile) {
  const exact = prescribedDistanceKm(w);
  if (w.kind === 'race')
    return `${eventDistanceDisplay(w.estimatedKm, profile.units)} ${profile.units} target`;
  if (exact !== null)
    return `${kmDisplay(exact, profile.units)} ${profile.units} target`;
  const estimate = distanceEstimate(w.steps, profile);
  return estimate.lowerKm === null
    ? 'Distance not estimated'
    : `${kmDisplay(estimate.lowerKm, profile.units)}–${kmDisplay(estimate.upperKm!, profile.units)} ${profile.units} estimated`;
}

function targetsSummary(w: Workout, units: Profile['units']) {
  const labels = {
    warmup: 'Warm-up',
    aerobic: 'Easy running',
    work: 'Main set',
    recovery: 'Recovery',
    cooldown: 'Cool-down',
  };
  return [
    ...new Set(
      w.steps.map(
        (s) =>
          `${labels[s.kind]}: ${s.target ? `${targetLabel(s.target, units)}; ${s.effort || 'By effort'}` : s.effort || 'By effort'}`,
      ),
    ),
  ].join('; ');
}

export type WorkoutComparisonRow = {
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

/** Both sides use the chosen units, but retain their own saved pace/benchmark context. */
export function workoutComparisonRows(
  before: Workout | undefined,
  after: Workout | undefined,
  oldProfile: Profile,
  newProfile: Profile,
): WorkoutComparisonRow[] {
  const units = newProfile.units;
  const oldDisplayProfile = { ...oldProfile, units };
  const values = (w: Workout | undefined, p: Profile) => {
    if (!w) return Array<string>(11).fill('Not scheduled');
    const set = mainSetSummary(w);
    return [
      dateLabel(w.date),
      displayTitle(w, units),
      previewDistance(w, p),
      w.kind === 'race'
        ? 'Race distance; no finish-time prediction'
        : `${runDuration(w.minutes)}${w.steps.some((step) => step.metres !== undefined) ? ' estimated' : ''}`,
      set ||
        [
          ...new Set(
            w.steps.filter((s) => s.kind === 'work').map((s) => s.label),
          ),
        ].join('; ') ||
        'Follow the saved steps',
      targetsSummary(w, units),
      recoverySummary(w) || 'No recovery breaks',
      w.startTime ?? 'Open start',
      `${w.hard ? 'Quality effort' : w.kind === 'long' ? 'Long-run endurance' : w.kind === 'race' ? 'Race' : 'Easy effort'}${w.qualityMinutes ? `; ${runDuration(w.qualityMinutes)} quality work` : ''}`,
      w.status === 'planned'
        ? 'Scheduled'
        : w.status === 'completed'
          ? 'Completed'
          : 'Skipped',
      w.kind === 'race'
        ? 'Race distance'
        : `${kmDisplay(w.estimatedKm, units)} ${units} allocated for planning`,
    ];
  };
  const a = values(before, oldDisplayProfile);
  const b = values(after, newProfile);
  return [
    'Date',
    'Workout',
    'Distance',
    'Time',
    'Main set',
    'Pace / effort',
    'Recoveries',
    'Start time',
    'Session role',
    'Status',
    'Planning distance',
  ]
    .map((label, i) => ({
      label,
      before: a[i],
      after: b[i],
      changed: a[i] !== b[i],
    }))
    .filter(
      (row) =>
        ![
          'Date',
          'Start time',
          'Recoveries',
          'Session role',
          'Status',
          'Planning distance',
        ].includes(row.label) || row.changed,
    );
}

function summedDistance(runs: Workout[], profile: Profile): string {
  if (!runs.length) return 'No training runs';
  let low = 0;
  let high = 0;
  let exact = true;
  for (const run of runs) {
    const prescribed = prescribedDistanceKm(run);
    const estimate = distanceEstimate(run.steps, profile);
    if (prescribed === null && estimate.lowerKm === null)
      return 'Distance not fully estimated';
    exact &&= prescribed !== null;
    low += prescribed ?? estimate.lowerKm!;
    high += prescribed ?? estimate.upperKm!;
  }
  return exact
    ? `${kmDisplay(low, profile.units)} ${profile.units} target`
    : `${kmDisplay(low, profile.units)}–${kmDisplay(high, profile.units)} ${profile.units} estimated`;
}

export function preferenceOverviewRows(
  before: Plan,
  after: Plan,
  from: string,
) {
  const nextWeek = after.weeks.find(
    (w) => w.start >= from && addDays(w.start, 6) <= after.profile.raceDate,
  );
  const oldProfile = { ...before.profile, units: after.profile.units };
  const values = (plan: Plan, profile: Profile) => {
    const week = nextWeek && plan.weeks.find((w) => w.start === nextWeek.start);
    const runs = week
      ? plan.workouts.filter(
          (w) =>
            w.week === week.index &&
            w.kind !== 'race' &&
            w.status !== 'skipped',
        )
      : [];
    const longest = plan.workouts
      .filter(
        (w) => w.date >= from && w.kind === 'long' && w.status === 'planned',
      )
      .sort((a, b) => b.estimatedKm - a.estimatedKm)[0];
    return [
      nextWeek ? summedDistance(runs, profile) : 'No full week remaining',
      nextWeek
        ? `${runDuration(runs.reduce((n, w) => n + w.minutes, 0))}${runs.some((w) => w.steps.some((step) => step.metres !== undefined)) ? ' estimated' : ''}`
        : 'No full week remaining',
      longest ? previewDistance(longest, profile) : 'No upcoming long run',
    ];
  };
  const a = values(before, oldProfile);
  const b = values(after, after.profile);
  return {
    weekStart: nextWeek?.start,
    rows: [
      'Next full week distance',
      'Next full week time',
      'Longest upcoming run',
    ].map((label, i) => ({
      label,
      before: a[i],
      after: b[i],
      changed: a[i] !== b[i],
    })),
  };
}
