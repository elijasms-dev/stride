import { dayNames, type Profile } from '@/lib/engine';
import { usesMarathonBook } from '@/lib/marathon-book';
import {
  classicQualityCount,
  desiredRuns,
  qualitySchedule,
  aerobicSupportDay,
} from '@/lib/training-structure';

/** The normal weekly contract. Actual recovery, taper and race weeks are shown separately. */
export function TrainingPattern({
  profile,
  heading = 'Your usual week',
}: {
  profile: Profile;
  heading?: string;
}) {
  const count = desiredRuns(profile);
  const quality =
    profile.goal === 'base' || profile.intent === 'finish'
      ? []
      : qualitySchedule({
          ...profile,
          qualitySessions:
            profile.qualityMode === 'automatic'
              ? classicQualityCount(profile)
              : profile.qualitySessions,
        });
  const doubles = ['easy-doubles', 'double-threshold'].includes(
    profile.method ?? '',
  )
    ? (profile.doubleDays ?? [])
    : [];
  const medium = usesMarathonBook(profile)
    ? aerobicSupportDay(profile, 'marathon', quality)
    : undefined;
  return (
    <section className="training-pattern" aria-label={heading}>
      <div className="pattern-heading">
        <h3>{heading}</h3>
        <span>
          {count} running days
          {doubles.length ? ` · up to ${count + doubles.length} sessions` : ''}
        </span>
      </div>
      <ol className="pattern-days">
        {dayNames.map((day, index) => {
          const running = profile.days.includes(index);
          const cross = profile.crossTraining?.find((s) => s.day === index);
          const role = !running
            ? cross
              ? 'Cross-train'
              : 'Rest'
            : count > 2 && index === profile.longDay
              ? 'Long'
              : quality.includes(index)
                ? 'Workout'
                : index === medium
                  ? 'Endurance'
                  : 'Easy';
          return (
            <li key={day} data-role={role.toLowerCase()}>
              <span>{day.slice(0, 3)}</span>
              <i aria-hidden="true" />
              <strong>{role}</strong>
              {doubles.includes(index) && <small>AM + PM</small>}
            </li>
          );
        })}
      </ol>
      <p>
        {usesMarathonBook(profile)
          ? `${medium === undefined ? 'Endurance follows your selected running days.' : 'Midweek endurance fits your baseline and time limits.'} ${quality.length && profile.intent !== 'finish' && profile.difficulty !== 'gentle' ? 'Marathon-effort long runs count as one of your workouts. ' : ''}Recovery and taper weeks are lighter.`
          : 'Recovery, taper and race weeks can be lighter. Your available days are options, not extra runs.'}
      </p>
    </section>
  );
}
