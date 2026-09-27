'use client';
import type { Profile } from '@/lib/engine';
import { dayNames } from '@/lib/engine';
import { beginnerDays, beginnerSteps } from '@/lib/beginner-course';
import { Choice, Field } from './stride-ui';
import { NumericInput } from './numeric-input';
import { TrainingPattern } from './training-pattern';

export function BeginnerCourseOverview() {
  return (
    <details className="preview-plan-explanation">
      <summary>The nine beginner stages</summary>
      <p>
        This is a progression guide. Your calendar repeats the approved stage
        until all three lessons are comfortably completed and reviewed. Each
        outing includes five minutes of walking before and after. More time or
        repeats are normal.
      </p>
      <ol>
        {Array.from({ length: 9 }, (_, stage) => (
          <li key={stage}>
            Stage {stage + 1}:{' '}
            {[0, 1, 2]
              .map((lesson) => {
                const steps = beginnerSteps(stage, lesson);
                return `${steps.reduce((n, s) => n + s.seconds, 0) / 60} min outing (${Math.max(...steps.filter((s) => s.movement === 'run').map((s) => s.seconds)) / 60} min longest jog)`;
              })
              .join('; ')}
            .
          </li>
        ))}
      </ol>
      <p>
        The endpoint is 30 minutes of running; it does not promise 5 km.{' '}
        <a
          href="https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/"
          target="_blank"
          rel="noreferrer"
        >
          Based on NHS Couch to 5K
        </a>
        .
      </p>
    </details>
  );
}

export function BeginnerCourseFields({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const count = p.runsPerWeek ?? p.days.length;
  const available = p.availableDays ?? p.days;
  const days = beginnerDays(
    p,
    available.filter((d) => !p.crossTraining?.some((c) => c.day === d)),
    count,
  );
  return (
    <div className="plan-customization">
      <p className="notice">
        Couch to 5K starts with no running history. Choose two or three days
        with rest between. Three runs usually need at least nine weeks; two need
        at least fourteen. Progress depends on comfortable completion, not the
        calendar.
      </p>
      <Field label="Beginner sessions per week">
        <Choice
          label="Beginner sessions per week"
          value={String(count)}
          onChange={(value) =>
            onChange({
              ...p,
              runsPerWeek: Number(value),
              qualityMode: 'automatic',
              qualitySessions: 0,
            })
          }
          options={[
            { value: '3', label: '3 sessions' },
            { value: '2', label: '2 sessions' },
          ]}
        />
      </Field>
      <Field label="Days you could run">
        <div className="day-picker">
          {dayNames.map((day, i) => (
            <button
              key={day}
              type="button"
              aria-pressed={available.includes(i)}
              onClick={() =>
                onChange({
                  ...p,
                  availableDays: available.includes(i)
                    ? available.filter((d) => d !== i)
                    : [...available, i].sort((a, b) => a - b),
                })
              }
            >
              {day}
            </button>
          ))}
        </div>
      </Field>
      <Field
        label="Minutes available per outing"
        hint="Later sessions need 40 minutes including warm-up and cooldown walking."
      >
        <NumericInput
          name="weekdayMinutes"
          label="Minutes available per outing"
          value={p.weekdayMinutes}
          min={40}
          max={150}
          integer
          required
          onValueChange={(value) =>
            onChange({ ...p, weekdayMinutes: value ?? NaN })
          }
        />
      </Field>
      {days.length === count ? (
        <TrainingPattern profile={{ ...p, days, qualitySessions: 0 }} />
      ) : (
        <output className="notice">
          Select days that leave at least one rest day between sessions,
          including across weekends. Each needs 40 minutes available.
        </output>
      )}
      <BeginnerCourseOverview />
    </div>
  );
}
