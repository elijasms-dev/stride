'use client';
import { dateLabel, kmDisplay, type Plan, type Workout } from '@/lib/engine';
import { dayOverview, dailyGuide } from '@/lib/daily-guide';
import { runDuration } from '@/lib/journal-view';
import { DailyGuide } from './daily-guide';
import { Modal } from './stride-ui';

export default function DayDetail({
  plan,
  date,
  onClose,
  onWorkout,
}: {
  plan: Plan;
  date: string;
  onClose: () => void;
  onWorkout: (workout: Workout) => void;
}) {
  const { title, records, activity, planned } = dayOverview(plan, date);
  return (
    <Modal
      open
      title={title}
      description={dateLabel(date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
      onClose={onClose}
    >
      {date < plan.profile.startDate && (
        <p className="subtle">
          Your block starts {dateLabel(plan.profile.startDate)}. No workout is
          prescribed for this date.
        </p>
      )}
      {date > plan.profile.raceDate && (
        <p className="subtle">
          This date is outside your current block. These are general recovery
          tips, not a new training session.
        </p>
      )}
      {planned.length > 0 && (
        <section className="day-records" aria-label="Remaining runs today">
          <h3>Still in your plan</h3>
          {planned.map((workout) => (
            <div key={workout.id}>
              <button
                type="button"
                className="text-button"
                onClick={() => onWorkout(workout)}
              >
                {workout.title}
              </button>
            </div>
          ))}
        </section>
      )}
      {records.length > 0 && (
        <section className="day-records" aria-label="Running recorded this day">
          <h3>Recorded on this day</h3>
          {records.map((entry) => (
            <div key={entry.record.id}>
              {entry.kind === 'planned' ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onWorkout(entry.workout)}
                >
                  {entry.workout.title}
                </button>
              ) : (
                <strong>Extra run</strong>
              )}
              <p>
                {entry.record.km === null
                  ? 'Distance not recorded'
                  : `${kmDisplay(entry.record.km, plan.profile.units)} ${plan.profile.units}`}{' '}
                · {runDuration(entry.record.minutes)}
              </p>
            </div>
          ))}
        </section>
      )}
      {activity && (
        <p className="subtle">
          {activity.minutes} minutes · Optional supporting activity
        </p>
      )}
      <DailyGuide guide={dailyGuide(plan, date)} />
    </Modal>
  );
}
