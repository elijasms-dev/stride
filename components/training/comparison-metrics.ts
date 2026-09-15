import type { Plan } from '@/lib/engine';

export function metrics(plan: Plan, today: string) {
  const active = plan.workouts.filter(
    (w) =>
      w.week >= 0 &&
      w.date >= today &&
      w.status === 'planned' &&
      w.kind !== 'race',
  );
  return {
    peak: Math.max(
      0,
      ...plan.weeks.map((week) =>
        active
          .filter((w) => w.week === week.index)
          .reduce((n, w) => n + w.minutes, 0),
      ),
    ),
    long: Math.max(0, ...active.map((w) => w.minutes)),
    quality: active.filter((w) => w.hard).length,
    minutes: active.reduce((n, w) => n + w.minutes, 0),
  };
}
export function weeklyTraining(plan: Plan, index: number, today: string) {
  return plan.workouts
    .filter(
      (w) =>
        w.week === index &&
        w.date >= today &&
        w.status === 'planned' &&
        w.kind !== 'race',
    )
    .reduce((n, w) => n + w.minutes, 0);
}
