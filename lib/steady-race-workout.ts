import { type Workout } from './plan/types.ts';

/** Inspect the saved prescription, not today's profile preference or target mode. */
export function isSteadyRaceAdaptation(workout: Workout): boolean {
  if (
    workout.kind === 'race' ||
    workout.stimulus !== 'race-rhythm' ||
    workout.pairType ||
    workout.returnRole
  )
    return false;
  const work = workout.steps.filter(
    (s) => s.kind === 'work' && s.intensity >= 4,
  );
  return (
    work.length > 0 &&
    work.every(
      (s) => s.intensity <= 5 && s.effort.startsWith('Steady and comfortable'),
    )
  );
}

export const steadyRaceBriefing =
  'Settle into a steady, comfortable rhythm. Follow the steady target in each block and use the easy recoveries to reset; this gentler session does not ask you to practise race pace.';
