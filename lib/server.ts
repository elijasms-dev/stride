import { encryptCredential, decryptCredential, credentialNeedsRotation, CredentialConfigurationError, type CredentialSecrets } from './credential-encryption';
import { safeRequestObservation, type RequestObservation } from './request-observation';
import { FitExportError } from './fit-error';
import { withCurrentFeasibility } from './plan/feasibility';
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
export class MutationConflictError extends HttpError {
  constructor() {
    super(
      409,
      'This save identifier already belongs to different information. Reopen the saved run before making a correction.',
    );
  }
}

export type JournalMutation = { id: string; requestHash: string };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonicalJson(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

export async function journalMutation(
  input: Record<string, unknown>,
): Promise<JournalMutation | undefined> {
  if (input.mutationId === undefined) return undefined;
  if (
    typeof input.mutationId !== 'string' ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(input.mutationId)
  )
    throw new HttpError(
      400,
      'This save identifier is invalid. Reopen the run and try again.',
    );
  if (
    ![
      'freeRun',
      'complete',
      'correctLog',
      'correctExtra',
      'attachRecording',
      'skip',
    ].includes(String(input.action))
  )
    throw new HttpError(400, 'This operation does not support a queued save.');
  const payload = Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => key !== 'version' && key !== 'mutationId',
    ),
  );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(payload)),
  );
  return {
    id: input.mutationId,
    requestHash: Array.from(new Uint8Array(digest), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join(''),
  };
}

export async function replayMutation(
  owner: string,
  epoch: number,
  mutation?: JournalMutation,
): Promise<State | null> {
  if (!mutation) return null;
  const receipt = await database()
    .prepare(
      'SELECT request_hash FROM journal_mutations WHERE owner=? AND epoch=? AND id=?',
    )
    .bind(owner, epoch, mutation.id)
    .first<{ request_hash: string }>();
  if (!receipt) return null;
  if (receipt.request_hash !== mutation.requestHash)
    throw new MutationConflictError();
  const state = await readState(owner);
  if (state.accountEpoch !== epoch || state.accountStatus !== 'active')
    throw new AccountContextError();
  return { ...state, acknowledgedMutationId: mutation.id };
}

export function mutationReceiptStatement(
  owner: string,
  epoch: number,
  mutation: JournalMutation,
  at: string,
  fence: 'state' | 'account',
  token: string,
) {
  const condition =
    fence === 'state'
      ? 'EXISTS(SELECT 1 FROM athlete_state s WHERE s.owner=accounts.owner AND s.write_token=?)'
      : 'operation_id=?';
  return database()
    .prepare(
      `INSERT INTO journal_mutations(owner,epoch,id,request_hash,created_at) SELECT owner,epoch,?,?,? FROM accounts WHERE owner=? AND epoch=? AND ${condition}`,
    )
    .bind(mutation.id, mutation.requestHash, at, owner, epoch, token);
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
function failureResponse(error: unknown) {
  if (error instanceof FitExportError)
    return json({ error: error.message, code: error.code }, 502);
  if (error instanceof HttpError) {
    const r = json(
      {
        error: error.message,
        ...(error instanceof AccountContextError
          ? { code: 'ACCOUNT_CONTEXT_CHANGED' }
          : {}),
        ...(error instanceof MutationConflictError
          ? { code: 'MUTATION_CONFLICT' }
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
export function failure(error: unknown, observation?: RequestObservation) {
  const response = failureResponse(error);
  if (response.status >= 500) {
    const requestId = response.headers.get('X-Request-Id') ?? crypto.randomUUID();
    response.headers.set('X-Request-Id', requestId);
    // Never include message/stack, URL, account, request body or provider payload.
    console.error(JSON.stringify({
      event: 'stride_request_failed', requestId, status: response.status,
      ...safeRequestObservation(observation),
      category: error instanceof FitExportError ? 'workout-export' :
        error instanceof SyntaxError ? 'invalid-stored-data' :
        error instanceof TypeError ? 'runtime-type-error' :
        response.status === 502 ? 'provider-unavailable' :
        response.status === 503 ? 'service-unavailable' : 'unexpected',
      at: new Date().toISOString(),
    }));
  }
  return response;
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
  const storedPlan: State['plan'] = row ? JSON.parse(row.data) : null;
  return row
    ? {
        standaloneRuns: loose,
        accountId: account.account_id,
        accountEpoch: account.epoch,
        accountStatus: account.status,
        version: row.version,
        plan: storedPlan ? withCurrentFeasibility(storedPlan) : null,
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
export const RETAINED_REVISIONS = 50;
export function pruneRevisionsStatement(owner: string, writeToken: string) {
  // Current journal contains the full recorded history. Only older undo
  // snapshots are compacted; latest and previous always remain recoverable.
  return database().prepare('DELETE FROM revisions WHERE owner=? AND version NOT IN (SELECT version FROM revisions WHERE owner=? ORDER BY version DESC LIMIT ?) AND EXISTS(SELECT 1 FROM athlete_state s WHERE s.owner=revisions.owner AND s.write_token=?)')
    .bind(owner, owner, RETAINED_REVISIONS, writeToken);
}
export async function saveState(
  owner: string,
  version: number,
  data: State['plan'],
  label: string,
  epoch: number,
  transferRevision?: number,
  importIdentity?: ProviderIdentity,
  mutation?: JournalMutation,
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
        `INSERT INTO athlete_state(owner,version,data,updated_at,write_token) SELECT owner,?,?,?,? FROM accounts WHERE owner=? AND epoch=? AND status='active' AND (? IS NULL OR revision=?) AND (?=0 OR EXISTS(SELECT 1 FROM athlete_state a WHERE a.owner=accounts.owner AND a.version=?)) AND (? IS NULL OR EXISTS(SELECT 1 FROM connections c WHERE c.owner=accounts.owner AND c.provider_athlete_id=? AND c.generation=?)) AND NOT EXISTS(SELECT 1 FROM journal_mutations m WHERE m.owner=accounts.owner AND m.epoch=accounts.epoch AND m.id=?) ON CONFLICT(owner) DO UPDATE SET version=excluded.version,data=excluded.data,updated_at=excluded.updated_at,write_token=excluded.write_token WHERE athlete_state.version=?`,
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
        mutation?.id ?? null,
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
    ...(mutation
      ? [mutationReceiptStatement(owner, epoch, mutation, date, 'state', token)]
      : []),
    pruneRevisionsStatement(owner, token),
  ]);
  if (saved[0].meta.changes !== 1) {
    const replay = await replayMutation(owner, epoch, mutation);
    if (replay) return replay;
    throw new HttpError(
      409,
      'Your journal or account changed in another window. Reload before saving.',
    );
  }
  return {
    ...(mutation ? { acknowledgedMutationId: mutation.id } : {}),
    accountId: (await readAccount(owner)).account_id,
    accountEpoch: epoch,
    version: nextVersion,
    plan: data ? withCurrentFeasibility(data) : null,
    updatedAt: date,
    lastChange: label,
  };
}
function credentialSecrets() { return env as unknown as CredentialSecrets; }
export async function encrypt(value: string) {
  try { return await encryptCredential(value, credentialSecrets()); }
  catch (error) {
    if (error instanceof CredentialConfigurationError)
      throw new HttpError(503, 'Secure connections are not configured yet. Your plan and workout downloads are available.');
    throw error;
  }
}
export async function decrypt(value: string) {
  try { return await decryptCredential(value, credentialSecrets()); }
  catch (error) {
    if (error instanceof CredentialConfigurationError)
      throw new HttpError(503, 'Secure connections are temporarily unavailable. Your plan and workout downloads are available.');
    throw error;
  }
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
  const key = await decrypt(row.encrypted_key);
  if (credentialNeedsRotation(row.encrypted_key, credentialSecrets())) {
    const replacement = await encrypt(key);
    // Compare-and-swap: rotation must never overwrite a concurrent reconnect.
    await database().prepare('UPDATE connections SET encrypted_key=? WHERE owner=? AND generation=? AND encrypted_key=?')
      .bind(replacement, owner, row.generation, row.encrypted_key).run();
  }
  return { key, athleteId: row.provider_athlete_id, generation: row.generation };
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
