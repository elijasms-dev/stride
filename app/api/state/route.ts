import type { ConnectionSummary } from '@/lib/connection-status';
import { prescriptionHash } from '@/lib/garmin';
import { ownerId, readState, json, failure, database } from '@/lib/server';
export async function GET(request: Request) {
  try {
    const owner = ownerId(request);
    const [state, history, deliveries, connection] = await Promise.all([
      readState(owner),
      database()
        .prepare(
          'SELECT version, label, created_at FROM revisions WHERE owner = ? ORDER BY version DESC LIMIT 20',
        )
        .bind(owner)
        .all(),
      database()
        .prepare(
          'SELECT d.workout_id,d.version,d.remote_id,d.status,d.message,d.updated_at,d.connection_generation,d.prescription_hash FROM deliveries d JOIN connections c ON c.owner=d.owner AND c.provider_athlete_id=d.provider_athlete_id WHERE d.owner=?',
        )
        .bind(owner)
        .all(),
      database()
        .prepare(
          'SELECT athlete_name, connected_at,provider_athlete_id,generation,activity_check,activity_attempt,activity_imported_at,activity_import_count FROM connections WHERE owner = ?',
        )
        .bind(owner)
        .first<
          Omit<ConnectionSummary, 'activity_check' | 'activity_attempt'> & {
            activity_check: string | null;
            activity_attempt: string | null;
          }
        >(),
    ]);
    const currentDeliveries = await Promise.all(
      deliveries.results.map(async (r) => {
        const w = state.plan?.workouts.find((w) => w.id === r.workout_id);
        if (w && ['accepted', 'confirmed'].includes(String(r.status)))
          return {
            ...r,
            ...(r.prescription_hash === (await prescriptionHash(w)) &&
            r.connection_generation ===
              (connection as { generation: string } | null)?.generation
              ? { version: state.version }
              : { status: 'stale' }),
          };
        return r;
      }),
    );
    return json({
      ...state,
      history: history.results,
      deliveries: currentDeliveries,
      connection: connection
        ? {
            ...connection,
            activity_check: connection.activity_check
              ? JSON.parse(connection.activity_check)
              : null,
            activity_attempt: connection.activity_attempt
              ? JSON.parse(connection.activity_attempt)
              : null,
          }
        : null,
    });
  } catch (e) {
    return failure(e);
  }
}
