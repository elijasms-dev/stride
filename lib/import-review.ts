import type { ConnectionSummary } from './connection-status';
import type { Plan, ExtraRun, Workout } from './plan/types.ts';

export type Activity = {
  id: string;
  name: string;
  date: string;
  distance: number | null;
  movingTime: number;
  source: string;
  startLocal?: string;
  startUtc?: string | null;
  timezone?: string | null;
  pairedEventId?: string | null;
};
export type ImportPage = {
  activities: Activity[];
  nextCursor: string | null;
  identity: { athleteId: string; generation: string };
};
export type ImportReviewCache = Omit<ImportPage, 'identity'> & {
  scope: string;
};

/** Transient UI state only; no provider recordings are persisted in the browser. */
export function importReviewScope(
  accountScope: string,
  connection: Pick<
    ConnectionSummary,
    'provider_athlete_id' | 'generation'
  > | null,
) {
  return accountScope &&
    connection?.provider_athlete_id &&
    connection.generation
    ? JSON.stringify([
        accountScope,
        connection.provider_athlete_id,
        connection.generation,
      ])
    : '';
}

export function mergeImportPage(
  current: ImportReviewCache | null,
  expectedScope: string,
  currentScope: string,
  identity: ImportPage['identity'],
  page: Omit<ImportPage, 'identity'>,
  older: boolean,
): ImportReviewCache | null {
  if (!expectedScope || expectedScope !== currentScope) return current;
  try {
    const parts: unknown = JSON.parse(expectedScope);
    if (
      !Array.isArray(parts) ||
      parts.length !== 3 ||
      parts.some((part) => typeof part !== 'string' || !part) ||
      parts[1] !== identity?.athleteId ||
      parts[2] !== identity?.generation
    )
      return current;
  } catch {
    return current;
  }
  const rows =
    older && current?.scope === expectedScope
      ? [...current.activities, ...page.activities]
      : page.activities;
  const seen = new Set<string>();
  return {
    scope: expectedScope,
    activities: rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }),
    nextCursor: page.nextCursor,
  };
}

export type LinkedActivityReview = {
  saved: { date: string; minutes: number; km: number | null };
  workout?: Workout;
  extraRun?: ExtraRun;
  differences: ('date' | 'distance' | 'duration')[];
};

/** Compare a fresh, positively identified recording with saved observations.
 * A mismatch is not proof the provider changed: the runner may have corrected
 * their log. Missing rows/page gaps never imply a deleted source activity. */
export function linkedActivityReview(
  activity: Activity,
  plan: Pick<Plan, 'workouts' | 'extraRuns'>,
): LinkedActivityReview | null {
  const extraRun = plan.extraRuns?.find(
    (run) => run.activityId === activity.id,
  );
  const workout = extraRun
    ? undefined
    : plan.workouts.find(
        (run) =>
          run.status === 'completed' &&
          run.feedback?.activityId === activity.id,
      );
  const saved = extraRun
    ? { date: extraRun.date, minutes: extraRun.minutes, km: extraRun.km }
    : workout?.feedback
      ? {
          date: workout.feedback.actualDate ?? workout.date,
          minutes: workout.feedback.actualMinutes,
          km: workout.feedback.actualKm,
        }
      : null;
  if (!saved) return null;
  const differences: LinkedActivityReview['differences'] = [];
  const latestKm =
    activity.distance != null && activity.distance > 0
      ? activity.distance / 1000
      : null;
  if (saved.date !== activity.date) differences.push('date');
  // Ignore sub-metre/sub-second representation differences in summary values.
  if (
    (saved.km === null) !== (latestKm === null) ||
    (saved.km !== null &&
      latestKm !== null &&
      Math.abs(saved.km - latestKm) > 0.001 + 1e-9)
  )
    differences.push('distance');
  if (Math.abs(saved.minutes * 60 - activity.movingTime) > 1 + 1e-9)
    differences.push('duration');
  return {
    saved,
    ...(workout ? { workout } : {}),
    ...(extraRun ? { extraRun } : {}),
    differences,
  };
}
