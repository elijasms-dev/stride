import { activeAccount } from './accounts';
import {
  database,
  HttpError,
  provider,
  readState,
  requestLimit,
} from './server';
import { prescriptionHash, syncWorkout } from './garmin';

type Job = {
  id: string;
  owner: string;
  epoch: number;
  workout_id: string;
  version: number;
  action: 'send' | 'check';
  provider_athlete_id: string;
  connection_generation: string;
  prescription_hash: string | null;
  status: string;
  attempts: number;
  available_at: string;
  lease_until: string | null;
  lease_token: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
};
type JobResult = {
  status: string;
  message?: string;
  remoteId?: string | null;
  jobId?: string;
  retryAt?: string;
  errorStatus?: number;
};
export const DELIVERY_JOB_ATTEMPTS = 5;
export const DELIVERY_JOB_LEASE_MS = 120000;
export const MAX_PENDING_DELIVERY_JOBS = 20;

async function job(owner: string, epoch: number, id: string) {
  return database()
    .prepare('SELECT * FROM delivery_jobs WHERE owner=? AND epoch=? AND id=?')
    .bind(owner, epoch, id)
    .first<Job>();
}

/** Only called by an authenticated, explicit send/check/reconcile request. */
export async function enqueueDelivery(
  owner: string,
  epoch: number,
  workoutId: string,
  version: number,
  action: 'send' | 'check',
) {
  await activeAccount(owner, epoch);
  if (
    !workoutId ||
    workoutId.length > 250 ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    throw new HttpError(422, 'Choose a workout in the current plan.');
  const state = await readState(owner),
    connection = await provider(owner);
  if (!state.plan || state.version !== version)
    throw new HttpError(
      409,
      'Load the latest plan before sending this workout.',
    );
  const workout = state.plan.workouts.find((w) => w.id === workoutId);
  if (!workout) {
    const receipt = await database()
      .prepare(
        'SELECT workout_id FROM deliveries WHERE owner=? AND provider_athlete_id=? AND workout_id=?',
      )
      .bind(owner, connection.athleteId, workoutId)
      .first();
    if (!receipt) throw new HttpError(404, 'Workout not found.');
  }
  const now = new Date().toISOString(),
    id = crypto.randomUUID();
  await database()
    .prepare(`INSERT INTO delivery_jobs(owner,epoch,id,workout_id,version,action,provider_athlete_id,connection_generation,prescription_hash,status,available_at,created_at,updated_at)
    SELECT owner,epoch,?,?,?,?,?,?,?,'queued',?,?,? FROM accounts
    WHERE owner=? AND epoch=? AND status='active'
      AND EXISTS(SELECT 1 FROM connections c WHERE c.owner=accounts.owner AND c.provider_athlete_id=? AND c.generation=?)
      AND EXISTS(SELECT 1 FROM athlete_state s WHERE s.owner=accounts.owner AND s.version=?)
      AND ((SELECT count(*) FROM delivery_jobs j WHERE j.owner=accounts.owner AND j.epoch=accounts.epoch AND j.status IN ('queued','retry','processing'))<?
        OR EXISTS(SELECT 1 FROM delivery_jobs j WHERE j.owner=accounts.owner AND j.epoch=accounts.epoch AND j.connection_generation=? AND j.workout_id=? AND j.version=? AND j.action=?))
    ON CONFLICT(owner,epoch,connection_generation,workout_id,version,action) DO UPDATE SET status='queued',attempts=0,available_at=excluded.available_at,lease_token=NULL,lease_until=NULL,result=NULL,updated_at=excluded.updated_at
      WHERE delivery_jobs.status IN ('complete','review','cancelled')`)
    .bind(
      id,
      workoutId,
      version,
      action,
      connection.athleteId,
      connection.generation,
      workout ? await prescriptionHash(workout) : null,
      now,
      now,
      now,
      owner,
      epoch,
      connection.athleteId,
      connection.generation,
      version,
      MAX_PENDING_DELIVERY_JOBS,
      connection.generation,
      workoutId,
      version,
      action,
    )
    .run();
  const queued = await database()
    .prepare(
      'SELECT * FROM delivery_jobs WHERE owner=? AND epoch=? AND connection_generation=? AND workout_id=? AND version=? AND action=?',
    )
    .bind(owner, epoch, connection.generation, workoutId, version, action)
    .first<Job>();
  if (!queued)
    throw new HttpError(
      409,
      'The delivery queue is full or your plan changed. Refresh and resolve pending deliveries before adding more.',
    );
  return queued.id;
}

function pending(job: Job): JobResult {
  return {
    status: 'queued',
    jobId: job.id,
    retryAt:
      job.status === 'processing'
        ? (job.lease_until ?? job.available_at)
        : job.available_at,
    message:
      'Delivery is saved for retry. Open Connections and choose Resume deliveries when connected.',
  };
}

/** No detached promise or pretend scheduler. Request handlers process at most two
 * jobs; a future worker must call this same fenced path with the saved scope. */
export async function runDeliveryJob(
  owner: string,
  epoch: number,
  id: string,
  execute: typeof syncWorkout = syncWorkout,
): Promise<JobResult> {
  await activeAccount(owner, epoch);
  const saved = await job(owner, epoch, id);
  if (!saved)
    throw new HttpError(404, 'This delivery request is no longer available.');
  if (
    saved.status === 'complete' ||
    saved.status === 'review' ||
    saved.status === 'cancelled'
  )
    return {
      ...JSON.parse(
        saved.result ??
          '{"status":"review","message":"Review this delivery before trying again."}',
      ),
      jobId: id,
    };
  const now = new Date().toISOString(),
    token = crypto.randomUUID();
  if (
    saved.attempts >= DELIVERY_JOB_ATTEMPTS &&
    (!saved.lease_until || saved.lease_until <= now)
  ) {
    const result = {
      status: 'review',
      message:
        'Delivery stopped after repeated interruptions. Check the provider calendar before sending again.',
      jobId: id,
    };
    await database()
      .prepare(
        "UPDATE delivery_jobs SET status='review',result=?,updated_at=? WHERE owner=? AND epoch=? AND id=? AND attempts>=? AND (lease_until IS NULL OR lease_until<=?)",
      )
      .bind(
        JSON.stringify(result),
        now,
        owner,
        epoch,
        id,
        DELIVERY_JOB_ATTEMPTS,
        now,
      )
      .run();
    return result;
  }
  await requestLimit(owner, 'delivery-jobs', 12, 60);
  const leaseUntil = new Date(Date.now() + DELIVERY_JOB_LEASE_MS).toISOString();
  const claimed = await database()
    .prepare(`UPDATE delivery_jobs SET status='processing',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=?
    WHERE owner=? AND epoch=? AND id=? AND attempts<? AND available_at<=?
    AND (status IN ('queued','retry') OR (status='processing' AND lease_until<=?))
    AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=delivery_jobs.owner AND a.epoch=delivery_jobs.epoch AND a.status='active')
    AND NOT EXISTS(SELECT 1 FROM delivery_jobs other WHERE other.owner=delivery_jobs.owner AND other.epoch=delivery_jobs.epoch AND other.id<>delivery_jobs.id AND other.status='processing' AND other.lease_until>?)`)
    .bind(
      token,
      leaseUntil,
      now,
      owner,
      epoch,
      id,
      DELIVERY_JOB_ATTEMPTS,
      now,
      now,
      now,
    )
    .run();
  if (claimed.meta.changes !== 1)
    return pending((await job(owner, epoch, id)) ?? saved);
  const finish = async (
    status: string,
    result: JobResult,
    availableAt = now,
  ) => {
    const written = await database()
      .prepare(
        "UPDATE delivery_jobs SET status=?,result=?,available_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE owner=? AND epoch=? AND id=? AND lease_token=? AND EXISTS(SELECT 1 FROM accounts a WHERE a.owner=delivery_jobs.owner AND a.epoch=delivery_jobs.epoch AND a.status='active')",
      )
      .bind(
        status,
        JSON.stringify(result),
        availableAt,
        new Date().toISOString(),
        owner,
        epoch,
        id,
        token,
      )
      .run();
    if (written.meta.changes !== 1)
      throw new HttpError(
        409,
        'Your account or delivery changed. Reload to check its status.',
      );
    return { ...result, jobId: id };
  };
  try {
    const state = await readState(owner),
      connection = await provider(owner);
    const workout = state.plan?.workouts.find((w) => w.id === saved.workout_id);
    if (
      state.version !== saved.version ||
      connection.generation !== saved.connection_generation ||
      connection.athleteId !== saved.provider_athlete_id ||
      (workout ? await prescriptionHash(workout) : null) !==
        saved.prescription_hash
    )
      return await finish('review', {
        status: 'review',
        message:
          'The plan or connected account changed. Review the current workout before sending it again.',
      });
    const result = await execute(
      owner,
      saved.workout_id,
      saved.version,
      false,
      epoch,
      saved.action === 'check',
      {
        athleteId: saved.provider_athlete_id,
        generation: saved.connection_generation,
      },
    );
    return await finish(
      ['review', 'stale', 'failed'].includes(result.status)
        ? 'review'
        : 'complete',
      result,
    );
  } catch (error) {
    const attempts = saved.attempts + 1;
    const status = error instanceof HttpError ? error.status : 503;
    const transient = status === 429 || status >= 500;
    if (transient && attempts < DELIVERY_JOB_ATTEMPTS) {
      const retrySeconds = Math.max(
        Math.min(900, 15 * 2 ** (attempts - 1)),
        error instanceof HttpError ? (error.retryAfter ?? 0) : 0,
      );
      const retryAt = new Date(Date.now() + retrySeconds * 1000).toISOString();
      return await finish(
        'retry',
        {
          status: 'queued',
          retryAt,
          errorStatus: status,
          message:
            'Delivery was interrupted and is saved for retry. Resume deliveries in Connections; an uncertain upload is checked before any new copy is created.',
        },
        retryAt,
      );
    }
    return await finish('review', {
      status: 'review',
      errorStatus: status,
      message:
        error instanceof HttpError
          ? error.message
          : 'Delivery could not be confirmed. Review the provider calendar before trying again.',
    });
  }
}

export async function listDeliveryJobs(owner: string, epoch: number) {
  const rows = await database()
    .prepare(
      "SELECT id,workout_id,version,action,status,attempts,available_at,lease_until,result,updated_at FROM delivery_jobs WHERE owner=? AND epoch=? ORDER BY CASE WHEN status IN ('queued','retry','processing') THEN 0 WHEN status='review' THEN 1 ELSE 2 END,updated_at DESC LIMIT 50",
    )
    .bind(owner, epoch)
    .all<
      Omit<
        Job,
        | 'owner'
        | 'epoch'
        | 'created_at'
        | 'provider_athlete_id'
        | 'connection_generation'
        | 'prescription_hash'
        | 'lease_token'
      >
    >();
  return rows.results.map(({ result, ...row }) => ({
    ...row,
    result: result ? (JSON.parse(result) as JobResult) : null,
  }));
}

export async function resumeDeliveryJobs(
  owner: string,
  epoch: number,
  execute: typeof syncWorkout = syncWorkout,
) {
  await activeAccount(owner, epoch);
  const now = new Date().toISOString();
  const due = await database()
    .prepare(
      "SELECT id FROM delivery_jobs WHERE owner=? AND epoch=? AND ((status IN ('queued','retry') AND available_at<=?) OR (status='processing' AND lease_until<=?)) ORDER BY available_at ASC LIMIT 2",
    )
    .bind(owner, epoch, now, now)
    .all<{ id: string }>();
  const results = [];
  for (const row of due.results) {
    const result = await runDeliveryJob(owner, epoch, row.id, execute);
    results.push(result);
    if ([401, 403, 429].includes(result.errorStatus ?? 0)) break;
  }
  return { results, jobs: await listDeliveryJobs(owner, epoch) };
}
