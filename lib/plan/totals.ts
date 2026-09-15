/** Plan totals responsibilities; extracted without changing policy or behavior. */
import { qualityWorkMinutes } from '../prescription.ts';
import { round } from './math.ts';
import { type Plan } from './types.ts';

export function refreshWeekTotals(plan: Plan) {
  for (const w of plan.weeks) {
    const runs = plan.workouts.filter(
      (s) => s.week === w.index && s.status !== 'skipped',
    );
    const training = runs.filter((s) => s.kind !== 'race');
    w.targetKm = round(training.reduce((n, s) => n + s.estimatedKm, 0));
    w.raceKm = runs
      .filter((s) => s.kind === 'race')
      .reduce((n, s) => n + s.estimatedKm, 0);
    w.trainingMinutes = training.reduce((n, s) => n + s.minutes, 0);
    w.qualityMinutes = training.reduce((n, s) => n + qualityWorkMinutes(s), 0);
    w.rationale = [
      w.focus,
      `${training.length} sessions, ${Math.round(w.trainingMinutes)} ${plan.profile.runMeasure === 'distance' ? 'planning' : 'prescribed'} minutes; quality-work allocation ${Math.round(w.qualityMinutes)} minutes.`,
      'Long and demanding work are separated by easy or rest days; there is no catch-up mileage.',
      ...(w.phase === 'Taper' || w.phase === 'Race week'
        ? [
            'Training totals exclude the race. Familiar work is reduced while recovery increases.',
          ]
        : []),
    ];
    w.longKm = Math.max(
      0,
      ...runs.filter((s) => s.kind === 'long').map((s) => s.estimatedKm),
    );
  }
  return plan;
}
