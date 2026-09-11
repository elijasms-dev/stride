'use client';
import { dayNames, type Profile } from '@/lib/engine';
import { availableRunningDays } from '@/lib/training-structure';
import { runDuration } from '@/lib/journal-view';
import { Field, Choice } from './stride-ui';
import { NumericInput } from './numeric-input';

type Props = { profile: Profile; onChange: (profile: Profile) => void };
export function ScheduleCustomizationFields({ profile: p, onChange }: Props) {
  function editDay(
    day: number,
    patch: { maxMinutes?: number | null; startTime?: string | null },
  ) {
    const next = {
      ...p.dayPreferences?.find((d) => d.day === day),
      day,
      ...patch,
    };
    onChange({
      ...p,
      dayPreferences: [
        ...(p.dayPreferences ?? []).filter((d) => d.day !== day),
        ...(next.maxMinutes != null || next.startTime ? [next] : []),
      ].sort((a, b) => a.day - b.day),
    });
  }
  return (
    <details className="reason-details advanced-preferences">
      <summary>Fit running around your week</summary>
      <div className="form-section section-space">
        <Field
          label="Weekly running-time ceiling (minutes)"
          hint="Optional. Includes warm-ups, recoveries and both runs on a paired day. Race day and cross-training are separate. More available time does not automatically add training."
        >
          <NumericInput
            name="weeklyMinutesLimit"
            value={p.weeklyMinutesLimit}
            min={30}
            max={1260}
            integer
            placeholder="Use the plan’s progression"
            onValueChange={(v) => onChange({ ...p, weeklyMinutesLimit: v })}
          />
        </Field>
        <div>
          <h4>Day-by-day schedule</h4>
          <p className="subtle">
            Add tighter limits for busy days. Blank fields use your usual limits
            and leave the start time open. A time does not add a run to that
            day.
          </p>
        </div>
        {availableRunningDays(p).map((day) => {
          const preference = p.dayPreferences?.find((d) => d.day === day);
          return (
            <fieldset key={day} className="custom-day-fields">
              <legend className="field-title">{dayNames[day]}</legend>
              <div className="form-grid">
                <Field label={`${dayNames[day]} running limit (minutes)`}>
                  <NumericInput
                    name={`day-${day}-minutes`}
                    value={preference?.maxMinutes}
                    min={15}
                    max={300}
                    integer
                    placeholder="Usual limit"
                    onValueChange={(v) => editDay(day, { maxMinutes: v })}
                  />
                </Field>
                <Field label={`${dayNames[day]} preferred start`}>
                  <input
                    type="time"
                    value={preference?.startTime ?? ''}
                    onChange={(e) =>
                      editDay(day, { startTime: e.target.value || null })
                    }
                  />
                </Field>
              </div>
            </fieldset>
          );
        })}
        <p className="subtle">
          Times follow your plan’s time zone. On paired days, choose the first
          run’s start; the second keeps your recovery gap. Daily limits include
          both runs.
        </p>
        {!!p.dayPreferences?.length && (
          <button
            type="button"
            className="text-button"
            onClick={() => onChange({ ...p, dayPreferences: [] })}
          >
            Reset day-by-day settings
          </button>
        )}
      </div>
    </details>
  );
}

export function WorkoutCustomizationFields({
  profile: p,
  onChange,
  allowRunMeasure = false,
}: Props & { allowRunMeasure?: boolean }) {
  return (
    <details className="reason-details advanced-preferences">
      <summary>Your workout preferences</summary>
      <div className="form-section section-space">
        {allowRunMeasure && (
          <Field
            label="Easy and long runs"
            hint="Distance gives you a finish point, such as a 20 km long run. Time limits still shape the plan. Run-walk sessions and timed recoveries keep their structure."
          >
            <Choice
              label="Easy and long runs"
              value={p.runMeasure ?? 'distance'}
              onChange={(v) =>
                onChange({ ...p, runMeasure: v as Profile['runMeasure'] })
              }
              options={[
                { value: 'distance', label: 'Distance targets' },
                { value: 'time', label: 'Time targets' },
              ]}
            />
          </Field>
        )}
        <Field
          label="Repetition preference"
          hint="Changes how eligible quality sessions are built. Your race goal, training phase and recovery needs still decide the purpose and amount of work."
        >
          <Choice
            label="Repetition preference"
            value={p.workoutFormat ?? 'automatic'}
            onChange={(v) =>
              onChange({ ...p, workoutFormat: v as Profile['workoutFormat'] })
            }
            options={[
              { value: 'automatic', label: 'Choose a suitable mix' },
              { value: 'time', label: 'Prefer timed repeats · e.g. 4 × 3 min' },
              {
                value: 'distance',
                label: 'Prefer measured repeats · e.g. 6 × 400 m',
              },
            ]}
          />
        </Field>
        {p.workoutFormat === 'distance' && (
          <p className="subtle">
            Measured repeats need a relevant pace range in Workout targets and
            enough room for a complete set. Until then, the plan uses timed
            alternatives. Familiar taper sessions may keep their original
            format.
          </p>
        )}
      </div>
    </details>
  );
}

export function CustomizationSummary({ profile: p }: { profile: Profile }) {
  const days = p.dayPreferences?.filter((d) => p.days.includes(d.day)) ?? [];
  if (
    !days.length &&
    p.weeklyMinutesLimit == null &&
    (!p.workoutFormat || p.workoutFormat === 'automatic') &&
    p.workoutVariety !== 'familiar'
  )
    return null;
  return (
    <section
      className="customization-summary"
      aria-label="Your plan customizations"
    >
      <h4>Your plan, your week</h4>
      <ul>
        {p.weeklyMinutesLimit != null && (
          <li>
            At most {runDuration(p.weeklyMinutesLimit)} of running per week,
            excluding race day.
          </li>
        )}
        {days.map((d) => (
          <li key={d.day}>
            <strong>{dayNames[d.day]}</strong>
            {d.maxMinutes != null
              ? ` · up to ${runDuration(d.maxMinutes)}`
              : ''}
            {d.startTime ? ` · first run at ${d.startTime}` : ''}
          </li>
        ))}
        {p.workoutFormat && p.workoutFormat !== 'automatic' && (
          <li>
            {p.workoutFormat === 'time'
              ? 'Timed repetitions preferred for new quality sessions.'
              : 'Measured repetitions preferred when your pace ranges and session budget support them.'}
          </li>
        )}
        {p.workoutVariety === 'familiar' && (
          <li>Core workout formats repeat as the training dose develops.</li>
        )}
      </ul>
    </section>
  );
}
