'use client';

import { useMemo } from 'react';
import { dateLabel, kmDisplay, type Plan, type Workout } from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { recordedTrainingInsights } from '@/lib/recorded-insights';
import { DrawnUnderline } from '../drawn-ui';

export function PlanTrainingInsights({
  plan,
  today,
  isDemo,
  onWorkout,
  onQuickLog,
}: {
  plan: Plan;
  today: string;
  isDemo: boolean;
  onWorkout: (workout: Workout) => void;
  onQuickLog?: () => void;
}) {
  const history = useMemo(
    () => recordedTrainingInsights(plan, today),
    [plan, today],
  );
  const distance = (km: number | null) =>
    km === null
      ? 'Not recorded'
      : `${kmDisplay(km, plan.profile.units)} ${plan.profile.units}`;
  const count = history.records.length;
  const feelingLabel =
    history.feelingCount > 0
      ? `${history.feelings.good} good · ${history.feelings.okay} okay · ${history.feelings.tired} tired`
      : 'No feelings recorded';
  return (
    <section className="plan-insights" aria-labelledby="plan-insights-heading">
      <div className="plan-insights-heading">
        <h2 id="plan-insights-heading" className="ink-heading">
          Training insights
          <DrawnUnderline />
        </h2>
        <p>
          {isDemo ? 'Example records · ' : ''}
          {dateLabel(history.start)}–{dateLabel(history.end)}
        </p>
        {onQuickLog && (
          <button
            type="button"
            className="secondary-button"
            onClick={onQuickLog}
          >
            Log a run
          </button>
        )}
      </div>
      <p className="plan-insights-intro">
        The last 28 completed days, in four seven-day periods, including runs
        outside this plan. Today’s runs remain in your journal until tomorrow.
      </p>
      {count === 0 ? (
        <p className="plan-insights-empty">
          No runs recorded in this period. Log a completed run to see your
          consistency, recorded volume and how the running felt here.
        </p>
      ) : (
        <>
          <dl className="plan-insights-totals">
            <div>
              <dt>Days you ran</dt>
              <dd>
                {history.recordedDays}
                <small> / 28</small>
              </dd>
              <span>
                {count} recorded {count === 1 ? 'run' : 'runs'}
              </span>
            </div>
            <div>
              <dt>Recorded running time</dt>
              <dd>
                {history.minutes === null ? '—' : runDuration(history.minutes)}
              </dd>
              <span>
                {history.missingTimes
                  ? `${history.missingTimes} without time`
                  : 'From your recorded runs'}
              </span>
            </div>
            <div>
              <dt>
                {history.missingDistances
                  ? 'Known distance'
                  : 'Recorded distance'}
              </dt>
              <dd>{history.km === null ? '—' : distance(history.km)}</dd>
              <span>
                {history.missingDistances
                  ? `${history.missingDistances} without distance`
                  : 'All recorded runs have a distance'}
              </span>
            </div>
          </dl>
          <div className="plan-insights-observations">
            <section aria-labelledby="plan-consistency-heading">
              <h3 id="plan-consistency-heading">Your consistency</h3>
              <p>
                You have recorded running in{' '}
                <strong>{history.recordedWeeks} of 4 weeks</strong>. Multiple
                runs on one date count as one running day.
              </p>
              <p>
                {history.longest ? (
                  <>
                    Your longest recorded distance was{' '}
                    <strong>{distance(history.longest.km)}</strong> on{' '}
                    {dateLabel(history.longest.date)}.
                    {history.missingDistances > 0
                      ? ' Runs without a distance cannot be compared.'
                      : ''}
                  </>
                ) : (
                  'Record a distance to compare the lengths of your runs.'
                )}
              </p>
            </section>
            <section aria-labelledby="plan-effort-heading">
              <h3 id="plan-effort-heading">How the running felt</h3>
              <p>
                {history.effort.mean === null ? (
                  'No effort ratings recorded.'
                ) : (
                  <>
                    Average self-reported effort:{' '}
                    <strong>{history.effort.mean.toFixed(1)}/10</strong> across{' '}
                    {history.effort.count} rated{' '}
                    {history.effort.count === 1 ? 'run' : 'runs'}.
                  </>
                )}
                {history.effort.count < count && (
                  <> {count - history.effort.count} without an effort rating.</>
                )}
              </p>
              <p>
                {feelingLabel}.
                {history.feelingCount < count && (
                  <>
                    {' '}
                    {count - history.feelingCount} without a feeling recorded.
                  </>
                )}{' '}
                These are your own ratings, not measured heart-rate zones.
              </p>
            </section>
          </div>
          <section
            className="plan-insights-heart-rate"
            aria-labelledby="plan-heart-rate-heading"
          >
            <h3 id="plan-heart-rate-heading">Measured heart rate</h3>
            {history.heartRate.count === 0 ? (
              <p>
                No measured heart rate is saved for these runs. Workout
                heart-rate targets are not recordings.
              </p>
            ) : (
              <>
                <p>
                  Heart-rate summaries are available for{' '}
                  <strong>
                    {history.heartRate.count} of {count} runs
                  </strong>
                  .
                  {history.heartRate.averageLow !== null && (
                    <>
                      {' '}
                      Per-run average heart rate:{' '}
                      <strong>
                        {history.heartRate.averageLow ===
                        history.heartRate.averageHigh
                          ? history.heartRate.averageLow
                          : `${history.heartRate.averageLow}–${history.heartRate.averageHigh}`}{' '}
                        bpm
                      </strong>
                      , across {history.heartRate.averageCount}{' '}
                      {history.heartRate.averageCount === 1 ? 'run' : 'runs'}.
                    </>
                  )}
                  {history.heartRate.highest && (
                    <>
                      {' '}
                      Highest recorded maximum:{' '}
                      <strong>{history.heartRate.highest.bpm} bpm</strong> on{' '}
                      {dateLabel(history.heartRate.highest.date)}.
                    </>
                  )}
                </p>
                <p>
                  These are imported summaries. Different sessions and
                  conditions are not directly comparable; an average or maximum
                  cannot show time spent in heart-rate zones.
                </p>
              </>
            )}
          </section>
          <div className="plan-insights-table-scroll">
            <table className="plan-insights-table">
              <caption>Recorded volume, week by week</caption>
              <thead>
                <tr>
                  <th scope="col">Dates</th>
                  <th scope="col">Run days</th>
                  <th scope="col">Time</th>
                  <th scope="col">Distance</th>
                </tr>
              </thead>
              <tbody>
                {history.periods.map((period) => (
                  <tr key={period.from}>
                    <th scope="row">
                      {dateLabel(period.from)}–{dateLabel(period.to)}
                    </th>
                    <td>
                      {period.days > 0
                        ? `${period.days} · ${period.runs} ${period.runs === 1 ? 'run' : 'runs'}`
                        : 'No runs logged'}
                    </td>
                    <td>
                      {period.minutes === null
                        ? '—'
                        : runDuration(period.minutes)}
                      {period.missingTimes > 0 && (
                        <small>{period.missingTimes} without time</small>
                      )}
                    </td>
                    <td>
                      {period.km === null ? '—' : distance(period.km)}
                      {period.missingDistances > 0 && (
                        <small>
                          {period.missingDistances} without distance
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="plan-insights-note">
            An empty period means no runs logged here; it does not prove you
            rested. Missing distances are excluded from known totals.
          </p>
          {history.quality.count > 0 && (
            <section
              className="plan-insights-execution"
              aria-labelledby="plan-execution-heading"
            >
              <h3 id="plan-execution-heading">Your workout execution</h3>
              <p>
                Of {history.quality.count} recorded quality{' '}
                {history.quality.count === 1 ? 'session' : 'sessions'}, you
                reported {history.quality.asPlanned} as planned and{' '}
                {history.quality.changed} changed or not attempted.
                {history.quality.missingExecution.length > 0 && (
                  <>
                    {' '}
                    {history.quality.missingExecution.length} still need
                    execution details.
                  </>
                )}
              </p>
              <p>
                {history.quality.knownMinutes === null ? (
                  'Work-interval minutes have not been recorded.'
                ) : (
                  <>
                    Known work-interval time:{' '}
                    <strong>{runDuration(history.quality.knownMinutes)}</strong>
                    .
                    {history.quality.missingMinutes > 0 && (
                      <>
                        {' '}
                        {history.quality.missingMinutes} sessions have no
                        work-interval time recorded.
                      </>
                    )}
                  </>
                )}{' '}
                Total run time does not confirm that each interval was
                completed.
              </p>
              {!isDemo && history.quality.missingExecution.length > 0 && (
                <div className="plan-insights-review-actions">
                  {history.quality.missingExecution.slice(-3).map((workout) => (
                    <button
                      key={workout.id}
                      type="button"
                      className="text-button"
                      onClick={() => onWorkout(workout)}
                    >
                      Review{' '}
                      {dateLabel(workout.feedback?.actualDate ?? workout.date)}{' '}
                      · {workout.title}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      <details className="plan-insights-data">
        <summary>What these insights can tell you</summary>
        <p>
          Runs use their recorded dates, including preserved history and extra
          runs. A linked recording is counted once. Planned distances and paces
          are never substituted for observations.
        </p>
        <p>
          Heart rate is shown only when a measured summary is saved with a
          recording. Missing readings stay unknown. Workout heart-rate targets
          are instructions, not measurements; this view does not derive zones or
          fitness changes from them.
        </p>
        {history.scheduled.count > 0 && (
          <p>
            For sessions scheduled in this period: {history.scheduled.completed}{' '}
            marked completed, {history.scheduled.skipped} skipped and{' '}
            {history.scheduled.unlogged} unlogged. Schedule status is separate
            from the running recorded above; a run may have happened on a
            different date.
          </p>
        )}
      </details>
    </section>
  );
}
