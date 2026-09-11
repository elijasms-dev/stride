import { guardAccount } from '@/lib/accounts';
import {
  ownerId,
  guardWrite,
  provider,
  readState,
  database,
  json,
  failure,
  HttpError,
} from '@/lib/server';
import { syncWorkout } from '@/lib/garmin';
import { todayInZone } from '@/lib/engine';
import { shouldReconcile, type DeliveryReceipt } from '@/lib/delivery-policy';
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const accountContext = await guardAccount(request, owner);
    await provider(owner);
    const state = await readState(owner);
    if (!state.plan) return json({ updated: 0, failed: [], remaining: 0 });
    const today = todayInZone(state.plan.profile.timezone);
    const rows = await database()
      .prepare(
        `SELECT d.workout_id,d.version,CASE WHEN d.connection_generation IS NOT c.generation THEN 'stale' ELSE d.status END AS status FROM deliveries d JOIN connections c ON c.owner=d.owner AND c.provider_athlete_id=d.provider_athlete_id WHERE d.owner=? ORDER BY d.updated_at ASC`,
      )
      .bind(owner)
      .all<DeliveryReceipt>();
    const candidates = rows.results.filter((row) =>
      shouldReconcile(
        row,
        state.plan!.workouts.find((w) => w.id === row.workout_id),
        state.version,
        today,
      ),
    );
    let updated = 0,
      attempted = 0,
      retryAfter: number | undefined;
    const failed: { id: string; message: string }[] = [];
    for (const row of candidates.slice(0, 2)) {
      attempted++;
      try {
        const result = await syncWorkout(
          owner,
          row.workout_id,
          state.version,
          false,
          accountContext.epoch,
        );
        if (['review', 'stale', 'failed'].includes(result.status))
          failed.push({
            id: row.workout_id,
            message:
              'This provider entry needs review in Connections before watch use.',
          });
        else updated++;
      } catch (e) {
        failed.push({
          id: row.workout_id,
          message:
            e instanceof Error ? e.message : 'Update failed. Retry later.',
        });
        if (e instanceof HttpError && [401, 403, 429].includes(e.status)) {
          if (e.status === 429) retryAfter = e.retryAfter ?? 60;
          break;
        }
      }
    }
    const result = json({
      updated,
      failed,
      remaining: Math.max(0, candidates.length - attempted),
      ...(retryAfter ? { retryAfter } : {}),
    });
    if (retryAfter) result.headers.set('Retry-After', String(retryAfter));
    return result;
  } catch (e) {
    return failure(e);
  }
}
