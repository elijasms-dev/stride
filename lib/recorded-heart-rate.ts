/** Observed activity summaries in bpm. These never describe training targets. */
export type RecordedHeartRate = {
  averageHeartRate?: number;
  maxHeartRate?: number;
};

// Corrupt-summary intake limit, not a training zone or an estimate of runner HRmax.
const validBpm = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 300;

export function validRecordedHeartRate(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    (value.averageHeartRate === undefined ||
      validBpm(value.averageHeartRate)) &&
    (value.maxHeartRate === undefined || validBpm(value.maxHeartRate)) &&
    !(
      typeof value.averageHeartRate === 'number' &&
      typeof value.maxHeartRate === 'number' &&
      value.averageHeartRate > value.maxHeartRate
    )
  );
}

/** Tolerant provider/read adapter: invalid values are absent, never zero-filled. */
export function recordedHeartRate(input: unknown): RecordedHeartRate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const value = input as Record<string, unknown>;
  const result: RecordedHeartRate = {
    ...(validBpm(value.averageHeartRate)
      ? { averageHeartRate: value.averageHeartRate }
      : {}),
    ...(validBpm(value.maxHeartRate)
      ? { maxHeartRate: value.maxHeartRate }
      : {}),
  };
  return validRecordedHeartRate(result) ? result : {};
}

/** Replace only measured fields, including clearing stale/client-supplied values. */
export function replaceRecordedHeartRate(
  target: RecordedHeartRate,
  source: unknown,
) {
  const measured = recordedHeartRate(source);
  delete target.averageHeartRate;
  delete target.maxHeartRate;
  Object.assign(target, measured);
}
