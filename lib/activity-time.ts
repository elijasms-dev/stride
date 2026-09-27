import { validDate } from './plan/calendar.ts';
import { PlanError } from './plan/errors.ts';

/** Original activity timing is independent of the current viewing timezone. */
export type ActivityTime = {
  startUtc?: string | null;
  startLocal?: string | null;
  timezone?: string | null;
};

const localTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 40 &&
  validDate(value.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(
    value,
  );

export function activityTime(raw: ActivityTime): ActivityTime {
  if (
    (raw.startLocal != null && !localTimestamp(raw.startLocal)) ||
    (raw.startUtc != null &&
      (!localTimestamp(raw.startUtc) ||
        !/(?:Z|[+-]\d{2}:\d{2})$/.test(raw.startUtc) ||
        !Number.isFinite(Date.parse(raw.startUtc)))) ||
    (raw.timezone != null &&
      (typeof raw.timezone !== 'string' ||
        !raw.timezone.trim() ||
        raw.timezone.length > 100 ||
        Array.from(raw.timezone, (character) => character.charCodeAt(0)).some(
          (code) => code < 32 || code === 127,
        )))
  )
    throw new PlanError(
      'Check the recording start time and original timezone.',
    );
  return {
    ...(raw.startLocal !== undefined ? { startLocal: raw.startLocal } : {}),
    ...(raw.startUtc !== undefined ? { startUtc: raw.startUtc } : {}),
    ...(raw.timezone !== undefined ? { timezone: raw.timezone } : {}),
  };
}
