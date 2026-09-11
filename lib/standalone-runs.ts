import {
  database,
  HttpError,
  readState,
  importReceiptStatement,
  type ProviderIdentity,
} from './server';
import { verifiedActivity } from './provider-activities';
import { todayInZone } from './engine';
import { validateRun } from './run-input';
import type { Account } from './accounts';
export async function saveStandaloneRun(
  owner: string,
  raw: unknown,
  account: Account,
) {
  const db = database();
  const profile = await db
    .prepare('SELECT timezone FROM profiles WHERE owner=?')
    .bind(owner)
    .first<{ timezone: string }>();
  const r = validateRun(raw, todayInZone(profile?.timezone || 'UTC'));
  r.id = r.activityId ? 'intervals:' + r.activityId : crypto.randomUUID();
  r.recordedAt = new Date().toISOString();
  r.source = 'Manual';
  let identity: ProviderIdentity | undefined;
  if (r.activityId) {
    const actual = await verifiedActivity(owner, r.activityId, r.date);
    identity = actual.identity;
    r.minutes = actual.movingTime / 60;
    r.km =
      actual.distance && actual.distance > 0 ? actual.distance / 1000 : null;
    r.source = actual.source;
  }
  validateRun(r, todayInZone(profile?.timezone || 'UTC'));
  const current = await readState(owner);
  if (current.plan)
    throw new HttpError(
      409,
      'Your plan was activated in another window. Reload before adding this run.',
    );
  if (
    current.standaloneRuns?.some(
      (x) => x.id === r.id || (r.activityId && x.activityId === r.activityId),
    )
  )
    return current;
  if ((current.standaloneRuns?.length ?? 0) >= 4000)
    throw new HttpError(
      413,
      'Export your journal before adding more records. This release supports 4,000 runs per journal.',
    );
  if (
    new TextEncoder().encode(
      JSON.stringify([...(current.standaloneRuns ?? []), r]),
    ).byteLength > 500000
  )
    throw new HttpError(
      413,
      'This pre-plan journal is approaching its storage limit. Download a recovery copy before adding more. Existing runs are unchanged.',
    );
  const token = crypto.randomUUID();
  const result = await db.batch([
    db
      .prepare(
        "UPDATE accounts SET revision=revision+1,operation_id=? WHERE owner=? AND epoch=? AND revision=? AND status='active' AND NOT EXISTS(SELECT 1 FROM athlete_state s WHERE s.owner=accounts.owner AND s.data<>'null') AND (? IS NULL OR EXISTS(SELECT 1 FROM connections c WHERE c.owner=accounts.owner AND c.provider_athlete_id=? AND c.generation=?))",
      )
      .bind(
        token,
        owner,
        account.epoch,
        account.revision,
        identity?.generation ?? null,
        identity?.athleteId ?? null,
        identity?.generation ?? null,
      ),
    db
      .prepare(
        'INSERT INTO standalone_runs(owner,id,data,updated_at) SELECT owner,?,?,? FROM accounts WHERE owner=? AND operation_id=? ON CONFLICT(owner,id) DO NOTHING',
      )
      .bind(r.id, JSON.stringify(r), r.recordedAt, owner, token),
    ...(identity
      ? [
          importReceiptStatement(
            owner,
            identity,
            account.epoch,
            r.recordedAt,
            'account',
            token,
          ),
        ]
      : []),
  ]);
  if (result[0].meta.changes !== 1)
    throw new HttpError(
      409,
      'Your journal changed. Reload and check the saved runs before retrying.',
    );
  return readState(owner);
}

export async function correctStandaloneRun(
  owner: string,
  id: string,
  raw: unknown,
  reason: unknown,
  account: Account,
) {
  const db = database(),
    state = await readState(owner);
  if (state.plan)
    throw new HttpError(
      409,
      'A plan now exists. Reload before correcting this run.',
    );
  const original = state.standaloneRuns?.find((r) => r.id === id);
  if (!original)
    throw new HttpError(404, 'That run is no longer in this journal.');
  const profile = await db
    .prepare('SELECT timezone FROM profiles WHERE owner=?')
    .bind(owner)
    .first<{ timezone: string }>();
  const r = validateRun(raw, todayInZone(profile?.timezone || 'UTC'));
  if (
    typeof reason !== 'string' ||
    reason.trim().length < 3 ||
    reason.length > 200
  )
    throw new HttpError(422, 'Add a brief reason for this correction.');
  if ((r.activityId ?? null) !== (original.activityId ?? null))
    throw new HttpError(422, 'Keep the original provider recording link.');
  const at = new Date().toISOString(),
    token = crypto.randomUUID();
  const next = {
    ...r,
    id,
    source: original.source,
    recordedAt: at,
    corrections: [
      ...(original.corrections ?? []),
      {
        at,
        reason: reason.trim(),
        date: original.date,
        minutes: original.minutes,
        km: original.km,
        effort: original.effort,
        feeling: original.feeling,
        note: original.note,
      },
    ].slice(-20),
  };
  if (
    new TextEncoder().encode(
      JSON.stringify(
        state.standaloneRuns?.map((r) => (r.id === id ? next : r)),
      ),
    ).byteLength > 500000
  )
    throw new HttpError(
      413,
      'This correction exceeds the pre-plan journal storage limit. Download a recovery copy; existing data is unchanged.',
    );
  const result = await db.batch([
    db
      .prepare(
        "UPDATE accounts SET revision=revision+1,operation_id=? WHERE owner=? AND epoch=? AND revision=? AND status='active'",
      )
      .bind(token, owner, account.epoch, account.revision),
    db
      .prepare(
        'UPDATE standalone_runs SET data=?,updated_at=? WHERE owner=? AND id=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=standalone_runs.owner AND a.operation_id=?)',
      )
      .bind(JSON.stringify(next), at, owner, id, token),
  ]);
  if (result[0].meta.changes !== 1 || result[1].meta.changes !== 1)
    throw new HttpError(
      409,
      'Your journal changed. Reload before correcting it.',
    );
  return readState(owner);
}
