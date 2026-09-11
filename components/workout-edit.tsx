'use client';
import { BusyButton } from './action-progress';
import { runDuration } from '@/lib/journal-view';
import { trainingRecords } from '@/lib/training-history';
import { qualityWorkMinutes } from '@/lib/prescription';
import { duration, mainSetSummary, recoverySummary } from '@/lib/workout-names';
import { useState, useRef, useEffect } from 'react';
import { NumericInput } from './numeric-input';
import { api, Field, Choice } from './stride-ui';
import { WeekMoveSlider } from './week-move-slider';
import {
  dateLabel,
  monday,
  addDays,
  weekday,
  workoutAlternatives,
  type Plan,
  type Workout,
} from '@/lib/engine';
import type { Action } from './workout-detail';
type Preview = { plan: Plan; version: number; effectiveDate: string };
export default function WorkoutEdit({
  workout: w,
  plan,
  version,
  mode,
  today,
  busy,
  onAction,
  onBack,
  onClose,
}: {
  workout: Workout;
  plan: Plan;
  version: number;
  mode: 'move' | 'advanced';
  today: string;
  busy: boolean;
  onAction: Action;
  onBack: () => void;
  onClose: () => void;
}) {
  const flight = useRef(false);
  const [submitted, setSubmitted] = useState<{
    id: string;
    date: string;
    minutes: number;
    templateId: string;
  } | null>(null);
  const [date, setDate] = useState(w.date),
    [minutes, setMinutes] = useState(Math.floor(w.minutes)),
    [templateId, setTemplateId] = useState(''),
    [kind] = useState(mode),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (preview || error)
      document
        .querySelector<HTMLElement>('[role="dialog"] .modal-title')
        ?.focus();
  }, [preview, error]);
  const alternatives = workoutAlternatives(plan, w.id);
  const edit =
    kind === 'move' ? 'move' : templateId ? 'substitute' : 'advanced';
  const payload = { id: w.id, date, minutes, templateId };
  const previewStale =
    !!preview &&
    (preview.version !== version || preview.effectiveDate !== today);
  const recordedRuns = trainingRecords(plan);
  const moveDays = Array.from({ length: 7 }, (_, day) => {
    const target = addDays(monday(w.date), day);
    const sessions = plan.workouts.filter((run) => run.date === target);
    const other = sessions.find((run) => run.id !== w.id);
    const additionalRecords = recordedRuns.filter(
      (run) =>
        run.date === target && !sessions.some((s) => s.id === run.workoutId),
    ).length;
    const crossTraining = plan.profile.crossTraining?.some(
      (s) => s.day === weekday(target),
    );
    const reason =
      target === w.date
        ? 'Current date'
        : target < today
          ? 'Past date'
          : target < plan.profile.startDate || target > plan.profile.raceDate
            ? 'Outside your plan'
            : crossTraining
              ? 'Reserved for cross-training'
              : other?.status === 'completed'
                ? 'Recorded run · cannot swap'
                : other?.status === 'skipped'
                  ? 'Skipped run · cannot swap'
                  : other?.kind === 'race'
                    ? 'Race day · stays in place'
                    : other?.pairId
                      ? 'Paired sessions · choose an empty day'
                      : w.pairId && other
                        ? 'Your paired runs need an empty day'
                        : '';
    return {
      date: target,
      occupied: !!other,
      reason,
      title:
        [
          sessions.length
            ? sessions
                .map(
                  (run) =>
                    `${run.session ? `${run.session} ` : ''}${run.title}`,
                )
                .join(' / ')
            : crossTraining
              ? 'Cross-training'
              : '',
          additionalRecords
            ? `${additionalRecords} run${additionalRecords === 1 ? '' : 's'} already recorded`
            : '',
        ]
          .filter(Boolean)
          .join(' / ') || 'Rest day',
      action:
        reason ||
        (other
          ? 'Swap with this run'
          : w.pairId
            ? 'Move both runs here'
            : 'Move here'),
    };
  });
  const selectedMove = moveDays.find((day) => day.date === date);
  const changes =
    preview?.plan.workouts.filter((s) => {
      const old = plan.workouts.find((x) => x.id === s.id);
      return (
        !old ||
        old.date !== s.date ||
        old.minutes !== s.minutes ||
        old.title !== s.title ||
        JSON.stringify(old.steps) !== JSON.stringify(s.steps)
      );
    }) ?? [];
  return (
    <>
      {mode === 'advanced' && (
        <p className="notice">
          Choose a shorter session or an equivalent main set. Complete efforts
          and useful preparation are retained; a very short limit becomes easy
          running.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!preview ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              flight.current ||
              (kind === 'move' && (!selectedMove || selectedMove.reason))
            )
              return;
            flight.current = true;
            const snapshot = {
              ...payload,
              date:
                (
                  e.currentTarget.elements.namedItem(
                    'new-date',
                  ) as HTMLInputElement | null
                )?.value ?? date,
            };
            setSubmitted(snapshot);
            setLoading(true);
            setError('');
            try {
              setPreview(
                await api<Preview>('/api/plan', {
                  method: 'POST',
                  body: JSON.stringify({
                    action: 'workoutPreview',
                    edit,
                    version,
                    ...snapshot,
                  }),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              flight.current = false;
              setLoading(false);
            }
          }}
        >
          <fieldset disabled={loading || busy} className="form-content">
            {kind === 'move' ? (
              <WeekMoveSlider
                days={moveDays}
                originalDate={w.date}
                value={date}
                title={w.title}
                duration={runDuration(w.minutes)}
                paired={!!w.pairId}
                disabled={loading || busy}
                onChange={(value) => {
                  setDate(value);
                  setError('');
                }}
              />
            ) : (
              <>
                <Field label="Workout option">
                  <Choice
                    label="Workout option"
                    value={templateId}
                    onChange={setTemplateId}
                    options={[
                      { value: '', label: 'Shorten this session' },
                      ...alternatives.map((t) => ({
                        value: t.id,
                        label: t.title,
                      })),
                    ]}
                  />
                </Field>
                {!templateId && (
                  <Field label="Maximum duration (minutes)">
                    <NumericInput
                      name="shorterMinutes"
                      value={minutes}
                      onValueChange={(v) => setMinutes(v ?? NaN)}
                      integer
                      required
                      min={5}
                      max={Math.floor(w.minutes)}
                    />
                  </Field>
                )}
                {!alternatives.length && (
                  <p className="subtle">
                    No equivalent session currently fits this purpose and work
                    budget.
                  </p>
                )}
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="text-button" onClick={onBack}>
                Back
              </button>
              <BusyButton
                busy={loading || busy}
                busyLabel="Checking the week…"
                className="primary-button"
                disabled={
                  loading ||
                  busy ||
                  (kind === 'move' && (!selectedMove || !!selectedMove.reason))
                }
              >
                {loading ? 'Checking the week…' : 'Preview changes'}
              </BusyButton>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="change-list">
            {changes.map((s) => {
              const previous = plan.workouts.find((old) => old.id === s.id);
              const previousDate = previous?.date;
              const workBefore = previous ? qualityWorkMinutes(previous) : 0;
              const workAfter = qualityWorkMinutes(s);
              return (
                <div key={s.id}>
                  <div>
                    <small>
                      {kind === 'move' &&
                      previousDate &&
                      previousDate !== s.date
                        ? `${dateLabel(previousDate, { weekday: 'short', day: 'numeric', month: 'short' })} → `
                        : ''}
                      {dateLabel(s.date, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </small>
                    <strong>{s.title}</strong>
                    {kind === 'advanced' && previous ? (
                      <>
                        {mainSetSummary(s) && (
                          <p>
                            {mainSetSummary(s)} · {recoverySummary(s)}
                          </p>
                        )}
                        <dl
                          className="mt-3 grid grid-cols-2 gap-3 text-sm"
                          aria-label="Session time changes"
                        >
                          <div>
                            <dt>Work intervals</dt>
                            <dd className="mt-1 font-semibold tabular-nums">
                              {duration(Math.round(workBefore * 60))} →{' '}
                              {duration(Math.round(workAfter * 60))}
                            </dd>
                          </div>
                          <div>
                            <dt>Easy & recovery</dt>
                            <dd className="mt-1 font-semibold tabular-nums">
                              {duration(
                                Math.round(
                                  (previous.minutes - workBefore) * 60,
                                ),
                              )}{' '}
                              →{' '}
                              {duration(
                                Math.round((s.minutes - workAfter) * 60),
                              )}
                            </dd>
                          </div>
                        </dl>
                        {(previous.steps.some(
                          (step) => step.metres !== undefined,
                        ) ||
                          s.steps.some(
                            (step) => step.metres !== undefined,
                          )) && (
                          <p>
                            Times for distance steps are planning estimates.
                          </p>
                        )}
                      </>
                    ) : (
                      <p>
                        {s.steps
                          .map(
                            (step) =>
                              `${step.label} ${Math.round(step.seconds / 6) / 10} min`,
                          )
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <span>{runDuration(s.minutes)}</span>
                </div>
              );
            })}
          </div>
          {!changes.length && <p>No workouts change with these settings.</p>}
          {previewStale && (
            <output className="notice">
              {preview.effectiveDate !== today
                ? 'A new training day has started.'
                : 'Your plan has changed since this preview.'}{' '}
              Review again before saving. Your choices are still here.
            </output>
          )}
          <div className="modal-actions">
            <button
              className="text-button"
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              {previewStale ? 'Review again' : 'Edit'}
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Saving workout changes…"
              className="primary-button"
              disabled={busy || !changes.length || previewStale}
              onClick={async () => {
                setError('');
                try {
                  await onAction(edit, {
                    ...submitted,
                    version: preview.version,
                    effectiveDate: preview.effectiveDate,
                  });
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {busy ? 'Saving…' : 'Save these changes'}
            </BusyButton>
          </div>
        </>
      )}
    </>
  );
}
