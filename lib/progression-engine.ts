import { type Goal, type Profile, type Workout } from './plan/types.ts';

/** Benchmark peak long-run bands by event family. */
export const PEAK_LONG_RUN_KM: Record<
  Exclude<Goal, 'custom'>,
  readonly [number, number]
> = {
  '5k': [10, 12],
  '10k': [14, 16],
  half: [18, 21],
  marathon: [32, 35],
  ultra: [40, 45],
  base: [8, 11],
};

export function peakLongRunRange(
  family: Exclude<Goal, 'custom'> | 'custom',
): readonly [number, number] {
  if (family === 'custom') return PEAK_LONG_RUN_KM.ultra;
  return PEAK_LONG_RUN_KM[family];
}

/** Upper-band peak unless the runner is finishing or already above it. */
export function peakLongRunKm(
  family: Exclude<Goal, 'custom'> | 'custom',
  currentLongRun: number,
  intent?: Profile['intent'],
): number {
  if (family === 'marathon')
    return intent === 'finish'
      ? Math.min(35, Math.max(currentLongRun, 32))
      : 35;
  const [low, high] = peakLongRunRange(family);
  const target = intent === 'finish' ? low : high;
  return Math.max(currentLongRun, target);
}

/** A supplied positive baseline is evidence; a family minimum is only a fallback. */
export function anchoredLongRunKm(
  currentLongRun: number,
  distanceMinimum: number,
): number {
  return Number.isFinite(currentLongRun) && currentLongRun > 0
    ? currentLongRun
    : distanceMinimum;
}

export function isShortTimeline(weeksUntilRace: number): boolean {
  return weeksUntilRace >= 4 && weeksUntilRace <= 8;
}

/** Marathon/ultra/half: 2 weeks when the block is short, otherwise 3. */
export function mandatoryTaperWeeks(
  family: string,
  weeksUntilRace: number,
  goal: Goal,
): number {
  if (goal === 'base') return 0;
  if (['half', 'marathon', 'ultra'].includes(family))
    return weeksUntilRace <= 8 ? 2 : 3;
  return 2;
}

/** Peak the long run 2–3 weeks before race day (the week before taper starts). */
export function peakLongWeekIndex(
  weekCount: number,
  taperWeeks: number,
): number {
  return Math.max(0, weekCount - taperWeeks - 1);
}

// Whole-distance build targets add at most two kilometres per ordinary build outing.
const MAXIMUM_LONG_RUN_BUILD_STEP_KM = 2;
// The default fourth-week recovery preserves the established consolidation rhythm.
const DEFAULT_LONG_RUN_RECOVERY_WEEKS = 4;
// Recovery long runs reduce the established endurance dose before progression resumes.
const LONG_RUN_RECOVERY_FRACTION = 0.8;

export function longRunForWeek(options: {
  weekIndex: number;
  startLongKm: number;
  peakKm: number;
  peakWeekIndex: number;
  recovery: boolean;
  taper: boolean;
  taperFraction: number;
  wholeKilometres?: boolean;
  recoveryEveryWeeks?: number;
  recoveryOffset?: number;
}): number {
  const {
    weekIndex,
    startLongKm,
    peakKm,
    peakWeekIndex,
    recovery,
    taper,
    taperFraction,
  } = options;
  if (options.wholeKilometres) {
    // The first outing is the runner's actual baseline, even when fractional.
    // Event-specific ceilings belong to the caller; ultra targets may exceed 35 km.
    const start = startLongKm;
    const wholeStart = Math.floor(start);
    const peak = Math.max(start, Math.floor(peakKm));
    const every = options.recoveryEveryWeeks ?? DEFAULT_LONG_RUN_RECOVERY_WEEKS;
    const offset = options.recoveryOffset ?? 0;
    const builds = (end: number) =>
      Math.max(
        0,
        end -
          Math.floor((end + offset + 1) / every) +
          Math.floor((offset + 1) / every),
      );
    const available = builds(peakWeekIndex);
    const ordinal = builds(Math.min(weekIndex, peakWeekIndex));
    // Count only ordinary build opportunities. The first increase reaches the
    // integer grid without rounding the baseline upward or exceeding a 2 km jump.
    const reachable = Math.max(
      start,
      Math.min(peak, wholeStart + available * MAXIMUM_LONG_RUN_BUILD_STEP_KM),
    );
    const steps =
      reachable > start
        ? Math.ceil((reachable - wholeStart) / MAXIMUM_LONG_RUN_BUILD_STEP_KM)
        : 0;
    const advances =
      available > 0 ? Math.floor((ordinal * steps) / available) : 0;
    const progressed =
      advances === 0
        ? start
        : Math.min(
            reachable,
            wholeStart + advances * MAXIMUM_LONG_RUN_BUILD_STEP_KM,
          );
    // Rounding a cutback down must never turn a sub-kilometre baseline into
    // a longer run; session feasibility remains the caller's responsibility.
    if (taper) return Math.max(0, Math.floor(progressed * taperFraction));
    if (recovery)
      return Math.max(0, Math.floor(progressed * LONG_RUN_RECOVERY_FRACTION));
    // A long timeline may hold the main two-kilometre ladder for several weeks.
    // Only the opening outing keeps a fractional baseline when the next whole
    // kilometre fits the peak; later ordinary holds use that first whole target.
    if (weekIndex > 0 && progressed === start && peak >= Math.ceil(start))
      return Math.ceil(start);
    return progressed;
  }
  const span = Math.max(1, peakWeekIndex);
  const progressed =
    weekIndex >= peakWeekIndex
      ? peakKm
      : startLongKm + ((peakKm - startLongKm) * weekIndex) / span;
  if (taper) return progressed * taperFraction;
  if (recovery) return progressed * LONG_RUN_RECOVERY_FRACTION;
  return progressed;
}

export function usesFiveDaySplit(
  p: Pick<Profile, 'days' | 'runsPerWeek' | 'goal'>,
): boolean {
  const runs = p.runsPerWeek ?? p.days.length;
  return runs === 5 && p.goal !== 'base';
}

export function recentTemplateIds(
  previous: Workout[],
  week: number,
  lookback = 3,
): Set<string> {
  return new Set(
    previous
      .filter(
        (w) =>
          !!w.templateId &&
          w.kind !== 'race' &&
          w.week >= week - lookback &&
          w.week < week,
      )
      .map((w) => w.templateId!),
  );
}

export function reconcileDailySplits(
  sessions: Array<{
    estimatedKm: number;
    minutes: number;
    kind: string;
    hard: boolean;
    title: string;
    steps: { seconds: number }[];
  }>,
  weeklyTotalVolume: number,
  paceMinPerKm: number,
): number {
  const training = sessions.filter((s) => s.kind !== 'race');
  if (!training.length) return 0;
  const sum = training.reduce((n, s) => n + s.estimatedKm, 0);
  const remainder = weeklyTotalVolume - sum;
  if (Math.abs(remainder) < 0.0005) return 0;
  const recoveries = training.filter(
    (s) =>
      !s.hard &&
      s.kind !== 'long' &&
      (s.title.includes('Recovery') || s.kind === 'easy'),
  );
  const target =
    recoveries.at(-1) ??
    training.filter((s) => !s.hard && s.kind !== 'long').at(-1) ??
    training.at(-1)!;
  const nextKm = Math.max(0.5, target.estimatedKm + remainder);
  const deltaKm = nextKm - target.estimatedKm;
  target.estimatedKm = Math.round(nextKm * 1000) / 1000;
  const nextMinutes = Math.max(
    5,
    Math.round(target.estimatedKm * paceMinPerKm),
  );
  const deltaSeconds = Math.round((nextMinutes - target.minutes) * 60);
  target.minutes = nextMinutes;
  const last = target.steps.at(-1);
  if (last && last.seconds + deltaSeconds >= 60) last.seconds += deltaSeconds;
  return deltaKm;
}
