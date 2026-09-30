'use client';

import { useState } from 'react';
import { dateLabel, kmDisplay, type Plan, type Workout } from '@/lib/engine';
import { dailyGuide, dayOverview } from '@/lib/daily-guide';
import { calendarSessions, orderedCalendarSessions } from '@/lib/day-sessions';
import { runDuration } from '@/lib/journal-view';
import { isRunWalkWorkout } from '@/lib/run-walk';
import { DailyGuide } from '../daily-guide';
import { SessionSequence } from '../session-sequence';
import { WorkoutSteps } from '../workout-steps';

/** Present the saved steps unchanged; selecting a block only highlights its row. */
function SavedSessionPrescription({
  plan,
  workout,
}: {
  plan: Plan;
  workout: Workout;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  return (
    <>
      {workout.purpose && (
        <section className="today-session-purpose" aria-label="Session purpose">
          <h2>Why this run</h2>
          <p>{workout.purpose}</p>
        </section>
      )}
      <section
        className="today-session-prescription"
        aria-label="Saved session instructions"
      >
        {workout.steps.length > 1 && (
          <SessionSequence
            workout={workout}
            units={plan.profile.units}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        )}
        <div className="session-steps">
          <h2>Your session, step by step</h2>
          {workout.steps.length ? (
            <WorkoutSteps
              workout={workout}
              profile={plan.profile}
              selectedIndex={selectedIndex}
            />
          ) : (
            <p>Detailed steps were not saved for this session.</p>
          )}
        </div>
      </section>
      {workout.reason && (
        <details className="today-session-why">
          <summary>Why this session?</summary>
          <p>{workout.reason}</p>
        </details>
      )}
    </>
  );
}

/** Inline daily context follows the hero; observations and prescriptions stay separate. */
export function TodaySessionDetails({
  plan,
  date,
  workout,
  onOpen,
}: {
  plan: Plan;
  date: string;
  workout?: Workout;
  onOpen: (workout: Workout) => void;
}) {
  const overview = dayOverview(plan, date);
  const sessions = orderedCalendarSessions(calendarSessions(plan), date);
  const outsideBlock =
    date < plan.profile.startDate || date > plan.profile.raceDate;
  if (outsideBlock && !workout && !sessions.length && !overview.records.length)
    return null;

  const selectedRecord =
    workout?.status === 'completed'
      ? overview.records.find((entry) => entry.record.workoutId === workout.id)
          ?.record
      : undefined;
  const otherRecords = overview.records.filter(
    (entry) => entry.record !== selectedRecord,
  );
  const completed = workout?.status === 'completed';
  const skipped = workout?.status === 'skipped';
  const runWalk = workout ? isRunWalkWorkout(workout) : false;
  // Match RecordedRunSummary: execution describes the log, never the saved dose.
  const executionLabels = {
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
    <div className="today-session-details">
      {workout?.status === 'planned' && (
        <SavedSessionPrescription
          key={workout.id}
          plan={plan}
          workout={workout}
        />
      )}

      {workout && completed && (
        <section
          className="today-recorded-observations"
          aria-label="Recorded run details"
        >
          <h2>How your run felt</h2>
          {selectedRecord ? (
            <>
              <dl>
                <div>
                  <dt>Recorded effort</dt>
                  <dd>{selectedRecord.effort} / 10</dd>
                </div>
                <div>
                  <dt>Feeling</dt>
                  <dd>{selectedRecord.feeling}</dd>
                </div>
                {(workout.hard ||
                  workout.stimulus === 'economy' ||
                  runWalk ||
                  workout.feedback?.execution) && (
                  <div>
                    <dt>
                      {runWalk ? 'Running intervals' : 'Session execution'}
                    </dt>
                    <dd>
                      {
                        executionLabels[
                          workout.feedback?.execution ?? 'unknown'
                        ]
                      }
                    </dd>
                  </div>
                )}
                {workout.feedback?.completedQualityMinutes != null && (
                  <div>
                    <dt>Quality work recorded</dt>
                    <dd>
                      {runDuration(workout.feedback.completedQualityMinutes)}
                    </dd>
                  </div>
                )}
              </dl>
              {selectedRecord.note && (
                <p className="today-recorded-note">{selectedRecord.note}</p>
              )}
            </>
          ) : (
            <p>
              This session is marked completed, but no run details are recorded
              for this date.
            </p>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => onOpen(workout)}
          >
            Review run record
          </button>
        </section>
      )}

      {workout && skipped && (
        <section className="today-session-skipped" aria-label="Skipped session">
          <h2>Session skipped</h2>
          <p>This session is marked skipped. It is not a recorded run.</p>
          {workout.skipReason && <p>{workout.skipReason}</p>}
        </section>
      )}

      {workout && (completed || skipped) && (
        <details className="today-original-prescription">
          <summary>
            {skipped
              ? 'Skipped session’s original plan'
              : 'Original planned session'}
          </summary>
          <p>
            Scheduled for {dateLabel(workout.date)}. These saved instructions
            are not recorded results.
          </p>
          <SavedSessionPrescription
            key={workout.id}
            plan={plan}
            workout={workout}
          />
        </details>
      )}

      {otherRecords.length > 0 && (
        <section
          className="today-recorded-runs"
          aria-label="Other running recorded on this day"
        >
          <h2>
            {selectedRecord
              ? 'Also recorded on this day'
              : 'Recorded on this day'}
          </h2>
          <ul>
            {otherRecords.map((entry) => (
              <li key={entry.record.id}>
                {entry.kind === 'planned' ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onOpen(entry.workout)}
                  >
                    {entry.workout.title}
                  </button>
                ) : (
                  <h3>Extra run</h3>
                )}
                <p>
                  {entry.record.km === null
                    ? 'Distance not recorded'
                    : `${kmDisplay(entry.record.km, plan.profile.units)} ${plan.profile.units} recorded`}
                  {' · '}
                  {runDuration(entry.record.minutes)} recorded
                </p>
                <p>
                  Effort {entry.record.effort} / 10 · Feeling{' '}
                  {entry.record.feeling}
                </p>
                {entry.record.note && (
                  <p className="today-recorded-note">{entry.record.note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!workout && overview.planned.length > 0 && (
        <section
          className="today-remaining-sessions"
          aria-label="Remaining sessions for this date"
        >
          <h2>Still in your plan</h2>
          <ul>
            {overview.planned.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onOpen(session)}
                >
                  {session.session ? `${session.session} · ` : ''}
                  {session.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overview.activity && (
        <section
          className="today-supporting-activity"
          aria-label="Optional supporting activity"
        >
          <h2>Optional supporting activity</h2>
          <h3>
            {overview.activity.title} · {runDuration(overview.activity.minutes)}
          </h3>
          <p>{overview.activity.notes}</p>
        </section>
      )}

      <DailyGuide guide={dailyGuide(plan, date, workout)} />
    </div>
  );
}
