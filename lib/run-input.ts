import { MAX_RECORDED_MINUTES } from './ultra-policy.ts';
import { validDate, PlanError, type ExtraRun } from './engine.ts';
export function validateRun(raw: unknown, today: string): ExtraRun {
  const r = raw as ExtraRun;
  if (
    !r ||
    !validDate(r.date) ||
    r.date > today ||
    !Number.isFinite(r.minutes) ||
    r.minutes < 1 ||
    r.minutes > MAX_RECORDED_MINUTES ||
    (r.km !== null && (!Number.isFinite(r.km) || r.km <= 0 || r.km > 250)) ||
    !Number.isInteger(r.effort) ||
    r.effort < 1 ||
    r.effort > 10 ||
    !['good', 'okay', 'tired'].includes(r.feeling) ||
    typeof r.note !== 'string' ||
    r.note.length > 2000 ||
    (r.activityId !== undefined &&
      (typeof r.activityId !== 'string' ||
        !r.activityId ||
        r.activityId.length > 150))
  )
    throw new PlanError(
      'Check the run date, time, distance, effort and feeling. Leave an unknown distance blank.',
    );
  return {
    id: typeof r.id === 'string' ? r.id : '',
    date: r.date,
    minutes: r.minutes,
    km: r.km,
    effort: r.effort,
    feeling: r.feeling,
    note: r.note,
    activityId: r.activityId,
    source: typeof r.source === 'string' ? r.source.slice(0, 100) : 'Manual',
    recordedAt: r.recordedAt,
  };
}
