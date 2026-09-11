export type HomePreferences = {
  openingView: 'today' | 'plan' | 'progress';
  upcomingCount: 0 | 1 | 3;
  showEstimates: boolean;
};

export const HOME_PREFERENCES_KEY = 'stride-home-preferences';
export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  openingView: 'today',
  upcomingCount: 1,
  showEstimates: true,
};

export function readHomePreferences(raw: string | null): HomePreferences {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return DEFAULT_HOME_PREFERENCES;
    return {
      openingView: ['today', 'plan', 'progress'].includes(value.openingView)
        ? value.openingView
        : 'today',
      upcomingCount: [0, 1, 3].includes(value.upcomingCount)
        ? value.upcomingCount
        : 1,
      showEstimates:
        typeof value.showEstimates === 'boolean' ? value.showEstimates : true,
    };
  } catch {
    return DEFAULT_HOME_PREFERENCES;
  }
}

export function openingView(
  query: URLSearchParams,
  preferred: HomePreferences['openingView'],
) {
  const requested = query.get('view');
  if (requested === 'restart') return 'plan';
  if (requested === 'training') return 'progress';
  if (
    requested &&
    ['today', 'plan', 'progress', 'settings'].includes(requested)
  )
    return requested;
  // Shared day/block links keep their original Today destination.
  if (query.has('view') || query.has('day') || query.has('block'))
    return 'today';
  return preferred;
}
