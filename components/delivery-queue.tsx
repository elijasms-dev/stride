'use client';
import { useEffect, useState } from 'react';
import { api } from './stride-ui';
import { dateLabel, type Workout } from '@/lib/engine';

type Job = {
  id: string;
  workout_id: string;
  status: string;
  available_at: string;
  result?: { message?: string } | null;
};
export function DeliveryQueue({
  onRefresh,
  workouts,
  onWorkout,
}: {
  onRefresh: () => Promise<void>;
  workouts: Workout[];
  onWorkout: (workout: Workout) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void api<{ jobs: Job[] }>('/api/delivery-jobs')
      .then((data) => {
        if (active) setJobs(data.jobs);
      })
      .catch(() => {
        if (active)
          setMessage(
            'Pending delivery status is unavailable. Reconnect and try again.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function update(action: 'resume' | 'cancel', id?: string) {
    setBusy(true);
    setMessage('');
    try {
      const result = await api<{ jobs: Job[] }>('/api/delivery-jobs', {
        method: 'POST',
        body: JSON.stringify({ action, id }),
      });
      setJobs(result.jobs);
      await onRefresh();
      setMessage(
        action === 'cancel'
          ? 'Pending delivery cancelled. Your provider calendar is unchanged.'
          : 'Delivery status refreshed. Items waiting for retry stay saved.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = jobs.filter((j) =>
    ['queued', 'retry', 'processing', 'review'].includes(j.status),
  );
  if (!pending.length && !message) return null;
  return (
    <section className="form-section" aria-label="Saved delivery requests">
      <h3>Saved deliveries</h3>
      <p>
        Interrupted sends stay saved. Resume while Stride is open; this web
        release does not retry after you close it. A changed workout or
        connection needs a fresh review.
      </p>
      {message && (
        <output className="notice" aria-live="polite">
          {message}
        </output>
      )}
      {pending.map((j) => {
        const workout = workouts.find((w) => w.id === j.workout_id);
        return (
          <div key={j.id} className="notice">
            <p>
              <strong>{workout?.title ?? 'Previous plan workout'}</strong>
              {workout ? ` · ${dateLabel(workout.date)}` : ''}
            </p>
            <p>
              {j.status === 'review'
                ? 'Review needed'
                : j.status === 'processing'
                  ? 'Sending or checking'
                  : 'Waiting to retry'}
              {j.status === 'retry'
                ? ` · ${new Date(j.available_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
            {j.result?.message && <p>{j.result.message}</p>}
            {j.status === 'review' && workout && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => onWorkout(workout)}
              >
                Review workout
              </button>
            )}
            {j.status !== 'processing' && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void update('cancel', j.id)}
              >
                Cancel saved request
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="primary-button"
        disabled={busy}
        onClick={() => void update('resume')}
      >
        {busy ? 'Checking deliveries…' : 'Resume deliveries'}
      </button>
    </section>
  );
}
