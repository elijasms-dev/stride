import { runningDayRange, type Profile } from './engine.ts';
export { runningDayRange } from './engine.ts';

/** Suggest a compatible selection without changing any declared running history. */
export function suggestedRunningDays(
  p: Pick<
    Profile,
    'currentRuns' | 'goal' | 'raceDistanceKm' | 'days' | 'longDay'
  >,
): number[] | null {
  const { min, max } = runningDayRange(p);
  if (max < min) return null;
  const count = Math.max(min, Math.min(max, p.days.length));
  if (count === p.days.length && new Set(p.days).size === count)
    return [...p.days];
  let best: number[] | null = null,
    bestScore = Infinity;
  for (let mask = 0; mask < 128; mask++) {
    const days = Array.from({ length: 7 }, (_, d) => d).filter(
      (d) => mask & (1 << d),
    );
    if (days.length !== count) continue;
    const score =
      (days.includes(p.longDay) ? 0 : 1000) +
      days.filter((d) => !p.days.includes(d)).length * 100 +
      days.filter((d) => days.includes((d + 1) % 7)).length * 10;
    if (score < bestScore) {
      best = days;
      bestScore = score;
    }
  }
  return best;
}
