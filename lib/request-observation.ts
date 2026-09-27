const OPERATIONS = new Set([
  'account',
  'activities',
  'connections',
  'export',
  'measurement',
  'plan',
  'profile',
  'reconcile',
  'recovery',
  'state',
  'sync',
  'billing',
  'history',
  'delivery-jobs',
]);
export type RequestObservation = { operation: string; startedAt: number };
export function beginRequestObservation(request: Request): RequestObservation {
  const segment = new URL(request.url).pathname.split('/')[2];
  return {
    operation: OPERATIONS.has(segment) ? segment : 'other',
    startedAt: performance.now(),
  };
}
/** Only closed categories, timing and correlation IDs leave the server. */
export function safeRequestObservation(observation?: RequestObservation) {
  const elapsed = observation ? performance.now() - observation.startedAt : NaN;
  return {
    operation:
      observation && OPERATIONS.has(observation.operation)
        ? observation.operation
        : 'other',
    ...(Number.isFinite(elapsed)
      ? { durationMs: Math.max(0, Math.min(3_600_000, Math.round(elapsed))) }
      : {}),
  };
}
