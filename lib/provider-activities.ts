import {
  provider,
  assertConnection,
  intervals,
  HttpError,
  database,
  type ProviderIdentity,
} from './server';
import { readAccount } from './accounts';
import { validDate } from './engine';
export function normalizeActivity(input: unknown, athleteId: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const a = input as Record<string, unknown>;
  const local =
    typeof a.start_date_local === 'string' ? a.start_date_local : '';
  if (
    !['Run', 'VirtualRun'].includes(String(a.type)) ||
    (typeof a.id !== 'string' && typeof a.id !== 'number') ||
    !validDate(local.slice(0, 10)) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(local) ||
    !Number.isFinite(a.moving_time) ||
    Number(a.moving_time) <= 0 ||
    (a.distance != null &&
      (!Number.isFinite(a.distance) || Number(a.distance) < 0))
  )
    return null;
  return {
    id: `${athleteId}:${String(a.id)}`,
    providerId: String(a.id),
    name: (typeof a.name === 'string' ? a.name : 'Run').slice(0, 160),
    date: local.slice(0, 10),
    startLocal: local,
    startUtc: typeof a.start_date === 'string' ? a.start_date : null,
    timezone: typeof a.timezone === 'string' ? a.timezone : null,
    pairedEventId:
      typeof a.paired_event_id === 'number' ||
      typeof a.paired_event_id === 'string'
        ? String(a.paired_event_id)
        : null,
    distance: a.distance == null ? null : Number(a.distance),
    movingTime: Number(a.moving_time),
    deviceName:
      typeof a.device_name === 'string' ? a.device_name.slice(0, 80) : null,
    source:
      'Intervals.icu' +
      (typeof a.device_name === 'string' &&
      /garmin/i.test(a.device_name) &&
      !(typeof a.source === 'string' && /garmin/i.test(a.source))
        ? ' · Garmin device data'
        : '') +
      (typeof a.source === 'string' ? ` · ${a.source.slice(0, 40)}` : ''),
  };
}
export async function providerActivities(
  owner: string,
  from: string,
  to: string,
  trackCheck = false,
) {
  const account = await readAccount(owner),
    connection = await provider(owner);
  const identity: ProviderIdentity = {
    athleteId: connection.athleteId,
    generation: connection.generation,
  };
  const startedAt = new Date().toISOString(),
    attemptId = crypto.randomUUID();
  if (trackCheck) {
    const begun = await database()
      .prepare(
        "UPDATE connections SET activity_attempt=? WHERE owner=? AND provider_athlete_id=? AND generation=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=connections.owner AND a.epoch=? AND a.status='active')",
      )
      .bind(
        JSON.stringify({ id: attemptId, at: startedAt, outcome: 'checking' }),
        owner,
        identity.athleteId,
        identity.generation,
        account.epoch,
      )
      .run();
    if (begun.meta.changes !== 1)
      throw new HttpError(
        409,
        'Your connection changed before the check started. Reload and try again.',
      );
  }
  async function remember(
    attempt: Record<string, unknown>,
    check?: Record<string, unknown>,
  ) {
    await database()
      .prepare(
        "UPDATE connections SET activity_attempt=?,activity_check=COALESCE(?,activity_check) WHERE owner=? AND provider_athlete_id=? AND generation=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=connections.owner AND a.epoch=? AND a.status='active') AND json_extract(activity_attempt,'$.id')=?",
      )
      .bind(
        JSON.stringify({ ...attempt, id: attemptId }),
        check ? JSON.stringify(check) : null,
        owner,
        identity.athleteId,
        identity.generation,
        account.epoch,
        attemptId,
      )
      .run();
  }
  try {
    const response = await intervals(
      connection.key,
      `/athlete/${encodeURIComponent(connection.athleteId)}/activities?oldest=${from}&newest=${to}`,
      {},
      false,
      owner,
    );
    const raw: unknown = await response.json();
    if (!Array.isArray(raw))
      throw new HttpError(
        502,
        'The provider returned an unreadable activity list. Try again.',
      );
    await assertConnection(owner, connection);
    const latest = await readAccount(owner);
    if (latest.epoch !== account.epoch || latest.status !== 'active')
      throw new HttpError(
        409,
        'Your account changed during the activity check. Reload before retrying.',
      );
    const normalized = raw
      .map((a) => normalizeActivity(a, identity.athleteId))
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const activities = [...new Map(normalized.map((a) => [a.id, a])).values()];
    const result = {
      activities,
      invalidCount: raw.length - normalized.length,
      duplicateCount: normalized.length - activities.length,
      from,
      to,
      identity,
    };
    if (trackCheck)
      await remember(
        { at: startedAt, outcome: 'success' },
        {
          at: new Date().toISOString(),
          from,
          to,
          count: activities.length,
          excluded: result.invalidCount,
          duplicates: result.duplicateCount,
        },
      );
    return result;
  } catch (error) {
    if (trackCheck) {
      const status = error instanceof HttpError ? error.status : 502;
      const category =
        status === 429
          ? 'rate-limited'
          : status === 401 || status === 403
            ? 'authorization'
            : status === 409
              ? 'connection-changed'
              : 'service-unavailable';
      try {
        await remember({ at: startedAt, outcome: 'failed', category });
      } catch {
        /* Preserve the original error; no provider text or runner data enters status. */
      }
    }
    throw error;
  }
}
export async function verifiedActivity(
  owner: string,
  id: string,
  date: string,
) {
  const { activities, identity } = await providerActivities(owner, date, date),
    record = activities.find((a) => a.id === id && a.date === date);
  if (!record)
    throw new HttpError(
      409,
      'This recording is unavailable in the connected athlete account on that date. Refresh the import list.',
    );
  return { ...record, identity };
}
