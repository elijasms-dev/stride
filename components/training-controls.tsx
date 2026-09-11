'use client';
import { useId } from 'react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { ChevronDown, SlidersHorizontal, Check } from 'lucide-react';
import { isLongUltra } from '@/lib/ultra-policy';
import { usesMarathonBook } from '@/lib/marathon-book';
import {
  ScheduleCustomizationFields,
  WorkoutCustomizationFields,
} from './runner-customization-fields';
import { TrainingPattern } from './training-pattern';
import { Field, Choice } from './stride-ui';
import { NumericInput } from './numeric-input';
import { MILE_KM } from '@/lib/form-values';
import { runningDayRange } from '@/lib/schedule-guidance';
import {
  availableRunningDays,
  desiredRuns,
  classicQualityCount,
  resolveRunningDays,
  requestedQualityCount,
} from '@/lib/training-structure';
import { dayNames, trainingFamily, type Profile } from '@/lib/engine';
import { qualitySchedule } from '@/lib/training-structure';

function PlanChoice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    title: string;
    detail?: string;
    disabled?: boolean;
  }[];
}) {
  const id = useId();
  return (
    <fieldset className="plan-choice-field">
      <legend id={id}>{label}</legend>
      <RadioGroup
        aria-labelledby={id}
        value={value}
        onValueChange={(v) => onChange(String(v))}
        className="plan-choice-grid"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="plan-choice"
            data-selected={value === option.value}
            data-disabled={option.disabled || undefined}
          >
            <RadioGroupItem
              value={option.value}
              disabled={option.disabled}
              className="plan-choice-radio"
            />
            <strong>{option.title}</strong>
            {option.detail && <span>{option.detail}</span>}
            <Check className="plan-choice-check" size={14} aria-hidden="true" />
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function WorkoutFrequencyField({
  profile: p,
  onChange,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
}) {
  const automatic =
    p.qualityMode === 'automatic' ||
    p.qualitySessions == null ||
    (usesMarathonBook(p) &&
      p.qualityMode === undefined &&
      p.qualitySessions === 2);
  const easyOnly = p.goal === 'base' || desiredRuns(p) === 2;
  const automaticCount =
    p.intent === 'finish'
      ? 0
      : requestedQualityCount({
          ...p,
          qualityMode: 'automatic',
        });
  const twoReason = isLongUltra(p)
    ? 'For ultras beyond 50 miles, keep to one harder workout.'
    : desiredRuns(p) < 5 || p.currentRuns < 5
      ? 'Two harder workouts need at least five running days in your plan and current routine.'
      : p.experience !== 'established' || p.weeklyKm < 45
        ? 'Two harder workouts need an established routine of at least 45 km a week.'
        : null;
  if (p.method === 'double-threshold')
    return (
      <div className="plan-workout-choice">
        <strong>One double-workout day</strong>
        <p>
          Your advanced method pairs two threshold sessions on one day. Change
          this in Advanced options.
        </p>
      </div>
    );
  return (
    <div className="plan-workout-choice">
      <PlanChoice
        label="Harder workouts per week"
        value={
          automatic
            ? String(automaticCount)
            : p.intent === 'finish'
              ? '0'
              : String(p.qualitySessions)
        }
        onChange={(v) =>
          onChange({
            ...p,
            qualityMode: v === 'automatic' ? 'automatic' : 'custom',
            qualitySessions:
              v === 'automatic' ? undefined : (Number(v) as 0 | 1 | 2),
            ...(Number(v) > 0 ? { intent: 'improve' as const } : {}),
          })
        }
        options={[
          { value: '0', title: '0', detail: 'All easy' },
          { value: '1', title: '1', detail: 'Per week', disabled: easyOnly },
          {
            value: '2',
            title: '2',
            detail: 'Different sessions',
            disabled: easyOnly || !!twoReason,
          },
        ]}
      />
      <p className="plan-control-hint">
        {easyOnly
          ? 'This plan keeps your runs easy.'
          : 'Tempo, intervals or marathon-effort work. An easy long run is separate.'}
      </p>
      {!easyOnly && twoReason && (
        <p className="plan-control-hint">{twoReason}</p>
      )}
      {!automatic &&
        p.qualitySessions === 2 &&
        (p.recentQualitySessions ?? 0) < 2 && (
          <div className="plan-history-check">
            <Field
              label="How many harder workouts do you already do?"
              hint="Two per week is available when it is already part of your routine."
            >
              <Choice
                label="Current harder workouts"
                value={
                  p.recentQualitySessions == null
                    ? 'unknown'
                    : String(p.recentQualitySessions)
                }
                onChange={(v) =>
                  onChange({
                    ...p,
                    recentQualitySessions:
                      v === 'unknown' ? null : (Number(v) as 0 | 1 | 2),
                  })
                }
                options={[
                  { value: 'unknown', label: 'Not sure' },
                  { value: '0', label: 'None yet' },
                  { value: '1', label: 'One' },
                  { value: '2', label: 'Two' },
                ]}
              />
            </Field>
          </div>
        )}
    </div>
  );
}

/** One simple surface shared by new plans, restarts and existing-plan preferences. */
export function PlanCustomizationFields({
  profile,
  onChange,
  onReviewRoutine,
  allowRunMeasure = false,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
  onReviewRoutine?: () => void;
  allowRunMeasure?: boolean;
}) {
  return (
    <div
      className="plan-customization"
      onInvalidCapture={(event) => {
        // Hidden invalid inputs must become reachable, including their raw draft text.
        let parent = (event.target as HTMLElement).parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          parent = parent.parentElement;
        }
      }}
    >
      <ScheduleFields
        profile={profile}
        onChange={onChange}
        onReviewRoutine={onReviewRoutine}
      />
      <div className="plan-distance-start">
        <div className="plan-distance-metrics">
          <div>
            <span>Starting weekly distance</span>
            <strong>
              {Number(
                (
                  profile.weeklyKm / (profile.units === 'mi' ? MILE_KM : 1)
                ).toFixed(1),
              )}
              <small> {profile.units}</small>
            </strong>
          </div>
          <div>
            <span>Recent long run</span>
            <strong>
              {Number(
                (
                  profile.longestKm / (profile.units === 'mi' ? MILE_KM : 1)
                ).toFixed(1),
              )}
              <small> {profile.units}</small>
            </strong>
          </div>
        </div>
        <p className="plan-control-hint">
          Your routine sets the starting workload. Recovery, taper and partial
          weeks are shorter.
        </p>
        {(profile.weekdayMinutes < 120 || profile.longMinutes < 300) && (
          <div className="plan-distance-limits">
            <p>
              Your saved time limits can shorten these distances:{' '}
              {profile.weekdayMinutes} min on weekdays, {profile.longMinutes}{' '}
              min for the long run.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                onChange({ ...profile, weekdayMinutes: 120, longMinutes: 300 })
              }
            >
              Prioritise my distances
            </button>
          </div>
        )}
      </div>
      <details className="plan-advanced">
        <summary>
          <SlidersHorizontal size={18} />
          <span>
            <strong>More options</strong>
            <small>Only if you want to fine-tune</small>
          </span>
          <ChevronDown size={18} />
        </summary>
        <div className="plan-options-body form-section">
          <PlanChoice
            label="Workout difficulty"
            value={profile.difficulty}
            onChange={(value) =>
              onChange({
                ...profile,
                difficulty: value as Profile['difficulty'],
              })
            }
            options={[
              { value: 'gentle', title: 'Gentler' },
              { value: 'balanced', title: 'Standard' },
            ]}
          />
          <ScheduleFields
            profile={profile}
            onChange={onChange}
            onReviewRoutine={onReviewRoutine}
            section="advanced"
          />
          <TrainingPreferenceFields
            profile={profile}
            onChange={onChange}
            allowRunMeasure={allowRunMeasure}
          />
        </div>
      </details>
    </div>
  );
}

export function ScheduleFields({
  profile: p,
  onChange,
  onReviewRoutine,
  section = 'basic',
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onReviewRoutine?: () => void;
  section?: 'basic' | 'advanced' | 'preview';
}) {
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...p, [key]: value });
  const range = runningDayRange(p);
  const available = availableRunningDays(p),
    count = desiredRuns(p);
  const crossDays = p.crossTraining?.map((s) => s.day) ?? [];
  const effectiveAvailable = available.filter((d) => !crossDays.includes(d));
  const reservedConflict =
    crossDays.includes(p.longDay) ||
    p.doubleDays?.some((d) => crossDays.includes(d));
  const conflict =
    count < range.min ||
    count > range.max ||
    count > effectiveAvailable.length ||
    reservedConflict;
  const recommended = Math.min(
    range.max,
    Math.max(range.min, Math.min(count, effectiveAvailable.length)),
  );
  const scheduled = !conflict
    ? resolveRunningDays({
        ...p,
        availableDays: available,
        runsPerWeek: count,
        qualitySessions:
          p.qualityMode === 'automatic'
            ? classicQualityCount(p)
            : p.qualitySessions,
      })
    : [];
  const hardDays =
    p.intent === 'finish' || p.goal === 'base'
      ? []
      : qualitySchedule({
          ...p,
          days: scheduled,
          qualitySessions:
            p.qualityMode === 'automatic'
              ? classicQualityCount(p)
              : p.qualitySessions,
        });
  return (
    <>
      {section === 'basic' && (
        <>
          <fieldset
            className="frequency-field"
            aria-label="Running days per week"
          >
            <legend className="field-title">
              How many days do you want to run?
            </legend>
            <p className="subtle">
              Easy runs, harder workouts and your long run all count.
            </p>
            <div className="frequency-options">
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={count === n}
                  aria-label={`${n} running days per week`}
                  onClick={() =>
                    onChange({ ...p, runsPerWeek: n, availableDays: available })
                  }
                >
                  <strong>{n}</strong>
                  <span>days</span>
                </button>
              ))}
            </div>
          </fieldset>
          <WorkoutFrequencyField profile={p} onChange={onChange} />
          <details
            className="plan-schedule-picker"
            open={conflict || undefined}
          >
            <summary>
              <span>
                <strong>Your running week</strong>
                <small>
                  {count} runs · {dayNames[p.longDay]}{' '}
                  {count === 2 ? 'anchor' : 'long run'}
                </small>
              </span>
              <ChevronDown size={18} />
            </summary>
            <div className="plan-options-body">
              <fieldset>
                <legend className="field-title">
                  Which days work for you?
                </legend>
                <p className="subtle">
                  Pick the days that work for you. We’ll use {count} of them.
                </p>
                <div className="availability">
                  {dayNames.map((day, i) => (
                    <button
                      type="button"
                      key={day}
                      className={available.includes(i) ? 'selected' : ''}
                      aria-pressed={available.includes(i)}
                      onClick={() => {
                        const days = available.includes(i)
                          ? available.filter((d) => d !== i)
                          : [...available, i].sort((a, b) => a - b);
                        onChange({
                          ...p,
                          availableDays: days,
                          runsPerWeek: count,
                          longDay: days.includes(p.longDay)
                            ? p.longDay
                            : (days.at(-1) ?? p.longDay),
                        });
                      }}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="subtle" aria-live="polite">
                  {available.length} available · {count} running days chosen ·{' '}
                  {Number.isFinite(p.currentRuns)
                    ? `${p.currentRuns} in your recent routine.`
                    : 'Enter your recent routine first.'}
                  {scheduled.length > 0 &&
                    ` Suggested: ${scheduled.map((d) => dayNames[d].slice(0, 3)).join(', ')}.`}
                </p>
                {conflict && (
                  <div className="schedule-guidance">
                    <p>
                      {reservedConflict
                        ? 'Your long run or paired running day overlaps cross-training. Move the supporting activity to another day.'
                        : count > effectiveAvailable.length
                          ? `Choose at least ${count} available running days after reserving cross-training, or fewer runs per week.`
                          : `This block supports ${range.min}–${range.max} runs per week from your recent routine. Availability can still include all seven days.`}
                    </p>
                    {!reservedConflict &&
                      recommended >= range.min &&
                      effectiveAvailable.length >= recommended && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            onChange({
                              ...p,
                              availableDays: available,
                              runsPerWeek: recommended,
                            })
                          }
                        >
                          Use {recommended} runs per week
                        </button>
                      )}
                    {onReviewRoutine && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={onReviewRoutine}
                      >
                        Review my recent routine
                      </button>
                    )}
                  </div>
                )}
              </fieldset>
              <Field
                label={count === 2 ? 'Preferred anchor day' : 'Long-run day'}
                hint={
                  count === 2
                    ? 'One of your two easy runs will fall on this day. Two-run weeks do not have a separate long run.'
                    : undefined
                }
              >
                <Choice
                  label={count === 2 ? 'Preferred anchor day' : 'Long-run day'}
                  value={String(p.longDay)}
                  onChange={(v) => update('longDay', Number(v))}
                  options={available.map((d) => ({
                    value: String(d),
                    label: dayNames[d],
                  }))}
                />
              </Field>
            </div>
          </details>
        </>
      )}
      {section === 'preview' && (
        <>
          {scheduled.length > 0 && (
            <TrainingPattern
              profile={{
                ...p,
                days: scheduled,
                qualitySessions:
                  p.qualityMode === 'automatic'
                    ? classicQualityCount(p)
                    : p.qualitySessions,
              }}
              heading="Your weekly rhythm"
            />
          )}
        </>
      )}
      {section === 'advanced' && (
        <>
          {['easy-doubles', 'double-threshold'].includes(p.method ?? '') && (
            <div className="schedule-guidance">
              <p>
                Your saved method includes two runs on selected days. Running
                days and individual sessions are counted separately.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  onChange({
                    ...p,
                    method: 'balanced',
                    doubleDays: [],
                  })
                }
              >
                Use one run per day
              </button>
            </div>
          )}
          <p className="subtle">
            Time you can usually spare. Suggestions allow for your recent
            routine and longer outings later in race preparation. Confirm how
            much time you can actually spare. A ceiling is not a session target.
          </p>
          <div className="form-grid">
            <Field label="Weekday limit (minutes)">
              <NumericInput
                name="weekdayMinutes"
                value={p.weekdayMinutes}
                min={20}
                max={120}
                required
                onValueChange={(v) => update('weekdayMinutes', v ?? NaN)}
              />
            </Field>
            <Field label="Long-run limit (minutes)">
              <NumericInput
                name="longMinutes"
                value={p.longMinutes}
                min={30}
                max={300}
                required
                onValueChange={(v) => update('longMinutes', v ?? NaN)}
              />
            </Field>
          </div>
          {count > 2 && p.longestKm * (p.easyPace ?? 7) > p.longMinutes + 1 && (
            <p className="notice">
              Your recent long run takes about{' '}
              {Math.round(p.longestKm * (p.easyPace ?? 7))} minutes at{' '}
              {p.easyPace
                ? 'your supplied easy pace'
                : 'the scheduling estimate'}
              . This {p.longMinutes}-minute ceiling will shorten it. Increase
              the limit if that is not intended.
            </p>
          )}
          <ScheduleCustomizationFields profile={p} onChange={onChange} />
          <details className="reason-details advanced-preferences">
            <summary>Shape your week</summary>
            <fieldset>
              <legend className="field-title">Preferred workout days</legend>
              <p className="subtle">
                Choose up to two preferences. Recovery spacing and your long run
                take priority; this does not add hard sessions.
              </p>
              <div className="availability">
                {dayNames.map((day, i) => (
                  <button
                    type="button"
                    key={day}
                    aria-pressed={p.preferredHardDays?.includes(i) ?? false}
                    className={
                      p.preferredHardDays?.includes(i) ? 'selected' : ''
                    }
                    disabled={
                      !p.preferredHardDays?.includes(i) &&
                      (p.preferredHardDays?.length ?? 0) >= 2
                    }
                    onClick={() =>
                      update(
                        'preferredHardDays',
                        p.preferredHardDays?.includes(i)
                          ? p.preferredHardDays.filter((d) => d !== i)
                          : [...(p.preferredHardDays ?? []), i].sort(
                              (a, b) => a - b,
                            ),
                      )
                    }
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              <p className="subtle" aria-live="polite">
                {conflict
                  ? 'Resolve the scheduling conflict above to see available workout days.'
                  : hardDays.length
                    ? `Available quality slots: ${hardDays.map((d) => dayNames[d]).join(', ')}.`
                    : 'Easy endurance and any relaxed strides follow your training intention; no separate hard session is requested.'}
                {(p.preferredHardDays ?? []).some(
                  (d) => !hardDays.includes(d),
                ) &&
                  ' Some preferences cannot fit the requested frequency, available days or recovery spacing.'}
              </p>
            </fieldset>
            <fieldset>
              <legend className="field-title">Cross-training days</legend>
              <p className="subtle">
                Reserve these days without running. Keep the activity easy or
                familiar; its minutes are separate from running load. Recovery
                and taper weeks contain less supporting work.
              </p>
              {(p.crossTraining ?? []).map((s, i) => (
                <div className="supporting-session-fields" key={i}>
                  <Field label={`Cross-training day ${i + 1}`}>
                    <Choice
                      label={`Cross-training day ${i + 1}`}
                      value={String(s.day)}
                      onChange={(v) =>
                        update(
                          'crossTraining',
                          p.crossTraining!.map((x, n) =>
                            n === i ? { ...x, day: Number(v) } : x,
                          ),
                        )
                      }
                      options={dayNames.map((label, d) => ({
                        value: String(d),
                        label,
                      }))}
                    />
                  </Field>
                  <Field label={`Activity ${i + 1}`}>
                    <Choice
                      label={`Activity ${i + 1}`}
                      value={s.activity}
                      onChange={(v) =>
                        update(
                          'crossTraining',
                          p.crossTraining!.map((x, n) =>
                            n === i
                              ? { ...x, activity: v as typeof s.activity }
                              : x,
                          ),
                        )
                      }
                      options={[
                        { value: 'cycling', label: 'Easy cycling' },
                        { value: 'swimming', label: 'Easy swimming' },
                        {
                          value: 'strength',
                          label: 'Familiar strength routine',
                        },
                        { value: 'mobility', label: 'Gentle mobility' },
                      ]}
                    />
                  </Field>
                  <Field label={`Cross-training minutes ${i + 1}`}>
                    <NumericInput
                      name={`crossTrainingMinutes${i}`}
                      value={s.minutes}
                      min={10}
                      max={60}
                      integer
                      required
                      onValueChange={(v) =>
                        update(
                          'crossTraining',
                          p.crossTraining!.map((x, n) =>
                            n === i ? { ...x, minutes: v ?? NaN } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      update(
                        'crossTraining',
                        p.crossTraining!.filter((_, n) => n !== i),
                      )
                    }
                  >
                    Remove activity {i + 1}
                  </button>
                </div>
              ))}
              {(p.crossTraining?.length ?? 0) < 3 && (
                <button
                  type="button"
                  className="secondary-button small-button"
                  onClick={() => {
                    const options = dayNames
                      .map((_, d) => d)
                      .filter(
                        (d) =>
                          d !== p.longDay &&
                          !p.doubleDays?.includes(d) &&
                          !p.crossTraining?.some((s) => s.day === d),
                      );
                    const day =
                      options.find((d) => !scheduled.includes(d)) ?? options[0];
                    if (day !== undefined)
                      update('crossTraining', [
                        ...(p.crossTraining ?? []),
                        { day, activity: 'cycling', minutes: 30 },
                      ]);
                  }}
                >
                  Add cross-training day
                </button>
              )}
              {available.filter(
                (d) => !p.crossTraining?.some((s) => s.day === d),
              ).length < count && (
                <p className="notice">
                  There are not enough running days after reserving
                  cross-training. Add availability, remove an activity or reduce
                  your runs per week.
                </p>
              )}
            </fieldset>
          </details>{' '}
        </>
      )}
    </>
  );
}
export function TrainingPreferenceFields({
  profile: p,
  onChange,
  allowRunMeasure = false,
}: {
  profile: Profile;
  allowRunMeasure?: boolean;
  onChange: (p: Profile) => void;
}) {
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...p, [key]: value });
  const cap = (
    key: 'easyLimitKm' | 'qualityLimitKm' | 'longLimitKm' | 'peakWeeklyKm',
    label: string,
  ) => (
    <Field
      label={`${label} (${p.units})`}
      hint="Optional ceiling, not a target."
    >
      <NumericInput
        name={key}
        value={p[key]}
        min={1}
        max={150}
        factor={p.units === 'mi' ? MILE_KM : 1}
        placeholder="Use the plan’s limit"
        onValueChange={(v) => update(key, v)}
      />
    </Field>
  );
  return (
    <>
      <Field label="Your intention">
        <Choice
          label="Your intention"
          value={p.intent ?? 'improve'}
          onChange={(v) => update('intent', v as Profile['intent'])}
          options={[
            {
              value: 'improve',
              label: 'Improve my performance',
            },
            {
              value: 'finish',
              label: 'Finish comfortably',
            },
          ]}
        />
      </Field>
      <div className="form-grid">
        <Field label="Training volume">
          <Choice
            label="Training volume"
            value={p.volume}
            onChange={(v) => update('volume', v as Profile['volume'])}
            options={[
              { value: 'gradual', label: 'Build gradually' },
              { value: 'maintain', label: 'Maintain my volume' },
            ]}
          />
        </Field>
      </div>
      <Field label="Harder workouts you already do each week">
        <Choice
          label="Harder workouts you already do each week"
          value={
            p.recentQualitySessions == null
              ? 'unknown'
              : String(p.recentQualitySessions)
          }
          onChange={(v) =>
            update(
              'recentQualitySessions',
              v === 'unknown' ? null : (Number(v) as 0 | 1 | 2),
            )
          }
          options={[
            { value: 'unknown', label: 'Not sure' },
            { value: '0', label: 'None yet' },
            { value: '1', label: 'One' },
            { value: '2', label: 'Two' },
          ]}
        />
      </Field>
      {(!p.method || p.method === 'balanced') &&
        (p.recentQualitySessions ?? 0) > 0 && (
          <Field
            label="Recent quality work minutes per week"
            hint="Optional. Total tempo or interval work, excluding warm-up and easy recoveries. This helps set your opening workouts."
          >
            <NumericInput
              name="recentQualityMinutes"
              value={p.recentQualityMinutes}
              min={0}
              max={300}
              integer
              placeholder="Not sure"
              onValueChange={(v) => update('recentQualityMinutes', v)}
            />
          </Field>
        )}
      <WorkoutCustomizationFields
        profile={p}
        onChange={onChange}
        allowRunMeasure={allowRunMeasure}
      />
      <details className="reason-details advanced-preferences">
        <summary>Advanced training controls</summary>
        <div className="form-section section-space">
          <Field
            label="Tolerated carbohydrate intake (g/hour)"
            hint="Optional. An amount you already tolerate on long outings, not a recommended target. Leaving it blank gives general fueling practice cues."
          >
            <NumericInput
              name="carbsPerHour"
              value={p.carbsPerHour}
              min={15}
              max={120}
              placeholder="Not established"
              onValueChange={(v) => update('carbsPerHour', v)}
            />
          </Field>
          <Field
            label="Equipment practice in darkness"
            hint="Optional 15–20 minutes within selected easy runs near dusk. No added mileage or sleep deprivation."
          >
            <Choice
              label="Equipment practice in darkness"
              value={p.practiceInDark ? 'yes' : 'no'}
              onChange={(v) => update('practiceInDark', v === 'yes')}
              options={[
                { value: 'no', label: 'No darkness practice' },
                { value: 'yes', label: 'Include short headlamp practice' },
              ]}
            />
          </Field>
        </div>
        {trainingFamily(p) === 'marathon' && (
          <Field label="Marathon structure">
            <Choice
              label="Marathon structure"
              value={p.marathonApproach ?? 'balanced'}
              onChange={(v) =>
                update('marathonApproach', v as Profile['marathonApproach'])
              }
              options={[
                {
                  value: 'balanced',
                  label: 'Endurance, tempo & race preparation',
                },
                {
                  value: 'endurance',
                  label: 'Endurance & tempo · less speed work',
                },
              ]}
            />
            <p className="subtle">
              Marathon plans prioritise long and midweek endurance, sustained
              tempo and selected marathon-pace long runs. The second option
              keeps tempo in place of later faster intervals. It requires five
              established running days and 50 km/week; it adds no mileage.
            </p>
          </Field>
        )}
        <div className="form-section section-space">
          <Field label="Training method">
            <Choice
              label="Training method"
              value={p.method ?? 'balanced'}
              onChange={(v) =>
                onChange({
                  ...p,
                  method: v as Profile['method'],
                  ...(v === 'double-threshold'
                    ? { volume: 'maintain', qualitySessions: 1 }
                    : {}),
                })
              }
              options={
                isLongUltra(p)
                  ? [
                      {
                        value: 'balanced',
                        label: 'Ultra endurance · single runs',
                      },
                    ]
                  : [
                      {
                        value: 'balanced',
                        label: 'Balanced, race-specific training',
                      },
                      {
                        value: 'threshold-singles',
                        label: 'Threshold-focused singles',
                      },
                      {
                        value: 'easy-doubles',
                        label: 'Easy doubles — split existing volume',
                      },
                      {
                        value: 'double-threshold',
                        label: 'Norwegian-inspired double threshold',
                      },
                    ]
              }
            />
          </Field>
          {p.method && p.method !== 'balanced' && (
            <div className="advanced-method-inputs form-section">
              <p className="subtle">
                These methods use your recent training history, not an
                “advanced” label. Paired work redistributes existing volume. The
                first double-threshold policy allows one paired day each week.
              </p>
              <div className="form-grid">
                <Field label="Weeks at a stable recent routine">
                  <NumericInput
                    name="stableWeeks"
                    value={p.stableWeeks}
                    min={0}
                    max={520}
                    required
                    integer
                    onValueChange={(v) => update('stableWeeks', v ?? NaN)}
                  />
                </Field>
                <Field label="Recent running sessions per week">
                  <NumericInput
                    name="recentSessionsPerWeek"
                    value={p.recentSessionsPerWeek}
                    min={0}
                    max={14}
                    required
                    integer
                    onValueChange={(v) =>
                      update('recentSessionsPerWeek', v ?? NaN)
                    }
                  />
                </Field>
                <Field
                  label="Recent quality work minutes per week"
                  hint="Work repetitions only; warm-up and recoveries are separate."
                >
                  <NumericInput
                    name="recentQualityMinutes"
                    value={p.recentQualityMinutes}
                    min={0}
                    max={300}
                    required
                    onValueChange={(v) =>
                      update('recentQualityMinutes', v ?? NaN)
                    }
                  />
                </Field>
                <Field label="Weeks of easy-double experience">
                  <NumericInput
                    name="easyDoubleWeeks"
                    value={p.easyDoubleWeeks}
                    min={0}
                    max={520}
                    integer
                    onValueChange={(v) => update('easyDoubleWeeks', v)}
                  />
                </Field>
              </div>
              {p.method !== 'threshold-singles' && (
                <>
                  <Field label="Paired-session day">
                    <Choice
                      label="Paired-session day"
                      value={
                        p.doubleDays?.length ? String(p.doubleDays[0]) : ''
                      }
                      onChange={(v) => update('doubleDays', [Number(v)])}
                      options={p.days
                        .filter((d) => d !== p.longDay)
                        .map((d) => ({ value: String(d), label: dayNames[d] }))}
                    />
                  </Field>
                  <Field
                    label="Recovery after the morning run (hours)"
                    hint="Morning start is 07:00. Evening time includes the morning duration plus this recovery gap."
                  >
                    <NumericInput
                      name="doubleGapHours"
                      value={p.doubleGapHours ?? 8}
                      min={6}
                      max={12}
                      onValueChange={(v) => update('doubleGapHours', v)}
                    />
                  </Field>
                </>
              )}
              {p.method === 'double-threshold' && (
                <>
                  <Field label="Individual threshold control">
                    <Choice
                      label="Individual threshold control"
                      value={p.thresholdControl ?? 'effort'}
                      onChange={(v) =>
                        onChange({
                          ...p,
                          thresholdControl: v as Profile['thresholdControl'],
                          thresholdCeiling: undefined,
                        })
                      }
                      options={[
                        {
                          value: 'effort',
                          label:
                            'Not established — double threshold unavailable',
                        },
                        {
                          value: 'heart-rate',
                          label: 'Individually established heart-rate ceiling',
                        },
                        { value: 'lactate', label: 'Measured lactate ceiling' },
                      ]}
                    />
                  </Field>
                  <Field
                    label={
                      p.thresholdControl === 'lactate'
                        ? 'Your measured lactate ceiling (mmol/L)'
                        : 'Your established heart-rate ceiling (bpm)'
                    }
                    hint="Use an individually established value. The app does not derive this from age or a population average."
                  >
                    <NumericInput
                      name="thresholdCeiling"
                      value={p.thresholdCeiling}
                      min={0}
                      max={250}
                      required
                      onValueChange={(v) =>
                        update('thresholdCeiling', v ?? NaN)
                      }
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <div className="form-grid">
            <Field label="Recovery rhythm">
              <Choice
                label="Recovery rhythm"
                value={String(p.recoveryWeeks ?? 4)}
                onChange={(v) => update('recoveryWeeks', Number(v) as 3 | 4)}
                options={[
                  { value: '4', label: 'Lighter every fourth week' },
                  { value: '3', label: 'Lighter every third week' },
                ]}
              />
            </Field>
            <Field
              label="Terrain available for alternatives"
              hint="Automatic workouts use level routes. Hills enable suitable substitutions in More actions; they do not change every automatic session."
            >
              <Choice
                label="Terrain available for alternatives"
                value={p.terrain ?? 'flat'}
                onChange={(v) => update('terrain', v as Profile['terrain'])}
                options={[
                  { value: 'flat', label: 'Flat routes or treadmill' },
                  {
                    value: 'hills',
                    label: 'Hill routes available for suitable alternatives',
                  },
                ]}
              />
            </Field>
          </div>
          <div className="form-grid">
            {cap('easyLimitKm', 'Easy-session maximum')}
            {cap('qualityLimitKm', 'Quality-session maximum')}
            {cap('longLimitKm', 'Long-run maximum')}
            {cap('peakWeeklyKm', 'Peak-week maximum')}
          </div>
          <p className="subtle">
            Quality-session limits include warm-up and recovery. Limits may make
            a race block infeasible; the preview will explain which constraint
            needs attention.
          </p>
        </div>
      </details>
    </>
  );
}
