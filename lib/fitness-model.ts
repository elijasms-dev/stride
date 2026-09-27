/** Daniels/Gilbert performance model. See docs/research/pace-model-evidence.md.
 * This estimates performance fitness, not laboratory VO2max. */
export const FITNESS_MODEL_VERSION = 'stride-daniels-1';
export const RACE_EQUIVALENCE_MODEL_VERSION = 'riegel-1.06';
export const FITNESS_MODEL_DOMAIN = { minVdot: 20, maxVdot: 85 } as const;

export interface FitnessPaceBand {
  /** Faster and slower edges, in seconds/km. These are effort bands, not confidence intervals. */
  low: number;
  high: number;
}

function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('Fitness model inputs must be positive finite numbers.');
}

/** Race duration in minutes; velocity in metres/minute. */
export function danielsVdot(distanceKm: number, timeMinutes: number): number {
  positive(distanceKm);
  positive(timeMinutes);
  const v = (distanceKm * 1000) / timeMinutes;
  const oxygen = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const sustained =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  const result = oxygen / sustained;
  positive(result);
  return result;
}

/** Invert the oxygen-cost polynomial, rather than multiplying pace by %VO2. */
export function paceAtOxygenFraction(vdot: number, fraction: number): number {
  positive(vdot);
  positive(fraction);
  const demand = vdot * fraction;
  const velocity =
    (2 * (demand + 4.6)) /
    (0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (demand + 4.6)));
  const result = 60000 / velocity;
  positive(result);
  return result;
}

/** Equal-VDOT performance, used only to anchor current 1500m/mile repetition effort. */
export function danielsEquivalentTime(
  vdot: number,
  distanceKm: number,
): number {
  positive(vdot);
  positive(distanceKm);
  let fast = (distanceKm * paceAtOxygenFraction(vdot, 2)) / 60;
  let slow = (distanceKm * paceAtOxygenFraction(vdot, 0.5)) / 60;
  for (let i = 0; i < 80; i++) {
    const middle = (fast + slow) / 2;
    if (danielsVdot(distanceKm, middle) > vdot) fast = middle;
    else slow = middle;
  }
  return (fast + slow) / 2;
}

function band(fast: number, slow: number): FitnessPaceBand {
  return {
    low: Math.floor(Math.min(fast, slow)),
    high: Math.ceil(Math.max(fast, slow)),
  };
}

/** Published oxygen-demand bands. Steady is Stride's name for the M-intensity
 * band, not a claim that every runner can race a marathon at this intensity.
 * Tempo remains the legacy alias for steady; true threshold has its own role. */
export function trainingRangesAtVdot(vdot: number) {
  positive(vdot);
  const oxygenBand = (low: number, high: number) =>
    band(paceAtOxygenFraction(vdot, high), paceAtOxygenFraction(vdot, low));
  const steady = oxygenBand(0.75, 0.84);
  const milePace = (danielsEquivalentTime(vdot, 1.609344) * 60) / 1.609344;
  const shortPace = (danielsEquivalentTime(vdot, 1.5) * 60) / 1.5;
  return {
    easy: oxygenBand(0.59, 0.74),
    steady,
    tempo: { ...steady },
    threshold: oxygenBand(0.85, 0.88),
    interval: oxygenBand(0.95, 1),
    repetition: band(shortPace, milePace),
  };
}

export type TrainingPaceRanges = ReturnType<typeof trainingRangesAtVdot>;

/** Representative paces for legacy numeric consumers. They are not confidence
 * estimates or official calculator/table reproductions. New targets use bands. */
export function trainingPacesAtVdot(vdot: number) {
  const interval = paceAtOxygenFraction(vdot, 0.975);
  const steady = paceAtOxygenFraction(vdot, 0.795);
  return {
    easy: paceAtOxygenFraction(vdot, 0.7),
    steady,
    tempo: steady,
    threshold: paceAtOxygenFraction(vdot, 0.88),
    interval,
    vo2Max: interval,
    repetition: (danielsEquivalentTime(vdot, 1.609344) * 60) / 1.609344,
  };
}
