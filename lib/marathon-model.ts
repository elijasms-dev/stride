import type { Phase, Profile, Workout } from './engine';

/** Original coaching policy, informed by the public plans compared in the research
 * report. Scheduled exposures are a forecast, never evidence of completed fitness.
 * Replans supply only eligible recorded quality plus the new future forecast.
 */
export const MARATHON_MODEL_VERSION = 'marathon-endurance-v3';

export function marathonDevelopment(p: Profile) {
  if (p.intent === 'finish' || p.experience !== 'established')
    return 'completion';
  if (p.marathonApproach === 'endurance') return 'endurance';
  return p.currentRuns >= 5 &&
    p.weeklyKm >= 45 &&
    (p.recentQualitySessions ?? 0) >= 2
    ? 'performance'
    : 'development';
}

/** Frequency offers slots; it does not establish tolerance for a second workout. */
export function marathonSecondQuality(p: Profile) {
  return marathonDevelopment(p) === 'performance';
}

/** A long preparation block should not spend months repeating peak long runs.
 * Preserve the runner's declared/recorded long baseline. New distance beyond that
 * is staged toward the final eight weeks, with each increase also constrained by
 * the engine's actual preceding non-recovery long run, volume and time budgets.
 */
export function marathonLongCeiling(
  baselineKm: number,
  daysToRace: number,
  ceiling = 32,
) {
  const stage = daysToRace > 84 ? 26 : daysToRace > 56 ? 28 : ceiling;
  return Math.min(ceiling, Math.max(baselineKm, stage));
}

/** Develop the duration of a repetition as well as its count. Short pyramids alone
 * cannot stand in for the sustained running required late in a marathon block.
 * Conservative/gentle runners retain the shorter progression. Advanced methods
 * have separate eligibility and dose rules and do not enter this model.
 */
export function marathonRecipe(
  originalId: string,
  p: Profile,
  phase: Phase,
  prior: Workout[],
) {
  if (
    p.goal !== 'marathon' ||
    p.experience !== 'established' ||
    p.intent === 'finish' ||
    p.difficulty === 'gentle' ||
    (p.method && p.method !== 'balanced') ||
    !['Build', 'Race preparation'].includes(phase)
  )
    return originalId;
  const support = prior.filter((w) => w.stimulus === 'threshold');
  const specific = prior.filter((w) => w.stimulus === 'race-rhythm');
  const latest = (runs: Workout[]) => runs.at(-1)?.qualityMinutes ?? 0;
  if (originalId === 'threshold-cruise') {
    if (support.length >= 4 && latest(support) >= 18)
      return 'marathon-tempo-eight';
    if (support.length >= 2 && latest(support) >= 12)
      return 'marathon-tempo-six';
  }
  const sustained =
    originalId === 'marathon-long-blocks' ||
    (originalId === 'marathon-steady' &&
      specific.length >= 3 &&
      latest(specific) >= 24);
  if (sustained) {
    const longest = Math.max(
      0,
      ...specific
        .slice(-3)
        .flatMap((w) =>
          w.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
        ),
    );
    // First sustain 10-minute blocks, then 12, then 16. A continuous rehearsal
    // follows those longer repetitions; it never appears as an opening session.
    if (
      phase === 'Race preparation' &&
      specific.some((w) => w.templateId === 'marathon-sixteen') &&
      longest >= 960 &&
      latest(specific) >= 30
    )
      return 'marathon-continuous-rehearsal';
    if (
      phase === 'Race preparation' &&
      specific.some((w) => w.templateId === 'marathon-twelve') &&
      longest >= 720 &&
      latest(specific) >= 24
    )
      return 'marathon-sixteen';
    if (
      specific.filter((w) => w.templateId === 'marathon-long-blocks').length >=
        2 &&
      longest >= 600 &&
      latest(specific) >= 24
    )
      return 'marathon-twelve';
    return 'marathon-long-blocks';
  }
  return originalId;
}

/** Keep long-run difficulty in its existing quality slot. Easy long runs separate
 * these rehearsals; their work dose is still capped by previous race-rhythm work.
 */
export function marathonLongRecipe(exposures: number) {
  return ['marathon-long-run', 'marathon-long-split', 'marathon-long-finish'][
    exposures % 3
  ];
}

export function marathonWeekFocus(phase: Phase, p: Profile) {
  const completion = marathonDevelopment(p) === 'completion';
  switch (phase) {
    case 'Foundation':
      return 'Build repeatable endurance around a long run and a midweek aerobic outing. Introduce controlled tempo only within your recent workout background.';
    case 'Build':
      return completion
        ? 'Build comfortable endurance, with easier weeks to absorb the work. Consistency matters more than speed.'
        : 'Develop sustained threshold running while preserving the long and midweek endurance runs. Hold new mileage long enough to absorb it; selected marathon-pace long runs replace weekday intensity.';
    case 'Race preparation':
      return completion
        ? 'Rehearse patient pacing, familiar fuel and race-day kit. The long run stays comfortable.'
        : 'Rehearse sustained marathon effort and introduce measured current-5K-effort repetitions. Preserve easy endurance, practise familiar fuel and keep recovery between demanding days.';
    case 'Recovery':
      return 'Shorter, easy running this week. Let the long-run and workout progression settle before the next build.';
    case 'Taper':
      return 'Reduce running around race day. Keep only short, familiar quality work; no new demanding sessions.';
    case 'Race week':
      return 'Keep the last runs short and relaxed. Use the pacing, fueling and equipment you have rehearsed.';
    default:
      return 'Hold a repeatable routine before the marathon-specific preparation begins.';
  }
}
