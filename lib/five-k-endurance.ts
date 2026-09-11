import type { Profile } from './engine.ts';

/** A retention allowance, not a new long-run target. See docs/five-k-endurance.md.
 * Published 5K approaches differ; only preserve already familiar easy endurance.
 * The caller still applies weekly allocation, time limits, recovery and taper.
 */
export function fiveKEnduranceCeiling(
  profile: Profile,
  ordinaryCeilingKm: number,
  baseline: { longestKm: number; longestMinutes: number; currentRuns: number },
) {
  if (
    profile.goal !== '5k' ||
    profile.experience !== 'established' ||
    baseline.currentRuns < 4 ||
    profile.days.length < 4 ||
    profile.easyPace == null ||
    !Number.isFinite(profile.easyPace) ||
    profile.easyPace <= 0 ||
    !Number.isFinite(baseline.longestKm) ||
    !Number.isFinite(baseline.longestMinutes)
  )
    return ordinaryCeilingKm;
  return Math.max(
    ordinaryCeilingKm,
    Math.min(
      baseline.longestKm,
      baseline.longestMinutes / profile.easyPace,
      90 / profile.easyPace,
    ),
  );
}
