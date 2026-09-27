/** A deliberately permissive corruption guard for Run/VirtualRun summaries,
 * not a training threshold or a performance prediction. No lower-speed bound:
 * walking, mountain races and multi-day efforts must remain valid records. */
export const MAX_RUNNING_SUMMARY_KMH = 45;

export function impossibleRunningSummary(minutes: number, km: number | null) {
  return (
    km !== null &&
    km > 0 &&
    minutes > 0 &&
    (km * 60) / minutes > MAX_RUNNING_SUMMARY_KMH
  );
}
