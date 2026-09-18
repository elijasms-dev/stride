'use client';

import { Check } from 'lucide-react';
import {
  dateLabel,
  kmDisplay,
  workoutDistanceValue,
  type Profile,
  type Workout,
} from '@/lib/engine';
import { workoutTone } from '@/lib/day-sessions';
import { runDuration } from '@/lib/journal-view';
import { summaryEffort } from '@/lib/prescription';
import { prescribedDistanceKm } from '@/lib/run-distance';
import { recordedWorkoutDate } from '@/lib/run-records';
import { mainWorkoutTarget, targetLabel } from '@/lib/workout-targets';

export function TodayWorkoutCard({
  workout,
  profile,
  showEstimates,
  onOpen,
}: {
  workout: Workout;
  profile: Profile;
  showEstimates: boolean;
  onOpen: (workout: Workout) => void;
}) {
  const completed = workout.status === 'completed';
  const feedback = completed ? workout.feedback : undefined;
  const race = workout.kind === 'race';
  const exactDistance = prescribedDistanceKm(workout);
  const distanceValue = workoutDistanceValue(workout, profile);
  const target = mainWorkoutTarget(workout);
  const date = recordedWorkoutDate(workout);
  const showDistance =
    completed || race || exactDistance !== null || showEstimates;
  const estimatedTime = workout.steps.some((step) => step.metres !== undefined);
  const missingRecord = completed && !feedback;
  return (
    <article className="workout-card" data-tone={workoutTone(workout)}>
      <div className="card-topline">
        <span className="eyebrow">
          {race
            ? 'Race day'
            : workout.kind === 'long'
              ? workout.hard
                ? 'Long run · quality'
                : 'Long run'
              : workout.hard
                ? 'Quality session'
                : 'Easy effort'}
        </span>
        <div className="workout-status-actions">
          {workout.status !== 'planned' && (
            <span className="pill">
              {completed ? (
                <>
                  <Check size={12} aria-hidden="true" /> Completed
                </>
              ) : (
                'Skipped'
              )}
            </span>
          )}
        </div>
      </div>
      <div className="session-heading">
        <h2>{workout.title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, '')}</h2>
        <time className="session-date-stamp" dateTime={date}>
          <span>{dateLabel(date, { month: 'short' })}</span>
          <strong>{dateLabel(date, { day: 'numeric' })}</strong>
        </time>
      </div>
      {missingRecord ? (
        <p className="subtle">
          Marked complete. Recorded distance, time and effort are unavailable.
          Open the run to add or correct its record.
        </p>
      ) : (
        <div
          className="workout-stats"
          data-metrics={Number(showDistance) + Number(completed || !race) + 1}
        >
          {showDistance && (
            <div>
              <strong>
                {feedback
                  ? feedback.actualKm === null
                    ? '—'
                    : kmDisplay(feedback.actualKm, profile.units)
                  : distanceValue}
              </strong>
              <span>
                {feedback
                  ? feedback.actualKm === null
                    ? 'Distance not recorded'
                    : `${profile.units} recorded`
                  : race || exactDistance !== null
                    ? `${profile.units} target`
                    : distanceValue === '—'
                      ? 'distance not estimated'
                      : `${profile.units} estimated range`}
              </span>
            </div>
          )}
          {(completed || !race) && (
            <div>
              <strong>
                {runDuration(
                  feedback ? feedback.actualMinutes : workout.minutes,
                )}
              </strong>
              <span>
                {feedback
                  ? 'recorded time'
                  : estimatedTime
                    ? 'estimated time'
                    : 'duration'}
              </span>
            </div>
          )}
          <div>
            <strong>
              {feedback
                ? feedback.effort
                : target
                  ? targetLabel(target, profile.units)
                  : summaryEffort(workout)}
              {(completed ||
                (!target && summaryEffort(workout) !== 'By feel')) && (
                <span className="stat-small"> / 10</span>
              )}
            </strong>
            <span>
              {completed
                ? 'recorded effort'
                : target
                  ? target.mode === 'pace'
                    ? 'Target pace'
                    : 'Target heart rate'
                  : 'effort'}
            </span>
          </div>
        </div>
      )}
      <div className="card-footer">
        <div className="today-run-actions">
          <button className="primary-button" onClick={() => onOpen(workout)}>
            {completed ? 'View run' : 'Open workout'}
          </button>
        </div>
      </div>
    </article>
  );
}
