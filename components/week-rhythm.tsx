import { recordedWorkoutDate } from '@/lib/training-history';
import { addDays, kmDisplay, type Plan } from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { desiredRuns } from '@/lib/training-structure';
import { weeklyRhythm } from '@/lib/weekly-rhythm';

export function WeekRhythm({ plan, week }: { plan: Plan; week: number }) {
  const rhythm = weeklyRhythm(plan, week);
  const start = plan.weeks[week]?.start;
  const earlier = start
    ? plan.workouts.filter(
        (w) =>
          w.status === 'completed' &&
          w.week < 0 &&
          recordedWorkoutDate(w) >= start &&
          recordedWorkoutDate(w) <= addDays(start, 6),
      ).length
    : 0;
  const items = [
    rhythm.easy ? `${rhythm.easy} easy` : '',
    rhythm.quality
      ? `${rhythm.quality} quality ${rhythm.quality === 1 ? 'workout' : 'workouts'}`
      : '',
    rhythm.long
      ? `${rhythm.long} long ${rhythm.long === 1 ? 'run' : 'runs'}`
      : '',
    rhythm.race ? `${rhythm.race} race` : '',
  ].filter(Boolean);
  return (
    <div className="week-rhythm" aria-label="This week’s running rhythm">
      <div>
        <span className="eyebrow">
          {desiredRuns(plan.profile)}-day routine · this week
        </span>
        <strong>{items.join(' · ') || 'No runs scheduled'}</strong>
      </div>
      <p>
        {rhythm.days} running {rhythm.days === 1 ? 'day' : 'days'}
        {rhythm.sessions > rhythm.days ? ` · ${rhythm.sessions} sessions` : ''}
        {' · '}
        {runDuration(Math.round(rhythm.minutes))} training
        {' · '}about {kmDisplay(rhythm.estimatedKm, plan.profile.units)}{' '}
        {plan.profile.units}
      </p>
      {earlier > 0 && (
        <p>
          {earlier} run{earlier === 1 ? '' : 's'} from your previous plan
          already recorded this week, shown separately from these prescriptions.
        </p>
      )}
      {rhythm.marathonMinutes > 0 && (
        <p>
          Includes {runDuration(rhythm.marathonMinutes)} at marathon effort
          inside the long run. This work is included in the long-run distance
          and time.
        </p>
      )}
      {rhythm.quality === 0 &&
        rhythm.long === 0 &&
        rhythm.race === 0 &&
        rhythm.easy > 0 && (
          <p>
            Comfortable running throughout. Relaxed strides, when included, are
            brief changes of rhythm.
          </p>
        )}
    </div>
  );
}
