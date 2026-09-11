import type { Plan } from './engine';

/** Describe the actual prescription, including exceptions, rather than a template promise. */
export function weeklyRhythm(plan: Plan, week: number) {
  const runs = plan.workouts.filter(
    (w) => w.week === week && w.status !== 'skipped',
  );
  const training = runs.filter((w) => w.kind !== 'race');
  const long = training.filter((w) => w.kind === 'long');
  const quality = training.filter((w) => w.hard && w.kind !== 'long');
  const easy = training.filter((w) => !w.hard && w.kind !== 'long');
  return {
    days: new Set(runs.map((w) => w.date)).size,
    sessions: runs.length,
    easy: easy.length,
    quality: quality.length,
    long: long.length,
    race: runs.length - training.length,
    minutes: training.reduce((n, w) => n + w.minutes, 0),
    estimatedKm: training.reduce((n, w) => n + w.estimatedKm, 0),
    marathonMinutes: long
      .filter((w) => w.stimulus === 'race-rhythm')
      .reduce((n, w) => n + (w.qualityMinutes ?? 0), 0),
    keySessions: [...quality, ...long].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  };
}
