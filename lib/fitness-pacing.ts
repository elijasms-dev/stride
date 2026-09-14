/** Race benchmarks use kilometres and elapsed minutes; all paces are seconds/km. */
export interface RecentRace {
  distanceKm: number;
  timeMinutes: number;
}

export const RIEGEL_EXPONENT = 1.06;

export function validateRecentRace(value: unknown): RecentRace {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enter both a recent race distance and finish time.');
  const { distanceKm, timeMinutes } = value as RecentRace;
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(timeMinutes) ||
    distanceKm < 1 ||
    distanceKm > 100 ||
    timeMinutes <= 0 ||
    timeMinutes / distanceKm < 2 ||
    timeMinutes / distanceKm > 15
  )
    throw new Error(
      'Recent race: use 1–100 km and a finish time equivalent to 2–15 minutes per km.',
    );
  const race = { distanceKm, timeMinutes };
  if (
    Object.values(rawTrainingPaces(race)).some(
      (pace) => !Number.isFinite(pace) || pace < 125 || pace > 1195,
    )
  )
    throw new Error(
      'This benchmark predicts training paces outside the supported 2:00–20:00 per km range. Check the race distance and finish time.',
    );
  return race;
}

/** Peter Riegel: T2 = T1 * (D2 / D1)^1.06. No rounding in predictions. */
export function predictRaceTime(race: RecentRace, distanceKm: number): number {
  if (
    ![race.distanceKm, race.timeMinutes, distanceKm].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    throw new Error(
      'Race distances and times must be positive finite numbers.',
    );
  const minutes =
    race.timeMinutes * (distanceKm / race.distanceKm) ** RIEGEL_EXPONENT;
  if (!Number.isFinite(minutes) || minutes <= 0)
    throw new Error(
      'The race prediction is outside the supported numeric range.',
    );
  return minutes;
}

/** Riegel predicts race performance, not training zones. These explicit coaching
 * heuristics use 60-minute race effort for threshold, the faster of 5K / 20-minute effort for intervals,
 * 5% slower than threshold for tempo, and 20% slower than marathon pace for easy.
 * They are estimates from current fitness, never targets inferred from a goal time. */
function rawTrainingPaces(race: RecentRace) {
  const hourDistance =
    race.distanceKm * (60 / race.timeMinutes) ** (1 / RIEGEL_EXPONENT);
  const threshold = 3600 / hourDistance;
  const marathon = (predictRaceTime(race, 42.195) * 60) / 42.195;
  const twentyMinuteDistance =
    race.distanceKm * (20 / race.timeMinutes) ** (1 / RIEGEL_EXPONENT);
  const interval = Math.min(
    (predictRaceTime(race, 5) * 60) / 5,
    1200 / twentyMinuteDistance,
  );
  return {
    easy: marathon * 1.2,
    tempo: threshold * 1.05,
    threshold,
    interval,
    vo2Max: interval,
    marathon,
  };
}

export function calculateTrainingPaces(race: RecentRace) {
  return rawTrainingPaces(validateRecentRace(race));
}

/** Small executable band around the calculated pace, bounded for watch exports. */
export function fitnessPaceRange(secondsPerKm: number) {
  if (
    !Number.isFinite(secondsPerKm) ||
    secondsPerKm < 120 ||
    secondsPerKm > 1200
  )
    throw new Error('Pace must be within 2:00–20:00 per km.');
  const low = Math.max(120, Math.min(1199, Math.floor(secondsPerKm - 5)));
  const high = Math.max(low + 1, Math.min(1200, Math.ceil(secondsPerKm + 5)));
  return { low, high };
}

/** Fund distance at the slow edge of its easy target; explicit targets take priority. */
export function schedulingEasyPace(profile?: {
  easyPace?: number | null;
  recentRace?: RecentRace;
  workoutTargets?: { mode: string; pace?: { easy?: { high: number } } };
}): number {
  if (!profile?.recentRace)
    return Math.ceil((profile?.easyPace ?? 7) * 60 - 1e-9) / 60;
  const fitness = profile?.recentRace
    ? fitnessPaceRange(calculateTrainingPaces(profile.recentRace).easy).high /
      60
    : undefined;
  const target =
    profile?.workoutTargets?.mode === 'pace'
      ? (profile.workoutTargets.pace?.easy?.high ?? 0) / 60
      : !profile?.workoutTargets
        ? fitness
        : undefined;
  return (
    Math.ceil(
      Math.max(profile?.easyPace ?? fitness ?? 7, target ?? 0) * 60 - 1e-9,
    ) / 60
  );
}
