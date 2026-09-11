import {
  validateWorkoutTargets,
  updateWorkoutTargets,
} from '@/lib/workout-targets';
import { MAX_RECORDED_MINUTES } from '@/lib/ultra-policy';
import { updateRunMeasure } from '@/lib/run-distance';
import {
  validWorkoutEnjoyment,
  mergeWorkoutEnjoyment,
} from '@/lib/workout-enjoyment';
import { measure } from '@/lib/measurement';
import { validateRun } from '@/lib/run-input';
import { saveStandaloneRun, correctStandaloneRun } from '@/lib/standalone-runs';
import {
  changeEvent,
  avoidRecordedOverlap,
  type EventPatch,
} from '@/lib/event-transition';
import { guardAccount } from '@/lib/accounts';
import { verifiedActivity } from '@/lib/provider-activities';
import {
  makePlan,
  refreshWorkoutVariety,
  addDays,
  advanceReturn,
  advanceRunWalk,
  substituteWorkout,
  revisePreferences,
  validDate,
  type PreferencePatch,
  moveWorkout,
  shortenWorkout,
  rebalanceFutureQuality,
  adjustPlan,
  refreshWeekTotals,
  validatePlan,
  PlanError,
  todayInZone,
  type Plan,
  type Feedback,
} from '@/lib/engine';
import {
  ownerId,
  guardWrite,
  body,
  json,
  failure,
  readState,
  saveState,
  database,
  HttpError,
  type ProviderIdentity,
} from '@/lib/server';
export async function POST(request: Request) {
  try {
    const owner = ownerId(request);
    guardWrite(request);
    const accountContext = await guardAccount(request, owner);
    const b = await body(request);
    if (b.action === 'preview') {
      const previous = await readState(owner);
      try {
        const plan = avoidRecordedOverlap(
          makePlan(b.profile),
          previous.plan,
          previous.standaloneRuns,
        );
        await measure(owner, accountContext.epoch, 'preview-accepted');
        return json({ plan, version: previous.version });
      } catch (e) {
        if (e instanceof PlanError)
          await measure(owner, accountContext.epoch, 'preview-rejected');
        throw e;
      }
    }
    const current = await readState(owner);
    if (b.action === 'correctExtra' && !current.plan)
      return json(
        await correctStandaloneRun(
          owner,
          String(b.id),
          b.run,
          b.correctionReason,
          accountContext,
        ),
      );
    if (b.action === 'freeRun' && !current.plan)
      return json(await saveStandaloneRun(owner, b.run, accountContext));
    if (b.action === 'activate' && b.requestId !== undefined) {
      if (
        typeof b.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(b.requestId)
      )
        throw new HttpError(
          400,
          'Activation request is invalid. Preview again.',
        );
      if (current.plan?.activationRequestId === b.requestId) {
        if (current.plan.activationInput !== JSON.stringify(b.profile))
          throw new HttpError(
            409,
            'This activation belongs to a different preview. Review your draft again.',
          );
        return json(current);
      }
    }
    if (b.version !== current.version)
      throw new HttpError(
        409,
        'Your plan changed in another window. Refresh before making this change.',
      );
    if (b.action === 'runMeasurePreview' || b.action === 'runMeasure') {
      if (!current.plan) throw new PlanError('Build a plan first.');
      if (b.measure !== 'distance' && b.measure !== 'time')
        throw new PlanError('Choose distance or time.');
      const effectiveDate = todayInZone(current.plan.profile.timezone);
      const receipts = await database()
        .prepare('SELECT workout_id FROM deliveries WHERE owner=?')
        .bind(owner)
        .all<{ workout_id: string }>();
      const protectedIds = receipts.results.map((r) => r.workout_id);
      const candidate = updateRunMeasure(
        current.plan,
        b.measure,
        effectiveDate,
        protectedIds,
      );
      // Old saved blocks can predate today's training policy. A measurement edit
      // must not introduce a new validation failure or silently rebuild that block.
      const priorIssues = new Set(validatePlan(current.plan));
      const issue = validatePlan(candidate).find(
        (message) => !priorIssues.has(message),
      );
      if (issue) throw new PlanError(issue);
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(candidate)),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
      if (b.action === 'runMeasurePreview')
        return json({
          plan: candidate,
          version: current.version,
          effectiveDate,
          fingerprint,
          protectedCount: current.plan.workouts.filter(
            (w) =>
              w.status === 'planned' &&
              w.date >= effectiveDate &&
              protectedIds.includes(w.id),
          ).length,
        });
      if (b.effectiveDate !== effectiveDate || b.fingerprint !== fingerprint)
        throw new HttpError(
          409,
          'Your plan changed. Review the distance targets again.',
        );
      if (JSON.stringify(candidate) === JSON.stringify(current.plan))
        return json(current);
      return json(
        await saveState(
          owner,
          current.version,
          candidate,
          `Changed easy and long runs to ${b.measure} targets; schedule and time allowances preserved`,
          accountContext.epoch,
        ),
      );
    }
    if (b.action === 'targetsPreview' || b.action === 'targets') {
      if (!current.plan) throw new PlanError('Build a plan first.');
      let config;
      try {
        config = validateWorkoutTargets(b.targets);
      } catch (e) {
        throw new PlanError((e as Error).message);
      }
      const effectiveDate = todayInZone(current.plan.profile.timezone);
      const receipts = await database()
        .prepare('SELECT workout_id FROM deliveries WHERE owner=?')
        .bind(owner)
        .all<{ workout_id: string }>();
      const protectedIds = receipts.results.map((r) => r.workout_id);
      const candidate = updateWorkoutTargets(
        current.plan,
        config,
        effectiveDate,
        protectedIds,
      );
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(candidate)),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
      if (b.action === 'targetsPreview')
        return json({
          plan: candidate,
          version: current.version,
          effectiveDate,
          fingerprint,
          protectedCount: current.plan.workouts.filter(
            (w) =>
              w.status === 'planned' &&
              w.date >= effectiveDate &&
              protectedIds.includes(w.id),
          ).length,
        });
      if (b.effectiveDate !== effectiveDate || b.fingerprint !== fingerprint)
        throw new HttpError(
          409,
          'Your target preview changed. Review the latest workouts before saving.',
        );
      if (JSON.stringify(candidate) === JSON.stringify(current.plan))
        return json(current);
      return json(
        await saveState(
          owner,
          current.version,
          candidate,
          'Saved workout targets; running days and session time unchanged',
          accountContext.epoch,
        ),
      );
    }
    if (b.action === 'varietyPreview' || b.action === 'variety') {
      if (!current.plan) throw new PlanError('Build a plan first.');
      // The watch can receive first-time sends through today + 6. Keep that window intact.
      const effectiveDate = addDays(
        todayInZone(current.plan.profile.timezone),
        7,
      );
      const receipts = await database()
        .prepare('SELECT workout_id FROM deliveries WHERE owner=?')
        .bind(owner)
        .all<{ workout_id: string }>();
      const candidate = refreshWorkoutVariety(
        current.plan,
        effectiveDate,
        receipts.results.map((r) => r.workout_id),
      );
      const issues = validatePlan({
        ...candidate,
        workouts: candidate.workouts.filter((w) => w.week >= 0),
      });
      if (issues.length) throw new PlanError(issues[0]);
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(candidate)),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
      if (b.action === 'varietyPreview')
        return json({
          plan: candidate,
          version: current.version,
          effectiveDate,
          fingerprint,
        });
      if (b.effectiveDate !== effectiveDate || b.fingerprint !== fingerprint)
        throw new HttpError(
          409,
          'Your workout preview changed. Review the latest sessions before saving.',
        );
      if (JSON.stringify(candidate) === JSON.stringify(current.plan))
        return json(current);
      return json(
        await saveState(
          owner,
          current.version,
          candidate,
          'Added variety to upcoming workouts; schedule and training time unchanged',
          accountContext.epoch,
        ),
      );
    }
    if (b.action === 'workoutPreview' || b.action === 'adjustPreview') {
      if (!current.plan) throw new PlanError('Build a plan first.');
      const effectiveDate = todayInZone(current.plan.profile.timezone);
      let candidate: Plan;
      if (b.action === 'adjustPreview') {
        if (!['easy', 'rest'].includes(String(b.mode)))
          throw new PlanError('Choose easy running or rest.');
        candidate = adjustPlan(
          current.plan,
          String(b.from),
          String(b.to),
          b.mode as 'easy' | 'rest',
          effectiveDate,
        );
      } else if (b.edit === 'move')
        candidate = moveWorkout(
          current.plan,
          String(b.id),
          String(b.date),
          effectiveDate,
        );
      else if (b.edit === 'advanced')
        candidate = shortenWorkout(
          current.plan,
          String(b.id),
          Number(b.minutes),
          effectiveDate,
        );
      else if (b.edit === 'substitute')
        candidate = substituteWorkout(
          current.plan,
          String(b.id),
          String(b.templateId),
          effectiveDate,
        );
      else throw new PlanError('Choose a supported workout change.');
      rebalanceFutureQuality(candidate, effectiveDate);
      const issues = validatePlan(candidate);
      if (issues.length) throw new PlanError(issues[0]);
      return json({ version: current.version, effectiveDate, plan: candidate });
    }
    if (
      ['returnPreview', 'runWalkPreview', 'substitutePreview'].includes(
        String(b.action),
      )
    ) {
      if (!current.plan) throw new PlanError('Build a plan first.');
      const effectiveDate = todayInZone(current.plan.profile.timezone);
      const candidate =
        b.action === 'returnPreview'
          ? advanceReturn(current.plan, effectiveDate)
          : b.action === 'runWalkPreview'
            ? advanceRunWalk(current.plan, effectiveDate)
            : substituteWorkout(
                current.plan,
                String(b.id),
                String(b.templateId),
                effectiveDate,
              );
      return json({ version: current.version, effectiveDate, plan: candidate });
    }
    if (b.action === 'eventPreview') {
      if (!current.plan) throw new PlanError('Build a plan first.');
      const effectiveDate = todayInZone(current.plan.profile.timezone);
      return json({
        version: current.version,
        effectiveDate,
        plan: changeEvent(current.plan, b.event as EventPatch, effectiveDate),
      });
    }
    if (b.action === 'preferencesPreview') {
      if (!current.plan) throw new PlanError('Build a plan first.');
      return json({
        version: current.version,
        effectiveDate: todayInZone(current.plan.profile.timezone),
        plan: revisePreferences(
          current.plan,
          b.preferences as PreferencePatch,
          todayInZone(current.plan.profile.timezone),
        ),
      });
    }
    let importIdentity: ProviderIdentity | undefined;
    let plan = current.plan ? structuredClone(current.plan) : null,
      label = 'Updated plan';
    if (b.action === 'activate') {
      const candidate = avoidRecordedOverlap(
        makePlan(b.profile),
        plan,
        current.standaloneRuns,
      );
      candidate.id = crypto.randomUUID();
      candidate.activationRequestId =
        typeof b.requestId === 'string' ? b.requestId : undefined;
      candidate.activationInput = b.requestId
        ? JSON.stringify(b.profile)
        : undefined;
      candidate.workouts = candidate.workouts.map((w) => ({
        ...w,
        id: `${candidate.id}:${w.id}`,
        pairId: w.pairId ? `${candidate.id}:${w.pairId}` : undefined,
      }));
      // Archive all old versions; preserve completed history in current journal as well.
      if (plan)
        candidate.workouts.push(
          ...plan.workouts
            .filter((w) => w.status === 'completed')
            .map((w) => ({ ...w, week: -1 })),
        );
      candidate.extraRuns = [
        ...(plan?.extraRuns ?? []),
        ...(current.standaloneRuns ?? []),
      ];
      plan = candidate;
      label = 'Activated a new training plan';
    } else {
      if (!plan) throw new PlanError('Build and activate your own plan first.');
      const today = todayInZone(plan.profile.timezone);
      const workout = plan.workouts.find((w) => w.id === b.id);
      if (b.effectiveDate !== undefined && b.effectiveDate !== today)
        throw new HttpError(
          409,
          'A new day has started. Review this change again.',
        );
      if (
        ['advanceReturn', 'advanceRunWalk', 'substitute'].includes(
          String(b.action),
        )
      ) {
        if (b.effectiveDate !== today)
          throw new HttpError(
            409,
            'A new day has started. Review these changes again.',
          );
        plan =
          b.action === 'advanceReturn'
            ? advanceReturn(plan, today)
            : b.action === 'advanceRunWalk'
              ? advanceRunWalk(plan, today)
              : substituteWorkout(
                  plan,
                  String(b.id),
                  String(b.templateId),
                  today,
                );
        label =
          b.action === 'substitute'
            ? 'Selected an equivalent workout'
            : 'Advanced training after a review of completed running';
      } else if (b.action === 'changeEvent') {
        if (b.effectiveDate !== today)
          throw new HttpError(
            409,
            'A new day has started. Review this event change again.',
          );
        plan = changeEvent(plan, b.event as EventPatch, today);
        label = 'Started a reviewed block with a changed event';
      } else if (b.action === 'preferences') {
        if (b.effectiveDate !== today)
          throw new HttpError(
            409,
            'A new day has started. Preview your changes again.',
          );
        plan = revisePreferences(plan, b.preferences as PreferencePatch, today);
        label = 'Updated future training preferences';
      } else if (b.action === 'correctExtra') {
        const original = plan.extraRuns?.find((r) => r.id === b.id);
        if (!original)
          throw new PlanError('Choose an extra run in this journal.');
        const r = validateRun(b.run, today);
        if (
          typeof b.correctionReason !== 'string' ||
          b.correctionReason.trim().length < 3 ||
          b.correctionReason.length > 200
        )
          throw new PlanError('Add a brief correction reason.');
        if ((r.activityId ?? null) !== (original.activityId ?? null))
          throw new PlanError('Keep the original provider recording link.');
        Object.assign(original, r, {
          id: original.id,
          source: original.source,
          recordedAt: new Date().toISOString(),
        });
        label = 'Corrected an extra run: ' + b.correctionReason.trim();
      } else if (b.action === 'freeRun' || b.action === 'attachRecording') {
        const r = b.run as Record<string, unknown>;
        if (
          !r ||
          !validDate(r.date) ||
          r.date > today ||
          typeof r.minutes !== 'number' ||
          !Number.isFinite(r.minutes) ||
          r.minutes < 1 ||
          r.minutes > MAX_RECORDED_MINUTES ||
          (r.km !== null &&
            (typeof r.km !== 'number' ||
              !Number.isFinite(r.km) ||
              r.km <= 0 ||
              r.km > 250)) ||
          !Number.isInteger(r.effort) ||
          Number(r.effort) < 1 ||
          Number(r.effort) > 10 ||
          !['good', 'okay', 'tired'].includes(String(r.feeling)) ||
          typeof r.note !== 'string' ||
          r.note.length > 2000
        )
          throw new PlanError(
            'Check the date, distance, time, effort and feeling for this run.',
          );
        if (
          r.activityId &&
          (typeof r.activityId !== 'string' ||
            r.activityId.length > 100 ||
            plan.workouts.some(
              (w) => w.feedback?.activityId === r.activityId,
            ) ||
            plan.extraRuns?.some((x) => x.activityId === r.activityId))
        )
          throw new PlanError(
            'That activity is already in your running journal.',
          );
        if (r.activityId) {
          const actual = await verifiedActivity(
            owner,
            r.activityId as string,
            String(r.date),
          );
          importIdentity = actual.identity;
          r.minutes = actual.movingTime / 60;
          r.km =
            actual.distance && actual.distance > 0
              ? actual.distance / 1000
              : null;
          r.source = actual.source;
          validateRun(r, today);
        }
        if (b.action === 'attachRecording') {
          if (typeof r.activityId !== 'string' || !r.activityId)
            throw new PlanError('Choose an imported recording.');
          const existing = plan.workouts.find(
            (w) =>
              w.id === b.id &&
              w.status === 'completed' &&
              !w.feedback?.activityId,
          );
          const extra = plan.extraRuns?.find(
            (x) => x.id === b.id && !x.activityId,
          );
          if (existing?.feedback) {
            if ((existing.feedback.actualDate ?? existing.date) !== r.date)
              throw new PlanError(
                'Choose a recording from the same date as this run.',
              );
            existing.feedback = {
              ...existing.feedback,
              actualDate: r.date,
              actualMinutes: Number(r.minutes),
              actualKm: r.km as number | null,
              activityId: r.activityId,
              source:
                typeof r.source === 'string'
                  ? r.source.slice(0, 80)
                  : 'Imported',
            };
          } else if (extra) {
            if (extra.date !== r.date)
              throw new PlanError(
                'Choose a recording from the same date as this run.',
              );
            Object.assign(extra, {
              minutes: Number(r.minutes),
              km: r.km,
              activityId: r.activityId,
              source:
                typeof r.source === 'string'
                  ? r.source.slice(0, 80)
                  : 'Imported',
            });
          } else
            throw new PlanError(
              'Choose an unlinked run already in your journal.',
            );
          return json(
            await saveState(
              owner,
              current.version,
              plan,
              'Attached a recording to the existing run',
              accountContext.epoch,
              undefined,
              importIdentity,
            ),
          );
        }
        plan.extraRuns ??= [];
        plan.extraRuns.push({
          id: crypto.randomUUID(),
          date: r.date,
          minutes: Number(r.minutes),
          km: r.km as number | null,
          effort: Number(r.effort),
          feeling: r.feeling as 'good' | 'okay' | 'tired',
          note: r.note,
          activityId: r.activityId as string | undefined,
          source:
            typeof r.source === 'string' ? r.source.slice(0, 80) : 'Manual',
          recordedAt: new Date().toISOString(),
        });
        label = 'Logged an extra run; future mileage unchanged';
      } else if (b.action === 'move') {
        plan = refreshWeekTotals(
          moveWorkout(plan, String(b.id), String(b.date), today),
        );
        label = 'Moved a workout';
      } else if (b.action === 'complete' || b.action === 'correctLog') {
        if (
          !workout ||
          workout.status !==
            (b.action === 'correctLog' ? 'completed' : 'planned')
        )
          throw new PlanError('Choose an uncompleted workout.');
        if (workout.date > today)
          throw new PlanError(
            'You can log a workout on its date or afterwards. Move it to today if you ran it early.',
          );
        const f = b.feedback as Feedback;
        if (
          f?.activityId &&
          (typeof f.activityId !== 'string' ||
            f.activityId.length > 100 ||
            plan.workouts.some(
              (w) =>
                w.id !== workout.id && w.feedback?.activityId === f.activityId,
            ) ||
            plan.extraRuns?.some((r) => r.activityId === f.activityId))
        )
          throw new PlanError(
            'That activity is already linked, or its identifier is invalid.',
          );
        if (
          !f ||
          (f.actualDate !== undefined &&
            (!validDate(f.actualDate) || f.actualDate > today)) ||
          !Number.isInteger(f.effort) ||
          f.effort < 1 ||
          f.effort > 10 ||
          !['good', 'okay', 'tired'].includes(f.feeling) ||
          (f.enjoyment != null && !validWorkoutEnjoyment(f.enjoyment)) ||
          !Number.isFinite(f.actualMinutes) ||
          f.actualMinutes < 1 ||
          f.actualMinutes > MAX_RECORDED_MINUTES ||
          typeof f.note !== 'string' ||
          f.note.length > 2000 ||
          (f.actualKm !== null &&
            (!Number.isFinite(f.actualKm) ||
              f.actualKm <= 0 ||
              f.actualKm > 250))
        )
          throw new PlanError(
            'Check your actual duration, distance, and effort before saving.',
          );
        if (f.activityId && b.action !== 'correctLog') {
          const actual = await verifiedActivity(
            owner,
            f.activityId,
            f.actualDate ?? workout.date,
          );
          importIdentity = actual.identity;
          f.actualMinutes = actual.movingTime / 60;
          f.actualKm =
            actual.distance && actual.distance > 0
              ? actual.distance / 1000
              : null;
          f.source = actual.source;
          validateRun(
            {
              date: f.actualDate ?? workout.date,
              minutes: f.actualMinutes,
              km: f.actualKm,
              effort: f.effort,
              feeling: f.feeling,
              note: f.note,
            },
            today,
          );
        }
        if (
          f.execution !== undefined &&
          ![
            'unknown',
            'as-planned',
            'partial',
            'easy-substitute',
            'not-attempted',
          ].includes(f.execution)
        )
          throw new PlanError(
            'Choose how much of the intended work you completed.',
          );
        if (
          f.completedQualityMinutes !== undefined &&
          (!Number.isFinite(f.completedQualityMinutes) ||
            f.completedQualityMinutes < 0 ||
            f.completedQualityMinutes >
              (workout.qualityMinutes ?? workout.minutes) ||
            f.completedQualityMinutes > f.actualMinutes)
        )
          throw new PlanError(
            'Quality minutes must fit the intended work and the recorded session duration.',
          );
        if (f.execution && f.execution !== 'unknown')
          f.executionSource = 'self-report';
        else {
          delete f.executionSource;
          delete f.completedQualityMinutes;
        }
        if (!f.activityId) f.source = 'Manual';
        if (
          b.action === 'correctLog' &&
          (typeof b.correctionReason !== 'string' ||
            b.correctionReason.trim().length < 3 ||
            b.correctionReason.length > 200)
        )
          throw new PlanError('Add a brief reason for this correction.');
        if (
          b.action === 'correctLog' &&
          f.activityId !== workout.feedback?.activityId
        )
          throw new PlanError(
            'Keep the original recording link when correcting its log.',
          );
        if (b.action === 'correctLog')
          f.source = workout.feedback?.source ?? 'Manual';
        f.enjoyment = mergeWorkoutEnjoyment(
          f.enjoyment,
          workout.feedback?.enjoyment,
        );
        workout.status = 'completed';
        workout.feedback = { ...f, recordedAt: new Date().toISOString() };
        label =
          b.action === 'correctLog'
            ? 'Corrected a run log: ' + String(b.correctionReason).trim()
            : 'Logged a completed run';
      } else if (b.action === 'skip') {
        if (!workout || workout.status !== 'planned' || workout.kind === 'race')
          throw new PlanError('Choose an uncompleted training session.');
        workout.status = 'skipped';
        workout.skipReason = (
          typeof b.reason === 'string' ? b.reason : 'Missed workout'
        ).slice(0, 200);
        label = 'Skipped a run; no mileage added elsewhere';
        plan = refreshWeekTotals(plan);
      } else if (b.action === 'adjust') {
        if (!['easy', 'rest'].includes(String(b.mode)))
          throw new PlanError('Choose easy running or rest.');
        plan = adjustPlan(
          plan,
          String(b.from),
          String(b.to),
          b.mode as 'easy' | 'rest',
          today,
        );
        label =
          b.mode === 'rest'
            ? 'Added a planned break and return week'
            : 'Reduced training and added a return week';
      } else if (b.action === 'advanced') {
        plan = shortenWorkout(plan, String(b.id), Number(b.minutes), today);
        label = 'Shortened a workout, preserving complete steps and recovery';
      } else if (b.action === 'undo') {
        const last = await database()
          .prepare('SELECT label FROM revisions WHERE owner=? AND version=?')
          .bind(owner, current.version)
          .first<{ label: string }>();
        if (
          last?.label.startsWith('Restored a recovery') ||
          last?.label === 'Opened an empty journal'
        )
          throw new PlanError(
            'Use Account data to restore another copy. Undo does not cross a recovery operation.',
          );
        const previous = await database()
          .prepare(
            'SELECT data FROM revisions WHERE owner = ? AND version < ? ORDER BY version DESC LIMIT 1',
          )
          .bind(owner, current.version)
          .first<{ data: string }>();
        if (!previous)
          throw new PlanError('There is no earlier plan revision to restore.');
        const restored = JSON.parse(previous.data) as Plan | null;
        if (!restored)
          throw new PlanError(
            'Undo does not cross an empty-journal recovery boundary. Use Account data to restore a different copy.',
          );
        restored.profile.units = plan.profile.units;
        restored.profile.timezone = plan.profile.timezone;
        restored.extraRuns = plan.extraRuns ?? restored.extraRuns;
        const completed = new Map(
          plan.workouts
            .filter((w) => w.status === 'completed')
            .map((w) => [w.id, w]),
        );
        restored.workouts = restored.workouts.map((w) => {
          const actual = completed.get(w.id);
          return actual
            ? {
                ...actual,
                week: w.week,
                date: w.date,
                originalDate: w.originalDate,
              }
            : w;
        });
        for (const [id, w] of completed)
          if (!restored.workouts.some((x) => x.id === id))
            restored.workouts.push({ ...w, week: -1 });
        plan = refreshWeekTotals(restored);
        label = 'Restored previous plan; completed runs preserved';
      } else throw new HttpError(400, 'Unknown plan action.');
    }
    if (
      b.action === 'preferences' &&
      JSON.stringify(plan) === JSON.stringify(current.plan)
    )
      return json(current);
    if (plan) rebalanceFutureQuality(plan, todayInZone(plan.profile.timezone));
    const issues = validatePlan({
      ...plan,
      workouts: plan.workouts.filter((w) => w.week >= 0),
    });
    if (issues.length) throw new PlanError(issues[0]);
    const saved = await saveState(
      owner,
      current.version,
      plan,
      label,
      accountContext.epoch,
      b.action === 'activate' ? accountContext.revision : undefined,
      importIdentity,
    );
    if (b.action === 'activate')
      await measure(owner, accountContext.epoch, 'activation-accepted');
    if (
      b.action === 'complete' &&
      !current.plan?.workouts.some((w) => w.status === 'completed')
    )
      await measure(owner, accountContext.epoch, 'first-workout-completed');
    return json(saved);
  } catch (e) {
    return failure(e);
  }
}
