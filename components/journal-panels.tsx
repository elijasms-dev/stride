'use client';
import { runDuration } from '@/lib/journal-view';
import { prescribedDistanceKm } from '@/lib/run-distance';
import { workoutTone } from '@/lib/day-sessions';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
import {
  dateLabel,
  workoutDistanceLabel,
  eventDistanceDisplay,
  type Plan,
  type Workout,
  type Step,
} from '@/lib/engine';

export function SessionStructure({
  workout,
  unit,
}: {
  workout: Workout;
  unit: 'km' | 'mi';
}) {
  const labels: Record<Step['kind'], string> = {
    warmup: 'Warm up',
    aerobic: 'Easy running',
    work: 'Running',
    recovery: 'Recoveries',
    cooldown: 'Cool down',
  };
  const groups = (
    ['warmup', 'aerobic', 'work', 'recovery', 'cooldown'] as const
  )
    .map((kind) => ({
      kind,
      steps: workout.steps.filter((s) => s.kind === kind),
    }))
    .filter((group) => group.steps.length);
  return (
    <div className="session-structure" aria-label="Session breakdown">
      {groups.map(({ kind, steps }) => (
        <div key={kind}>
          <span>
            {labels[kind]}
            {kind === 'work' && steps.length > 1
              ? ` · ${steps.length} efforts`
              : ''}
          </span>
          <strong>
            {steps.every((s) => s.metres !== undefined)
              ? `${eventDistanceDisplay(steps.reduce((n, s) => n + (s.metres ?? 0), 0) / 1000, unit)} ${unit}`
              : `${Math.round(steps.reduce((n, s) => n + s.seconds, 0) / 6) / 10} min`}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function UpcomingSessions({
  count = 1,
  showEstimates = true,
  plan,
  fromDate,
  selectedId,
  onWorkout,
  onPlan,
}: {
  count?: 0 | 1 | 3;
  showEstimates?: boolean;
  plan: Plan;
  fromDate: string;
  selectedId?: string;
  onWorkout: (w: Workout) => void;
  onPlan: () => void;
}) {
  const runs = plan.workouts
    .filter(
      (w) =>
        w.date >= fromDate && w.id !== selectedId && w.status === 'planned',
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    )
    .slice(0, count);
  if (count === 0) return null;
  return (
    <section className="journal-upcoming" aria-label="Upcoming sessions">
      <div className="journal-section-heading">
        <h2>Up next</h2>
        <button className="text-button" onClick={onPlan}>
          Full schedule <ArrowUpRight size={16} />
        </button>
      </div>
      {runs.length ? (
        <div className="session-contact-sheet">
          {runs.map((w) => (
            <button
              key={w.id}
              className="upcoming-session"
              data-tone={workoutTone(w)}
              onClick={() => onWorkout(w)}
            >
              <span className="upcoming-date">
                <span>{dateLabel(w.date, { weekday: 'short' })}</span>
                <strong>{dateLabel(w.date, { day: 'numeric' })}</strong>
                <small>
                  {dateLabel(w.date, { month: 'short' })}
                  {w.session ? ` · ${w.session}` : ''}
                </small>
              </span>
              <span className="upcoming-body">
                <strong>{w.title}</strong>
                <span>
                  {w.kind === 'race'
                    ? `${eventDistanceDisplay(w.estimatedKm, plan.profile.units)} ${plan.profile.units}`
                    : `${prescribedDistanceKm(w) !== null || showEstimates ? `${workoutDistanceLabel(w, plan.profile)} · ` : ''}${runDuration(w.minutes)}${prescribedDistanceKm(w) !== null ? ' estimated' : ''}`}
                </span>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      ) : (
        <p className="journal-empty">
          No more planned runs from this date. Open your schedule to review the
          block.
        </p>
      )}
    </section>
  );
}

export function BlockVolume({
  plan,
  selected,
  onWeek,
}: {
  plan: Plan;
  selected: number;
  onWeek: (index: number) => void;
}) {
  const start = Math.max(0, Math.min(selected - 2, plan.weeks.length - 6));
  const weeks = plan.weeks.slice(start, start + 6);
  const peak = Math.max(
    1,
    ...plan.weeks.map(
      (w) => w.trainingMinutes ?? w.targetKm * (plan.profile.easyPace ?? 7),
    ),
  );
  return (
    <section className="block-volume" aria-label="Weekly planned volume">
      <div className="journal-section-heading">
        <h3>Block volume</h3>
        <span>minutes of training</span>
      </div>
      <div className="volume-columns">
        {weeks.map((w) => (
          <button
            key={w.index}
            className={selected === w.index ? 'selected' : ''}
            onClick={() => onWeek(w.index)}
            aria-pressed={selected === w.index}
            aria-label={`View week ${w.index + 1}, ${w.phase}, ${Math.round(w.trainingMinutes ?? w.targetKm * (plan.profile.easyPace ?? 7))} minutes`}
          >
            <span>
              {Math.round(
                w.trainingMinutes ?? w.targetKm * (plan.profile.easyPace ?? 7),
              )}
            </span>
            <i
              style={{
                height: `${Math.max(3, ((w.trainingMinutes ?? w.targetKm * (plan.profile.easyPace ?? 7)) / peak) * 76)}px`,
              }}
            />
            <small>W{w.index + 1}</small>
          </button>
        ))}
      </div>
      <p>
        Week {selected + 1} · {plan.weeks[selected].phase}. Race distance is
        shown separately.
      </p>
    </section>
  );
}
