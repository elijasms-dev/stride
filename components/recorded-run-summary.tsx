import { kmDisplay, type Profile, type Workout } from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { isRunWalkWorkout } from '@/lib/run-walk';

/** Recorded observations only; planned distances and durations stay separate. */
export function RecordedRunSummary({
  workout,
  profile,
  disabled,
  onCorrect,
}: {
  workout: Workout;
  profile: Profile;
  disabled: boolean;
  onCorrect: () => void;
}) {
  const log = workout.feedback;
  const runWalk = isRunWalkWorkout(workout);
  const execution = {
    'as-planned': runWalk
      ? 'Completed the run-and-walk intervals'
      : 'Completed the intended work',
    partial: runWalk
      ? 'Needed extra walking or shortened the running'
      : 'Completed some of the intended work',
    'easy-substitute': 'Ran easy instead',
    'not-attempted': runWalk
      ? 'Walked instead or did not run'
      : 'Did not attempt the work',
    unknown: 'Not recorded',
  };
  return (
    <section className="recorded-run-summary" aria-label="Recorded run">
      <div className="recorded-run-heading">
        <h3>Your recorded run</h3>
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={onCorrect}
        >
          {log ? 'Correct run log' : 'Add run details'}
        </button>
      </div>
      {log ? (
        <>
          <dl className="recorded-run-metrics">
            <div>
              <dt>Time running</dt>
              <dd>{runDuration(log.actualMinutes)}</dd>
            </div>
            <div>
              <dt>Recorded distance</dt>
              <dd>
                {log.actualKm == null
                  ? 'Not recorded'
                  : `${kmDisplay(log.actualKm, profile.units)} ${profile.units}`}
              </dd>
            </div>
            <div>
              <dt>Effort</dt>
              <dd>
                {log.effort}
                <small> / 10</small>
              </dd>
            </div>
          </dl>
          <p>
            Feeling {log.feeling}
            {log.activityId ? ' · Recording attached' : ' · Manual log'}
          </p>
          {(workout.hard || workout.stimulus === 'economy' || runWalk) && (
            <dl className="recorded-run-execution">
              <div>
                <dt>{runWalk ? 'Running intervals' : 'Session execution'}</dt>
                <dd>{execution[log.execution ?? 'unknown']}</dd>
              </div>
              {!runWalk && (
                <div>
                  <dt>Quality work completed</dt>
                  <dd>
                    {log.completedQualityMinutes == null
                      ? 'Not recorded'
                      : runDuration(log.completedQualityMinutes)}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {log.enjoyment && (
            <p>
              Would do this workout again:{' '}
              {log.enjoyment === 'yes'
                ? 'Yes'
                : log.enjoyment === 'maybe'
                  ? 'Maybe'
                  : 'No'}
              .
            </p>
          )}
          {log.note && <p className="recorded-run-note">{log.note}</p>}
        </>
      ) : (
        <p>
          This run is marked completed, but its duration, distance and feedback
          were not recorded. Add the details when you have them.
        </p>
      )}
    </section>
  );
}
