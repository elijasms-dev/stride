import { addDays, demoProfile } from '../lib/engine.ts';

export const start = '2026-09-28';
export const profile = (goal, qualitySessions, patch = {}) => ({
  ...demoProfile(start),
  planLevel: 'standard',
  goal,
  startDate: start,
  raceDate: addDays(start, 8 * 7 - 1),
  weeklyKm: 45,
  longestKm: 12,
  currentRuns: 5,
  runsPerWeek: 5,
  days: [0, 1, 3, 4, 6],
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  longDay: 6,
  weekdayMinutes: 120,
  longMinutes: 240,
  experience: 'established',
  intent: 'improve',
  method: 'balanced',
  qualityMode: 'custom',
  qualitySessions,
  recentQualitySessions: qualitySessions,
  recentQualityMinutes: qualitySessions * 20,
  runMeasure: 'distance',
  workoutFormat: 'automatic',
  ...patch,
});
const isQuality = (workout) =>
  workout.hard &&
  ['intervals', 'tempo', 'fartlek'].includes(workout.kind) &&
  workout.steps.some((step) => step.kind === 'work' && step.seconds > 0);
export const qualityByWeek = (plan) =>
  plan.weeks.map((week) =>
    plan.workouts.filter(
      (workout) => workout.week === week.index && isQuality(workout),
    ),
  );
