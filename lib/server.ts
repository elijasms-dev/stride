import { FitExportError } from './fit-error';
import { readAccount } from './accounts';
import { env } from 'cloudflare:workers';
import { PlanError, type State } from './engine';
export class HttpError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
/** Only the provider adapter can establish that a request was never dispatched
 * or was explicitly rejected. A timeout/server error remains ambiguous. */
export class ProviderRequestRejected extends HttpError {}
export class AccountContextError extends HttpError {
  constructor() {
    super(
      409,
      'Your account changed or this window is out of date. Reopen your journal before saving.',
    );
  }
}
export function database() {
  if (!env.DB)
    throw new HttpError(
      503,
      'Your journal is temporarily unavailable. Please try again.',
    );
  return env.DB;
}
export function ownerId(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id)
    throw new HttpError(
      401,
      'Sign in to access your private training journal.',
    );
  return id;
}
export function guardWrite(request: Request) {
  const origin = request.headers.get('origin');
  const u = new URL(request.url);
  if (!origin || origin !== u.origin)
    throw new HttpError(403, 'This request must come from your Stride app.');
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'Use a JSON request.');
}
export async function body(
  request: Request,
  limit = 100000,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') ?? 0) > limit)
    throw new HttpError(413, 'This request is too large.');
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let raw = '',
    size = 0;
  if (reader)
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, 'This request is too large.');
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
  raw += decoder.decode();
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new HttpError(400, 'Check the information and try again.');
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof FitExportError)
    return json({ error: error.message, code: error.code }, 502);
  if (error instanceof HttpError) {
    const r = json(
      {
        error: error.message,
        ...(error instanceof AccountContextError
          ? { code: 'ACCOUNT_CONTEXT_CHANGED' }
          : {}),
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      },
      error.status,
    );
    if (error.retryAfter)
      r.headers.set('Retry-After', String(error.retryAfter));
    return r;
  }
  if (error instanceof PlanError) return json({ error: error.message }, 422);
  const requestId = crypto.randomUUID();
  // No identity, request body, notes, URL, provider payload or secret enters logs.
  console.error(
    JSON.stringify({
      event: 'stride_request_failed',
      requestId,
      status: 500,
      at: new Date().toISOString(),
    }),
  );
  const r = json(
    {
      error:
        'The request could not be completed. Reload to check your journal before retrying.',
      requestId,
    },
    500,
  );
  r.headers.set('X-Request-Id', requestId);
  return r;
}
export async function requestLimit(
  owner: string,
  bucket: string,
  limit = 120,
  seconds = 60,
) {
  const now = Math.floor(Date.now() / 1000),
    db = database();
  const result = await db
    .prepare(
      `INSERT INTO request_limits(owner,bucket,count,reset_at) VALUES(?,?,1,?) ON CONFLICT(owner,bucket) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END WHERE reset_at<=? OR count<?`,
    )
    .bind(owner, bucket, now + seconds, now, now, now, limit)
    .run();
  if (result.meta.changes !== 1) {
    const row = await db
      .prepare('SELECT reset_at FROM request_limits WHERE owner=? AND bucket=?')
      .bind(owner, bucket)
      .first<{ reset_at: number }>();
    const e = new HttpError(
      429,
      'Too many requests. Wait before trying again.',
    );
    e.retryAfter = Math.max(1, (row?.reset_at ?? now + seconds) - now);
    throw e;
  }
}
export async function readState(owner: string): Promise<State> {
  const account = await readAccount(owner);
  const row = await database()
    .prepare(
      'SELECT version, data, updated_at FROM athlete_state WHERE owner = ?',
    )
    .bind(owner)
    .first<{ version: number; data: string; updated_at: string }>();
  const standaloneRuns = await database()
    .prepare(
      'SELECT data FROM standalone_runs WHERE owner=? ORDER BY updated_at DESC',
    )
    .bind(owner)
    .all<{ data: string }>();
  const loose = standaloneRuns.results.map((r) => JSON.parse(r.data));
  return row
    ? {
        standaloneRuns: loose,
        accountId: account.account_id,
        accountEpoch: account.epoch,
        accountStatus: account.status,
        version: row.version,
        plan: JSON.parse(row.data),
        updatedAt: row.updated_at,
      }
    : {
        standaloneRuns: loose,
        accountId: account.account_id,
        accountEpoch: account.epoch,
        accountStatus: account.status,
        version: 0,
        plan: null,
        updatedAt: null,
      };
}
export async function saveState(
  owner: string,
  version: number,
  data: State['plan'],
  label: string,
  epoch: number,
  transferRevision?: number,
  importIdentity?: ProviderIdentity,
): Promise<State> {
  const db = database(),
    date = new Date().toISOString(),
    payload = JSON.stringify(data),
    nextVersion = version + 1,
    token = crypto.randomUUID();
  if (new TextEncoder().encode(payload).byteLength > 1500000)
    throw new HttpError(
      413,
      'Your journal is too large for this release. Export a recovery copy and contact support before adding more records. Existing data is unchanged.',
    );
  const saved = await db.batch([
    db
      .prepare(
        `INSERT INTO athlete_state(owner,version,data,updated_at,write_token) SELECT owner,?,?,?,? FROM accounts WHERE owner=? AND epoch=? AND status='active' AND (? IS NULL OR revision=?) AND (?=0 OR EXISTS(SELECT 1 FROM athlete_state a WHERE a.owner=accounts.owner AND a.version=?)) AND (? IS NULL OR EXISTS(SELECT 1 FROM connections c WHERE c.owner=accounts.owner AND c.provider_athlete_id=? AND c.generation=?)) ON CONFLICT(owner) DO UPDATE SET version=excluded.version,data=excluded.data,updated_at=excluded.updated_at,write_token=excluded.write_token WHERE athlete_state.version=?`,
      )
      .bind(
        nextVersion,
        payload,
        date,
        token,
        owner,
        epoch,
        transferRevision ?? null,
        transferRevision ?? null,
        version,
        version,
        importIdentity?.generation ?? null,
        importIdentity?.athleteId ?? null,
        importIdentity?.generation ?? null,
        version,
      ),
    db
      .prepare(
        'INSERT OR IGNORE INTO revisions(owner,version,data,label,created_at) SELECT owner,version,data,?,updated_at FROM athlete_state WHERE owner=? AND write_token=?',
      )
      .bind(label, owner, token),
    db
      .prepare(
        'UPDATE accounts SET revision=revision+1 WHERE owner=? AND epoch=? AND EXISTS(SELECT 1 FROM athlete_state a WHERE a.owner=accounts.owner AND a.write_token=?)',
      )
      .bind(owner, epoch, token),
    ...(transferRevision === undefined
      ? []
      : [
          db
            .prepare(
              'DELETE FROM standalone_runs WHERE owner=? AND EXISTS(SELECT 1 FROM athlete_state s WHERE s.owner=standalone_runs.owner AND s.write_token=?)',
            )
            .bind(owner, token),
        ]),
    ...(importIdentity
      ? [
          importReceiptStatement(
            owner,
            importIdentity,
            epoch,
            date,
            'state',
            token,
          ),
        ]
      : []),
  ]);
  if (saved[0].meta.changes !== 1)
    throw new HttpError(
      409,
      'Your journal or account changed in another window. Reload before saving.',
    );
  return {
    accountId: (await readAccount(owner)).account_id,
    accountEpoch: epoch,
    version: nextVersion,
    plan: data,
    updatedAt: date,
    lastChange: label,
  };
}
async function cipherKey() {
  const secret = (env as unknown as Record<string, string>)
    .STRIDE_ENCRYPTION_KEY;
  if (!secret)
    throw new HttpError(
      503,
      'Secure connections are not configured yet. Your plan and workout downloads are available.',
    );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
export async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await cipherKey(),
      new TextEncoder().encode(value),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...bytes));
}
export async function decrypt(value: string) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    await cipherKey(),
    bytes.slice(12),
  );
  return new TextDecoder().decode(plain);
}
export type ProviderConnection = {
  key: string;
  athleteId: string;
  generation: string;
};
export type ProviderIdentity = Pick<
  ProviderConnection,
  'athleteId' | 'generation'
>;
/** Included in the same batch as the successful journal write, never after a redirect or provider read. */
export function importReceiptStatement(
  owner: string,
  identity: ProviderIdentity,
  epoch: number,
  at: string,
  writeKind: 'state' | 'account',
  token: string,
) {
  const fence =
    writeKind === 'state'
      ? 'EXISTS(SELECT 1 FROM athlete_state s WHERE s.owner=connections.owner AND s.write_token=?)'
      : 'EXISTS(SELECT 1 FROM accounts s WHERE s.owner=connections.owner AND s.operation_id=?)';
  return database()
    .prepare(
      `UPDATE connections SET activity_imported_at=?,activity_import_count=activity_import_count+1 WHERE owner=? AND provider_athlete_id=? AND generation=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=connections.owner AND a.epoch=? AND a.status='active') AND ${fence}`,
    )
    .bind(at, owner, identity.athleteId, identity.generation, epoch, token);
}
export async function provider(owner: string): Promise<ProviderConnection> {
  const row = await database()
    .prepare(
      'SELECT encrypted_key,provider_athlete_id,generation FROM connections WHERE owner=?',
    )
    .bind(owner)
    .first<{
      encrypted_key: string;
      provider_athlete_id: string;
      generation: string;
    }>();
  if (!row) throw new HttpError(409, 'Connect Intervals.icu first.');
  if (
    row.provider_athlete_id === '__legacy__' ||
    row.generation === '__legacy__'
  )
    throw new HttpError(
      409,
      'Reconnect Intervals.icu to verify the athlete account before sending or importing.',
    );
  return {
    key: await decrypt(row.encrypted_key),
    athleteId: row.provider_athlete_id,
    generation: row.generation,
  };
}
export async function assertConnection(
  owner: string,
  connection: ProviderConnection,
) {
  const row = await database()
    .prepare(
      'SELECT provider_athlete_id,generation FROM connections WHERE owner=?',
    )
    .bind(owner)
    .first<{ provider_athlete_id: string; generation: string }>();
  if (
    !row ||
    row.provider_athlete_id !== connection.athleteId ||
    row.generation !== connection.generation
  )
    throw new HttpError(
      409,
      'Your connection changed. Reopen the connection screen before retrying.',
    );
}
export async function intervals(
  key: string,
  path: string,
  init: RequestInit = {},
  allowMissing = false,
  owner?: string,
) {
  let r: Response;
  if (owner) {
    const cooldown = await database()
      .prepare(
        "SELECT reset_at FROM request_limits WHERE owner=? AND bucket='provider-cooldown'",
      )
      .bind(owner)
      .first<{ reset_at: number }>();
    if (cooldown && cooldown.reset_at > Date.now() / 1000) {
      const e = new ProviderRequestRejected(
        429,
        'Intervals.icu has asked us to wait before another request.',
      );
      e.retryAfter = Math.ceil(cooldown.reset_at - Date.now() / 1000);
      throw e;
    }
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Basic ' + btoa('API_KEY:' + key));
  headers.set('Content-Type', 'application/json');
  try {
    r = await fetch('https://intervals.icu/api/v1' + path, {
      ...init,
      headers,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new HttpError(
      502,
      'Intervals.icu did not respond. Check the connection and try again.',
    );
  }
  if (
    !r.ok &&
    !(r.status === 404 && (allowMissing || init.method === 'DELETE'))
  ) {
    if (r.status === 401 || r.status === 403)
      throw new ProviderRequestRejected(
        401,
        'Intervals.icu rejected the key. Reconnect with a valid personal API key.',
      );
    if (r.status === 429) {
      const raw = r.headers.get('Retry-After'),
        date = raw ? Date.parse(raw) : NaN;
      const delay =
        raw && /^\d+$/.test(raw)
          ? Number(raw)
          : Number.isFinite(date)
            ? Math.ceil((date - Date.now()) / 1000)
            : 60;
      const retryAfter = Math.max(1, Math.min(604800, delay));
      if (owner)
        await database()
          .prepare(
            "INSERT INTO request_limits(owner,bucket,count,reset_at) VALUES(?,'provider-cooldown',0,?) ON CONFLICT(owner,bucket) DO UPDATE SET reset_at=MAX(reset_at,excluded.reset_at)",
          )
          .bind(owner, Math.floor(Date.now() / 1000) + retryAfter)
          .run();
      const e = new ProviderRequestRejected(
        429,
        `Intervals.icu has asked us to wait ${retryAfter} seconds before trying again.`,
      );
      e.retryAfter = retryAfter;
      throw e;
    }
    throw new HttpError(
      502,
      'Intervals.icu could not complete that request. No watch delivery has been confirmed.',
    );
  }
  return r;
}
