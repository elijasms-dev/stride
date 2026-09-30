import { dayDiff, validDate } from './plan/calendar.ts';
import {
  danielsVdot,
  FITNESS_MODEL_DOMAIN,
  FITNESS_MODEL_VERSION,
  trainingPacesAtVdot,
  trainingRangesAtVdot,
} from './fitness-model.ts';
export {
  FITNESS_MODEL_VERSION,
  RACE_EQUIVALENCE_MODEL_VERSION,
} from './fitness-model.ts';

/** Race benchmarks use kilometres and elapsed minutes; all paces are seconds/km.
 * Evidence metadata is descriptive and never changes the pace calculation. */
export interface RecentRace {
  distanceKm: number;
  timeMinutes: number;
  date?: string;
  source?: 'race' | 'time-trial';
  course?: 'road' | 'track' | 'trail' | 'treadmill';
  /** Explicit runner confirmation; no inferred confidence or expiry threshold. */
  representative?: boolean;
}

export const RIEGEL_EXPONENT = 1.06;

export function validateRecentRace(value: unknown, asOf?: string): RecentRace {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enter both a recent race distance and finish time.');
  const { distanceKm, timeMinutes, date, source, course, representative } =
    value as RecentRace;
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
  if (date !== undefined && !validDate(date))
    throw new Error(
      'Recent race: enter a real calendar date, or leave it blank.',
    );
  if (date && validDate(asOf) && date > asOf)
    throw new Error('Recent race: a completed result cannot be in the future.');
  if (source !== undefined && !['race', 'time-trial'].includes(source))
    throw new Error(
      'Recent race: choose a race or time trial, or leave the result type blank.',
    );
  if (
    course !== undefined &&
    !['road', 'track', 'trail', 'treadmill'].includes(course)
  )
    throw new Error(
      'Recent race: choose a supported course, or leave it blank.',
    );
  if (representative !== undefined && typeof representative !== 'boolean')
    throw new Error(
      'Confirm whether the result represents your current fitness.',
    );
  const race: RecentRace = {
    distanceKm,
    timeMinutes,
    ...(date !== undefined ? { date } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(course !== undefined ? { course } : {}),
    ...(representative !== undefined ? { representative } : {}),
  };
  return race;
}

/** Evidence reminders are display guidance, not a confidence score or a pace adjustment. */
export function benchmarkEvidence(race: RecentRace, asOf?: string) {
  const ageDays =
    validDate(race.date) && validDate(asOf) ? dayDiff(race.date, asOf) : null;
  const notices: string[] = [];
  if (ageDays === null)
    notices.push(
      'No benchmark age is available. Add the result date to judge how current it is.',
    );
  else if (ageDays < 0)
    notices.push(
      'This result date is in the future. Use a completed race or time trial.',
    );
  else {
    notices.push(
      ageDays === 0
        ? 'Result recorded today.'
        : `Result recorded ${ageDays} days ago.`,
    );
    // Six months is a review reminder only, not a scientifically calibrated expiry.
    if (ageDays >= 180)
      notices.push(
        'This is an older result. Review whether it still reflects your current fitness.',
      );
  }
  if (!race.source || !race.course)
    notices.push(
      'Result type or course is unspecified, so comparability is unknown.',
    );
  if (race.course === 'trail')
    notices.push(
      'Trail terrain and elevation can make this result a poor comparison for road paces.',
    );
  if (race.course === 'treadmill')
    notices.push(
      'Treadmill calibration and conditions can differ from running outside.',
    );
  return { ageDays, notices };
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

/** Legacy mathematical API retained for analysis and historical tests. It is not
 * the source-based workout prescription resolver and does not certify V.O2 parity. */
export function calculateTrainingPaces(race: RecentRace) {
  const benchmark = validateRecentRace(race);
  return {
    ...trainingPacesAtVdot(
      danielsVdot(benchmark.distanceKm, benchmark.timeMinutes),
    ),
    marathon: (predictRaceTime(benchmark, 42.195) * 60) / 42.195,
  };
}

/** Legacy mathematical current-fitness derivation. No goal-distance input, calendar
 * clock, stale-result correction, or adjustment for hills/conditions. */
export function deriveFitness(race?: RecentRace | null, asOf?: string) {
  if (!race)
    return {
      modelVersion: FITNESS_MODEL_VERSION,
      source: 'none' as const,
      benchmark: null,
      vdot: null,
      confidence: {
        level: 'unavailable' as const,
        reasons: [
          'No performance benchmark. Use conversational effort and time or run/walk targets.',
        ],
      },
      paces: null,
      ranges: null,
    };
  const benchmark = validateRecentRace(race, asOf);
  const vdot = danielsVdot(benchmark.distanceKm, benchmark.timeMinutes);
  const evidence = benchmarkEvidence(benchmark, asOf);
  const reasons = evidence.notices.filter(
    (notice) => !notice.startsWith('Result recorded'),
  );
  if (benchmark.timeMinutes < 10)
    reasons.push(
      'A short result can be less representative of endurance fitness; a recent 10–12 minute or longer effort is preferable.',
    );
  if (benchmark.distanceKm > 10)
    reasons.push(
      'Longer results also reflect endurance preparation, fueling, course and weather; compare with a shorter recent result if available.',
    );
  if (
    vdot < FITNESS_MODEL_DOMAIN.minVdot ||
    vdot > FITNESS_MODEL_DOMAIN.maxVdot
  )
    reasons.push(
      'This performance is outside the supported VDOT 20–85 reference range. Use effort targets rather than extrapolated training paces.',
    );
  const rawRanges = trainingRangesAtVdot(vdot);
  const supported =
    vdot >= FITNESS_MODEL_DOMAIN.minVdot &&
    vdot <= FITNESS_MODEL_DOMAIN.maxVdot &&
    benchmark.distanceKm <= 42.195 &&
    Object.values(rawRanges).every(
      (range) => range.low >= 120 && range.high <= 1200,
    );
  if (benchmark.distanceKm > 42.195)
    reasons.push(
      'Ultradistance results are outside this road-fitness model; use effort targets.',
    );
  if (!supported && !reasons.some((reason) => reason.includes('outside')))
    reasons.push(
      'The estimated effort bands exceed supported pace targets; use effort targets.',
    );
  return {
    modelVersion: FITNESS_MODEL_VERSION,
    source: 'benchmark' as const,
    benchmark,
    vdot,
    confidence: {
      level: reasons.length ? ('limited' as const) : ('estimated' as const),
      reasons: [
        'Performance-based coaching estimate; not a laboratory measurement or statistical confidence interval. Adjust to effort and conditions.',
        ...reasons,
      ],
    },
    paces: supported ? trainingPacesAtVdot(vdot) : null,
    ranges: supported ? rawRanges : null,
  };
}

export function calculateTrainingPaceRanges(race: RecentRace, asOf?: string) {
  return deriveFitness(race, asOf).ranges;
}

/** Operational tolerance for a single race-equivalent pace, not a fitness zone
 * or statistical confidence interval. Training targets use the model bands. */
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
export interface PacingProfile {
  easyPace?: number | null;
  recentRace?: RecentRace;
  workoutTargets?: {
    mode: string;
    pace?: { easy?: { high: number } };
    overrides?: { easy?: { mode: string; high?: number } };
  };
}

function manualEasyPace(profile?: PacingProfile) {
  const override = profile?.workoutTargets?.overrides?.easy;
  const high =
    override?.mode === 'pace'
      ? override.high
      : profile?.workoutTargets?.mode === 'pace'
        ? profile.workoutTargets.pace?.easy?.high
        : undefined;
  return high !== undefined &&
    Number.isFinite(high) &&
    high >= 120 &&
    high <= 1200
    ? high / 60
    : undefined;
}

export function schedulingEasyPace(profile?: PacingProfile): number {
  const manual = manualEasyPace(profile);
  if (manual !== undefined) return Math.ceil(manual * 60 - 1e-9) / 60;
  const fitness = profile?.recentRace
    ? calculateTrainingPaceRanges(profile.recentRace)?.easy.high
    : undefined;
  const declared = profile?.easyPace;
  const validDeclared =
    declared != null && Number.isFinite(declared) && declared > 0
      ? declared
      : undefined;
  // Explicit effort/HR mode does not prescribe the calculated easy range.
  const autoTarget = !profile?.workoutTargets
    ? fitness === undefined
      ? undefined
      : fitness / 60
    : undefined;
  const pace = Math.max(
    validDeclared ?? autoTarget ?? (fitness === undefined ? 7 : fitness / 60),
    autoTarget ?? 0,
  );
  return Math.ceil(pace * 60 - 1e-9) / 60;
}

/** Explain precedence, without changing fitness or replacing an explicit target. */
export function pacingEvidence(profile?: PacingProfile, asOf?: string) {
  let fitness: ReturnType<typeof deriveFitness>;
  try {
    fitness = deriveFitness(profile?.recentRace, asOf);
  } catch (error) {
    // This helper also renders unfinished form drafts and imported data. Input
    // validation and deriveFitness remain strict at save/generation boundaries.
    const notices = [
      error instanceof Error ? error.message : 'Check the benchmark inputs.',
      'Pace preview is unavailable until the benchmark is corrected. Use effort guidance in the meantime.',
    ];
    return {
      fitness: {
        ...deriveFitness(),
        confidence: { level: 'unavailable' as const, reasons: notices },
      },
      notices,
      schedulingPaceMinutesPerKm: null,
    };
  }
  const notices = [...fitness.confidence.reasons];
  const manual = manualEasyPace(profile);
  const declared = profile?.easyPace;
  if (manual !== undefined) {
    notices.push(
      'Your manual easy pace range sets scheduled easy-run duration, including when it differs from the benchmark estimate.',
    );
    if (declared != null && declared * 60 > manual * 60)
      notices.push(
        'Your declared easy pace is slower than the manual target. Scheduling uses the manual range; review these conflicting inputs.',
      );
  }
  const band = fitness.ranges?.easy;
  const chosen = manual ?? declared;
  if (
    band &&
    chosen != null &&
    (chosen * 60 < band.low || chosen * 60 > band.high)
  )
    notices.push(
      'Your easy pace and benchmark estimate differ. Review which reflects your current conversational effort; the benchmark has not been corrected.',
    );
  return {
    fitness,
    notices,
    schedulingPaceMinutesPerKm: schedulingEasyPace(profile),
  };
}
