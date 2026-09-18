import {
  dateLabel,
  workoutDistanceLabel,
  type Profile,
  type Workout,
} from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { prescribedDistanceKm } from '@/lib/run-distance';
import { specificWorkoutName } from '@/lib/workout-names';
import { WorkoutSteps } from './workout-steps';

/** Show the same saved prescription before activation as in the active plan. */
export function OnboardingWorkoutPreview({
  workout,
  profile,
}: {
  workout: Workout;
  profile: Profile;
}) {
  const race = workout.kind === 'race';
  const distanceTarget = prescribedDistanceKm(workout) !== null;
  const estimatedTime = workout.steps.some((step) => step.metres !== undefined);
  return (
    <details className="preview-workout">
      <summary className="preview-run">
        <span>{dateLabel(workout.date, { weekday: 'short' })}</span>
        <strong>
          {specificWorkoutName(workout).replace(
            /^\d+(?:\.\d+)? (?:km|mi) · /,
            '',
          )}
        </strong>
        <span className="preview-run-measure">
          <b>
            {race || distanceTarget
              ? workoutDistanceLabel(workout, profile)
              : runDuration(workout.minutes)}
          </b>
          <small>
            {race
              ? 'Race distance target'
              : distanceTarget
                ? `${runDuration(workout.minutes)} estimated`
                : estimatedTime
                  ? 'Estimated duration'
                  : 'Total duration'}
          </small>
        </span>
      </summary>
      <p>{workout.purpose}</p>
      <div className="session-steps">
        <WorkoutSteps workout={workout} profile={profile} />
      </div>
    </details>
  );
}
