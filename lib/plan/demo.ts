/** Plan demo responsibilities; extracted without changing policy or behavior. */
import { addDays, monday } from './calendar.ts';
import { makePlan } from './generate.ts';
import { type Plan, type Profile } from './types.ts';

export function demoProfile(date: string): Profile {
  const start = monday(date);
  return {
    name: '',
    goal: '10k',
    raceName: 'Autumn 10K',
    startDate: start,
    raceDate: addDays(start, 83),
    weeklyKm: 30,
    longestKm: 10,
    currentRuns: 4,
    days: [0, 2, 4, 6],
    longDay: 6,
    weekdayMinutes: 65,
    longMinutes: 100,
    experience: 'established',
    difficulty: 'balanced',
    volume: 'gradual',
    timezone: 'Europe/London',
    units: 'km',
    easyPace: 6,
  };
}

export function demoPlan(date: string): Plan {
  const p = demoProfile(date);
  return makePlan(p, p.startDate);
}
