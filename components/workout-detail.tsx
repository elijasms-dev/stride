'use client';
import { GarminHandoff } from './garmin-handoff';
import { SessionBriefing } from './session-briefing';
import { DailyGuide } from './daily-guide';
import { dailyGuide } from '@/lib/daily-guide';
import { isRunWalkWorkout } from '@/lib/run-walk';
import { WorkoutSteps } from './workout-steps';
import { targetLabel, mainWorkoutTarget } from '@/lib/workout-targets';
import { workoutSendWindow, deliveryLabel } from '@/lib/delivery-policy';
import { MAX_RECORDED_MINUTES } from '@/lib/ultra-policy';

import { workoutGuidance } from '@/lib/coaching-context';
import { BusyButton } from './action-progress';
import { NumericInput } from './numeric-input';
import { useState } from 'react';
import WorkoutEdit from './workout-edit';
import { distanceEstimate } from '@/lib/prescription';
import { prescribedDistanceKm } from '@/lib/run-distance';
import { workoutDistanceValue, workoutDistanceLabel } from '@/lib/engine';
import { recordedWorkoutDate } from '@/lib/training-history';
import { runDuration } from '@/lib/journal-view';
import { useRunFeedbackValidation } from './run-feedback-validation';
import {
  ArrowLeft,
  Download,
  MoreHorizontal,
  CalendarDays,
  Check,
  Watch,
  SlidersHorizontal,
  SkipForward,
  Footprints,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Modal,
  Field,
  Choice,
  FormError,
  EffortGraph,
  workoutEffort,
} from './stride-ui';
import { dateLabel, kmDisplay, type Workout, type Profile } from '@/lib/engine';
export type Action = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<void>;
export default function WorkoutDetail({
  workout: w,
  plan,
  version,
  profile,
  open,
  onClose,
  onAction,
  onConnect,
  isDemo,
  connected,
  today,
  delivery,
  busy,
  initialMode = 'view',
  imported,
}: {
  workout: Workout;
  plan: import('@/lib/engine').Plan;
  version: number;
  profile: Profile;
  open: boolean;
  onClose: () => void;
  onAction: Action;
  onConnect: () => void;
  isDemo: boolean;
  connected: boolean;
  today: string;
  delivery?: { status: string; version: number; message?: string };
  busy: boolean;
  initialMode?: string;
  imported?: {
    id: string;
    distance: number | null;
    movingTime: number;
    source: string;
    date?: string;
  };
}) {
  const [mode, setMode] = useState(
      ['actions', 'delivery'].includes(initialMode) ? 'view' : initialMode,
    ),
    [actualDate, setActualDate] = useState(
      imported?.date ?? w.feedback?.actualDate ?? w.date,
    ),
    [error, setError] = useState('');
  const [effort, setEffort] = useState(String(w.feedback?.effort ?? '')),
    [feeling, setFeeling] = useState<string>(w.feedback?.feeling ?? ''),
    [enjoyment, setEnjoyment] = useState<string>(
      w.feedback?.enjoyment ?? 'unanswered',
    ),
    [skipReason, setSkipReason] = useState('okay'),
    [minutes, setMinutes] = useState(
      imported
        ? imported.movingTime / 60
        : (w.feedback?.actualMinutes ?? w.minutes),
    ),
    [distance, setDistance] = useState<number | null>(
      imported?.distance
        ? imported.distance / 1000
        : (w.feedback?.actualKm ?? null),
    ),
    [execution, setExecution] = useState(w.feedback?.execution ?? 'unknown'),
    [qualityDone, setQualityDone] = useState<number | null>(
      w.feedback?.completedQualityMinutes ?? null,
    ),
    [note, setNote] = useState(w.feedback?.note ?? ''),
    [correctionReason, setCorrectionReason] = useState('');
  const feedbackValidation = useRunFeedbackValidation(effort, feeling);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const logging = mode === 'log' || mode === 'correctLog';
  const runWalk = isRunWalkWorkout(w);
  const estimate = distanceEstimate(w.steps, profile);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setError('');
    setPendingAction(action);
    try {
      await onAction(action, { id: w.id, ...payload });
      if (!['sync', 'checkDelivery', 'confirmWatch'].includes(action))
        onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingAction(null);
    }
  }
  const editable =
    w.status === 'planned' && w.kind !== 'race' && w.date >= today;
  const sendWindow = workoutSendWindow(w.date, today, !!delivery);
  const completedLog = w.status === 'completed' ? w.feedback : undefined;
  const prescriptionContent = (
    <>
      <p className="detail-purpose">{w.purpose}</p>
      <div className="workout-stats">
        <div>
          <strong>{workoutDistanceValue(w, profile)}</strong>
          <span>
            {prescribedDistanceKm(w) !== null
              ? `${profile.units} target`
              : estimate.lowerKm === null
                ? 'Distance unknown'
                : `${profile.units} estimate`}
          </span>
        </div>
        <div>
          <strong>{runDuration(w.minutes)}</strong>
          <span>
            {prescribedDistanceKm(w) !== null ? 'estimated time' : 'duration'}
          </span>
        </div>
        <div>
          <strong>
            {mainWorkoutTarget(w) ? (
              targetLabel(mainWorkoutTarget(w), profile.units)
            ) : (
              <>
                {workoutEffort(w)}
                <span className="stat-small"> / 10</span>
              </>
            )}
          </strong>
          <span>{mainWorkoutTarget(w) ? 'main-set target' : 'effort'}</span>
        </div>
      </div>
      {w.kind !== 'race' && (
        <p className="subtle">
          {w.steps.some((s) => s.metres !== undefined)
            ? 'Distance steps finish at their kilometre or mile target. Time is a planning estimate; keep the effort comfortable and stop earlier if you reach your available time limit. '
            : ''}
          {estimate.basis} Follow the targets and cues in each step.
        </p>
      )}
      {!completedLog && <DailyGuide guide={dailyGuide(plan, w.date, w)} />}
      <SessionBriefing workout={w} units={profile.units} />
      <EffortGraph workout={w} units={profile.units} />
      <div className="session-steps">
        <div className="section-heading">
          <h3>Your session, step by step</h3>
          <Footprints size={18} />
        </div>
        <WorkoutSteps workout={w} profile={profile} />
      </div>
      <details className="reason-details">
        <summary>Why this workout?</summary>
        <p>{w.reason}</p>
      </details>
      {workoutGuidance(plan, w).length > 0 && (
        <details className="reason-details">
          <summary>Race practice & preparation</summary>
          {workoutGuidance(plan, w).map((note) => (
            <p key={note}>{note}</p>
          ))}
        </details>
      )}
    </>
  );
  const currentDelivery =
    delivery?.version === version &&
    ['accepted', 'confirmed'].includes(delivery.status);
  const heartRate = w.steps.some((s) => s.target?.mode === 'heart-rate');
  const deliveryContent = (
    <section className="watch-single" aria-label="Watch delivery">
      <div className="watch-delivery">
        <Watch size={20} aria-hidden="true" />
        <div>
          <strong>{deliveryLabel(delivery, version)}</strong>
          <small>
            {currentDelivery
              ? delivery?.status === 'confirmed'
                ? 'You confirmed this version on your watch.'
                : 'The date and workout steps match in Intervals.icu.'
              : heartRate
                ? 'This workout uses heart-rate targets. Use a Garmin FIT file to keep the exact BPM targets.'
                : delivery?.message ||
                  'Send this workout with its warm-up, repetitions, recovery and cool-down.'}
          </small>
        </div>
      </div>
      {currentDelivery &&
        delivery?.status === 'accepted' &&
        w.status === 'planned' && (
          <>
            <GarminHandoff />
            <BusyButton
              className="secondary-button"
              busy={pendingAction === 'confirmWatch'}
              busyLabel="Saving confirmation…"
              disabled={busy}
              onClick={() => void act('confirmWatch')}
            >
              <Check size={16} />I can see it on my watch
            </BusyButton>
          </>
        )}
      {!currentDelivery && !heartRate && (
        <BusyButton
          className="primary-button"
          busy={pendingAction === 'sync'}
          busyLabel="Sending and checking…"
          disabled={
            isDemo || busy || w.status !== 'planned' || !sendWindow.allowed
          }
          onClick={() => (connected ? void act('sync') : onConnect())}
        >
          <Watch size={17} />
          {!connected
            ? 'Connect my watch'
            : sendWindow.opens
              ? `Send from ${dateLabel(sendWindow.opens)}`
              : delivery
                ? 'Update watch workout'
                : 'Send watch workout'}
        </BusyButton>
      )}
      {!sendWindow.allowed && w.status === 'planned' && (
        <output className="subtle">{sendWindow.reason}</output>
      )}
      {heartRate && (
        <a
          className={`primary-button ${isDemo ? 'disabled-link' : ''}`}
          href={
            isDemo
              ? undefined
              : `/api/export?id=${encodeURIComponent(w.id)}&format=fit`
          }
          aria-disabled={isDemo}
          download
        >
          <Download size={17} />
          Download Garmin FIT
        </a>
      )}
      <details className="reason-details">
        <summary>Delivery details &amp; other options</summary>
        {delivery && w.status === 'planned' && (
          <BusyButton
            className="secondary-button"
            busy={pendingAction === 'checkDelivery'}
            disabled={busy}
            busyLabel="Checking delivery…"
            onClick={() => void act('checkDelivery')}
          >
            <RefreshCw size={16} />
            Check delivery status
          </BusyButton>
        )}
        {!heartRate && (
          <a
            className={`text-button ${isDemo ? 'disabled-link' : ''}`}
            href={
              isDemo
                ? undefined
                : `/api/export?id=${encodeURIComponent(w.id)}&format=fit`
            }
            aria-disabled={isDemo}
            download
          >
            <Download size={17} />
            Download FIT instead
          </a>
        )}
        <p className="subtle">
          Stride verifies your workout in Intervals.icu. Garmin Connect syncs it
          to your watch. Only your confirmation marks it as seen on the watch.
        </p>
      </details>
      <button className="text-button" disabled={busy} onClick={onConnect}>
        <ArrowLeft size={15} />
        Back to watch sync
      </button>
    </section>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        logging
          ? mode === 'correctLog'
            ? 'Correct your run'
            : 'Log your run'
          : mode === 'move'
            ? 'Move your run'
            : mode === 'skip'
              ? 'Let this one go'
              : mode === 'advanced'
                ? 'Advanced workout edit'
                : w.title
      }
      description={
        mode === 'view'
          ? completedLog
            ? `${dateLabel(recordedWorkoutDate(w), { weekday: 'long', day: 'numeric', month: 'long' })} · ${runDuration(completedLog.actualMinutes)}`
            : `${dateLabel(w.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${prescribedDistanceKm(w) !== null ? workoutDistanceLabel(w, profile) : runDuration(w.minutes)}${w.session ? ` · ${w.session} ${w.startTime}` : ''}`
          : logging
            ? 'Your feedback helps decide whether to ease the next week.'
            : mode === 'move'
              ? w.pairId
                ? 'Slide to an empty day. Both sessions move together; we’ll check the week before saving.'
                : 'Slide your workout through the week. Landing on another run swaps their dates.'
              : mode === 'skip'
                ? 'There is no missed mileage to make up.'
                : 'Shorten the session while keeping its structure.'
      }
      wide
      locked={busy}
    >
      {mode === 'view' && (
        <>
          {initialMode === 'delivery' && deliveryContent}
          <div className="detail-topline">
            <span className="pill filled">
              {w.status === 'completed'
                ? 'Completed'
                : w.status === 'skipped'
                  ? 'Skipped'
                  : w.hard
                    ? 'Quality session'
                    : 'Easy effort'}
            </span>
            {!completedLog && (
              <DropdownMenu defaultOpen={initialMode === 'actions'}>
                <DropdownMenuTrigger
                  className="secondary-button small-button"
                  aria-label="More workout actions"
                >
                  More actions <MoreHorizontal size={17} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="workout-menu">
                  <DropdownMenuItem
                    disabled={!editable || isDemo}
                    onClick={() => setMode('move')}
                  >
                    <CalendarDays size={16} />{' '}
                    {w.pairId ? 'Move paired day' : 'Move date'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={
                      w.status !== 'planned' || w.kind === 'race' || isDemo
                    }
                    onClick={() => setMode('skip')}
                  >
                    <SkipForward size={16} /> Skip this run
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!editable || isDemo}
                    onClick={() => setMode('advanced')}
                  >
                    <SlidersHorizontal size={16} /> Shorten or substitute
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {completedLog ? (
            <>
              <section
                className="recorded-run-summary"
                aria-label="Recorded run"
              >
                <div className="recorded-run-heading">
                  <h3>Your recorded run</h3>
                  <button
                    className="secondary-button"
                    disabled={busy || isDemo}
                    onClick={() => setMode('correctLog')}
                  >
                    Correct run log
                  </button>
                </div>
                <dl className="recorded-run-metrics">
                  <div>
                    <dt>Time running</dt>
                    <dd>{runDuration(completedLog.actualMinutes)}</dd>
                  </div>
                  <div>
                    <dt>Recorded distance</dt>
                    <dd>
                      {completedLog.actualKm === null
                        ? 'Not recorded'
                        : `${kmDisplay(completedLog.actualKm, profile.units)} ${profile.units}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Effort</dt>
                    <dd>
                      {completedLog.effort}
                      <small> / 10</small>
                    </dd>
                  </div>
                </dl>
                <p>
                  Feeling {completedLog.feeling}
                  {completedLog.activityId
                    ? ' · Recording attached'
                    : ' · Manual log'}
                </p>
                {completedLog.enjoyment && (
                  <p>
                    Would do this workout again:{' '}
                    {completedLog.enjoyment === 'yes'
                      ? 'Yes'
                      : completedLog.enjoyment === 'maybe'
                        ? 'Maybe'
                        : 'No'}
                    .
                  </p>
                )}
                {completedLog.note && (
                  <p className="recorded-run-note">{completedLog.note}</p>
                )}
              </section>
              <DailyGuide guide={dailyGuide(plan, recordedWorkoutDate(w), w)} />
              <details className="recorded-prescription">
                <summary>View prescribed workout</summary>
                <p className="subtle">
                  Scheduled for {dateLabel(w.date)}. These are the original
                  instructions; your recorded results are above.
                </p>
                {prescriptionContent}
              </details>
            </>
          ) : (
            prescriptionContent
          )}
          {w.skipReason && <p className="subtle">Skipped: {w.skipReason}</p>}
          <div className="modal-actions">
            <span className="subtle">
              {isDemo
                ? 'Example workout · build your own plan to log runs.'
                : w.date > today
                  ? 'Logging opens on the workout date.'
                  : ''}
            </span>
            {w.status === 'planned' && (
              <button
                className="primary-button"
                disabled={isDemo || w.date > today || busy}
                onClick={() => setMode('log')}
              >
                Log this run <Check size={17} />
              </button>
            )}
          </div>
        </>
      )}
      {logging && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!feedbackValidation.validate()) return;
            void act(mode === 'correctLog' ? 'correctLog' : 'complete', {
              correctionReason,
              feedback: {
                actualDate,
                effort: Number(effort),
                feeling,
                enjoyment: enjoyment === 'unanswered' ? null : enjoyment,
                actualMinutes: minutes,
                actualKm: distance,
                note,
                execution,
                completedQualityMinutes: qualityDone ?? undefined,
                ...(w.feedback?.activityId
                  ? {
                      activityId: w.feedback.activityId,
                      source: w.feedback.source,
                    }
                  : {}),
                ...(imported
                  ? { activityId: imported.id, source: imported.source }
                  : {}),
              },
            });
          }}
        >
          <fieldset disabled={busy} className="form-section form-content">
            {mode === 'correctLog' && (
              <Field label="Reason for correction">
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="For example: entered the wrong duration"
                />
                <small>The earlier log remains in your revision history.</small>
              </Field>
            )}
            <Field label="Actual run date">
              <input
                required
                type="date"
                max={today}
                value={actualDate}
                onInput={(e) => setActualDate(e.currentTarget.value)}
              />
            </Field>
            {imported && (
              <div className="notice">
                Imported from {imported.source}. Check the details and confirm
                this is the right session.
              </div>
            )}
            <div className="form-grid">
              <Field label="Actual time (minutes)">
                <NumericInput
                  name="loggedMinutes"
                  value={minutes}
                  onValueChange={(v) => setMinutes(v ?? NaN)}
                  required
                  min={1}
                  max={MAX_RECORDED_MINUTES}
                />
              </Field>
              <Field label={`Actual distance (${profile.units}, optional)`}>
                <NumericInput
                  name="loggedDistance"
                  value={distance}
                  onValueChange={setDistance}
                  factor={profile.units === 'mi' ? 1.609344 : 1}
                  min={0.001}
                  max={250}
                  placeholder="From your watch"
                />
              </Field>
            </div>
            {(w.hard || w.stimulus === 'economy' || runWalk) && (
              <>
                <Field
                  label={
                    runWalk
                      ? 'Did you complete the running intervals?'
                      : 'How much of the intended session did you do?'
                  }
                  hint={
                    runWalk
                      ? 'Walking breaks are part of the plan. Extra walking is okay; record what you did so the next stage fits your running.'
                      : 'Your own report. A watch summary alone does not prove the intervals were completed.'
                  }
                >
                  <Choice
                    label={runWalk ? 'Running intervals' : 'Session execution'}
                    value={execution}
                    onChange={(v) => setExecution(v as typeof execution)}
                    options={[
                      { value: 'unknown', label: 'Not sure / not recorded' },
                      {
                        value: 'as-planned',
                        label: runWalk
                          ? 'Completed the run-and-walk intervals'
                          : 'Completed the intended work',
                      },
                      {
                        value: 'partial',
                        label: runWalk
                          ? 'Needed extra walking / shortened the running'
                          : 'Some of the intended work',
                      },
                      {
                        value: 'easy-substitute',
                        label: runWalk
                          ? 'Did a different easy run'
                          : 'Ran easy instead',
                      },
                      {
                        value: 'not-attempted',
                        label: runWalk
                          ? 'Walked instead / did not run'
                          : 'Did not attempt the work',
                      },
                    ]}
                  />
                </Field>
                {!runWalk && (
                  <Field
                    label="Quality minutes completed, optional"
                    hint="Count work intervals only. Leave blank if unknown; exclude warm-up, recoveries and cooldown."
                  >
                    <NumericInput
                      name="qualityDone"
                      value={qualityDone}
                      onValueChange={setQualityDone}
                      min={0}
                      max={w.qualityMinutes ?? w.minutes}
                    />
                  </Field>
                )}
              </>
            )}
            <Field
              label="Overall effort"
              error={feedbackValidation.effortError}
            >
              <Choice
                label="Overall effort"
                id={feedbackValidation.effortId}
                placeholder="Choose your effort"
                value={effort}
                onChange={setEffort}
                options={Array.from({ length: 10 }, (_, i) => ({
                  value: String(i + 1),
                  label: `${i + 1} / 10${i < 3 ? ' · Easy' : i < 6 ? ' · Moderate' : i < 8 ? ' · Hard' : ' · Very hard'}`,
                }))}
              />
            </Field>
            <Field
              label="How did you feel after this run?"
              error={feedbackValidation.feelingError}
            >
              <Choice
                label="Feeling"
                id={feedbackValidation.feelingId}
                placeholder="Choose how you felt"
                value={feeling}
                onChange={setFeeling}
                options={[
                  { value: 'good', label: 'Good · ready for more' },
                  { value: 'okay', label: 'Okay · a normal training day' },
                  { value: 'tired', label: 'Tired · could use more recovery' },
                ]}
              />
            </Field>
            <Field
              label="Would you do this workout again? (optional)"
              hint="Your preference, separate from fatigue. This does not increase your training load."
            >
              <Choice
                label="Workout enjoyment"
                value={enjoyment}
                onChange={setEnjoyment}
                options={[
                  { value: 'unanswered', label: 'Leave unanswered' },
                  { value: 'yes', label: 'Yes · I enjoyed it' },
                  { value: 'maybe', label: 'Maybe · with some changes' },
                  { value: 'no', label: 'No · it did not work for me' },
                ]}
              />
            </Field>
            <Field label="Anything worth remembering? (optional)">
              <textarea
                maxLength={2000}
                rows={3}
                value={note}
                onInput={(e) => setNote(e.currentTarget.value)}
                placeholder="What worked, what felt repetitive, or what did not fit your day."
              />
            </Field>
          </fieldset>
          <div className="modal-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => setMode('view')}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Saving your run…"
              className="primary-button"
              disabled={busy}
            >
              {busy
                ? 'Saving…'
                : mode === 'correctLog'
                  ? 'Save correction'
                  : 'Save run'}{' '}
              <Check size={16} />
            </BusyButton>
          </div>
        </form>
      )}
      {(mode === 'move' || mode === 'advanced') && (
        <WorkoutEdit
          workout={w}
          plan={plan}
          version={version}
          mode={mode}
          today={today}
          busy={busy}
          onAction={onAction}
          onBack={() => setMode('view')}
          onClose={onClose}
        />
      )}
      {mode === 'skip' && (
        <>
          <Field label="Reason">
            <Choice
              label="Skip reason"
              value={skipReason}
              onChange={setSkipReason}
              options={[
                { value: 'okay', label: 'Life got in the way' },
                { value: 'tired', label: 'I need more recovery' },
                { value: 'good', label: 'I did something else' },
              ]}
            />
          </Field>
          <p className="subtle">
            Skipping leaves the rest of your plan in place. If you need several
            days off, use Adjust plan to add a break and a lighter return week.
          </p>
          <div className="modal-actions">
            <button className="text-button" onClick={() => setMode('view')}>
              Back
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                void act('skip', {
                  reason:
                    skipReason === 'tired'
                      ? 'Needed recovery'
                      : skipReason === 'good'
                        ? 'Did something else'
                        : 'Life got in the way',
                })
              }
            >
              Skip workout
            </button>
          </div>
        </>
      )}

      {error && <FormError message={error} />}
    </Modal>
  );
}
