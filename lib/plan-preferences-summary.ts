import type { Profile } from './plan/types.ts';
import { desiredRuns, requestedQualityCount } from './training-structure.ts';
import { runDuration } from './journal-view.ts';
import { elapsedTimeText } from './benchmark-input.ts';
import { eventDistanceDisplay } from './plan/display.ts';
import { dateLabel } from './plan/calendar.ts';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export type PreferenceSummaryRow = { label: string; value: string };

/** Stable choices, separate from the selected week's recovery/taper prescription. */
export function planPreferenceRows(p: Profile): PreferenceSummaryRow[] {
  const quality = requestedQualityCount(p);
  const paceSource =
    p.workoutTargets?.mode === 'heart-rate'
      ? 'Your heart-rate ranges'
      : p.workoutTargets?.mode === 'pace'
        ? 'Saved pace ranges; other sessions by effort'
        : p.workoutTargets?.mode === 'effort'
          ? 'Your saved effort targets'
          : p.recentRace
            ? 'Recent benchmark estimates'
            : 'Your easy pace and effort';
  return [
    {
      label: 'Running days',
      value: `${desiredRuns(p)} per week · ${[...p.days]
        .sort((a, b) => a - b)
        .map((d) => days[d])
        .join(', ')}`,
    },
    {
      label: 'Weekday workouts',
      value: `${quality} ${quality === 1 ? 'workout' : 'workouts'}${p.qualityMode === 'custom' ? ' · your choice' : ' · automatic'}`,
    },
    { label: 'Long-run day', value: days[p.longDay] ?? 'Not selected' },
    {
      label: 'Time limits',
      value: `${runDuration(p.weekdayMinutes)} weekdays · ${runDuration(p.longMinutes)} long run${p.weeklyMinutesLimit ? ` · ${runDuration(p.weeklyMinutesLimit)} weekly` : ''}`,
    },
    {
      label: 'Daily limits',
      value:
        p.dayPreferences
          ?.filter((d) => d.maxMinutes != null)
          .map((d) => `${days[d.day]} ${runDuration(d.maxMinutes!)}`)
          .join(', ') || 'Use session limits',
    },
    { label: 'Target source', value: paceSource },
    {
      label: 'Benchmark',
      value: p.recentRace
        ? `${eventDistanceDisplay(p.recentRace.distanceKm, p.units)} ${p.units} in ${elapsedTimeText(p.recentRace.timeMinutes)} · ${p.recentRace.date ? dateLabel(p.recentRace.date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not provided'} · ${p.recentRace.source === 'time-trial' ? 'Time trial' : p.recentRace.source === 'race' ? 'Race' : 'Result type not provided'} · ${p.recentRace.course ?? 'Course not provided'}`
        : 'Not provided',
    },
  ];
}

export function comparePlanPreferences(before: Profile, after: Profile) {
  const previous = planPreferenceRows({ ...before, units: after.units });
  return planPreferenceRows(after).map((row, index) => ({
    label: row.label,
    before: previous[index].value,
    after: row.value,
    changed: previous[index].value !== row.value,
  }));
}
