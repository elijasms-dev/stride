'use client';
import { useState } from 'react';
import { BusyButton } from './action-progress';
import { runDuration } from '@/lib/journal-view';
import { Check, CalendarDays, ArrowRight } from 'lucide-react';
import { Modal, Field, Choice, api } from './stride-ui';
import { addDays, dateLabel, type Plan } from '@/lib/engine';
import type { Action } from './workout-detail';
export function Adjustments({
  version,
  open,
  onClose,
  plan,
  today,
  onAction,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  version: number;
  today: string;
  onAction: Action;
  busy: boolean;
}) {
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(addDays(today, 3)),
    [mode, setMode] = useState('easy'),
    [preview, setPreview] = useState<Plan | null>(null),
    [previewVersion, setPreviewVersion] = useState(version),
    [effectiveDate, setEffectiveDate] = useState(today),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const changed =
    preview?.workouts.filter((s) => {
      const old = plan.workouts.find((w) => w.id === s.id);
      return (
        old &&
        (old.minutes !== s.minutes ||
          old.status !== s.status ||
          old.title !== s.title)
      );
    }) ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={preview ? 'A little room to recover' : 'Make room for real life'}
      description={
        preview
          ? 'Review the sessions that change. Everything else stays in place.'
          : 'A lighter stretch, time away, or simply a few days of rest.'
      }
      wide
    >
      {!preview ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setLoading(true);
            try {
              const r = await api<{
                plan: Plan;
                version: number;
                effectiveDate: string;
              }>('/api/plan', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'adjustPreview',
                  version,
                  from,
                  to,
                  mode,
                }),
              });
              setPreview(r.plan);
              setPreviewVersion(r.version);
              setEffectiveDate(r.effectiveDate);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="form-section">
            <Field label="What do you need?">
              <Choice
                value={mode}
                onChange={setMode}
                label="Adjustment type"
                options={[
                  { value: 'easy', label: 'Keep running, but make it easier' },
                  { value: 'rest', label: 'Take a complete break' },
                ]}
              />
            </Field>
            <div className="form-grid">
              <Field label="From">
                <input
                  required
                  type="date"
                  min={plan.profile.startDate}
                  max={plan.profile.raceDate}
                  value={from}
                  onInput={(e) => setFrom(e.currentTarget.value)}
                />
              </Field>
              <Field label="Through">
                <input
                  required
                  type="date"
                  min={from}
                  max={addDays(from, 20)}
                  value={to}
                  onInput={(e) => setTo(e.currentTarget.value)}
                />
              </Field>
            </div>
            <div className="notice">
              The return begins with short easy runs. Logged comfortable running
              unlocks a review of the next stage, including a capped long run
              and later a newly based training block. Rest can include race day;
              the event will be marked for review.
            </div>
          </div>
          <div className="modal-actions">
            <span />
            <BusyButton
              busy={loading}
              busyLabel="Recalculating your sessions…"
              className="primary-button"
              disabled={loading}
            >
              {loading ? 'Preparing…' : 'Preview changes'}{' '}
              <ArrowRight size={17} />
            </BusyButton>
          </div>
        </form>
      ) : (
        <>
          <div className="notice">
            <CalendarDays size={18} />
            <span>
              {dateLabel(from)} — {dateLabel(to)} ·{' '}
              {mode === 'rest' ? 'Rest' : 'Easy running'} · {changed.length}{' '}
              sessions change
            </span>
          </div>
          {preview.feasibility?.reasons.map((reason) => (
            <p className="notice" key={reason}>
              {reason}
            </p>
          ))}
          <div className="change-list">
            {changed.map((s) => {
              const old = plan.workouts.find((w) => w.id === s.id)!;
              return (
                <div key={s.id}>
                  <div>
                    <small>{dateLabel(s.date)}</small>
                    <strong>{s.title}</strong>
                  </div>
                  <span>
                    <del>{runDuration(old.minutes)}</del>{' '}
                    <ArrowRight size={14} />{' '}
                    {s.status === 'skipped'
                      ? 'Rest'
                      : `${runDuration(s.minutes)}`}
                  </span>
                </div>
              );
            })}
          </div>
          {changed.length === 0 && (
            <p className="subtle section-space">
              There are no planned training sessions affected by this period.
            </p>
          )}
          <div className="modal-actions">
            <button className="text-button" onClick={() => setPreview(null)}>
              Edit dates
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Saving your adjusted plan…"
              className="primary-button"
              disabled={busy || !changed.length}
              onClick={async () => {
                setError('');
                try {
                  await onAction('adjust', {
                    from,
                    to,
                    mode,
                    version: previewVersion,
                    effectiveDate,
                  });
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {busy ? 'Saving…' : 'Save these changes'} <Check size={16} />
            </BusyButton>
          </div>
        </>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
