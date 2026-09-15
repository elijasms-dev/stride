/** Plan display responsibilities; extracted without changing policy or behavior. */
import { distanceEstimate } from '../prescription.ts';
import { prescribedDistanceKm } from '../run-distance.ts';
import { round } from './math.ts';
import { type Goal, type Profile, type Workout } from './types.ts';

export const goalLabel = (goal: Goal) =>
  ({
    base: 'Build a running habit',
    '5k': '5K training',
    '10k': '10K training',
    half: 'Half-marathon training',
    marathon: 'Marathon training',
    ultra: 'Ultra training',
    custom: 'Custom-distance training',
  })[goal];

export function eventDistanceDisplay(km: number, units: 'km' | 'mi') {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: units === 'km' ? 4 : 5,
  }).format(units === 'mi' ? km / 1.609344 : km);
}

export function workoutDistanceValue(
  w: Workout,
  p: Pick<Profile, 'units' | 'easyPace'>,
) {
  if (w.kind === 'race') return eventDistanceDisplay(w.estimatedKm, p.units);
  const exact = prescribedDistanceKm(w);
  if (exact !== null) return String(kmDisplay(exact, p.units));
  const estimate = distanceEstimate(w.steps, p);
  return estimate.lowerKm === null
    ? '—'
    : `${kmDisplay(estimate.lowerKm, p.units)}–${kmDisplay(estimate.upperKm!, p.units)}`;
}

export function workoutDistanceLabel(
  w: Workout,
  p: Pick<Profile, 'units' | 'easyPace'>,
) {
  const value = workoutDistanceValue(w, p);
  return value === '—'
    ? 'Distance not estimated'
    : `${value} ${p.units}${w.kind === 'race' || prescribedDistanceKm(w) !== null ? '' : ' est.'}`;
}

export function kmDisplay(km: number, units: 'km' | 'mi') {
  return round(units === 'mi' ? km / 1.609344 : km);
}
