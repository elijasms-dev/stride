import { beginRequestObservation } from '@/lib/request-observation';
import {
  AccountContextError,
  database,
  failure,
  HttpError,
  json,
  ownerId,
  requestLimit,
} from '@/lib/server';
import {
  parseRevisionPlan,
  reviewRevision,
  type RevisionMetadata,
} from '@/lib/revision-review';

type AccountStamp = { account_id: string; epoch: number; status: string };
type Snapshot = RevisionMetadata & { data: string };

export async function GET(request: Request) {
  const observation = beginRequestObservation(request);
  try {
    const owner = ownerId(request);
    await requestLimit(owner, 'history-review', 30);
    const url = new URL(request.url),
      rawVersion = url.searchParams.get('version'),
      rawOffset = url.searchParams.get('offset') ?? '0';
    if (
      !rawVersion ||
      !/^[1-9]\d*$/.test(rawVersion) ||
      !Number.isSafeInteger(Number(rawVersion)) ||
      !/^\d+$/.test(rawOffset) ||
      !Number.isSafeInteger(Number(rawOffset)) ||
      Number(rawOffset) > 10000
    )
      throw new HttpError(422, 'Choose a valid saved revision.');
    const version = Number(rawVersion),
      offset = Number(rawOffset),
      db = database();
    const readStamp = () =>
      db
        .prepare('SELECT account_id,epoch,status FROM accounts WHERE owner=?')
        .bind(owner)
        .first<AccountStamp>();
    const account = await readStamp();
    if (!account) throw new HttpError(404, 'No saved revision is available.');
    if (account.status !== 'active') throw new AccountContextError();
    // Measure bytes before reading JSON: at most two bounded snapshots enter memory.
    const metadata = await db
      .prepare(
        'SELECT version,length(CAST(data AS BLOB)) AS bytes FROM revisions WHERE owner=? AND version<=? ORDER BY version DESC LIMIT 2',
      )
      .bind(owner, version)
      .all<{ version: number; bytes: number }>();
    if (metadata.results[0]?.version !== version)
      throw new HttpError(404, 'This saved revision is no longer available.');
    if (metadata.results.some((r) => r.bytes > 1500000))
      throw new HttpError(
        413,
        'This saved revision is too large to compare here. Download it from Account data instead.',
      );
    const selected = metadata.results.map((r) => r.version);
    const snapshots = await db
      .prepare(
        `SELECT version,data,label,created_at FROM revisions WHERE owner=? AND version IN (${selected.map(() => '?').join(',')}) AND length(CAST(data AS BLOB))<=1500000 ORDER BY version DESC`,
      )
      .bind(owner, ...selected)
      .all<Snapshot>();
    if (snapshots.results.length !== selected.length)
      throw new AccountContextError();
    const [current, previous] = snapshots.results;
    let review;
    try {
      review = reviewRevision(
        previous ? parseRevisionPlan(previous.data) : null,
        parseRevisionPlan(current.data),
        {
          version: current.version,
          label: current.label,
          created_at: current.created_at,
        },
        previous?.version ?? null,
        offset,
      );
    } catch {
      throw new HttpError(
        409,
        'This saved revision cannot be compared. Its original snapshot remains available in Account data.',
      );
    }
    const latest = await readStamp();
    if (
      !latest ||
      latest.account_id !== account.account_id ||
      latest.epoch !== account.epoch ||
      latest.status !== 'active'
    )
      throw new AccountContextError();
    return json({
      accountId: account.account_id,
      accountEpoch: account.epoch,
      ...review,
    });
  } catch (error) {
    return failure(error, observation);
  }
}
