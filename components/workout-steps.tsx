import { Repeat2 } from 'lucide-react';
import type { Profile, Step, Workout } from '@/lib/engine';
import { eventDistanceDisplay, kmDisplay } from '@/lib/engine';
import { stepLength } from '@/lib/workout-names';
import { targetLabel } from '@/lib/workout-targets';
import { workoutStepGroups } from '@/lib/workout-groups';

export function WorkoutSteps({
  workout,
  profile,
}: {
  workout: Workout;
  profile: Profile;
}) {
  const row = (s: Step, number: string, repeated = false, note?: string) => (
    <div className={`session-step ${s.kind}`}>
      <span className="step-number">{number}</span>
      <div>
        <strong>
          {repeated ? s.label.replace(/ · \d+ of \d+$/, '') : s.label}
        </strong>
        {note && <span className="step-repeat-note">{note}</span>}
        <small>{s.effort}</small>
        {s.target && (
          <span className="step-target">
            {targetLabel(s.target, profile.units)}
          </span>
        )}
      </div>
      <span className="step-time">
        {s.metres && ['race', 'easy', 'long'].includes(workout.kind)
          ? `${workout.kind === 'race' ? eventDistanceDisplay(s.metres / 1000, profile.units) : kmDisplay(s.metres / 1000, profile.units)} ${profile.units}`
          : stepLength(s)}
      </span>
    </div>
  );
  return workoutStepGroups(workout.steps).map((group) =>
    group.repetitions > 1 ? (
      <section
        className="session-repeat-group"
        key={group.start}
        aria-label={`Repeat ${group.repetitions} times`}
      >
        <div className="session-repeat-heading">
          <Repeat2 size={16} />
          <strong>Repeat × {group.repetitions}</strong>
        </div>
        {row(group.work, String(group.start + 1).padStart(2, '0'), true)}
        {group.reset &&
          row(
            group.reset,
            '↳',
            false,
            group.resetAfterLast
              ? 'After every effort, including the last'
              : `Between repeats · ${group.repetitions - 1} ${group.repetitions === 2 ? 'recovery' : 'recoveries'}`,
          )}
      </section>
    ) : (
      <div key={group.start}>
        {row(group.work, String(group.start + 1).padStart(2, '0'))}
      </div>
    ),
  );
}
