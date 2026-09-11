import { activeAccount } from './accounts';
import {
  readState,
  provider,
  assertConnection,
  intervals,
  database,
  HttpError,
  ProviderRequestRejected,
} from './server';
import { todayInZone, addDays, type Workout } from './engine';
import { intervalsWorkoutText } from './intervals-workout';
import { FitExportError } from './fit-error';
import {
  cancellationDecision,
  garminUploadFailed,
  GARMIN_UPLOAD_ERROR,
  workoutSendWindow,
  type RemoteEvent,
} from './delivery-policy';
type Receipt = {
  status: string;
  version: number;
  remote_id: string | null;
  connection_generation: string | null;
  attempt_id: string | null;
  create_outcome: string;
  prescription_hash: string | null;
  updated_at: string;
};
export async function prescriptionHash(w: Workout) {
  const data = JSON.stringify({
    date: w.date,
    time: w.startTime ?? '00:00',
    title: w.title,
    steps: w.steps.map((s) => ({
      seconds: s.seconds,
      metres: s.metres ?? null,
      effort: s.effort,
      label: s.label,
      kind: s.kind,
      ...(s.target ? { target: s.target } : {}),
    })),
  });
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export function structuredMatch(remote: RemoteEvent, w: Workout) {
  const doc = remote.workout_doc as { steps?: unknown[] } | undefined;
  const flattened: Record<string, unknown>[] = [];
  function expand(list: unknown[], depth = 0): boolean {
    if (depth > 3) return false;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') return false;
      const s = raw as Record<string, unknown>;
      // A manual lap changes when a timed/distance step ends, even if its
      // displayed duration matches. Do not certify that as this prescription.
      if (s.until_lap_press != null && s.until_lap_press !== false)
        return false;
      if (s.ramp === true || s.maxeffort === true) return false;
      if (Array.isArray(s.steps)) {
        const count = Number(s.reps ?? 1);
        if (!Number.isInteger(count) || count < 1 || count > 100) return false;
        for (let n = 0; n < count; n++)
          if (!expand(s.steps, depth + 1)) return false;
      } else flattened.push(s);
      if (flattened.length > 1500) return false;
    }
    return true;
  }
  return (
    !!doc &&
    Array.isArray(doc.steps) &&
    expand(doc.steps) &&
    flattened.length === w.steps.length &&
    flattened.every((s, i) => {
      const kind = w.steps[i].kind;
      const expectedIntensity = ['warmup', 'cooldown', 'recovery'].includes(
        kind,
      )
        ? kind
        : 'active';
      // Some older readbacks omit intensity. A reported contradictory value is
      // not the saved prescription, especially for easy floats and walking rests.
      if (
        s.intensity != null &&
        (typeof s.intensity !== 'string' ||
          s.intensity.toLowerCase() !== expectedIntensity)
      )
        return false;
      const target = w.steps[i].target;
      const forbidden = [
        'heart_rate',
        'heartRate',
        'power',
        '_power',
        'cadence',
        'target',
        'targets',
      ];
      if (forbidden.some((key) => s[key] != null)) return false;
      if (target) {
        const key = target.mode === 'pace' ? 'pace' : 'hr';
        const other = key === 'pace' ? 'hr' : 'pace';
        if (
          s[other] != null ||
          s[`_${other}`] != null ||
          s[key] == null ||
          s.ramp === true ||
          s.freeride === true ||
          s.maxeffort === true
        )
          return false;
        const resolved = s[`_${key}`] as
          | { start?: unknown; end?: unknown }
          | undefined;
        if (
          !resolved ||
          typeof resolved.start !== 'number' ||
          typeof resolved.end !== 'number' ||
          !Number.isFinite(resolved.start) ||
          !Number.isFinite(resolved.end)
        )
          return false;
        const low = Math.min(resolved.start, resolved.end),
          high = Math.max(resolved.start, resolved.end);
        const expectedLow =
          target.mode === 'pace' ? 1000 / Math.round(target.high) : target.low;
        const expectedHigh =
          target.mode === 'pace' ? 1000 / Math.round(target.low) : target.high;
        if (
          Math.abs(low - expectedLow) > 0.001 ||
          Math.abs(high - expectedHigh) > 0.001
        )
          return false;
      } else if (['pace', '_pace', 'hr', '_hr'].some((key) => s[key] != null))
        return false;
      const cue =
        typeof s.text === 'string'
          ? s.text
          : typeof s.notes === 'string'
            ? s.notes
            : '';
      if (
        !cue
          .replace(/\s+/g, ' ')
          .trim()
          .includes(w.steps[i].effort.replace(/\s+/g, ' ').trim())
      )
        return false;
      // Native distance is a termination rule; _distance is only an estimate.
      // A distance-ended step may also include an estimated duration.
      if (w.steps[i].metres === undefined && s.distance != null) {
        const distance = Number(s.distance);
        if (!Number.isFinite(distance) || distance !== 0) return false;
      }
      return w.steps[i].metres !== undefined
        ? Math.abs(Number(s.distance) - w.steps[i].metres!) < 0.02
        : Math.abs(Number(s.duration) - w.steps[i].seconds) <= 1;
    })
  );
}
function eventMatches(remote: RemoteEvent, workout: Workout, athlete: string) {
  const start = workout.date + 'T' + (workout.startTime ?? '00:00') + ':00';
  return (
    remote.external_id === `stride:${workout.id}` &&
    remote.category === 'WORKOUT' &&
    remote.type === 'Run' &&
    remote.start_date_local === start &&
    (remote.athlete_id == null ||
      ((typeof remote.athlete_id === 'string' ||
        typeof remote.athlete_id === 'number') &&
        String(remote.athlete_id) === athlete)) &&
    structuredMatch(remote, workout)
  );
}
export async function syncWorkout(
  owner: string,
  id: string,
  version: number,
  confirm = false,
  requestedEpoch?: number,
  checkOnly = false,
) {
  const state = await readState(owner);
  if (!state.plan || version !== state.version)
    throw new HttpError(
      409,
      'Load the latest plan before sending this workout.',
    );
  const accountEpoch = requestedEpoch ?? state.accountEpoch ?? 0;
  await activeAccount(owner, accountEpoch);
  // Connection identity is checked even when a previous receipt appears current.
  const connection = await provider(owner),
    db = database(),
    workout = state.plan.workouts.find((w) => w.id === id),
    athlete = connection.athleteId;
  const scope = `/athlete/${encodeURIComponent(athlete)}`;
  const previous = await db
    .prepare(
      'SELECT * FROM deliveries WHERE owner=? AND provider_athlete_id=? AND workout_id=?',
    )
    .bind(owner, athlete, id)
    .first<Receipt>();
  const legacy = previous
    ? null
    : await db
        .prepare(
          "SELECT remote_id FROM deliveries WHERE owner=? AND provider_athlete_id='__legacy__' AND workout_id=?",
        )
        .bind(owner, id)
        .first<{ remote_id: string | null }>();
  if (!workout && !previous && !legacy)
    throw new HttpError(404, 'Workout not found.');
  if (
    checkOnly &&
    (!workout || workout.status !== 'planned' || (!previous && !legacy))
  )
    throw new HttpError(
      422,
      'Send an upcoming workout before checking its delivery.',
    );
  if (
    !confirm &&
    !checkOnly &&
    workout?.status === 'planned' &&
    workout.steps.some((s) => s.target?.mode === 'heart-rate')
  )
    throw new HttpError(
      422,
      'BPM targets are available in Garmin FIT downloads. Direct sending through Intervals is not supported for these targets yet. Download the FIT file, or choose pace or effort in Settings.',
    );
  const hash = workout ? await prescriptionHash(workout) : null;
  const currentReceipt =
    previous?.prescription_hash === hash &&
    previous?.connection_generation === connection.generation &&
    ['accepted', 'confirmed'].includes(previous?.status ?? '');
  if (confirm) {
    if (!workout || workout.status !== 'planned' || !currentReceipt)
      throw new HttpError(
        409,
        'Send the current workout to the connected account before confirming it on your watch.',
      );
    await assertConnection(owner, connection);
    const saved = await db
      .prepare(
        "UPDATE deliveries SET status='confirmed',version=?,message=?,updated_at=? WHERE owner=? AND provider_athlete_id=? AND workout_id=? AND prescription_hash=? AND connection_generation=? AND status IN ('accepted','confirmed') AND EXISTS(SELECT 1 FROM connections c WHERE c.owner=deliveries.owner AND c.provider_athlete_id=deliveries.provider_athlete_id AND c.generation=deliveries.connection_generation) AND EXISTS(SELECT 1 FROM athlete_state a WHERE a.owner=deliveries.owner AND a.version=?)",
      )
      .bind(
        version,
        'You confirmed seeing this workout on your watch.',
        new Date().toISOString(),
        owner,
        athlete,
        id,
        hash,
        connection.generation,
        version,
      )
      .run();
    if (saved.meta.changes !== 1)
      throw new HttpError(
        409,
        'The receipt changed. Refresh and check the current workout.',
      );
    return { status: 'confirmed' };
  }
  if (workout?.status === 'completed') return { status: 'completed' };
  const remove = !workout || workout.status === 'skipped',
    today = todayInZone(state.plan.profile.timezone);
  if (remove && !previous && !legacy) return { status: 'removed' };
  if (remove && previous?.status === 'removed') return { status: 'removed' };
  if (
    !checkOnly &&
    !remove &&
    workout &&
    !workoutSendWindow(workout.date, today, !!previous || !!legacy).allowed
  )
    throw new HttpError(
      422,
      'Send workouts scheduled in the next seven days. Later sessions stay in your plan.',
    );
  const attempt = crypto.randomUUID(),
    now = new Date().toISOString(),
    expired = new Date(Date.now() - 120000).toISOString();
  // A verified removal ended that delivery. Restoring a run starts a new
  // attempt; its deleted event ID must not become evidence of a lost upload.
  const claimed = await db
    .prepare(
      "INSERT INTO deliveries (owner,provider_athlete_id,workout_id,connection_generation,attempt_id,create_outcome,version,status,updated_at) SELECT ?,?,?,?,?,?,?,'sending',? FROM accounts WHERE owner=? AND epoch=? AND status='active' ON CONFLICT(owner,provider_athlete_id,workout_id) DO UPDATE SET connection_generation=excluded.connection_generation,attempt_id=excluded.attempt_id,version=excluded.version,remote_id=CASE WHEN deliveries.status='removed' THEN NULL ELSE deliveries.remote_id END,create_outcome=CASE WHEN deliveries.status='removed' THEN 'none' ELSE deliveries.create_outcome END,status='sending',updated_at=excluded.updated_at WHERE deliveries.status!='sending' OR deliveries.updated_at<? OR deliveries.connection_generation!=excluded.connection_generation",
    )
    .bind(
      owner,
      athlete,
      id,
      connection.generation,
      attempt,
      legacy ? 'unknown' : 'none',
      version,
      now,
      owner,
      accountEpoch,
      expired,
    )
    .run();
  if (claimed.meta.changes !== 1)
    throw new HttpError(
      409,
      'This workout is already being sent. Wait a moment and refresh.',
    );
  async function fence() {
    await activeAccount(owner, accountEpoch);
    await assertConnection(owner, connection);
    const latest = await readState(owner),
      lease = await db
        .prepare(
          'SELECT attempt_id FROM deliveries WHERE owner=? AND provider_athlete_id=? AND workout_id=?',
        )
        .bind(owner, athlete, id)
        .first<{ attempt_id: string }>();
    if (latest.version !== version || lease?.attempt_id !== attempt)
      throw new HttpError(
        409,
        'Your plan or delivery changed. Refresh before trying again.',
      );
  }
  async function finish(
    status: string,
    message: string,
    remoteId: string | null = previous?.status === 'removed'
      ? null
      : (previous?.remote_id ?? null),
  ) {
    let current = true;
    try {
      await fence();
    } catch {
      current = false;
    }
    if (!current) {
      status = 'stale';
      message =
        'Plan or connection changed during delivery. Review the calendar before retrying.';
    }
    const result = await db
      .prepare(
        'UPDATE deliveries SET remote_id=?,status=?,message=?,prescription_hash=?,create_outcome=?,updated_at=? WHERE owner=? AND provider_athlete_id=? AND workout_id=? AND attempt_id=? AND connection_generation=? AND EXISTS(SELECT 1 FROM connections c WHERE c.owner=deliveries.owner AND c.provider_athlete_id=deliveries.provider_athlete_id AND c.generation=deliveries.connection_generation) AND EXISTS(SELECT 1 FROM athlete_state a WHERE a.owner=deliveries.owner AND a.version=?)',
      )
      .bind(
        remoteId,
        status,
        message,
        hash,
        remoteId
          ? 'known'
          : previous?.status === 'removed'
            ? 'none'
            : (previous?.create_outcome ?? 'none'),
        new Date().toISOString(),
        owner,
        athlete,
        id,
        attempt,
        connection.generation,
        version,
      )
      .run();
    if (result.meta.changes !== 1)
      throw new HttpError(
        409,
        'The provider may have received this workout, but its receipt could not be saved. Refresh to reconcile; delivery is unconfirmed.',
      );
    return { status, remoteId, message };
  }
  const callProvider = (
    path: string,
    init: RequestInit = {},
    allowMissing = false,
  ) => intervals(connection.key, path, init, allowMissing, owner);
  let creationDefinitelyNotSent = false;
  try {
    const response = await callProvider(
        `${scope}/events?oldest=${addDays(today, -370)}&newest=${addDays(today, 370)}&resolve=true`,
      ),
      raw: unknown = await response.json();
    if (!Array.isArray(raw))
      throw new HttpError(
        502,
        'Could not verify the provider calendar. No workout was changed.',
      );
    const matches = (raw as RemoteEvent[]).filter(
      (e) => e.external_id === `stride:${id}`,
    );
    if (matches.length > 1)
      throw new HttpError(
        409,
        'Multiple calendar copies need review in Intervals.icu before retrying.',
      );
    let existing = matches[0];
    if (!existing && previous?.remote_id && previous.status !== 'removed') {
      const r = await callProvider(
        `${scope}/events/${encodeURIComponent(previous.remote_id)}?resolve=true`,
        {},
        true,
      );
      if (r.status !== 404) {
        const found = (await r.json()) as RemoteEvent;
        if (found.external_id !== `stride:${id}`)
          throw new HttpError(
            409,
            'The saved provider event has changed ownership. Review it in Intervals.icu.',
          );
        existing = found;
      }
    }
    if (existing && (!existing.id || existing.category !== 'WORKOUT'))
      throw new HttpError(
        409,
        'The calendar entry no longer matches this workout. Review it in Intervals.icu.',
      );
    if (checkOnly) {
      if (!existing)
        return finish(
          'review',
          'This workout could not be found in Intervals.icu. Review its calendar before sending again.',
        );
      if (!eventMatches(existing, workout!, athlete))
        return finish(
          'review',
          'The workout in Intervals.icu differs from your current plan. Send the updated workout when you are ready.',
          String(existing.id),
        );
      if (garminUploadFailed(existing))
        return finish('review', GARMIN_UPLOAD_ERROR, String(existing.id));
      const status =
        currentReceipt && previous?.status === 'confirmed'
          ? 'confirmed'
          : 'accepted';
      return finish(
        status,
        status === 'confirmed'
          ? 'The workout still matches Intervals.icu. Your earlier watch confirmation is saved.'
          : 'Workout verified in Intervals.icu. No Garmin upload error was reported; sync Garmin Connect and check your watch.',
        String(existing.id),
      );
    }
    const activitiesResponse = existing
      ? await callProvider(
          `${scope}/activities?oldest=${addDays(today, -370)}&newest=${today}`,
        )
      : null;
    const activities: unknown = activitiesResponse
      ? await activitiesResponse.json()
      : [];
    if (!Array.isArray(activities))
      throw new HttpError(
        502,
        'Could not verify completed activities. No workout was changed.',
      );
    const paired = new Set(
      activities.map((a) => String(a.paired_event_id ?? '')),
    );
    if (
      !existing &&
      ((previous?.create_outcome === 'unknown' &&
        previous.status !== 'removed') ||
        legacy)
    )
      throw new HttpError(
        409,
        'A previous upload has an uncertain outcome. Check the Intervals.icu calendar; automatic creation is paused to avoid a duplicate.',
      );
    if (
      !existing &&
      !remove &&
      previous?.remote_id &&
      previous.status !== 'removed'
    )
      throw new HttpError(
        409,
        'The previously received calendar entry could not be found. Review it in Intervals.icu; automatic creation is paused to avoid a duplicate.',
      );
    if (remove) {
      if (existing) {
        const decision = cancellationDecision(existing, id, today, paired);
        if (decision === 'preserve')
          return finish(
            'preserved',
            'Historical or completed calendar entry preserved.',
          );
        if (decision !== 'remove')
          throw new HttpError(
            409,
            'Review today’s workout or this changed entry directly in Intervals.icu. It was not deleted.',
          );
        await fence();
        await callProvider(
          `${scope}/events/${encodeURIComponent(String(existing.id))}`,
          { method: 'DELETE' },
        );
      }
      return finish(
        'removed',
        'No upcoming copy remains in the verified provider calendar.',
        existing ? String(existing.id) : (previous?.remote_id ?? null),
      );
    }
    if (
      existing &&
      ((existing.start_date_local?.slice(0, 10) ?? '') < today ||
        paired.has(String(existing.id)))
    )
      return finish(
        'preserved',
        'Historical or completed calendar entry preserved.',
      );
    if (
      existing &&
      currentReceipt &&
      eventMatches(existing, workout!, athlete) &&
      garminUploadFailed(existing)
    )
      return finish('review', GARMIN_UPLOAD_ERROR, String(existing.id));
    if (existing && currentReceipt && eventMatches(existing, workout!, athlete))
      return finish(
        previous!.status,
        previous!.status === 'confirmed'
          ? 'Provider calendar rechecked; the unchanged workout retains your watch confirmation.'
          : 'Provider calendar rechecked and its structured steps match. Garmin sync and watch confirmation are still pending.',
        String(existing.id),
      );
    const start = workout!.date + 'T' + (workout!.startTime ?? '00:00') + ':00';
    const event = {
      category: 'WORKOUT',
      type: 'Run',
      name: workout!.title,
      start_date_local: start,
      external_id: `stride:${id}`,
      description: intervalsWorkoutText(workout!),
    };
    await fence();
    if (!existing) {
      const pending = await db
        .prepare(
          "UPDATE deliveries SET create_outcome='unknown',attempted_start_local=? WHERE owner=? AND provider_athlete_id=? AND workout_id=? AND attempt_id=?",
        )
        .bind(start, owner, athlete, id, attempt)
        .run();
      if (pending.meta.changes !== 1)
        throw new HttpError(
          409,
          'Delivery changed before upload. Refresh to reconcile.',
        );
      creationDefinitelyNotSent = true;
    }
    await fence();
    // Never retry POST automatically. A timeout may occur after the provider committed it.
    let sent: Response;
    if (existing) {
      sent = await callProvider(
        `${scope}/events/${encodeURIComponent(String(existing.id))}`,
        { method: 'PUT', body: JSON.stringify(event) },
      );
    } else {
      creationDefinitelyNotSent = false;
      try {
        sent = await callProvider(`${scope}/events/bulk`, {
          method: 'POST',
          body: JSON.stringify([event]),
        });
      } catch (error) {
        creationDefinitelyNotSent = error instanceof ProviderRequestRejected;
        throw error;
      }
    }
    const sentRaw = (await sent.json()) as RemoteEvent | RemoteEvent[],
      receipt = Array.isArray(sentRaw) ? sentRaw[0] : sentRaw;
    if (!receipt?.id)
      throw new HttpError(
        502,
        'The provider did not return an event identity. The upload remains unconfirmed.',
      );
    if (existing && String(receipt.id) !== String(existing.id))
      throw new HttpError(
        409,
        'The provider returned a different event identity for this update. Review the calendar before retrying.',
      );
    const remembered = await db
      .prepare(
        "UPDATE deliveries SET remote_id=?,create_outcome='known' WHERE owner=? AND provider_athlete_id=? AND workout_id=? AND attempt_id=? AND connection_generation=?",
      )
      .bind(
        String(receipt.id),
        owner,
        athlete,
        id,
        attempt,
        connection.generation,
      )
      .run();
    if (remembered.meta.changes !== 1)
      throw new HttpError(
        409,
        'The provider returned an entry but its identity could not be saved. Delivery remains unconfirmed.',
      );
    const savedResponse = await callProvider(
        `${scope}/events/${encodeURIComponent(String(receipt.id))}?resolve=true`,
      ),
      saved = (await savedResponse.json()) as RemoteEvent;
    const valid =
      String(saved.id) === String(receipt.id) &&
      eventMatches(saved, workout!, athlete);
    return finish(
      valid && !garminUploadFailed(saved) ? 'accepted' : 'review',
      valid && garminUploadFailed(saved)
        ? GARMIN_UPLOAD_ERROR
        : valid
          ? 'Provider read-back matches the date and structured durations/distances. Garmin sync and watch confirmation are still pending.'
          : 'Provider entry received, but its date, sport or parsed steps do not match. Review it before watch use.',
      String(receipt.id),
    );
  } catch (e) {
    await db
      .prepare(
        "UPDATE deliveries SET status='failed',message=?,updated_at=?,create_outcome=CASE WHEN ?=1 AND remote_id IS NULL AND create_outcome='unknown' THEN 'none' ELSE create_outcome END WHERE owner=? AND provider_athlete_id=? AND workout_id=? AND status='sending' AND attempt_id=?",
      )
      .bind(
        e instanceof HttpError || e instanceof FitExportError
          ? e.message
          : 'Delivery was not confirmed. Refresh to reconcile.',
        new Date().toISOString(),
        creationDefinitelyNotSent ? 1 : 0,
        owner,
        athlete,
        id,
        attempt,
      )
      .run();
    throw e;
  }
}
