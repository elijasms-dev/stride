import type { Profile, Workout } from './engine';

export type DayPreference = {
  day: number;
  maxMinutes?: number | null;
  startTime?: string | null;
};
export const validStartTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const clockMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export const runningDayLimit = (
  p: Pick<Profile, 'dayPreferences'>,
  day: number,
) => p.dayPreferences?.find((d) => d.day === day)?.maxMinutes ?? Infinity;

export function customizationError(p: Profile): string | null {
  if (
    p.runMeasure !== undefined &&
    !['distance', 'time'].includes(p.runMeasure)
  )
    return 'Choose distance or time for easy and long runs.';
  if (
    p.dayPreferences !== undefined &&
    (!Array.isArray(p.dayPreferences) ||
      p.dayPreferences.length > 7 ||
      p.dayPreferences.some(
        (d) =>
          !d ||
          typeof d !== 'object' ||
          !Number.isInteger(d.day) ||
          d.day < 0 ||
          d.day > 6 ||
          (d.maxMinutes != null &&
            (!Number.isInteger(d.maxMinutes) ||
              d.maxMinutes < 15 ||
              d.maxMinutes > 300)) ||
          (d.startTime != null && !validStartTime(d.startTime)),
      ) ||
      new Set(p.dayPreferences.map((d) => d.day)).size !==
        p.dayPreferences.length)
  )
    return 'Choose each weekday once, with a 15–300 minute daily limit and a valid start time, or leave these fields blank.';
  if (
    p.weeklyMinutesLimit != null &&
    (!Number.isInteger(p.weeklyMinutesLimit) ||
      p.weeklyMinutesLimit < 30 ||
      p.weeklyMinutesLimit > 1260)
  )
    return 'Enter a weekly running-time ceiling of 30–1,260 minutes, or leave it blank.';
  if (
    p.workoutFormat !== undefined &&
    !['automatic', 'time', 'distance'].includes(p.workoutFormat)
  )
    return 'Choose automatic, timed or distance-based repetitions.';
  if (
    p.workoutVariety !== undefined &&
    !['varied', 'familiar'].includes(p.workoutVariety)
  )
    return 'Choose varied workouts or familiar formats.';
  return null;
}

/** Only call on new or explicitly reviewed upcoming sessions. Races retain
 * their event timing. A paired day keeps its established recovery gap. */
export function applyPreferredStartTimes(
  workouts: Workout[],
  p: Profile,
  previous?: Profile,
): string | null {
  for (const w of workouts) {
    if (w.kind === 'race' || w.status !== 'planned') continue;
    const day = (new Date(w.date + 'T12:00:00Z').getUTCDay() + 6) % 7;
    let preferred = p.dayPreferences?.find((d) => d.day === day)?.startTime;
    const previousTime = previous?.dayPreferences?.find(
      (d) => d.day === day,
    )?.startTime;
    const partner = w.pairId
      ? workouts.find((s) => s.pairId === w.pairId && s.id !== w.id)
      : undefined;
    if (partner && partner.status !== 'planned' && previous) {
      if (
        (preferred ?? null) !== (previousTime ?? null) ||
        (p.doubleGapHours ?? 8) !== (previous.doubleGapHours ?? 8)
      )
        return 'This paired day has already started. Keep its saved timing and change upcoming paired days separately.';
      continue;
    }
    if (
      !preferred &&
      previous?.dayPreferences?.find((d) => d.day === day)?.startTime
    ) {
      if (w.pairId) preferred = '07:00';
      else delete w.startTime;
    }
    if (!preferred) continue;
    let start = clockMinutes(preferred);
    if (w.pairId && w.session === 'PM') {
      const first = workouts.find(
        (s) => s.pairId === w.pairId && s.session === 'AM',
      );
      if (!first)
        return 'Review both sessions together before changing a paired day’s start time.';
      start += Math.ceil(first.minutes) + (p.doubleGapHours ?? 8) * 60;
    }
    if (start + w.minutes > 1440)
      return 'That start time leaves a run finishing after midnight. Choose an earlier time, allowing the recovery gap on paired days.';
    w.startTime = clock(start);
  }
  return null;
}
