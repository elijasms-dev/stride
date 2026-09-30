import { dateLabel, type Plan } from '@/lib/engine';
import { dayOverview } from '@/lib/daily-guide';
import { SessionAtmosphere } from '../session-atmosphere';

/** Dates outside the block are context, not another full-screen experience. */
export function TodayDayCard({
  plan,
  date,
  motion,
}: {
  plan: Plan;
  date: string;
  motion: boolean;
}) {
  const overview = dayOverview(plan, date);
  const recorded = overview.records.length > 0;
  const outside = date < plan.profile.startDate || date > plan.profile.raceDate;
  if (outside && !recorded)
    return (
      <p className="today-boundary-note">
        <strong>{overview.title}.</strong>{' '}
        {date < plan.profile.startDate
          ? `Training starts ${dateLabel(plan.profile.startDate)}. No run is scheduled for this date.`
          : `This block ended ${dateLabel(plan.profile.raceDate)}. No run is scheduled for this date.`}
      </p>
    );
  return (
    <article
      className="today-hero today-day-hero"
      data-tone={recorded ? 'easy' : 'rest'}
    >
      <SessionAtmosphere mood={recorded ? 'easy' : 'rest'} motion={motion} />
      <span className="today-hero-kind">
        {recorded ? 'Your running journal' : 'Recovery is part of the plan'}
      </span>
      <div className="today-hero-heading">
        <h2>{recorded ? 'Run recorded' : 'Rest day'}</h2>
      </div>
      <p className="today-day-message">
        {recorded
          ? `${overview.records.length === 1 ? 'Your run is' : `${overview.records.length} runs are`} saved. Review what you recorded below.`
          : overview.activity
            ? `No run today. ${overview.activity.title} is optional; its details are below.`
            : 'No run scheduled. Make space to recover.'}
      </p>
      <a className="today-hero-detail-link" href="#today-workout-details">
        {recorded ? 'Your run details' : 'Your day, in detail'}{' '}
        <span aria-hidden="true">↓</span>
      </a>
    </article>
  );
}
