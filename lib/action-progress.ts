export type ActionProgress = { id: number; label: string };
const listeners = new Set<() => void>();
const pending = new Map<number, ActionProgress>();
let serial = 0;
let snapshot: ActionProgress | null = null;
export const subscribeToActionProgress = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getActionProgress = () => snapshot;
export const getServerActionProgress = () => null;
function publish() {
  snapshot = [...pending.values()].at(-1) ?? null;
  for (const listener of listeners) listener();
}

/** Labels contain no request contents, provider credentials or runner data. */
export function actionProgressLabel(path: string, init?: RequestInit) {
  const route = path.split('?')[0];
  if (route === '/api/activities') return 'Checking for recorded runs…';
  if (route === '/api/export') return 'Preparing your journal download…';
  if (!init?.method || init.method.toUpperCase() === 'GET') return null;
  if (route === '/api/measurement') return null;
  const action =
    typeof init.body === 'string'
      ? /"action"\s*:\s*"([A-Za-z]+)"/.exec(init.body)?.[1]
      : undefined;
  if (route === '/api/plan') {
    const labels: Record<string, string> = {
      preview: 'Building your training plan…',
      runMeasurePreview: 'Preparing your distance targets…',
      runMeasure: 'Saving your run targets…',
      varietyPreview: 'Reviewing fresh workout options…',
      variety: 'Saving your workout mix…',
      activate: 'Saving your training plan…',
      preferencesPreview: 'Reviewing your training preferences…',
      eventPreview: 'Building your next training block…',
      changeEventPreview: 'Building your next training block…',
      workoutPreview: 'Checking the surrounding week…',
      adjustPreview: 'Recalculating the affected sessions…',
      returnPreview: 'Reviewing your return to running…',
      runWalkPreview: 'Reviewing your running intervals…',
      substitutePreview: 'Checking workout alternatives…',
      complete: 'Saving your run…',
      freeRun: 'Saving your run…',
      attachRecording: 'Linking your recording…',
      correctLog: 'Saving your run correction…',
      correctExtra: 'Saving your run correction…',
      preferences: 'Saving your revised training…',
      changeEvent: 'Saving your next training block…',
      adjust: 'Saving the adjusted sessions…',
      advanceReturn: 'Saving your next return stage…',
      advanceRunWalk: 'Saving your next running stage…',
      undo: 'Restoring your previous plan…',
    };
    return labels[action ?? ''] ?? 'Saving your workout changes…';
  }
  if (route === '/api/sync')
    return action === 'confirm'
      ? 'Saving your watch confirmation…'
      : 'Checking workout delivery…';
  if (route === '/api/reconcile') return 'Updating your watch calendar…';
  if (route === '/api/connections')
    return action === 'disconnect' || init.method.toUpperCase() === 'DELETE'
      ? 'Disconnecting your watch service…'
      : 'Checking your watch connection…';
  if (route === '/api/profile') return 'Saving your profile…';
  if (route === '/api/recovery')
    return action?.endsWith('Preview') || action === 'preview'
      ? 'Checking your journal recovery…'
      : 'Updating your journal…';
  return null;
}

/** Allow the status to render for a frame before synchronous work begins. */
export function afterActionPaint(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible')
    return Promise.resolve();
  return new Promise((resolve) => {
    let frame = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      resolve();
    };
    const visibility = () => {
      if (document.visibilityState !== 'visible') finish();
    };
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(finish);
    });
  });
}

/** UI-only tracking: errors, aborts, request bodies and transport stay unchanged. */
export async function withActionProgress<T>(
  label: string | null,
  work: () => Promise<T>,
): Promise<T> {
  if (!label) return work();
  const id = ++serial;
  pending.set(id, { id, label });
  publish();
  try {
    await afterActionPaint();
    return await work();
  } finally {
    pending.delete(id);
    publish();
  }
}

/** Hold a complete logical action, including its refresh and calendar follow-up. */
export function singleFlight<T>(
  slot: { current: Promise<T> | null },
  work: () => Promise<T>,
): Promise<T> {
  if (slot.current) return slot.current;
  const task = Promise.resolve().then(work);
  slot.current = task;
  const release = () => {
    if (slot.current === task) slot.current = null;
  };
  void task.then(release, release);
  return task;
}
