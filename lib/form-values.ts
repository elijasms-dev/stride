import { dayDiff, todayInZone } from './plan/calendar.ts';

export const MILE_KM = 1.609344;
/** Subjective feedback must be chosen by the runner, never inferred from a recording. */
export function runFeedbackError(effort: string, feeling: string) {
  if (
    !effort.trim() ||
    !Number.isInteger(Number(effort)) ||
    Number(effort) < 1 ||
    Number(effort) > 10
  )
    return 'Choose your session effort from 1 to 10.';
  if (!['good', 'okay', 'tired'].includes(feeling))
    return 'Choose how you felt before saving this run.';
  return '';
}
export function numericText(value: number | null | undefined, factor = 1) {
  return value == null || !Number.isFinite(value)
    ? ''
    : String(Number((value / factor).toFixed(8)));
}
export function parseNumericText(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return NaN;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}
export function paceText(minutesPerKm: number | null | undefined, factor = 1) {
  if (minutesPerKm == null || !Number.isFinite(minutesPerKm)) return '';
  const seconds = Math.round(minutesPerKm * factor * 6000) / 100;
  const mins = Math.floor(seconds / 60);
  const [whole, fraction] = String(
    Number((seconds - mins * 60).toFixed(2)),
  ).split('.');
  return `${mins}:${whole.padStart(2, '0')}${fraction ? '.' + fraction : ''}`;
}
/** Colon syntax is deliberate: 6.30 must never silently mean either 6:18 or 6:30. */
export function parsePaceText(raw: string, factor = 1): number | null {
  if (!raw.trim()) return null;
  const match = /^(\d{1,2}):([0-5]\d)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  if (!match) return NaN;
  return (
    (Number(match[1]) +
      (Number(match[2]) + Number(`0.${match[3] || '0'}`)) / 60) /
    factor
  );
}
export function validTimezone(zone: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return !!zone;
  } catch {
    return false;
  }
}
export function trainingDay(zone: string, instant = new Date()) {
  return todayInZone(validTimezone(zone) ? zone : 'UTC', instant);
}
export function reconcileStartDate(
  start: string,
  zone: string,
  instant = new Date(),
) {
  const today = trainingDay(zone, instant);
  return {
    today,
    start,
    corrected: false,
  };
}
export function relativeDayLabel(selected: string, today: string) {
  const offset = dayDiff(today, selected);
  return offset === 0
    ? 'Today'
    : offset === 1
      ? 'Tomorrow'
      : offset === -1
        ? 'Yesterday'
        : offset > 0
          ? `In ${offset} days`
          : `${-offset} days ago`;
}
