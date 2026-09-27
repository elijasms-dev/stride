import { trainingDay } from './form-values.ts';

/** Find the next calendar-day boundary in the training timezone, including DST. */
export function millisecondsUntilTrainingDay(
  zone: string,
  instant = new Date(),
) {
  const start = instant.getTime();
  const today = trainingDay(zone, instant);
  let low = start;
  let high = start + 36 * 60 * 60 * 1000;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (trainingDay(zone, new Date(middle)) === today) low = middle;
    else high = middle;
  }
  return Math.max(1000, high - start + 100);
}
