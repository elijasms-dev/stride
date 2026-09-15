'use client';

import { dateLabel, kmDisplay, raceDistance } from '@/lib/engine';
import type { useTrainingTools } from './use-training-tools';

export function TrainingOverview({
  plan,
  isDemo,
  section,
  unit,
}: ReturnType<typeof useTrainingTools>) {
  return (
    <section className="training-baseline" hidden={section !== 'overview'}>
      <span className="eyebrow">Your starting point</span>
      <h2>
        {kmDisplay(plan.profile.weeklyKm, unit)} {unit} a week.
        <br />
        <span className="subtle">
          A {kmDisplay(plan.profile.longestKm, unit)} {unit} longest run.{' '}
          {plan.profile.currentRuns} recent running days.
        </span>
      </h2>
      <p>
        {isDemo ? 'Example inputs' : 'Your supplied inputs'} for this block,
        beginning {dateLabel(plan.profile.startDate)}.{' '}
        {plan.profile.goal === 'base'
          ? 'Building a habit.'
          : `${kmDisplay(raceDistance(plan.profile), unit)} ${unit} on race day.`}
      </p>
      <div className="method-summary">
        <div>
          <span className="eyebrow">Training approach</span>
          <h3>
            {
              {
                balanced: 'Balanced race preparation',
                'threshold-singles': 'Threshold-focused singles',
                'easy-doubles': 'Easy volume, split across the day',
                'double-threshold': 'One controlled threshold pair',
              }[plan.profile.method ?? 'balanced']
            }
          </h3>
          <p>
            {plan.profile.method === 'double-threshold'
              ? 'An advanced, individually monitored option inspired by Norwegian practice. Morning and evening share existing volume, with no extra hard session that week.'
              : plan.profile.method === 'easy-doubles'
                ? 'Two relaxed sessions on one selected day. The split changes when you run; it does not add distance to the week.'
                : plan.profile.method === 'threshold-singles'
                  ? 'Controlled threshold sessions with a separate weekly work budget. Consistency and repeatability come before faster repetitions.'
                  : 'Easy running carries most of the volume. Quality sessions change purpose through the block, while long runs progress independently.'}
          </p>
        </div>
        <dl>
          <dt>Weekly volume</dt>
          <dd>
            {plan.profile.volume === 'maintain'
              ? 'Hold steady'
              : 'Gradual build'}
          </dd>
          <dt>Recovery week</dt>
          <dd>Every {plan.profile.recoveryWeeks ?? 4} weeks</dd>
          <dt>Quality ceiling</dt>
          <dd>
            {['threshold-singles', 'double-threshold'].includes(
              plan.profile.method ?? '',
            )
              ? '18%'
              : '22%'}{' '}
            of training time
          </dd>
          <dt>Long-run limit</dt>
          <dd>{plan.profile.longMinutes} min</dd>
        </dl>
      </div>
    </section>
  );
}
