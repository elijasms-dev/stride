'use client';
import { MAX_RECORDED_MINUTES } from '@/lib/ultra-policy';

import { type Plan } from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { BusyButton } from '../action-progress';
import { NumericInput } from '../numeric-input';
import type { Activity } from '../settings';
import { Choice, Field, FormError, Modal } from '../stride-ui';
import { useExtraRunForm } from './use-extra-run-form';

export function ExtraRunForm({
  plan,
  today,
  onClose,
  onBackToRecordings,
  onSaved,
  onAction,
  busy,
  imported,
  existing,
}: {
  plan: Plan;
  today: string;
  onClose: () => void;
  onBackToRecordings?: () => void;
  onSaved?: () => void;
  onAction: (action: string, payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  imported?: Activity;
  existing?: import('@/lib/engine').ExtraRun;
}) {
  const state = useExtraRunForm({
    plan,
    today,
    onClose,
    onBackToRecordings,
    onSaved,
    onAction,
    busy,
    imported,
    existing,
  });
  const {
    unit,
    date,
    setDate,
    minutes,
    setMinutes,
    distance,
    setDistance,
    effort,
    setEffort,
    feeling,
    setFeeling,
    note,
    setNote,
    correctionReason,
    setCorrectionReason,
    error,
    target,
    setTarget,
    matches,
    extras,
    attachedFeedback,
    feedbackValidation,
  } = state;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        existing
          ? 'Correct your run'
          : imported
            ? 'Review this recording'
            : 'Log an extra run'
      }
      description={
        existing
          ? 'Correct the recorded time, distance or notes.'
          : imported
            ? 'Attach this recording to an existing run, or save it as an extra run.'
            : 'Log running outside your prescribed sessions. Your future workload does not increase automatically.'
      }
      locked={busy}
    >
      <form onSubmit={state.saveRun}>
        <fieldset disabled={busy} className="form-section form-content">
          {imported && !existing && (
            <p className="notice">
              Date, time and distance come from the provider and are verified
              when saved. To correct a recording, save it first, then use
              Correct run or Correct run log in your journal.
            </p>
          )}
          {imported && (
            <Field label="Where does this recording belong?">
              <select
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose a session</option>
                {matches.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.session ? `${w.session} · ` : ''}
                    {w.title} ·{' '}
                    {w.status === 'completed'
                      ? 'Attach to logged run'
                      : 'Log planned run'}
                  </option>
                ))}
                {extras.map((r) => (
                  <option key={r.id} value={r.id}>
                    Attach to extra run · {runDuration(r.minutes)}
                  </option>
                ))}
                <option value="extra">A separate, extra run</option>
              </select>
              <p className="subtle">
                Attaching updates the existing entry so the same run is counted
                once. Choose a separate run only if you ran again.
              </p>
            </Field>
          )}
          <Field label="Date you ran">
            <input
              required
              type="date"
              max={today}
              value={date}
              disabled={!!imported && !existing}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Actual minutes">
              <NumericInput
                name="actualMinutes"
                value={minutes}
                onValueChange={(v) => setMinutes(v ?? NaN)}
                disabled={!!imported && !existing}
                required
                min={1}
                max={MAX_RECORDED_MINUTES}
              />
            </Field>
            <Field label={`Actual distance (${unit}), optional`}>
              <NumericInput
                name="actualDistance"
                value={distance}
                onValueChange={setDistance}
                disabled={!!imported && !existing}
                factor={unit === 'mi' ? 1.609344 : 1}
                min={0.001}
                max={250}
              />
            </Field>
          </div>
          {attachedFeedback ? (
            <p className="notice">
              Your logged effort ({attachedFeedback.effort}/10), feeling (
              {attachedFeedback.feeling}) and notes stay with this run.
              Attaching only updates its recorded time, distance and source.
            </p>
          ) : (
            <>
              <Field
                label="Session effort, 1–10"
                error={feedbackValidation.effortError}
              >
                <input
                  required
                  type="number"
                  min="1"
                  max="10"
                  id={feedbackValidation.effortId}
                  placeholder="Choose 1–10"
                  value={effort}
                  onInput={(e) => setEffort(e.currentTarget.value)}
                />
              </Field>
              <Field
                label="How you felt"
                error={feedbackValidation.feelingError}
              >
                <Choice
                  label="How you felt"
                  id={feedbackValidation.feelingId}
                  placeholder="Choose how you felt"
                  value={feeling}
                  onChange={setFeeling}
                  options={[
                    { value: 'good', label: 'Good' },
                    { value: 'okay', label: 'Okay' },
                    { value: 'tired', label: 'Tired' },
                  ]}
                />
              </Field>
              <Field label="Notes, optional">
                <textarea
                  maxLength={2000}
                  value={note}
                  onInput={(e) => setNote(e.currentTarget.value)}
                />
              </Field>
            </>
          )}
          {existing && (
            <Field label="Reason for correction">
              <input
                required
                minLength={3}
                maxLength={200}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </Field>
          )}
          {imported && onBackToRecordings && (
            <button
              type="button"
              className="text-button"
              onClick={onBackToRecordings}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Back to recordings
            </button>
          )}
          <BusyButton
            busy={busy}
            busyLabel="Saving your run…"
            className="primary-button"
            disabled={busy}
          >
            {busy ? 'Saving…' : existing ? 'Save correction' : 'Save run'}{' '}
            <ArrowRight size={16} />
          </BusyButton>
        </fieldset>
        {error && <FormError message={error} />}
      </form>
    </Modal>
  );
}
