import { guardAccount } from '@/lib/accounts';
import {
  ownerId,
  guardWrite,
  body,
  json,
  failure,
  database,
  encrypt,
  intervals,
  HttpError,
  provider,
  assertConnection,
  requestLimit,
} from '@/lib/server';
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const accountContext = await guardAccount(request, owner);
    const b = await body(request);
    if (typeof b.key === 'string') b.key = b.key.trim();
    if (b.action === 'disconnect') {
      const token = crypto.randomUUID(),
        db = database(),
        result = await db.batch([
          db
            .prepare(
              "UPDATE accounts SET revision=revision+1,operation_id=? WHERE owner=? AND epoch=? AND status='active'",
            )
            .bind(token, owner, accountContext.epoch),
          db
            .prepare(
              'DELETE FROM connections WHERE owner=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=connections.owner AND a.operation_id=?)',
            )
            .bind(owner, token),
        ]);
      if (result[0].meta.changes !== 1)
        throw new HttpError(
          409,
          'Your account changed. Reload before disconnecting.',
        );
      return json({ connection: null });
    }
    if (
      typeof b.key !== 'string' ||
      b.key.length < 8 ||
      b.key.length > 200 ||
      /[^\x21-\x7E]/.test(b.key)
    )
      throw new HttpError(422, 'Enter your personal Intervals.icu API key.');
    const r = await intervals(b.key, '/athlete/0', {}, false, owner);
    const athlete = (await r.json()) as { name?: string; id?: string | number };
    if (!athlete.id || !/^i?[0-9]+$/.test(String(athlete.id)))
      throw new HttpError(
        502,
        'The provider did not return a valid athlete identity. No connection was saved.',
      );
    const encrypted = await encrypt(b.key);
    const token = crypto.randomUUID(),
      db = database(),
      result = await db.batch([
        db
          .prepare(
            "UPDATE accounts SET revision=revision+1,operation_id=? WHERE owner=? AND epoch=? AND status='active'",
          )
          .bind(token, owner, accountContext.epoch),
        db
          .prepare(
            'INSERT INTO connections(owner,encrypted_key,athlete_name,connected_at,provider_athlete_id,generation) SELECT owner,?,?,?,?,? FROM accounts WHERE owner=? AND operation_id=? ON CONFLICT(owner) DO UPDATE SET encrypted_key=excluded.encrypted_key,athlete_name=excluded.athlete_name,connected_at=excluded.connected_at,provider_athlete_id=excluded.provider_athlete_id,generation=excluded.generation,activity_check=NULL,activity_attempt=NULL,activity_imported_at=NULL,activity_import_count=0',
          )
          .bind(
            encrypted,
            String(athlete.name || 'Your Intervals.icu account'),
            new Date().toISOString(),
            String(athlete.id),
            crypto.randomUUID(),
            owner,
            token,
          ),
      ]);
    if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1)
      throw new HttpError(
        409,
        'Your account changed before the connection could be saved. Reload and reconnect.',
      );
    return json({ connected: true });
  } catch (e) {
    return failure(e);
  }
}

export async function GET(request: Request) {
  try {
    const owner = ownerId(request);
    await requestLimit(owner, 'watch-check', 10);
    const connection = await provider(owner);
    const response = await intervals(
      connection.key,
      '/athlete/0',
      {},
      false,
      owner,
    );
    const athlete = (await response.json()) as Record<string, unknown>;
    if (String(athlete.id) !== connection.athleteId)
      throw new HttpError(
        409,
        'The API key now belongs to a different athlete. Reconnect before sending.',
      );
    await assertConnection(owner, connection);
    const filters = athlete.icu_garmin_upload_filters;
    return json({
      checkedAt: new Date().toISOString(),
      trainingAccess:
        typeof athlete.icu_garmin_training === 'boolean'
          ? athlete.icu_garmin_training
          : null,
      workoutUploads:
        typeof athlete.icu_garmin_upload_workouts === 'boolean'
          ? athlete.icu_garmin_upload_workouts
          : null,
      hasUploadFilters:
        filters != null &&
        (Array.isArray(filters)
          ? filters.length > 0
          : typeof filters === 'object'
            ? Object.keys(filters).length > 0
            : Boolean(filters)),
      lastUploadAt:
        typeof athlete.icu_garmin_last_upload === 'string' &&
        Number.isFinite(Date.parse(athlete.icu_garmin_last_upload))
          ? athlete.icu_garmin_last_upload
          : null,
    });
  } catch (error) {
    return failure(error);
  }
}
