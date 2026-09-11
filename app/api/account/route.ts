import { ownerId, json, failure, database } from '@/lib/server';
import { readAccount } from '@/lib/accounts';
export async function GET(request: Request) {
  try {
    const a = await readAccount(ownerId(request));
    const db = database();
    const planSize = await db
      .prepare(
        'SELECT length(CAST(data AS BLOB)) AS bytes FROM athlete_state WHERE owner=?',
      )
      .bind(a.owner)
      .first<{ bytes: number }>();
    const runs = await db
      .prepare(
        'SELECT COUNT(*) AS count,COALESCE(SUM(length(CAST(data AS BLOB))),0) AS bytes FROM standalone_runs WHERE owner=?',
      )
      .bind(a.owner)
      .first<{ count: number; bytes: number }>();
    const measurements = await db
      .prepare(
        "SELECT bucket,count,reset_at FROM request_limits WHERE owner=? AND bucket LIKE 'measure:%' AND reset_at>?",
      )
      .bind(a.owner, Math.floor(Date.now() / 1000))
      .all();
    return json({
      accountEpoch: a.epoch,
      accountRevision: a.revision,
      status: a.status,
      accountId: a.account_id,
      access: 'Private preview',
      billing: 'Not enabled',
      measurements: measurements.results,
      storage: {
        journalBytes: planSize?.bytes ?? 0,
        journalLimit: 1500000,
        preplanBytes: runs?.bytes ?? 0,
        preplanLimit: 500000,
        preplanRuns: runs?.count ?? 0,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
