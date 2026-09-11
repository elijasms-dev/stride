export type WorkoutEnjoyment = 'yes' | 'maybe' | 'no';
export function validWorkoutEnjoyment(
  value: unknown,
): value is WorkoutEnjoyment {
  return typeof value === 'string' && ['yes', 'maybe', 'no'].includes(value);
}

/** Older clients omit the field; current clients use null to explicitly clear it. */
export function mergeWorkoutEnjoyment(
  value: unknown,
  previous?: WorkoutEnjoyment,
): WorkoutEnjoyment | undefined {
  if (value === undefined) return previous;
  if (value === null) return undefined;
  if (!validWorkoutEnjoyment(value))
    throw new Error('Choose a valid workout preference.');
  return value;
}
