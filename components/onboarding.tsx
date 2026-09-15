'use client';
import { RecentRaceFields } from './recent-race-fields';
import { UltraDistanceChoices, UltraRoutineFields } from './ultra-fields';
import { TrainingPattern } from './training-pattern';
import { BusyButton } from './action-progress';
import { runDuration } from '@/lib/journal-view';
import { useState, useEffect, useRef } from 'react';
import {
  NumericInput,
  NumericDraftContext,
  type NumericDraft,
} from './numeric-input';
import {
  MILE_KM,
  trainingDay,
  reconcileStartDate,
  validTimezone,
} from '@/lib/form-values';
import { ArrowRight, ArrowLeft, Check, Flag, CalendarDays } from 'lucide-react';
import RacePicker from './race-picker';
import { PlanFit } from './plan-fit';
import { WeekRhythm } from './week-rhythm';
import {
  suggestedSessionLimits,
  longRunShareLimit,
} from '@/lib/training-structure';
import { TRAINING_POLICY, trainingFamily } from '@/lib/engine';
import { PlanCustomizationFields } from './training-controls';
import { runningDayRange } from '@/lib/schedule-guidance';
import { availableRunningDays, desiredRuns } from '@/lib/training-structure';
import { Modal, Field, Choice, api } from './stride-ui';
import {
  addDays,
  validDate,
  dateLabel,
  dayDiff,
  goalLabel,
  trainingPhaseOn,
  type Plan,
  type Profile,
  preparationRequirements,
  MAX_EVENT_KM,
} from '@/lib/engine';
export default function Onboarding({
  open,
  onClose,
  onActivate,
  existing,
  defaults,
  draftScope,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onActivate: (plan: Plan, requestId: string, version: number) => Promise<void>;
  existing?: Profile;
  defaults?: Partial<Pick<Profile, 'name' | 'units' | 'timezone'>>;
  draftScope: string;
  busy: boolean;
}) {
  // Activation changes the active plan before this dialog closes. Keep its
  // draft attached to the plan it was opened for throughout that transition.
  const [storageKey] = useState(() => `stride-onboarding:${draftScope}`);
  const [initial] = useState(() => {
    const timezone =
      defaults?.timezone ||
      existing?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC';
    const profile: Profile = existing
      ? {
          ...existing,
          availableDays: existing.availableDays ?? [...existing.days],
          runsPerWeek: existing.runsPerWeek ?? existing.days.length,
          ...defaults,
          timezone,
        }
      : {
          name: '',
          goal: '10k',
          raceName: '',
          raceDate: '',
          startDate: trainingDay(timezone),
          weeklyKm: NaN,
          longestKm: NaN,
          currentRuns: NaN,
          days: [0, 2, 4, 6],
          availableDays: [0, 1, 2, 3, 4, 5, 6],
          runsPerWeek: 4,
          qualityMode: 'automatic',
          longDay: 5,
          weekdayMinutes: 120,
          longMinutes: 300,
          experience: 'established',
          difficulty: 'balanced',
          volume: 'gradual',
          runMeasure: 'distance',
          timezone,
          units: 'km',
          easyPace: null,
          ...defaults,
        };
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (
        saved?.profile &&
        Array.isArray(saved.profile.days) &&
        saved.profile.days.every(
          (d: unknown) =>
            Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 6,
        ) &&
        ['5k', '10k', 'half', 'marathon', 'ultra', 'custom', 'base'].includes(
          saved.profile.goal,
        ) &&
        ['km', 'mi'].includes(saved.profile.units) &&
        validTimezone(saved.profile.timezone) &&
        Number.isInteger(saved.step) &&
        saved.step >= 0 &&
        Number.isFinite(saved.savedAt) &&
        Date.now() >= saved.savedAt &&
        Date.now() - saved.savedAt < 30 * 86400000
      )
        return {
          profile: {
            ...saved.profile,
            availableDays: saved.profile.availableDays ?? [
              ...saved.profile.days,
            ],
            runsPerWeek: saved.profile.runsPerWeek ?? saved.profile.days.length,
            startDate: validDate(saved.profile.startDate)
              ? saved.profile.startDate
              : trainingDay(saved.profile.timezone),
            raceDate: validDate(saved.profile.raceDate)
              ? saved.profile.raceDate
              : '',
          } as Profile,
          raw: saved.raw || {},
          resumed: true,
          step: Math.min(2, saved.step || 0),
          scheduleTouched: saved.scheduleTouched ?? saved.step >= 2,
        };
    } catch {}
    return {
      profile,
      raw: {},
      resumed: false,
      step: 0,
      scheduleTouched: !!existing,
    };
  });
  const [step, setStep] = useState(initial.step),
    [p, setP] = useState<Profile>(initial.profile);
  const [raw, setRaw] = useState<Record<string, NumericDraft>>(initial.raw);
  const [scheduleTouched, setScheduleTouched] = useState(
    initial.scheduleTouched,
  );
  const [previewWeek, setPreviewWeek] = useState(0);
  const [preview, setPreview] = useState<Plan | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(
      initial.resumed
        ? 'Your draft is restored. Review the dates before continuing.'
        : '',
    ),
    [loading, setLoading] = useState(false);
  const form = useRef<HTMLFormElement>(null),
    inFlight = useRef(false),
    generation = useRef(0);
  const activationId = useRef(crypto.randomUUID());
  const previewVersion = useRef<number | null>(null);
  const previewDay = useRef(''),
    activationInFlight = useRef(false),
    finished = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (finished.current || !draftScope) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          profile: p,
          raw,
          step: Math.min(step, 2),
          scheduleTouched,
          savedAt: Date.now(),
        }),
      );
    } catch {}
  }, [p, raw, step, storageKey, draftScope, scheduleTouched]);
  useEffect(() => {
    const tick = () => {
      if (!validTimezone(p.timezone)) return;
      const result = reconcileStartDate(p.startDate, p.timezone);
      if (preview && previewDay.current !== result.today) {
        generation.current++;
        setPreview(null);
        setStep(0);
        setNotice(
          `A new training day has started in ${p.timezone}. Your other entries are kept; review the dates and preview again.`,
        );
      }
    };
    tick();
    const interval = setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [p.timezone, p.startDate, preview]);
  useEffect(() => {
    document
      .querySelector<HTMLElement>('[role="dialog"] .modal-title')
      ?.focus();
  }, [step]);
  useEffect(() => {
    if (error && !form.current?.contains(document.activeElement))
      form.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [error, loading]);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));
  function checkFields() {
    const controls = Array.from(
      form.current?.querySelectorAll<HTMLInputElement>(
        'input,select,textarea',
      ) || [],
    );
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      let parent = invalid.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      const label =
        invalid.getAttribute('aria-label') ||
        invalid.closest('label')?.querySelector('span')?.textContent ||
        'Entry';
      void api('/api/measurement', {
        method: 'POST',
        body: JSON.stringify({ event: 'field-invalid' }),
      }).catch(() => {});
      setError(`${label}: ${invalid.validationMessage}`);
      invalid.focus();
      return false;
    }
    return true;
  }
  async function next() {
    if (inFlight.current) return;
    setError('');
    if (!checkFields()) return;
    if (step === 0) {
      if (!validTimezone(p.timezone)) {
        setError(
          'Training timezone: choose a valid timezone such as Europe/Vilnius.',
        );
        form.current
          ?.querySelector<HTMLInputElement>('[name="timezone"]')
          ?.focus();
        return;
      }
      if (!p.raceDate || p.raceDate < p.startDate) {
        setError('Choose a finish date on or after your start date.');
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (![p.weeklyKm, p.longestKm, p.currentRuns].every(Number.isFinite)) {
        setError(
          'Enter your recent weekly distance, longest run and running frequency.',
        );
        return;
      }
      if (p.longestKm > p.weeklyKm && p.weeklyKm > 0) {
        setError(
          'Longest run exceeds your typical weekly total. Review these recent inputs.',
        );
        return;
      }
      const limits = suggestedSessionLimits(
        p,
        p.goal === 'base'
          ? p.longestKm
          : TRAINING_POLICY.family[trainingFamily(p)].longCeilingKm,
        scheduleTouched ? desiredRuns(p) : Math.max(2, p.currentRuns),
        longRunShareLimit(p),
      );
      let next = {
        ...p,
        weekdayMinutes: Number.isFinite(p.weekdayMinutes)
          ? p.weekdayMinutes
          : limits.weekdayMinutes,
        longMinutes: Number.isFinite(p.longMinutes)
          ? p.longMinutes
          : limits.longMinutes,
      };
      if (!scheduleTouched) {
        const range = runningDayRange(p);
        const recommended = Math.min(
          range.max,
          Math.max(range.min, p.currentRuns || 2),
        );
        next = { ...next, runsPerWeek: recommended };
        setNotice(
          `We suggested ${recommended} runs per week from your recent routine. Choose how often you want to run, then every day you could run.`,
        );
      }
      setP(next);
      setStep(2);
    } else {
      const range = runningDayRange(p);
      if (
        desiredRuns(p) < range.min ||
        desiredRuns(p) > range.max ||
        desiredRuns(p) > availableRunningDays(p).length
      ) {
        setError(
          range.max >= range.min
            ? `You requested ${desiredRuns(p)} runs. Choose ${range.min === range.max ? range.min : `${range.min}–${range.max}`} runs per week and at least that many available days, or review your recent routine.`
            : 'This goal and recent routine do not have a compatible schedule yet. Review your recent routine and goal before building.',
        );
        form.current
          ?.querySelector<HTMLElement>('.schedule-guidance')
          ?.scrollIntoView({ block: 'center' });
        return;
      }
      inFlight.current = true;
      setLoading(true);
      const request = ++generation.current;
      try {
        const r = await api<{ plan: Plan; version: number }>('/api/plan', {
          method: 'POST',
          body: JSON.stringify({
            action: 'preview',
            profile: { ...p, workoutVariety: 'varied' },
          }),
        });
        if (generation.current !== request) return;
        activationId.current = crypto.randomUUID();
        setPreview(r.plan);
        previewVersion.current = r.version;
        previewDay.current = trainingDay(p.timezone);
        setStep(3);
      } catch (e) {
        if (generation.current === request) setError((e as Error).message);
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }
  const distanceInput = (key: 'weeklyKm' | 'longestKm') => (
    <NumericInput
      name={key}
      label={
        key === 'weeklyKm'
          ? `Weekly distance (${p.units})`
          : `Longest run (${p.units})`
      }
      value={p[key]}
      onValueChange={(v) => update(key, v ?? NaN)}
      factor={p.units === 'mi' ? MILE_KM : 1}
      min={0}
      max={
        key === 'weeklyKm'
          ? p.goal === 'marathon' && (!p.method || p.method === 'balanced')
            ? 150
            : 120
          : 45
      }
      required
      placeholder={key === 'weeklyKm' ? 'e.g. 30' : 'e.g. 10'}
    />
  );
  const previewWeeks =
    preview?.weeks.map((week) => {
      const start =
        week.start < preview.profile.startDate
          ? preview.profile.startDate
          : week.start;
      const phase = trainingPhaseOn(preview.profile, week.phase, start);
      const days = Math.max(0, dayDiff(start, preview.profile.raceDate));
      const weeks = Math.ceil(days / 7);
      const countdown =
        days === 0
          ? 'Race day'
          : days < 7
            ? `${days} ${days === 1 ? 'day' : 'days'} to race`
            : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} to race`;
      return { start, phase, countdown };
    }) ?? [];
  const previewIndex = Math.min(previewWeek, previewWeeks.length - 1);
  const previewContext = previewWeeks[previewIndex];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        step === 3
          ? 'Meet your next training block'
          : step === 0
            ? 'What are you running towards?'
            : step === 1
              ? 'Start from where you are'
              : 'Make it fit your week'
      }
      description={
        step === 3
          ? 'Check the weekly time, longest runs and workout balance before you commit.'
          : `${existing ? 'RESTART PLAN' : 'YOUR PLAN'} · ${step + 1} OF 3`
      }
      wide
      locked={loading || busy}
    >
      <div className="onboarding-progress">
        {[0, 1, 2, 3].map((n) => (
          <i key={n} className={n <= step ? 'active' : ''} />
        ))}
      </div>
      {notice && <output className="notice">{notice}</output>}
      <p className="subtle">
        {existing && step === 0
          ? 'Change any of your inputs. Your current plan stays active until you review and confirm the replacement.'
          : 'Your draft stays in this tab when you close.'}
      </p>
      <NumericDraftContext.Provider
        value={{
          values: raw,
          set: (name, text) =>
            setRaw((v) => (v[name] === text ? v : { ...v, [name]: text })),
        }}
      >
        <form
          ref={form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) void next();
          }}
        >
          <fieldset disabled={loading || busy} className="form-content">
            {step === 0 && (
              <div className="form-section">
                <RacePicker profile={p} onChange={setP} />
                <fieldset
                  className="goal-options expanded-goals"
                  aria-label="Training goal"
                >
                  {(
                    [
                      '5k',
                      '10k',
                      'half',
                      'marathon',
                      'ultra',
                      'custom',
                      'base',
                    ] as const
                  ).map((goal) => (
                    <button
                      type="button"
                      key={goal}
                      aria-pressed={p.goal === goal}
                      className={`goal-option ${p.goal === goal ? 'selected' : ''}`}
                      onClick={() => {
                        if (p.goal === goal) return;
                        setP((prev) => ({
                          ...prev,
                          goal,
                          raceDistanceKm:
                            goal === 'ultra'
                              ? 50
                              : goal === 'custom'
                                ? 15
                                : undefined,
                          qualitySessions: goal === 'base' ? 0 : 1,
                          longMinutes:
                            goal === 'ultra'
                              ? 240
                              : goal === 'marathon'
                                ? 180
                                : goal === 'half'
                                  ? 120
                                  : 100,
                        }));
                        if (goal === 'base' && !p.raceDate)
                          update(
                            'raceDate',
                            addDays(
                              validDate(p.startDate)
                                ? p.startDate
                                : trainingDay(p.timezone),
                              55,
                            ),
                          );
                      }}
                    >
                      <span>
                        {
                          {
                            base: 'Base',
                            '5k': '5K',
                            '10k': '10K',
                            half: 'Half',
                            marathon: 'Marathon',
                            ultra: 'Ultra',
                            custom: 'Custom',
                          }[goal]
                        }
                      </span>
                      <small>
                        {
                          {
                            base: 'Find your rhythm',
                            '5k': 'Quick & purposeful',
                            '10k': 'Stronger for longer',
                            half: '21.1 km',
                            marathon: '42.2 km',
                            ultra: '50 km–100 miles',
                            custom: 'Your distance',
                          }[goal]
                        }
                      </small>
                      {p.goal === goal && <Check size={16} />}
                    </button>
                  ))}
                </fieldset>
                {p.goal === 'ultra' && (
                  <UltraDistanceChoices profile={p} onChange={setP} />
                )}
                {['ultra', 'custom'].includes(p.goal) && (
                  <Field
                    label={`Race distance (${p.units})`}
                    hint={
                      p.goal === 'ultra'
                        ? 'Above a marathon, up to 100 miles.'
                        : 'Any distance from 1 km to 100 miles.'
                    }
                  >
                    <NumericInput
                      name="raceDistanceKm"
                      label={`Race distance (${p.units})`}
                      value={p.raceDistanceKm}
                      onValueChange={(v) => update('raceDistanceKm', v ?? NaN)}
                      factor={p.units === 'mi' ? MILE_KM : 1}
                      required
                      min={p.goal === 'ultra' ? 42.1951 : 1}
                      max={MAX_EVENT_KM}
                    />
                  </Field>
                )}
                {p.goal !== 'base' && (
                  <Field label="Race course">
                    <Choice
                      label="Race course"
                      value={p.raceTerrain ?? 'road'}
                      onChange={(v) =>
                        update('raceTerrain', v as Profile['raceTerrain'])
                      }
                      options={[
                        {
                          value: 'road',
                          label: 'Road or flat runnable course',
                        },
                        { value: 'rolling', label: 'Runnable rolling terrain' },
                        {
                          value: 'mountain',
                          label: 'Technical or mountainous — not supported yet',
                        },
                      ]}
                    />
                  </Field>
                )}

                <Field label="Your name (optional)">
                  <input
                    value={p.name}
                    maxLength={60}
                    onInput={(e) => update('name', e.currentTarget.value)}
                    placeholder="What should we call you?"
                  />
                </Field>
                <Field
                  label={
                    p.goal === 'base'
                      ? 'Block name (optional)'
                      : 'Race name (optional)'
                  }
                >
                  <input
                    value={p.raceName}
                    maxLength={100}
                    onInput={(e) => update('raceName', e.currentTarget.value)}
                    placeholder={
                      p.goal === 'base' ? 'A fresh start' : 'e.g. Autumn 10K'
                    }
                  />
                </Field>
                <Field
                  label="Your training timezone"
                  hint="Dates follow this timezone even when you travel; change it deliberately in your profile."
                >
                  <input
                    required
                    name="timezone"
                    value={p.timezone}
                    onInput={(e) => update('timezone', e.currentTarget.value)}
                  />
                </Field>
                <div className="form-grid">
                  <Field
                    label="Start date"
                    hint="Any valid date, including an earlier start. Past sessions are not marked completed or added as catch-up work."
                  >
                    <input
                      required
                      type="date"
                      name="startDate"
                      value={p.startDate}
                      onInput={(e) =>
                        update('startDate', e.currentTarget.value)
                      }
                    />
                  </Field>
                  <Field
                    label={
                      p.goal === 'base' ? 'Block finish date' : 'Race date'
                    }
                  >
                    <input
                      required
                      type="date"
                      name="raceDate"
                      min={p.startDate || undefined}
                      value={p.raceDate}
                      onInput={(e) => update('raceDate', e.currentTarget.value)}
                    />
                  </Field>
                </div>
                {['custom', 'ultra'].includes(p.goal) && (
                  <p className="notice">
                    Preparation band: {preparationRequirements(p).band}. Recent
                    baseline: {preparationRequirements(p).minWeekly} km/week,{' '}
                    {preparationRequirements(p).minLong} km longest run,{' '}
                    {preparationRequirements(p).minRuns} running days. Baseline
                    mileage varies gradually with your exact distance;
                    running-day requirements are whole-day gates. Review the
                    full plan before activating.
                  </p>
                )}
                <p className="subtle">
                  No minimum plan length. Choose any finish date on or after
                  your start date, up to 52 weeks. Short race blocks keep the
                  taper without squeezing in missed preparation.
                </p>
              </div>
            )}
            {step === 1 && (
              <div className="form-section">
                <Field label="Running background">
                  <Choice
                    label="Running background"
                    value={p.experience}
                    onChange={(v) =>
                      update('experience', v as Profile['experience'])
                    }
                    options={[
                      { value: 'established', label: 'I run consistently' },
                      {
                        value: 'returning',
                        label: 'I am returning after a break',
                      },
                      { value: 'new', label: 'I am new to running' },
                    ]}
                  />
                </Field>
                <Field label="Distance units">
                  <Choice
                    label="Distance units"
                    value={p.units}
                    onChange={(v) => update('units', v as 'km' | 'mi')}
                    options={[
                      { value: 'km', label: 'Kilometres' },
                      { value: 'mi', label: 'Miles' },
                    ]}
                  />
                </Field>
                <div className="form-grid">
                  <Field
                    label={`Weekly distance (${p.units})`}
                    hint="The weekly distance to start from. Use the total you have been running consistently."
                  >
                    {distanceInput('weeklyKm')}
                  </Field>
                  <Field
                    label={`Longest run (${p.units})`}
                    hint="Your starting long-run distance. Use a recent run you could comfortably repeat."
                  >
                    {distanceInput('longestKm')}
                  </Field>
                </div>
                <Field label="Days you currently run per week">
                  <NumericInput
                    name="currentRuns"
                    label="Days you currently run per week"
                    value={p.currentRuns}
                    onValueChange={(v) => update('currentRuns', v ?? NaN)}
                    required
                    integer
                    min={0}
                    max={7}
                    placeholder="e.g. 4"
                  />
                </Field>
                <UltraRoutineFields profile={p} onChange={setP} />
                <RecentRaceFields profile={p} onChange={setP} />
                <Field
                  label={`Easy pace (minutes:seconds/${p.units}, optional)`}
                  hint="Used to estimate distance and the time needed for your recent mileage. Workout targets are set separately. Enter 6:17, not decimal minutes; leave blank if unknown."
                >
                  <NumericInput
                    name="easyPace"
                    label={`Easy pace (minutes:seconds/${p.units}, optional)`}
                    pace
                    value={p.easyPace}
                    onValueChange={(v) => update('easyPace', v)}
                    factor={p.units === 'mi' ? MILE_KM : 1}
                    min={3}
                    max={15}
                    placeholder={p.units === 'mi' ? 'e.g. 9:45' : 'e.g. 6:00'}
                  />
                </Field>
              </div>
            )}
            {step === 2 && (
              <div className="form-section">
                <PlanCustomizationFields
                  profile={p}
                  onChange={(profile) => {
                    setScheduleTouched(true);
                    setError('');
                    setP(profile);
                  }}
                  allowRunMeasure
                  onReviewRoutine={() => {
                    setError('');
                    setStep(1);
                  }}
                />
              </div>
            )}
            {step === 3 && preview && (
              <div className="form-section">
                <div className="preview-summary">
                  <Flag size={24} />
                  <div>
                    <h3>
                      {preview.profile.raceName ||
                        goalLabel(preview.profile.goal)}
                    </h3>
                    <p>
                      {preview.weeks.length} weeks ·{' '}
                      {preview.profile.days.length} running days per week ·{' '}
                      {dateLabel(preview.profile.raceDate)}
                    </p>
                  </div>
                </div>
                {preview.notes.find((note) =>
                  note.startsWith('Short block ·'),
                ) && (
                  <p className="notice">
                    {preview.notes.find((note) =>
                      note.startsWith('Short block ·'),
                    )}
                  </p>
                )}
                <TrainingPattern profile={preview.profile} />
                <button
                  className="text-button preview-edit-schedule"
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setError('');
                  }}
                >
                  Edit running days and preferences
                </button>
                <div className="preview-metrics">
                  {[
                    ['First week', preview.weeks[0]?.targetKm ?? 0],
                    [
                      'Peak week',
                      Math.max(0, ...preview.weeks.map((w) => w.targetKm)),
                    ],
                    [
                      'Longest run',
                      Math.max(0, ...preview.weeks.map((w) => w.longKm)),
                    ],
                  ].map(([label, km]) => (
                    <div key={String(label)}>
                      <span>{label}</span>
                      <strong>
                        {Number(
                          (
                            Number(km) / (p.units === 'mi' ? MILE_KM : 1)
                          ).toFixed(1),
                        )}{' '}
                        <small>{p.units}</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="plan-control-hint">
                  Weekly totals include estimated distance for timed workout
                  steps. Recovery and taper weeks are lighter.
                </p>
                <div className="plan-bars">
                  {preview.weeks.map((w) => (
                    <div
                      key={w.index}
                      title={`Week ${w.index + 1}: ${Math.round(preview.workouts.filter((x) => x.week === w.index && x.kind !== 'race').reduce((n, x) => n + x.minutes, 0))} training min, ${w.phase}`}
                    >
                      <i
                        className={
                          ['Recovery', 'Taper', 'Race week'].includes(w.phase)
                            ? 'recovery'
                            : ''
                        }
                        style={{
                          height: `${((w.trainingMinutes ?? 0) / Math.max(1, ...preview.weeks.map((v) => v.trainingMinutes ?? 0))) * 100}%`,
                        }}
                      />
                      <small>{w.index + 1}</small>
                    </div>
                  ))}
                </div>
                <details className="preview-plan-explanation">
                  <summary>Why these sessions?</summary>
                  <PlanFit
                    plan={preview}
                    asOf={trainingDay(preview.profile.timezone)}
                  />
                </details>
                <Field label="Explore the plan">
                  <Choice
                    label="Preview week"
                    value={String(
                      Math.min(previewWeek, preview.weeks.length - 1),
                    )}
                    onChange={(value) => setPreviewWeek(Number(value))}
                    options={preview.weeks.map((week) => ({
                      value: String(week.index),
                      label:
                        preview.profile.goal === 'base'
                          ? `Week ${week.index + 1} · ${week.phase}`
                          : `${previewWeeks[week.index].countdown} · ${previewWeeks[week.index].phase} · Week ${week.index + 1}`,
                    }))}
                  />
                </Field>
                <div className="preview-first-week">
                  <div className="section-heading">
                    <div>
                      {preview.profile.goal !== 'base' && previewContext && (
                        <p className="eyebrow">
                          {dateLabel(previewContext.start)} ·{' '}
                          {previewContext.countdown}
                        </p>
                      )}
                      <h3>
                        {preview.profile.goal !== 'base' && previewContext
                          ? previewContext.phase
                          : `Week ${previewIndex + 1}`}
                      </h3>
                    </div>
                    <CalendarDays size={18} />
                  </div>
                  <WeekRhythm
                    plan={preview}
                    week={Math.min(previewWeek, preview.weeks.length - 1)}
                  />
                  {preview.workouts
                    .filter(
                      (w) =>
                        w.week ===
                        Math.min(previewWeek, preview.weeks.length - 1),
                    )
                    .map((w) => (
                      <details className="preview-workout" key={w.id}>
                        <summary className="preview-run">
                          <span>{dateLabel(w.date, { weekday: 'short' })}</span>
                          <strong>{w.title}</strong>
                          <span>{runDuration(w.minutes)}</span>
                        </summary>
                        <p>{w.purpose}</p>
                        {w.steps.map((step, i) => (
                          <p key={i}>
                            {step.label} · {runDuration(step.seconds / 60)} ·{' '}
                            {step.effort}
                          </p>
                        ))}
                      </details>
                    ))}
                </div>
                <div className="notice">
                  These are independent training rules, with effort-based
                  guidance. The workload limits are provisional coaching
                  choices. Start with the first week and use your feedback to
                  review changes.
                </div>
                {existing && (
                  <p className="subtle">
                    Activating replaces your upcoming plan. Completed runs and
                    previous revisions stay in your journal.
                  </p>
                )}
              </div>
            )}
          </fieldset>
          {error && (
            <div
              className="notice error section-space"
              role="alert"
              tabIndex={-1}
            >
              {error}
            </div>
          )}
          <div className="modal-actions">
            {step > 0 ? (
              <button
                className="text-button"
                type="button"
                disabled={loading || busy}
                onClick={() => {
                  generation.current++;
                  setPreview(null);
                  setError('');
                  setStep(step - 1);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <BusyButton
                busy={loading}
                busyLabel="Building your plan…"
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? 'Building your block…'
                  : step === 2
                    ? 'Preview my plan'
                    : 'Continue'}{' '}
                <ArrowRight size={17} />
              </BusyButton>
            ) : (
              <BusyButton
                busy={busy}
                busyLabel="Saving your plan…"
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    if (
                      !preview ||
                      previewVersion.current === null ||
                      activationInFlight.current
                    )
                      return;
                    if (previewDay.current !== trainingDay(p.timezone)) {
                      setPreview(null);
                      setStep(0);
                      setNotice(
                        'A new day has started. Review your dates and preview again.',
                      );
                      return;
                    }
                    activationInFlight.current = true;
                    await onActivate(
                      preview,
                      activationId.current,
                      previewVersion.current,
                    );
                    finished.current = true;
                    try {
                      sessionStorage.removeItem(storageKey);
                    } catch {}
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    activationInFlight.current = false;
                  }
                }}
              >
                {busy
                  ? 'Saving your plan…'
                  : existing
                    ? 'Restart with this plan'
                    : 'This is my plan'}{' '}
                <Check size={17} />
              </BusyButton>
            )}
          </div>
        </form>
        <div className="draft-actions">
          <button
            type="button"
            className="text-button"
            disabled={loading || busy}
            onClick={() => {
              finished.current = true;
              try {
                sessionStorage.removeItem(storageKey);
              } catch {}
              onClose();
            }}
          >
            Discard draft
          </button>
        </div>
      </NumericDraftContext.Provider>
    </Modal>
  );
}
