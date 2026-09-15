'use client';

import {
  addDays,
  dateLabel,
  kmDisplay,
  type Plan,
  type Workout,
} from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { qualityTrainingEvidence } from '@/lib/training-evidence';
import { workloadSummary } from '@/lib/training-history';
import { Plus } from 'lucide-react';

export function TrainingInsights({
  plan,
  today,
  isDemo,
  onWorkout,
  onExtra,
}: {
  plan: Plan;
  today: string;
  isDemo: boolean;
  onWorkout: (w: Workout) => void;
  onExtra: () => void;
}) {
  const history = workloadSummary(plan, today),
    unit = plan.profile.units;
  const qualityData = qualityTrainingEvidence(
    plan.workouts,
    today,
    history.start,
  );
  const missingExecution = qualityData.filter((r) =>
    ['execution-unknown', 'dose-unknown', 'feedback-unknown'].includes(
      r.status,
    ),
  );
  return (
    <section className="training-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Recorded training</span>
          <h2>Your last four weeks</h2>
        </div>
        <button className="secondary-button" onClick={onExtra}>
          <Plus size={16} />
          Log an extra run
        </button>
      </div>
      <p>
        {dateLabel(history.start)} — {dateLabel(history.end)}. Today is shown
        separately in your journal.
      </p>
      <div className="history-metrics">
        <div>
          <strong>{history.recent.length}</strong>
          <span>runs recorded</span>
        </div>
        <div>
          <strong>
            {history.recent.some((r) => r.km !== null)
              ? `${kmDisplay(history.totalKm, unit)} ${unit}`
              : '—'}
          </strong>
          <span>known distance</span>
        </div>
        <div>
          <strong>{runDuration(history.totalMinutes)}</strong>
          <span>actual time</span>
        </div>
        <div>
          <strong>
            {history.records.some(
              (r) =>
                r.date <= today &&
                r.date >= addDays(today, -29) &&
                r.km !== null,
            )
              ? `${kmDisplay(history.longestKm, unit)} ${unit}`
              : '—'}
          </strong>
          <span>longest run · last 30 days</span>
        </div>
      </div>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Seven-day period</th>
              <th>Runs</th>
              <th>Actual distance</th>
              <th>Actual time</th>
              <th>Prescribed time</th>
            </tr>
          </thead>
          <tbody>
            {history.weeks.map((w) => (
              <tr key={w.from}>
                <th>
                  {dateLabel(w.from)}–{dateLabel(w.to)}
                </th>
                <td>{w.runs}</td>
                <td>
                  {w.runs > w.unknownDistances
                    ? `${kmDisplay(w.km, unit)} ${unit}`
                    : '—'}
                  {w.unknownDistances
                    ? ` · ${w.unknownDistances} without distance`
                    : ''}
                </td>
                <td>{runDuration(w.minutes)}</td>
                <td>{w.plannedMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="subtle">
        An empty week means no runs recorded here; it does not prove you rested.
        Extra runs count toward actual workload and never add a mileage debt to
        the plan.
      </p>
      <details className="reason-details">
        <summary>Training data behind your plan</summary>
        <p>
          This review uses your recorded runs from the four completed weeks
          above. A missing distance stays unknown. Today can inform a fatigue
          hold, but does not yet count toward progression.
        </p>
        <div className="history-metrics">
          <div>
            <strong>
              {history.recent.filter((r) => r.km === null).length}
            </strong>
            <span>runs without distance</span>
          </div>
          <div>
            <strong>{qualityData.filter((r) => r.eligible).length}</strong>
            <span>quality sessions meeting review criteria</span>
          </div>
          <div>
            <strong>{missingExecution.length}</strong>
            <span>quality logs with incomplete feedback</span>
          </div>
        </div>
        <p className="subtle">
          Interval completion is your own report. A watch’s total time or
          distance does not prove the work intervals were completed. Eligibility
          also depends on the session family and training phase.
        </p>
        {!isDemo && missingExecution.length > 0 && (
          <ul>
            {missingExecution
              .slice(-3)
              .reverse()
              .map(({ workout, date, status }) => (
                <li key={workout.id}>
                  <button
                    className="text-button"
                    onClick={() => onWorkout(workout)}
                  >
                    {dateLabel(date)} · {workout.title} · Review log
                  </button>
                  <p className="subtle">
                    {status === 'feedback-unknown'
                      ? 'Effort or feeling is missing. Correct the log only if you remember how the session felt.'
                      : status === 'dose-unknown'
                        ? 'Work minutes are missing. Add them only if you know how much of the main set you completed.'
                        : 'Session execution is unknown. You can leave it unknown or correct the log if you remember.'}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </details>
      {history.fatigue.length >= 2 && (
        <div className="notice">
          <strong>Consider a lighter stretch</strong>
          <p>
            {history.fatigue.length} recent runs include tiredness or
            unexpectedly high effort on an easy day. Review recovery before
            adding more work.
          </p>
        </div>
      )}
      {history.unlogged.length > 0 && (
        <p className="subtle">
          {history.unlogged.length} past prescribed runs are still unlogged.
          Record what happened before drawing conclusions.
        </p>
      )}
      <details className="reason-details">
        <summary>How the workload review works</summary>
        <p>
          Actual duration is compared with prescribed duration, so a missing
          pace estimate does not create a false mileage comparison. Your longest
          run is a single recorded session, not the sum of a double day.
          Reported effort × minutes is {history.recordedLoad} for the recorded
          runs; this is a personal tracking measure, not a fitness or injury
          score.
        </p>
        <p>
          {history.canReviewBaseline
            ? 'There is enough recorded history to review your starting inputs, once you confirm that all running is included.'
            : 'More complete history is needed before reviewing your baseline. No automatic increase is made.'}
        </p>
      </details>
    </section>
  );
}
