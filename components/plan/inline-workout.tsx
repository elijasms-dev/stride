'use client';

import { ArrowUpRight, Check, ChevronDown, Flag } from 'lucide-react';
import {
  dateLabel,
  kmDisplay,
  workoutDistanceLabel,
  workoutDistanceValue,
  type Plan,
  type Workout,
} from '@/lib/engine';
import { calendarWorkoutStatus } from '@/lib/plan-explorer';
import { workoutTone } from '@/lib/day-sessions';
import { specificWorkoutName } from '@/lib/workout-names';
import { runDuration } from '@/lib/journal-view';
import { WorkoutSteps } from '../workout-steps';
import type { Props } from './explorer-types';

export function InlineWorkout({
  workout,
  plan,
  onWorkout,
  expanded,
  onToggle,
  detailId,
}: {
  workout: Workout;
  plan: Plan;
  onWorkout: Props['onWorkout'];
  expanded: boolean;
  onToggle: () => void;
  detailId: string;
}) {
  const completed = workout.status === 'completed';
  const distance =
    completed && !workout.feedback
      ? 'Not recorded'
      : completed && workout.feedback
        ? workout.feedback.actualKm === null
          ? runDuration(workout.feedback.actualMinutes)
          : `${kmDisplay(workout.feedback.actualKm, plan.profile.units)} ${plan.profile.units}`
        : workoutDistanceValue(workout, plan.profile) === '—'
          ? runDuration(workout.minutes)
          : workoutDistanceLabel(workout, plan.profile);
  const minutes =
    completed && workout.feedback
      ? workout.feedback.actualMinutes
      : workout.minutes;
  return (
    <div
      className={`pe-workout ${workout.status === 'skipped' ? 'is-skipped' : ''} ${expanded ? 'is-expanded' : ''}`}
      data-tone={workoutTone(workout)}
    >
      <button
        type="button"
        className="pe-workout-summary"
        aria-expanded={expanded}
        aria-controls={
          expanded ? `${detailId}-mobile ${detailId}-desktop` : undefined
        }
        onClick={onToggle}
      >
        <span className="pe-workout-status">
          {completed ? (
            <Check size={13} aria-hidden="true" />
          ) : workout.kind === 'race' ? (
            <Flag size={13} aria-hidden="true" />
          ) : (
            <i aria-hidden="true" />
          )}
          {calendarWorkoutStatus(workout)}
          {workout.session ? ` · ${workout.session}` : ''}
        </span>
        <strong className="pe-workout-distance">{distance}</strong>
        <span className="pe-workout-title">
          {specificWorkoutName(workout).replace(
            /^\d+(?:\.\d+)? (?:km|mi) · /,
            '',
          )}
        </span>
        <span className="pe-workout-duration">
          {completed && !workout.feedback ? (
            'Open run to review its record'
          ) : workout.kind === 'race' && !completed ? (
            'Race distance target'
          ) : (
            <>
              {runDuration(minutes)}{' '}
              {completed
                ? 'recorded'
                : workout.steps.some((step) => step.metres !== undefined)
                  ? 'estimated'
                  : 'total'}
            </>
          )}
          {workout.changed ? ' · Adjusted' : ''}
        </span>
        <span className="pe-expand-label">
          {expanded ? 'Hide steps' : 'View steps'}
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </button>
      {expanded && (
        <div className="pe-mobile-prescription" id={`${detailId}-mobile`}>
          <WorkoutPrescription
            workout={workout}
            plan={plan}
            onWorkout={onWorkout}
          />
        </div>
      )}
    </div>
  );
}

export function WorkoutPrescription({
  workout,
  plan,
  onWorkout,
}: {
  workout: Workout;
  plan: Plan;
  onWorkout: Props['onWorkout'];
}) {
  const completed = workout.status === 'completed';
  return (
    <div className="pe-prescription">
      <div className="pe-prescription-heading">
        <div>
          <span>
            {dateLabel(workout.feedback?.actualDate ?? workout.date, {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <h3>{specificWorkoutName(workout)}</h3>
        </div>
        <button
          type="button"
          className="pe-workout-open"
          onClick={() => onWorkout(workout)}
        >
          {completed
            ? 'Open recorded run'
            : workout.status === 'skipped'
              ? 'Open skipped workout'
              : 'Open workout'}
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
      <p>
        {completed
          ? 'Original prescription. Your recorded result is shown above.'
          : workout.status === 'skipped'
            ? 'Skipped prescription, excluded from this week’s total.'
            : 'Warm-up and cool-down are included in the total.'}
      </p>
      <WorkoutSteps workout={workout} profile={plan.profile} />
    </div>
  );
}
