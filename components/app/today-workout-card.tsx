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
import { workoutTargetSummary } from '../session-sequence';
import { SessionAtmosphere } from '../session-atmosphere';

export function TodayWorkoutCard({
  workout,
  profile,
  showEstimates,
  onOpen,
  motion = true,
}: {
  workout: Workout;
  profile: Profile;
  showEstimates: boolean;
  onOpen: (workout: Workout) => void;
  motion?: boolean;
}) {
  const completed = workout.status === 'completed';
  const feedback = completed ? workout.feedback : undefined;
  const race = workout.kind === 'race';
  const exactDistance = prescribedDistanceKm(workout);
  const distanceValue = workoutDistanceValue(workout, profile);
  const target =
    !completed && workout.steps.some((step) => step.target)
      ? workoutTargetSummary(workout, profile.units)
      : null;
  const date = recordedWorkoutDate(workout);
  const showDistance =
    completed || race || exactDistance !== null || showEstimates;
  const estimatedTime = workout.steps.some((step) => step.metres !== undefined);
  const missingRecord = completed && !feedback;
  return (
    <article className="today-hero" data-tone={workoutTone(workout)}>
      <SessionAtmosphere
        mood={
          workout.status === 'skipped'
            ? 'rest'
            : workout.kind === 'long'
              ? 'long'
              : workout.hard || race
                ? 'quality'
                : 'easy'
        }
        motion={motion}
      />
      <div className="today-hero-topline">
        <span className="today-hero-kind">
          {completed
            ? 'Recorded run'
            : workout.status === 'skipped'
              ? 'Skipped session'
              : race
                ? 'Race day'
                : workout.kind === 'long'
                  ? workout.hard
                    ? 'Long run · quality'
                    : 'Long run'
                  : workout.hard
                    ? 'Quality session'
                    : 'Easy effort'}
        </span>
        <div className="today-hero-status">
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
      <div className="today-hero-heading">
        <h2>{workout.title.replace(/^\d+(?:\.\d+)? (?:km|mi) · /, '')}</h2>
        <time className="today-hero-date" dateTime={date}>
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
          className="today-session-stats"
          data-metrics={Number(showDistance) + Number(completed || !race) + 1}
        >
          {showDistance && (
            <div className="today-distance-metric">
              <strong>
                {feedback
                  ? feedback.actualKm === null
                    ? '—'
                    : kmDisplay(feedback.actualKm, profile.units)
                  : distanceValue}
                {(feedback
                  ? feedback.actualKm !== null
                  : distanceValue !== '—') && (
                  <span className="today-distance-unit"> {profile.units}</span>
                )}
              </strong>
              <span>
                {feedback
                  ? feedback.actualKm === null
                    ? 'Distance not recorded'
                    : 'recorded distance'
                  : race || exactDistance !== null
                    ? 'target'
                    : distanceValue === '—'
                      ? 'distance not estimated'
                      : 'estimated range'}
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
          <div className="today-target-metric">
            <strong>
              {feedback ? feedback.effort : summaryEffort(workout)}
              {(completed || summaryEffort(workout) !== 'By feel') && (
                <span className="stat-small"> / 10</span>
              )}
            </strong>
            <span>{completed ? 'recorded effort' : 'effort'}</span>
          </div>
        </div>
      )}
      {target && (
        <p className="today-saved-target">
          <span>{target.label}</span> <strong>{target.value}</strong>
        </p>
      )}
      <div className="today-hero-footer">
        <div className="today-hero-actions">
          <button className="primary-button" onClick={() => onOpen(workout)}>
            {completed
              ? 'View run'
              : workout.status === 'skipped'
                ? 'View skipped run'
                : 'Open workout'}
          </button>
        </div>
      </div>
    </article>
  );
}
