import { isLongUltra, longUltraCapacity } from '@/lib/ultra-policy';
import { CustomizationSummary } from './runner-customization-fields';
import { dayNames, kmDisplay, type Plan } from '@/lib/engine';
import { qualitySchedule } from '@/lib/training-structure';
import { runDuration } from '@/lib/journal-view';
import { weeklyRhythm } from '@/lib/weekly-rhythm';
import { usesMarathonBook } from '@/lib/marathon-book';
import { marathonPlanDescription } from '@/lib/plan-guidance';

export function PlanFit({ plan, asOf }: { plan: Plan; asOf: string }) {
  const p = plan.profile;
  const firstFull =
    plan.weeks.find((week) => week.start >= p.startDate) ?? plan.weeks[0];
  const initial = weeklyRhythm(plan, firstFull.index);
  const openingRatio = initial.estimatedKm / Math.max(1, p.weeklyKm);
  const development = plan.weeks.find((w) => w.phase === 'Build');
  const opening = plan.workouts.find((w) => w.templateId && w.kind !== 'race');
  const roles = plan.workouts.filter((w) => w.week === development?.index);
  return (
    <div className="plan-fit">
      <h3>Built around your running</h3>
      <CustomizationSummary profile={p} />
      {isLongUltra(p) && (
        <p>
          Your long-ultra block includes at most one controlled workout each
          week, a separate endurance outing, and easy long runs capped at four
          hours. The six weeks before taper average{' '}
          {(longUltraCapacity(plan, asOf).averageMinutes / 60).toFixed(1)} hours
          per week, including lighter weeks. This is a planning check, not a
          prediction of race readiness. Fueling, walk breaks and equipment
          practice are included in workout guidance.
        </p>
      )}
      <p>
        {kmDisplay(p.weeklyKm, p.units)} {p.units} per week, a{' '}
        {kmDisplay(p.longestKm, p.units)} {p.units} recent long run, and{' '}
        {p.currentRuns} current running days. Your block uses {p.days.length}{' '}
        running days
        {p.availableDays
          ? ` selected from ${p.availableDays.length} available`
          : ''}{' '}
        with{' '}
        {p.volume === 'maintain'
          ? 'steady overall volume'
          : 'gradual volume development'}
        .
      </p>
      <p>
        Week {firstFull.index + 1} schedules{' '}
        {runDuration(Math.round(initial.minutes))} of training, about{' '}
        {kmDisplay(initial.estimatedKm, p.units)} {p.units} across{' '}
        {initial.days} days.
        {openingRatio < 0.9 && p.weeklyKm > 0
          ? ' This is below your reported weekly distance. Fewer requested runs, a return to training, or the time and session-role limits can reduce the opening allocation. Review the week before activating; unused capacity is not added to recovery runs.'
          : ''}
        {!p.easyPace && !p.recentRace
          ? ' Distance and time comparisons use 7 min/km for scheduling; enter your usual easy pace for a closer estimate.'
          : ''}
      </p>
      {usesMarathonBook(p) ? (
        <p>{marathonPlanDescription(plan)}</p>
      ) : (
        <p>
          {p.qualitySessions === 0 || p.intent === 'finish'
            ? 'Your focus is easy endurance. Any relaxed strides provide changes of rhythm rather than a hard speed session.'
            : `${p.qualityMode === 'automatic' ? 'Your classic structure allows' : 'You requested'} up to ${p.qualitySessions ?? 1} quality sessions per week. ${p.recentQualitySessions == null ? 'Recent workout history was not supplied, so the introduction starts conservatively.' : `You reported ${p.recentQualitySessions} recent quality sessions${p.recentQualityMinutes != null ? ` and ${p.recentQualityMinutes} work minutes per week` : ', with work duration unspecified'}.`}`}{' '}
          {opening
            ? `First structured session: ${opening.title.toLowerCase()}, with ${runDuration(opening.qualityMinutes ?? 0)} of ${opening.stimulus === 'economy' ? 'relaxed accelerations' : 'controlled work'}.`
            : (p.qualitySessions ?? 0) > 0 && p.intent !== 'finish'
              ? 'Your current schedule and session limits do not fit a complete structured session. Review those limits if you want quality work in this block.'
              : ''}
          {roles.some((w) => w.role === 'medium-long')
            ? ' A weekday endurance run supports your long run, with shorter recovery outings around key days.'
            : ' Easy running surrounds the key sessions, with lighter weeks to absorb training.'}
        </p>
      )}
      {!usesMarathonBook(p) &&
        plan.workouts.some(
          (w) => w.kind === 'long' && w.stimulus === 'race-rhythm',
        ) && (
          <p>
            Selected race-preparation weeks include controlled marathon effort
            in the long run. Those weeks replace one weekday workout, keeping
            the rest of the long run easy.
          </p>
        )}
      {plan.notes
        .filter(
          (n) =>
            !usesMarathonBook(p) &&
            n.startsWith('Your available days and preferred'),
        )
        .map((n) => (
          <p key={n}>{n}</p>
        ))}
      {!!p.preferredHardDays?.length &&
        p.intent !== 'finish' &&
        p.goal !== 'base' &&
        p.qualitySessions !== 0 && (
          <p>
            Preferred workout days:{' '}
            {p.preferredHardDays.map((d) => dayNames[d]).join(', ')}. Available
            quality slots:{' '}
            {qualitySchedule(p)
              .map((d) => dayNames[d])
              .join(', ') || 'none'}
            .
            {p.preferredHardDays.some((d) => !qualitySchedule(p).includes(d)) &&
              ' Some preferences cannot fit recovery spacing, your long run or requested frequency.'}
          </p>
        )}
      {!!p.crossTraining?.length && (
        <p>
          {p.crossTraining.length} cross-training{' '}
          {p.crossTraining.length === 1 ? 'day is' : 'days are'} reserved
          without running. Optional supporting work stays outside running totals
          and watch delivery.
        </p>
      )}
    </div>
  );
}
