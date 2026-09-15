import { type Profile, type Workout } from './plan/types.ts';
import { customRaceName, withSpecificWorkoutName } from './workout-names.ts';

export function customWorkoutEventDistance(profile: Profile) {
  // This pass covers road-event rhythm from 5K through 30K. Short races,
  // marathon preparation and ultra effort retain their separate model cues.
  const distance = profile.raceDistanceKm;
  return profile.goal === 'custom' &&
    distance !== undefined &&
    Number.isFinite(distance) &&
    distance >= 5 &&
    distance <= 30
    ? distance
    : undefined;
}

export function eventContextText(
  text: string,
  distance: number,
  previous?: number,
) {
  const event = customRaceName(distance);
  const current =
    previous !== undefined && previous !== distance
      ? text.replaceAll(customRaceName(previous), event)
      : text;
  return current.replace(/\b(?:half[- ]marathon|marathon|10K|5K)\b/gi, event);
}

/** Preparation families choose a recipe; the runner's event chooses its race cue.
 * Apply only when authoring/reviewing a prescription, never when reading history.
 * Workout doses, intensity, recoveries and numeric target ranges are untouched.
 */
export function withWorkoutEventContext(
  workout: Workout,
  profile: Profile,
): Workout {
  const distance = customWorkoutEventDistance(profile);
  if (
    distance === undefined ||
    workout.kind === 'race' ||
    workout.stimulus !== 'race-rhythm' ||
    workout.pairType ||
    workout.returnRole
  ) {
    if (workout.eventDistanceKm === undefined) return workout;
    const { eventDistanceKm: _old, ...plain } = workout;
    return plain;
  }
  // These are authored workout instructions, not runner notes. Preserve each
  // recipe's coaching detail while removing the fallback family's event name.
  const contextualize = (text: string) =>
    eventContextText(text, distance, workout.eventDistanceKm);
  const steps = workout.steps.map((step) => ({
    ...step,
    label: contextualize(step.label),
    effort: contextualize(step.effort),
  }));
  return withSpecificWorkoutName({
    ...workout,
    eventDistanceKm: distance,
    purpose: contextualize(workout.purpose),
    reason: contextualize(workout.reason),
    steps,
  });
}
