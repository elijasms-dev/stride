import type { ExtraRun, Plan, Workout } from './engine.ts';
import { trainingRecords, type RunRecord } from './training-history.ts';

export type JournalEntry = { record: RunRecord } & (
  | { kind: 'planned'; workout: Workout }
  | { kind: 'extra'; run: ExtraRun }
);

/** The same deduplicated actual records drive totals and their correction actions. */
export function journalEntries(plan: Plan): JournalEntry[] {
  const workouts = new Map<string, Workout>();
  for (const w of plan.workouts) {
    if (w.status === 'completed' && w.feedback && !workouts.has(w.id))
      workouts.set(w.id, w);
  }
  const extras = new Map<string, ExtraRun>();
  for (const r of plan.extraRuns ?? []) {
    if (!extras.has(r.id)) extras.set(r.id, r);
  }
  return trainingRecords(plan).flatMap((record): JournalEntry[] => {
    if (record.workoutId) {
      const workout = workouts.get(record.workoutId);
      return workout ? [{ record, kind: 'planned', workout }] : [];
    }
    const run = extras.get(record.id);
    return run ? [{ record, kind: 'extra', run }] : [];
  });
}

export function journalSummary(entries: JournalEntry[]) {
  const known = entries.filter((entry) => entry.record.km !== null);
  return {
    count: entries.length,
    knownDistances: known.length,
    missingDistances: entries.length - known.length,
    km: known.length
      ? known.reduce((n, entry) => n + entry.record.km!, 0)
      : null,
    minutes: entries.reduce((n, entry) => n + entry.record.minutes, 0),
  };
}

export function runDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes * 60));
  const hours = Math.floor(total / 3600),
    mins = Math.floor((total % 3600) / 60),
    seconds = total % 60;
  return (
    [
      hours ? `${hours}h` : '',
      mins ? `${mins}m` : '',
      seconds ? `${seconds}s` : '',
    ]
      .filter(Boolean)
      .join(' ') || '0m'
  );
}
