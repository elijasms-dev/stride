import { isBeginnerProfile } from '@/lib/beginner-course';
import { dayNames, type Profile } from '@/lib/engine';
import { usesMarathonBook } from '@/lib/marathon-book';
import { isShortRoadRaceProfile } from '@/lib/road-training-policy';
import {
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
  const quality = qualitySchedule(profile);
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
            : isBeginnerProfile(profile)
              ? 'Run/walk'
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
        {isBeginnerProfile(profile)
          ? 'Timed beginner lessons, no speed workouts. Keep a rest day between runs and review each stage after comfortable completion.'
          : usesMarathonBook(profile)
            ? `${medium === undefined ? 'Endurance follows your selected running days.' : 'Midweek endurance fits your baseline and time limits.'} ${quality.length && profile.intent !== 'finish' && profile.difficulty !== 'gentle' ? 'Marathon-effort long runs count as one of your workouts. ' : ''}Recovery and taper weeks are lighter.`
            : isShortRoadRaceProfile(profile) &&
                profile.planLevel !== 'beginner'
              ? `${quality.length === 2 ? `Before taper, two workouts reduce to one every ${profile.recoveryWeeks ?? 4} weeks. ` : quality.length === 1 ? 'One workout remains each week before taper. ' : 'Your all-easy choice stays all easy. '}There are no scheduled full recovery weeks. Taper and race weeks are lighter.`
              : 'Recovery, taper and race weeks can be lighter. Your available days are options, not extra runs.'}
      </p>
    </section>
  );
}
