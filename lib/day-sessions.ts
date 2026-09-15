import { type Workout } from './plan/types.ts';

/** Calendar presentation only: never changes prescriptions or journal records. */
export function orderedDaySessions(workouts: Workout[], date: string) {
  return workouts
    .filter((w) => w.date === date && w.week >= 0)
    .sort((a, b) =>
      (a.startTime ?? (a.session === 'PM' ? '18:00' : '06:00')).localeCompare(
        b.startTime ?? (b.session === 'PM' ? '18:00' : '06:00'),
      ),
    );
}

export function focusedSession(sessions: Workout[], selectedId?: string) {
  return (
    sessions.find((w) => w.id === selectedId) ??
    sessions.find((w) => w.status === 'planned') ??
    sessions.find((w) => w.status === 'completed') ??
    sessions[0]
  );
}

export function daySessionSummary(sessions: Workout[]) {
  const remaining = sessions.filter((w) => w.status === 'planned').length;
  const completed = sessions.filter((w) => w.status === 'completed').length;
  const skipped = sessions.filter((w) => w.status === 'skipped').length;
  const active = remaining + completed;
  const state = !sessions.length
    ? 'rest'
    : remaining
      ? completed
        ? 'partial'
        : 'planned'
      : completed
        ? 'completed'
        : 'skipped';
  const counts = [
    completed ? `${completed} completed` : '',
    remaining ? `${remaining} remaining` : '',
    skipped ? `${skipped} skipped` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const descriptions = sessions
    .map((w) => `${w.session ? `${w.session} ` : ''}${w.title}, ${w.status}`)
    .join('; ');
  return {
    remaining,
    completed,
    skipped,
    active,
    state,
    label: sessions.length ? `${counts}; ${descriptions}` : 'rest day',
  };
}

export function workoutTone(w: Workout) {
  return w.kind === 'race'
    ? 'race'
    : w.kind === 'long'
      ? 'long'
      : w.hard
        ? 'quality'
        : 'easy';
}
