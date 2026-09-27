import type { Profile } from './plan/types.ts';
import {
  TARGET_BANDS,
  benchmarkWorkoutTargets,
  paceText,
  parsePace,
  manualTargetRange,
  targetBandLabels,
  validateWorkoutTargets,
  type TargetBand,
  type WorkoutTargets,
} from './workout-targets.ts';

export type TargetSettingsMode = 'automatic' | WorkoutTargets['mode'];
export type TargetRangeValues = Record<
  TargetBand,
  { low: string; high: string }
>;
export type TargetSettingsDraft = {
  mode: TargetSettingsMode;
  pace: TargetRangeValues;
  heartRate: TargetRangeValues;
};
type TargetProfile = Pick<
  Profile,
  'goal' | 'raceDistanceKm' | 'recentRace' | 'workoutTargets' | 'units'
>;

export function initialTargetSettings(
  profile: TargetProfile,
): TargetSettingsDraft {
  const saved = profile.workoutTargets;
  const source = saved ?? benchmarkWorkoutTargets(profile);
  const values = (kind: 'pace' | 'heartRate'): TargetRangeValues =>
    Object.fromEntries(
      TARGET_BANDS.map((band) => {
        const range = source
          ? manualTargetRange(source, kind, band)
          : undefined;
        const text = (n: number) =>
          kind === 'pace' ? paceText(n, profile.units) : String(n);
        return [
          band,
          {
            low: range ? text(range.low) : '',
            high: range ? text(range.high) : '',
          },
        ];
      }),
    ) as TargetRangeValues;
  return {
    mode: saved?.mode ?? 'automatic',
    pace: values('pace'),
    heartRate: values('heartRate'),
  };
}

/** Null is the explicit wire action for removing an override, not an effort mode. */
export function targetSettingsConfig(
  profile: TargetProfile,
  draft: TargetSettingsDraft,
): WorkoutTargets | null {
  if (draft.mode === 'automatic') return null;
  const saved = profile.workoutTargets;
  const next: WorkoutTargets = { ...saved, mode: draft.mode, bandsVersion: 2 };
  if (draft.mode === 'effort') return validateWorkoutTargets(next);
  const key = draft.mode === 'pace' ? 'pace' : 'heartRate';
  const initial = saved ?? benchmarkWorkoutTargets(profile);
  next[key] = {};
  for (const band of TARGET_BANDS) {
    const raw = draft[key][band];
    if (!raw.low.trim() && !raw.high.trim()) continue;
    const original = initial
      ? manualTargetRange(initial, key, band)
      : undefined;
    const parse = (bound: 'low' | 'high') =>
      key === 'pace'
        ? original && raw[bound] === paceText(original[bound], profile.units)
          ? original[bound]
          : parsePace(raw[bound], profile.units)
        : raw[bound].trim()
          ? Number(raw[bound])
          : null;
    const low = parse('low');
    const high = parse('high');
    if (low === null || high === null)
      throw new Error(
        `${targetBandLabels[band]}: enter both ends of the range${key === 'pace' ? ' as minutes:seconds' : ''}.`,
      );
    next[key]![band] = { low, high };
  }
  return validateWorkoutTargets(next);
}
