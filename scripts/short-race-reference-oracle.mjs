/** Independent expectation from TRAINING_REFERENCE.md (2026-09-27).
 * The requested short-race back-off replaces a full recovery week with one
 * quality outing when two were selected. Its existing configurable cadence
 * remains four weeks by default. Call only for complete ordinary weeks;
 * taper, recorded/manual exceptions and beginner courses have separate checks.
 * Do not import the production scheduler to calculate expected test results.
 */
export function referenceOrdinaryQualityCount(profile, weekIndex, requested) {
  if (
    ['5k', '10k'].includes(profile.goal) &&
    profile.planLevel !== 'beginner' &&
    weekIndex > 0 &&
    (weekIndex + 1) % (profile.recoveryWeeks ?? 4) === 0
  )
    return Math.min(1, requested);
  return requested;
}
