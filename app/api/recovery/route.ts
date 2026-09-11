import {
  ownerId,
  guardWrite,
  body,
  database,
  json,
  failure,
  readState,
  HttpError,
} from '@/lib/server';
import {
  assertAccountIdentity,
  guardAccount,
  readAccount,
} from '@/lib/accounts';
import {
  validateRecovery,
  prepareRestoredPlan,
  recoveryCounts,
  type RecoveryFile,
} from '@/lib/recovery';
async function digest(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
type Operation = {
  id: string;
  kind: string;
  digest: string;
  epoch: number;
  revision: number;
  expires_at: string;
  status: string;
};
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    assertAccountIdentity(request, await readAccount(owner));
    const b = await body(request, 2200000),
      db = database(),
      kind = String(b.kind);
    if (!['restore', 'delete', 'reopen'].includes(kind))
      throw new HttpError(422, 'Choose restore, delete, or reopen.');
    const file: RecoveryFile | null =
      kind === 'restore' ? validateRecovery(b.file) : null;
    const hash = await digest(file ?? { kind });
    if (b.action === 'commit') {
      const op = await db
        .prepare('SELECT * FROM recovery_operations WHERE owner=? AND id=?')
        .bind(owner, String(b.id))
        .first<Operation>();
      if (!op || op.kind !== kind || op.digest !== hash)
        throw new HttpError(
          409,
          'This recovery review does not match the file or account. Preview it again.',
        );
      if (op.status === 'complete')
        return json({
          ...(await readState(owner)),
          alreadyCompleted: true,
          accountStatus: (await readAccount(owner)).status,
        });
    }
    const account = await guardAccount(request, owner, true),
      state = await readState(owner);
    if (kind === 'reopen' && account.status !== 'closed')
      throw new HttpError(409, 'Your journal is already open.');
    if (kind === 'delete' && account.status === 'closed')
      throw new HttpError(409, 'Your journal is already closed.');
    if (b.action === 'preview') {
      const id = crypto.randomUUID(),
        expires = new Date(Date.now() + 600000).toISOString();
      const count = await db
        .prepare(
          "SELECT COUNT(*) AS count FROM recovery_operations WHERE owner=? AND expires_at>? AND status='preview'",
        )
        .bind(owner, new Date().toISOString())
        .first<{ count: number }>();
      if ((count?.count ?? 0) >= 8)
        throw new HttpError(
          429,
          'Several recovery reviews are already open. Wait ten minutes before starting another.',
        );
      const savedPreview = await db.batch([
        db
          .prepare(
            "DELETE FROM recovery_operations WHERE owner=? AND expires_at<? AND status='preview'",
          )
          .bind(owner, new Date().toISOString()),
        db
          .prepare(
            'INSERT INTO recovery_operations(owner,id,kind,digest,epoch,revision,expires_at) SELECT owner,?,?,?,?,?,? FROM accounts WHERE owner=? AND epoch=? AND revision=?',
          )
          .bind(
            id,
            kind,
            hash,
            account.epoch,
            account.revision,
            expires,
            owner,
            account.epoch,
            account.revision,
          ),
      ]);
      if (savedPreview[1].meta.changes !== 1)
        throw new HttpError(
          409,
          'Your account changed while preparing this review. Preview it again.',
        );
      return json({
        id,
        kind,
        accountId: account.account_id,
        accountEpoch: account.epoch,
        expiresAt: expires,
        current: {
          ...recoveryCounts(state.plan),
          extraRuns:
            (state.plan?.extraRuns?.length ?? 0) +
            (state.standaloneRuns?.length ?? 0),
        },
        replacement: {
          ...recoveryCounts(file?.plan ?? null),
          extraRuns:
            (file?.plan?.extraRuns?.length ?? 0) +
            (file?.standaloneRuns?.length ?? 0),
        },
        profileName: file?.profile?.display_name ?? null,
        warning:
          kind === 'reopen'
            ? 'This opens an empty Stride journal. It does not restore deleted running; use a recovery copy if you want your records back.'
            : kind === 'delete'
              ? 'This deletes the local training journal, profile, connection key and revision history. A minimal account tombstone remains to block stale requests.'
              : 'Restoring replaces the current journal and profile. Current revisions remain available for audit, but automatic undo cannot cross a recovery operation. Revision snapshots from the uploaded file are not imported; keep the original export for that audit history. Provider connections and delivery confirmations are cleared. External calendar workouts are not removed; review those copies before reconnecting.',
      });
    }
    if (b.action !== 'commit')
      throw new HttpError(400, 'Choose preview or commit.');
    const op = await db
      .prepare('SELECT * FROM recovery_operations WHERE owner=? AND id=?')
      .bind(owner, String(b.id))
      .first<Operation>();
    if (
      !op ||
      op.status !== 'preview' ||
      op.expires_at < new Date().toISOString() ||
      op.epoch !== account.epoch ||
      op.revision !== account.revision
    )
      throw new HttpError(
        409,
        'Your journal changed or the review expired. Preview this operation again.',
      );
    if (
      b.confirm !==
      (kind === 'delete' ? 'DELETE' : kind === 'restore' ? 'REPLACE' : 'OPEN')
    )
      throw new HttpError(422, 'Enter the confirmation shown in the review.');
    const token = crypto.randomUUID(),
      date = new Date().toISOString(),
      plan = prepareRestoredPlan(file?.plan ?? null),
      payload = JSON.stringify(plan),
      version = state.version + 1,
      epoch = account.epoch + 1;
    if (new TextEncoder().encode(payload).byteLength > 1500000)
      throw new HttpError(
        413,
        'This journal exceeds the 1.5 MB recovery limit after normalization. Keep the original file; it needs an assisted recovery. Your current data is unchanged.',
      );
    const statements = [
      db
        .prepare(
          'UPDATE accounts SET epoch=epoch+1,revision=revision+1,status=?,operation_id=? WHERE owner=? AND epoch=? AND revision=?',
        )
        .bind(
          kind === 'delete' ? 'closed' : 'active',
          token,
          owner,
          account.epoch,
          account.revision,
        ),
      db
        .prepare(
          'INSERT INTO athlete_state(owner,version,data,updated_at,write_token) SELECT owner,?,?,?,? FROM accounts WHERE owner=? AND operation_id=? ON CONFLICT(owner) DO UPDATE SET version=excluded.version,data=excluded.data,updated_at=excluded.updated_at,write_token=excluded.write_token',
        )
        .bind(version, payload, date, token, owner, token),
    ];
    for (const table of [
      'profiles',
      'connections',
      'deliveries',
      'standalone_runs',
      'request_limits',
    ])
      statements.push(
        db
          .prepare(
            `DELETE FROM ${table} WHERE owner=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=${table}.owner AND a.operation_id=?)`,
          )
          .bind(owner, token),
      );
    if (kind === 'delete')
      statements.push(
        db
          .prepare(
            'DELETE FROM revisions WHERE owner=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=revisions.owner AND a.operation_id=?)',
          )
          .bind(owner, token),
      );
    else {
      statements.push(
        db
          .prepare(
            'INSERT INTO revisions(owner,version,data,label,created_at) SELECT owner,version,data,?,updated_at FROM athlete_state WHERE owner=? AND write_token=?',
          )
          .bind(
            kind === 'restore'
              ? 'Restored a recovery copy; provider connections cleared'
              : 'Opened an empty journal',
            owner,
            token,
          ),
      );
      for (const r of file?.standaloneRuns ?? [])
        statements.push(
          db
            .prepare(
              'INSERT INTO standalone_runs(owner,id,data,updated_at) SELECT owner,?,?,? FROM accounts WHERE owner=? AND operation_id=?',
            )
            .bind(r.id, JSON.stringify(r), r.recordedAt, owner, token),
        );
      if (file?.profile) {
        const p = file.profile;
        statements.push(
          db
            .prepare(
              'INSERT INTO profiles(owner,display_name,city,units,timezone,accent,updated_at) SELECT owner,?,?,?,?,?,? FROM accounts WHERE owner=? AND operation_id=?',
            )
            .bind(
              p.display_name,
              p.city,
              p.units,
              p.timezone,
              p.accent,
              date,
              owner,
              token,
            ),
        );
      }
    }
    statements.push(
      db
        .prepare(
          "UPDATE recovery_operations SET status='complete' WHERE owner=? AND id=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=recovery_operations.owner AND a.operation_id=?)",
        )
        .bind(owner, op.id, token),
    );
    statements.push(
      db
        .prepare(
          'DELETE FROM recovery_operations WHERE owner=? AND id<>? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=recovery_operations.owner AND a.operation_id=?)',
        )
        .bind(owner, op.id, token),
    );
    const results = await db.batch(statements);
    if (results[0].meta.changes !== 1) {
      const completed = await db
        .prepare(
          'SELECT status,digest,kind FROM recovery_operations WHERE owner=? AND id=?',
        )
        .bind(owner, op.id)
        .first<Operation>();
      if (
        completed?.status === 'complete' &&
        completed.digest === hash &&
        completed.kind === kind
      )
        return json({
          ...(await readState(owner)),
          alreadyCompleted: true,
          accountStatus: (await readAccount(owner)).status,
        });
      throw new HttpError(
        409,
        'Your account changed during this operation. Reload to check the saved result.',
      );
    }
    return json({
      accountId: account.account_id,
      accountEpoch: epoch,
      version,
      plan,
      updatedAt: date,
      accountStatus: kind === 'delete' ? 'closed' : 'active',
      lastChange:
        kind === 'restore'
          ? 'Recovery copy restored'
          : kind === 'delete'
            ? 'Local journal deleted'
            : 'Empty journal opened',
    });
  } catch (e) {
    return failure(e);
  }
}
