import { type Workout } from './plan/types.ts';

// Classify the saved prescription, not its editable display name. Walking
// recoveries in a speed session do not make it a beginner run/walk outing.
export function isRunWalkWorkout(workout: Workout): boolean {
  return (
    !workout.hard &&
    workout.kind !== 'race' &&
    workout.steps.some((step) => step.movement === 'run') &&
    workout.steps.some((step) => step.movement === 'walk')
  );
}
