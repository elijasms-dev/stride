'use client';
import { CustomizationSummary } from './runner-customization-fields';
import { MAX_RECORDED_MINUTES } from '@/lib/ultra-policy';

import { BusyButton } from './action-progress';
import { runDuration } from '@/lib/journal-view';
import { NumericInput } from './numeric-input';
import { useRunFeedbackValidation } from './run-feedback-validation';
import { runFeedbackError } from '@/lib/form-values';
import { useMemo, useState, useRef } from 'react';
import {
  ArrowUpRight,
  SlidersHorizontal,
  Plus,
  BookOpen,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import {
  revisePreferences,
  type PreferencePatch,
  kmDisplay,
  dateLabel,
  addDays,
  raceDistance,
  trainingFamily,
  type Plan,
  type Profile,
  type Workout,
} from '@/lib/engine';
import { WORKOUT_LIBRARY, stimulusLabel } from '@/lib/workout-library';
import { workloadSummary, recordingCandidates } from '@/lib/training-history';
import { qualityTrainingEvidence } from '@/lib/training-evidence';
import { FormError, Modal, Field, Choice, api } from './stride-ui';
import { PlanCustomizationFields } from './training-controls';
import { desiredRuns, requestedQualityCount } from '@/lib/training-structure';
import type { Activity } from './settings';
const references = [
  {
    name: 'Higdon · Novice 5K',
    family: '5k',
    weeks: '8',
    runs: '3',
    long: '4.8 km',
    audience: 'Beginning runners; completion emphasis',
    url: 'https://www.halhigdon.com/training-programs/5k-training/novice-5k/',
  },
  {
    name: 'Higdon · Novice 10K',
    family: '10k',
    weeks: '8',
    runs: '3',
    long: '8.9 km',
    audience: 'Completion emphasis; lower-volume routine',
    url: 'https://www.halhigdon.com/training-programs/10k-training/novice-10k/',
  },
  {
    name: 'Pfitzinger · 10K',
    family: '10k',
    weeks: '12',
    runs: 'Varies',
    long: 'Higher-volume schedule',
    audience: 'Lowest family starts around 48 km/week; experienced runners',
    url: 'https://us.humankinetics.com/products/faster-road-racing',
  },
  {
    name: 'Higdon · Novice half',
    family: 'half',
    weeks: '12',
    runs: '3–4',
    long: '16.1 km',
    audience: 'Building toward a first half-marathon',
    url: 'https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/',
  },
  {
    name: 'Hansons · Advanced marathon',
    family: 'marathon',
    weeks: '18',
    runs: '6',
    long: '25.75 km (16 mi)',
    audience:
      'Classic advanced schedule; cumulative fatigue and marathon-pace work. Not a universal long-run cap.',
    url: 'https://hansons-running.com/pages/training-plans',
  },
  {
    name: 'Pfitzinger · Advanced Marathoning',
    family: 'marathon',
    weeks: '12 / 18',
    runs: 'Varies by volume',
    long: 'Varies by schedule',
    audience:
      'Established mileage; medium-long running, threshold, marathon specificity and recovery.',
    url: 'https://us.humankinetics.com/products/advanced-marathoning-4th-edition',
  },
  {
    name: 'Higdon · Novice marathon',
    family: 'marathon',
    weeks: '18',
    runs: '4',
    long: '32.2 km',
    audience: 'Existing running base; completion emphasis',
    url: 'https://www.halhigdon.com/training-programs/marathon-training/novice-1-marathon/',
  },
  {
    name: 'Higdon · 50K ultra',
    family: 'ultra',
    weeks: '26',
    runs: '5',
    long: '4–5 hours',
    audience: 'Established runners; time on feet and walking practice',
    url: 'https://www.halhigdon.com/training-programs/more-training/ultramarathon-50k/',
  },
];
function metrics(plan: Plan, today: string) {
  const active = plan.workouts.filter(
    (w) =>
      w.week >= 0 &&
      w.date >= today &&
      w.status === 'planned' &&
      w.kind !== 'race',
  );
  return {
    peak: Math.max(
      0,
      ...plan.weeks.map((week) =>
        active
          .filter((w) => w.week === week.index)
          .reduce((n, w) => n + w.minutes, 0),
      ),
    ),
    long: Math.max(0, ...active.map((w) => w.minutes)),
    quality: active.filter((w) => w.hard).length,
    minutes: active.reduce((n, w) => n + w.minutes, 0),
  };
}
function weeklyTraining(plan: Plan, index: number, today: string) {
  return plan.workouts
    .filter(
      (w) =>
        w.week === index &&
        w.date >= today &&
        w.status === 'planned' &&
        w.kind !== 'race',
    )
    .reduce((n, w) => n + w.minutes, 0);
}
export function TrainingView({
  plan,
  today,
  isDemo,
  onPreferences,
  onNew,
}: {
  plan: Plan;
  today: string;
  isDemo: boolean;
  onPreferences: (patch?: Partial<PreferencePatch>) => void;
  onNew: () => void;
  onWorkout: (w: Workout) => void;
  onExtra: () => void;
}) {
  const [option, setOption] = useState('gentle'),
    [section, setSection] = useState('overview'),
    [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const compare = useMemo(() => {
    if (section !== 'compare') return { plan: null, patch: {}, error: '' };
    try {
      const patch =
        option === 'gentle'
          ? { difficulty: 'gentle' as const }
          : option === 'maintain'
            ? { volume: 'maintain' as const }
            : option === 'recover'
              ? { recoveryWeeks: 3 as const }
              : { intent: 'finish' as const };
      return {
        plan: revisePreferences(plan, { ...plan.profile, ...patch }, today),
        patch,
        error: '',
      };
    } catch (e) {
      return { plan: null, patch: {}, error: (e as Error).message };
    }
  }, [option, plan, today, section]);
  const current = metrics(plan, today),
    candidate = compare.plan ? metrics(compare.plan, today) : null,
    unit = plan.profile.units;
  const family = trainingFamily(plan.profile);
  const scale = Math.max(current.peak, candidate?.peak ?? 0);
  const trainingDisplay = (value: number, _units?: string) =>
    Math.round(value).toLocaleString();
  return (
    <div className="view-wrapper training-view">
      <div className="page-heading">
        <button
          className="secondary-button"
          onClick={() => (isDemo ? onNew() : onPreferences())}
        >
          <SlidersHorizontal size={17} />
          {isDemo ? 'Build my plan' : 'Plan preferences'}
        </button>
      </div>
      <div className="training-subnav" aria-label="Training sections">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'compare', label: 'Compare' },
          { id: 'research', label: 'Research' },
        ].map((t) => (
          <button
            key={t.id}
            aria-pressed={section === t.id}
            onClick={() => setSection(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <section className="training-baseline" hidden={section !== 'overview'}>
        <span className="eyebrow">Your starting point</span>
        <h2>
          {kmDisplay(plan.profile.weeklyKm, unit)} {unit} a week.
          <br />
          <span className="subtle">
            A {kmDisplay(plan.profile.longestKm, unit)} {unit} longest run.{' '}
            {plan.profile.currentRuns} recent running days.
          </span>
        </h2>
        <p>
          {isDemo ? 'Example inputs' : 'Your supplied inputs'} for this block,
          beginning {dateLabel(plan.profile.startDate)}.{' '}
          {plan.profile.goal === 'base'
            ? 'Building a habit.'
            : `${kmDisplay(raceDistance(plan.profile), unit)} ${unit} on race day.`}
        </p>
        <div className="method-summary">
          <div>
            <span className="eyebrow">Training approach</span>
            <h3>
              {
                {
                  balanced: 'Balanced race preparation',
                  'threshold-singles': 'Threshold-focused singles',
                  'easy-doubles': 'Easy volume, split across the day',
                  'double-threshold': 'One controlled threshold pair',
                }[plan.profile.method ?? 'balanced']
              }
            </h3>
            <p>
              {plan.profile.method === 'double-threshold'
                ? 'An advanced, individually monitored option inspired by Norwegian practice. Morning and evening share existing volume, with no extra hard session that week.'
                : plan.profile.method === 'easy-doubles'
                  ? 'Two relaxed sessions on one selected day. The split changes when you run; it does not add distance to the week.'
                  : plan.profile.method === 'threshold-singles'
                    ? 'Controlled threshold sessions with a separate weekly work budget. Consistency and repeatability come before faster repetitions.'
                    : 'Easy running carries most of the volume. Quality sessions change purpose through the block, while long runs progress independently.'}
            </p>
          </div>
          <dl>
            <dt>Weekly volume</dt>
            <dd>
              {plan.profile.volume === 'maintain'
                ? 'Hold steady'
                : 'Gradual build'}
            </dd>
            <dt>Recovery week</dt>
            <dd>Every {plan.profile.recoveryWeeks ?? 4} weeks</dd>
            <dt>Quality ceiling</dt>
            <dd>
              {['threshold-singles', 'double-threshold'].includes(
                plan.profile.method ?? '',
              )
                ? '18%'
                : '22%'}{' '}
              of training time
            </dd>
            <dt>Long-run limit</dt>
            <dd>{plan.profile.longMinutes} min</dd>
          </dl>
        </div>
      </section>
      <section className="training-section" hidden={section !== 'compare'}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Compare approaches</span>
            <h2>Compare your options</h2>
          </div>
        </div>
        <div className="comparison-controls">
          <Choice
            label="Training option to compare"
            value={option}
            onChange={setOption}
            options={[
              { value: 'gentle', label: 'Gentler quality sessions' },
              { value: 'maintain', label: 'Maintain starting volume' },
              { value: 'recover', label: 'Recovery every third week' },
              { value: 'finish', label: 'Easy endurance, finish focus' },
            ]}
          />
          <p className="subtle">
            Compare remaining prescriptions from today. Completed runs and
            manual changes stay in place.
          </p>
        </div>
        {compare.error && <p className="notice">{compare.error}</p>}
        {candidate && compare.plan && (
          <>
            <div
              className="comparison-chart"
              aria-label="Current and alternative weekly training duration; values in the table below"
            >
              <div style={{ minWidth: plan.weeks.length * 40 }}>
                {plan.weeks.map((w, i) => (
                  <button
                    type="button"
                    key={i}
                    aria-pressed={selectedWeek === i}
                    onClick={() => setSelectedWeek(i)}
                    aria-label={`Week ${i + 1}: current ${trainingDisplay(weeklyTraining(plan, i, today), unit)}, alternative ${trainingDisplay(weeklyTraining(compare.plan!, i, today), unit)} min`}
                  >
                    <i
                      className="saved"
                      style={{
                        height: `${(weeklyTraining(plan, i, today) / Math.max(1, scale)) * 100}%`,
                      }}
                    />
                    <b
                      className="candidate"
                      style={{
                        height: `${(weeklyTraining(compare.plan!, i, today) / Math.max(1, scale)) * 100}%`,
                      }}
                    />
                    <small>{i + 1}</small>
                  </button>
                ))}
              </div>
            </div>
            {selectedWeek !== null && (
              <output className="subtle">
                Week {selectedWeek + 1}:{' '}
                {trainingDisplay(
                  weeklyTraining(plan, selectedWeek, today),
                  unit,
                )}{' '}
                min saved ·{' '}
                {trainingDisplay(
                  weeklyTraining(compare.plan!, selectedWeek, today),
                  unit,
                )}{' '}
                min alternative.
              </output>
            )}
            <div className="chart-legend">
              <span>Saved plan</span>
              <span>Alternative</span>
            </div>
            <details className="reason-details">
              <summary>Weekly training minutes</summary>
              <div className="table-scroll">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Saved</th>
                      <th>Alternative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.weeks.map((w, i) => (
                      <tr key={i}>
                        <th>
                          {i + 1} · {dateLabel(w.start)}
                        </th>
                        <td>
                          {trainingDisplay(
                            weeklyTraining(plan, i, today),
                            unit,
                          )}{' '}
                          min
                        </td>
                        <td>
                          {trainingDisplay(
                            weeklyTraining(compare.plan!, i, today),
                            unit,
                          )}{' '}
                          min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>From today</th>
                    <th>Saved plan</th>
                    <th>Alternative</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Peak remaining training week</th>
                    <td>{trainingDisplay(current.peak, unit)} min</td>
                    <td>{trainingDisplay(candidate.peak, unit)} min</td>
                  </tr>
                  <tr>
                    <th>Longest training run</th>
                    <td>{trainingDisplay(current.long, unit)} min</td>
                    <td>{trainingDisplay(candidate.long, unit)} min</td>
                  </tr>
                  <tr>
                    <th>Quality sessions</th>
                    <td>{current.quality}</td>
                    <td>{candidate.quality}</td>
                  </tr>
                  <tr>
                    <th>Total training time</th>
                    <td>
                      {Math.floor(current.minutes / 60)} h{' '}
                      {current.minutes % 60} min
                    </td>
                    <td>
                      {Math.floor(candidate.minutes / 60)} h{' '}
                      {candidate.minutes % 60} min
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        <button
          className="text-button"
          onClick={() => (isDemo ? onNew() : onPreferences(compare.patch))}
        >
          Review this option <ArrowRight size={16} />
        </button>
      </section>
      <section className="training-section" hidden={section !== 'research'}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">Coaching references</span>
            <h2>How other plans are shaped</h2>
          </div>
          <BookOpen size={22} />
        </div>
        <p>
          Useful reference points, for different runners. Stride does not
          average these plans together or reproduce their schedules.
        </p>
        <div className="table-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Published plan</th>
                <th>Weeks</th>
                <th>Runs/week</th>
                <th>Peak long outing</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              {references
                .filter((r) => r.family === family || family === 'base')
                .map((r) => (
                  <tr key={r.name}>
                    <th>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.name} ↗
                      </a>
                    </th>
                    <td>{r.weeks}</td>
                    <td>{r.runs}</td>
                    <td>{r.long}</td>
                    <td>{r.audience}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <details className="reason-details">
          <summary>Sources, choices and limits</summary>
          <p>
            <a
              href="https://vdoto2.com/learn-more/training-definitions"
              target="_blank"
              rel="noreferrer"
            >
              Daniels’ training definitions
            </a>{' '}
            distinguish easy endurance, sustained threshold work, aerobic-power
            intervals and relaxed economy. We store a session’s purpose
            separately from its format. The numerical recipes here are original
            Stride choices.
          </p>
          <p>
            <a
              href="https://support.runna.com/en/articles/10393191-how-to-use-training-preferences"
              target="_blank"
              rel="noreferrer"
            >
              Runna’s preferences
            </a>{' '}
            separate volume from difficulty.{' '}
            <a
              href="https://support.runna.com/en/articles/11794078-what-are-mileage-insights"
              target="_blank"
              rel="noreferrer"
            >
              Mileage Insights
            </a>{' '}
            includes off-plan running. Its exact numerical algorithm remains
            private.
          </p>
          <p>
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/37163550/"
              target="_blank"
              rel="noreferrer"
            >
              Taper research
            </a>{' '}
            supports reducing volume while retaining familiar intensity.{' '}
            <a
              href="https://bjsm.bmj.com/content/59/17/1203"
              target="_blank"
              rel="noreferrer"
            >
              Recent session-distance research
            </a>{' '}
            supports examining individual outings, while not establishing a
            universal safe percentage.
          </p>
          <p>
            Stride’s progression, entry requirements and caps are provisional
            training policies, not proof of readiness. Books and public plans
            inform the design; this app has not been independently validated as
            a coaching service.
          </p>
          <p>
            Today’s tired feedback can hold a progression review immediately.
            Increases still need repeated completed training on earlier days;
            duplicate recordings count once.{' '}
            <a
              href="https://pubmed.ncbi.nlm.nih.gov/26423706/"
              target="_blank"
              rel="noreferrer"
            >
              Research on subjective training responses
            </a>{' '}
            supports monitoring how training feels. It does not validate
            Stride’s effort cutoffs or review windows, which remain coaching
            policies awaiting independent review.
          </p>
        </details>
      </section>
    </div>
  );
}
export function PlanPreferences({
  initialPatch = {},
  plan,
  today,
  version,
  onClose,
  onAction,
  busy,
}: {
  initialPatch?: Partial<PreferencePatch>;
  plan: Plan;
  today: string;
  version: number;
  onClose: () => void;
  onAction: (action: string, payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const flight = useRef(false);
  const [submitted, setSubmitted] = useState<Profile | null>(null);
  const [p, setP] = useState({ ...plan.profile, ...initialPatch }),
    [previewVersion, setPreviewVersion] = useState(version),
    [effectiveDate, setEffectiveDate] = useState(today),
    [showAll, setShowAll] = useState(false),
    [preview, setPreview] = useState<Plan | null>(null),
    [error, setError] = useState(''),
    [checking, setChecking] = useState(false);
  const changes =
    preview?.workouts.filter(
      (w) =>
        w.date >= today &&
        (() => {
          const old = plan.workouts.find((x) => x.id === w.id);
          return (
            !old ||
            old.date !== w.date ||
            old.startTime !== w.startTime ||
            old.status !== w.status ||
            old.title !== w.title ||
            JSON.stringify(w.steps) !== JSON.stringify(old.steps)
          );
        })(),
    ) ?? [];
  const removed = preview
    ? plan.workouts.filter(
        (w) =>
          w.date >= today &&
          w.status !== 'completed' &&
          !preview.workouts.some((x) => x.id === w.id),
      )
    : [];
  return (
    <Modal
      open
      onClose={onClose}
      title={preview ? 'Review your next runs' : 'Plan preferences'}
      description={
        preview
          ? 'Only upcoming prescriptions change. Completed running stays in your journal.'
          : 'Choose your week. Preview the changes before saving.'
      }
      wide
      locked={checking || busy}
    >
      {!preview ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (flight.current) return;
            flight.current = true;
            setChecking(true);
            const snapshot = {
              ...structuredClone(p),
              workoutVariety: 'varied' as const,
            };
            setError('');
            try {
              const result = await api<{
                plan: Plan;
                version: number;
                effectiveDate: string;
              }>('/api/plan', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'preferencesPreview',
                  version,
                  preferences: snapshot,
                }),
              });
              setSubmitted(snapshot);
              setPreview(result.plan);
              setPreviewVersion(result.version);
              setEffectiveDate(result.effectiveDate);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              flight.current = false;
              setChecking(false);
            }
          }}
        >
          <fieldset
            disabled={checking || busy}
            className="form-section form-content"
          >
            <PlanCustomizationFields profile={p} onChange={setP} />
            <BusyButton
              busy={checking}
              busyLabel="Reviewing your plan…"
              className="primary-button"
              disabled={checking}
            >
              {checking ? 'Checking your plan…' : 'Preview future changes'}
              <ArrowRight size={17} />
            </BusyButton>
          </fieldset>
        </form>
      ) : (
        <div className="form-section">
          <div className="plan-review-choice">
            <strong>{desiredRuns(preview.profile)} running days</strong>
            <span>
              Up to{' '}
              {preview.profile.intent === 'finish'
                ? 0
                : requestedQualityCount(preview.profile)}{' '}
              harder workouts per week
            </span>
            <p>
              Recovery and taper weeks can be lighter. Completed runs and
              workouts you edited individually stay as saved.
            </p>
          </div>
          <div className="plan-distance-metrics">
            <div>
              <span>Next full week</span>
              <strong>
                {Number(
                  (
                    (preview.weeks.find((w) => w.start >= today)?.targetKm ??
                      preview.weeks.at(-1)?.targetKm ??
                      0) / (preview.profile.units === 'mi' ? 1.609344 : 1)
                  ).toFixed(1),
                )}
                <small> {preview.profile.units}</small>
              </strong>
            </div>
            <div>
              <span>Longest upcoming run</span>
              <strong>
                {Number(
                  (
                    Math.max(
                      0,
                      ...preview.workouts
                        .filter((w) => w.date >= today && w.kind === 'long')
                        .map((w) => w.estimatedKm),
                    ) / (preview.profile.units === 'mi' ? 1.609344 : 1)
                  ).toFixed(1),
                )}
                <small> {preview.profile.units}</small>
              </strong>
            </div>
          </div>
          <p className="plan-control-hint">
            Weekly totals include estimates for timed workout steps.
          </p>
          <CustomizationSummary profile={preview.profile} />
          <div className="notice">
            {(previewVersion !== version || effectiveDate !== today) &&
              'This preview is out of date. Go back and preview again. '}
            {changes.length} upcoming sessions change; {removed.length} are
            removed from the schedule. Race day remains{' '}
            {dateLabel(plan.profile.raceDate)}.
          </div>
          {(preview.profile.carbsPerHour ?? null) !==
            (plan.profile.carbsPerHour ?? null) && (
            <p className="subtle">
              Long-run fueling cue:{' '}
              {preview.profile.carbsPerHour != null
                ? `${preview.profile.carbsPerHour} g carbohydrate/hour, as already tolerated`
                : 'General fueling practice without a saved intake'}
              .
            </p>
          )}
          {!!preview.profile.practiceInDark !==
            !!plan.profile.practiceInDark && (
            <p className="subtle">
              Short headlamp practice:{' '}
              {preview.profile.practiceInDark
                ? 'included within eligible easy runs'
                : 'off'}
              . Running duration stays unchanged by this preference.
            </p>
          )}
          {JSON.stringify(preview.profile.crossTraining ?? []) !==
            JSON.stringify(plan.profile.crossTraining ?? []) && (
            <p className="subtle">
              {preview.profile.crossTraining?.length ?? 0} cross-training days
              reserved without running. Supporting activities are separate from
              running totals and watch delivery.
            </p>
          )}
          <div className="changed-runs">
            {removed.map((w) => (
              <div key={w.id}>
                <span>{dateLabel(w.date)}</span>
                <strong>{w.title}</strong>
                <span>Removed</span>
              </div>
            ))}
            {changes.slice(0, showAll ? undefined : 12).map((w) => {
              const old = plan.workouts.find((x) => x.id === w.id);
              return (
                <div key={w.id}>
                  <span>{dateLabel(w.date)}</span>
                  <strong>{w.title}</strong>
                  <span>
                    {old ? runDuration(old.minutes) : 'New'} →{' '}
                    {runDuration(w.minutes)}
                    {old?.startTime !== w.startTime && (
                      <small>
                        {old?.startTime ?? 'Open start'} →{' '}
                        {w.startTime ?? 'Open start'}
                      </small>
                    )}
                  </span>
                  <details className="change-reason">
                    <summary>Why this changes</summary>
                    <p>{w.reason}</p>
                  </details>
                </div>
              );
            })}
          </div>
          {changes.length > 12 && (
            <button
              className="text-button"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show fewer' : `Show all ${changes.length} changes`}
            </button>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Back to settings
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Saving your revised plan…"
              className="primary-button"
              disabled={
                busy || previewVersion !== version || effectiveDate !== today
              }
              onClick={async () => {
                try {
                  await onAction('preferences', {
                    preferences: submitted,
                    version: previewVersion,
                    effectiveDate,
                  });
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Apply from {dateLabel(today)}
              <ArrowRight size={17} />
            </BusyButton>
          </div>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
export function ExtraRunForm({
  plan,
  today,
  onClose,
  onBackToRecordings,
  onSaved,
  onAction,
  busy,
  imported,
  existing,
}: {
  plan: Plan;
  today: string;
  onClose: () => void;
  onBackToRecordings?: () => void;
  onSaved?: () => void;
  onAction: (action: string, payload: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  imported?: Activity;
  existing?: import('@/lib/engine').ExtraRun;
}) {
  const unit = plan.profile.units;
  const [date, setDate] = useState(existing?.date ?? imported?.date ?? today),
    [minutes, setMinutes] = useState(
      existing?.minutes ?? (imported ? imported.movingTime / 60 : NaN),
    ),
    [distance, setDistance] = useState(
      existing?.km ?? (imported?.distance ? imported.distance / 1000 : null),
    ),
    [effort, setEffort] = useState(String(existing?.effort ?? '')),
    [feeling, setFeeling] = useState<string>(existing?.feeling ?? ''),
    [note, setNote] = useState(existing?.note ?? ''),
    [correctionReason, setCorrectionReason] = useState(''),
    [error, setError] = useState(''),
    [target, setTarget] = useState(imported ? '' : 'extra');
  const matches = recordingCandidates(plan.workouts, date);
  const extras = (plan.extraRuns ?? []).filter(
    (r) => r.date === date && !r.activityId,
  );
  const attachedFeedback = imported
    ? (matches.find((w) => w.id === target && w.status === 'completed')
        ?.feedback ?? extras.find((r) => r.id === target))
    : undefined;
  const feedbackValidation = useRunFeedbackValidation(
    String(attachedFeedback?.effort ?? effort),
    attachedFeedback?.feeling ?? feeling,
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={
        existing
          ? 'Correct your run'
          : imported
            ? 'Review this recording'
            : 'Log an extra run'
      }
      description={
        existing
          ? 'Correct the recorded time, distance or notes.'
          : imported
            ? 'Attach this recording to an existing run, or save it as an extra run.'
            : 'Log running outside your prescribed sessions. Your future workload does not increase automatically.'
      }
      locked={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            if (!target)
              throw new Error(
                'Choose where this recording belongs before saving.',
              );
            if (attachedFeedback) {
              const feedbackError = runFeedbackError(
                String(attachedFeedback.effort),
                attachedFeedback.feeling,
              );
              if (feedbackError) throw new Error(feedbackError);
            } else if (!feedbackValidation.validate()) return;
            const run = {
              date,
              minutes,
              km: distance,
              effort: attachedFeedback?.effort ?? Number(effort),
              feeling: attachedFeedback?.feeling ?? feeling,
              note: attachedFeedback?.note ?? note,
              activityId: existing?.activityId ?? imported?.id,
              source: existing?.source ?? imported?.source ?? 'Manual',
            };
            const planned = matches.find(
              (w) => w.id === target && w.status === 'planned',
            );
            if (existing)
              await onAction('correctExtra', {
                id: existing.id,
                run,
                correctionReason,
              });
            else if (planned)
              await onAction('complete', {
                id: target,
                feedback: {
                  actualDate: date,
                  actualMinutes: run.minutes,
                  actualKm: run.km,
                  effort: run.effort,
                  feeling,
                  note,
                  activityId: imported?.id,
                  source: run.source,
                },
              });
            else if (target === 'extra') await onAction('freeRun', { run });
            else await onAction('attachRecording', { id: target, run });
            (onSaved ?? onClose)();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <fieldset disabled={busy} className="form-section form-content">
          {imported && !existing && (
            <p className="notice">
              Date, time and distance come from the provider and are verified
              when saved. To correct a recording, save it first, then use
              Correct run or Correct run log in your journal.
            </p>
          )}
          {imported && (
            <Field label="Where does this recording belong?">
              <select
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose a session</option>
                {matches.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.session ? `${w.session} · ` : ''}
                    {w.title} ·{' '}
                    {w.status === 'completed'
                      ? 'Attach to logged run'
                      : 'Log planned run'}
                  </option>
                ))}
                {extras.map((r) => (
                  <option key={r.id} value={r.id}>
                    Attach to extra run · {runDuration(r.minutes)}
                  </option>
                ))}
                <option value="extra">A separate, extra run</option>
              </select>
              <p className="subtle">
                Attaching updates the existing entry so the same run is counted
                once. Choose a separate run only if you ran again.
              </p>
            </Field>
          )}
          <Field label="Date you ran">
            <input
              required
              type="date"
              max={today}
              value={date}
              disabled={!!imported && !existing}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
          </Field>
          <div className="form-grid">
            <Field label="Actual minutes">
              <NumericInput
                name="actualMinutes"
                value={minutes}
                onValueChange={(v) => setMinutes(v ?? NaN)}
                disabled={!!imported && !existing}
                required
                min={1}
                max={MAX_RECORDED_MINUTES}
              />
            </Field>
            <Field label={`Actual distance (${unit}), optional`}>
              <NumericInput
                name="actualDistance"
                value={distance}
                onValueChange={setDistance}
                disabled={!!imported && !existing}
                factor={unit === 'mi' ? 1.609344 : 1}
                min={0.001}
                max={250}
              />
            </Field>
          </div>
          {attachedFeedback ? (
            <p className="notice">
              Your logged effort ({attachedFeedback.effort}/10), feeling (
              {attachedFeedback.feeling}) and notes stay with this run.
              Attaching only updates its recorded time, distance and source.
            </p>
          ) : (
            <>
              <Field
                label="Session effort, 1–10"
                error={feedbackValidation.effortError}
              >
                <input
                  required
                  type="number"
                  min="1"
                  max="10"
                  id={feedbackValidation.effortId}
                  placeholder="Choose 1–10"
                  value={effort}
                  onInput={(e) => setEffort(e.currentTarget.value)}
                />
              </Field>
              <Field
                label="How you felt"
                error={feedbackValidation.feelingError}
              >
                <Choice
                  label="How you felt"
                  id={feedbackValidation.feelingId}
                  placeholder="Choose how you felt"
                  value={feeling}
                  onChange={setFeeling}
                  options={[
                    { value: 'good', label: 'Good' },
                    { value: 'okay', label: 'Okay' },
                    { value: 'tired', label: 'Tired' },
                  ]}
                />
              </Field>
              <Field label="Notes, optional">
                <textarea
                  maxLength={2000}
                  value={note}
                  onInput={(e) => setNote(e.currentTarget.value)}
                />
              </Field>
            </>
          )}
          {existing && (
            <Field label="Reason for correction">
              <input
                required
                minLength={3}
                maxLength={200}
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </Field>
          )}
          {imported && onBackToRecordings && (
            <button
              type="button"
              className="text-button"
              onClick={onBackToRecordings}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Back to recordings
            </button>
          )}
          <BusyButton
            busy={busy}
            busyLabel="Saving your run…"
            className="primary-button"
            disabled={busy}
          >
            {busy ? 'Saving…' : existing ? 'Save correction' : 'Save run'}{' '}
            <ArrowRight size={16} />
          </BusyButton>
        </fieldset>
        {error && <FormError message={error} />}
      </form>
    </Modal>
  );
}

export function TrainingInsights({
  plan,
  today,
  isDemo,
  onWorkout,
  onExtra,
}: {
  plan: Plan;
  today: string;
  isDemo: boolean;
  onWorkout: (w: Workout) => void;
  onExtra: () => void;
}) {
  const history = workloadSummary(plan, today),
    unit = plan.profile.units;
  const qualityData = qualityTrainingEvidence(
    plan.workouts,
    today,
    history.start,
  );
  const missingExecution = qualityData.filter((r) =>
    ['execution-unknown', 'dose-unknown', 'feedback-unknown'].includes(
      r.status,
    ),
  );
  return (
    <section className="training-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Recorded training</span>
          <h2>Your last four weeks</h2>
        </div>
        <button className="secondary-button" onClick={onExtra}>
          <Plus size={16} />
          Log an extra run
        </button>
      </div>
      <p>
        {dateLabel(history.start)} — {dateLabel(history.end)}. Today is shown
        separately in your journal.
      </p>
      <div className="history-metrics">
        <div>
          <strong>{history.recent.length}</strong>
          <span>runs recorded</span>
        </div>
        <div>
          <strong>
            {history.recent.some((r) => r.km !== null)
              ? `${kmDisplay(history.totalKm, unit)} ${unit}`
              : '—'}
          </strong>
          <span>known distance</span>
        </div>
        <div>
          <strong>{runDuration(history.totalMinutes)}</strong>
          <span>actual time</span>
        </div>
        <div>
          <strong>
            {history.records.some(
              (r) =>
                r.date <= today &&
                r.date >= addDays(today, -29) &&
                r.km !== null,
            )
              ? `${kmDisplay(history.longestKm, unit)} ${unit}`
              : '—'}
          </strong>
          <span>longest run · last 30 days</span>
        </div>
      </div>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Seven-day period</th>
              <th>Runs</th>
              <th>Actual distance</th>
              <th>Actual time</th>
              <th>Prescribed time</th>
            </tr>
          </thead>
          <tbody>
            {history.weeks.map((w) => (
              <tr key={w.from}>
                <th>
                  {dateLabel(w.from)}–{dateLabel(w.to)}
                </th>
                <td>{w.runs}</td>
                <td>
                  {w.runs > w.unknownDistances
                    ? `${kmDisplay(w.km, unit)} ${unit}`
                    : '—'}
                  {w.unknownDistances
                    ? ` · ${w.unknownDistances} without distance`
                    : ''}
                </td>
                <td>{runDuration(w.minutes)}</td>
                <td>{w.plannedMinutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="subtle">
        An empty week means no runs recorded here; it does not prove you rested.
        Extra runs count toward actual workload and never add a mileage debt to
        the plan.
      </p>
      <details className="reason-details">
        <summary>Training data behind your plan</summary>
        <p>
          This review uses your recorded runs from the four completed weeks
          above. A missing distance stays unknown. Today can inform a fatigue
          hold, but does not yet count toward progression.
        </p>
        <div className="history-metrics">
          <div>
            <strong>
              {history.recent.filter((r) => r.km === null).length}
            </strong>
            <span>runs without distance</span>
          </div>
          <div>
            <strong>{qualityData.filter((r) => r.eligible).length}</strong>
            <span>quality sessions meeting review criteria</span>
          </div>
          <div>
            <strong>{missingExecution.length}</strong>
            <span>quality logs with incomplete feedback</span>
          </div>
        </div>
        <p className="subtle">
          Interval completion is your own report. A watch’s total time or
          distance does not prove the work intervals were completed. Eligibility
          also depends on the session family and training phase.
        </p>
        {!isDemo && missingExecution.length > 0 && (
          <ul>
            {missingExecution
              .slice(-3)
              .reverse()
              .map(({ workout, date, status }) => (
                <li key={workout.id}>
                  <button
                    className="text-button"
                    onClick={() => onWorkout(workout)}
                  >
                    {dateLabel(date)} · {workout.title} · Review log
                  </button>
                  <p className="subtle">
                    {status === 'feedback-unknown'
                      ? 'Effort or feeling is missing. Correct the log only if you remember how the session felt.'
                      : status === 'dose-unknown'
                        ? 'Work minutes are missing. Add them only if you know how much of the main set you completed.'
                        : 'Session execution is unknown. You can leave it unknown or correct the log if you remember.'}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </details>
      {history.fatigue.length >= 2 && (
        <div className="notice">
          <strong>Consider a lighter stretch</strong>
          <p>
            {history.fatigue.length} recent runs include tiredness or
            unexpectedly high effort on an easy day. Review recovery before
            adding more work.
          </p>
        </div>
      )}
      {history.unlogged.length > 0 && (
        <p className="subtle">
          {history.unlogged.length} past prescribed runs are still unlogged.
          Record what happened before drawing conclusions.
        </p>
      )}
      <details className="reason-details">
        <summary>How the workload review works</summary>
        <p>
          Actual duration is compared with prescribed duration, so a missing
          pace estimate does not create a false mileage comparison. Your longest
          run is a single recorded session, not the sum of a double day.
          Reported effort × minutes is {history.recordedLoad} for the recorded
          runs; this is a personal tracking measure, not a fitness or injury
          score.
        </p>
        <p>
          {history.canReviewBaseline
            ? 'There is enough recorded history to review your starting inputs, once you confirm that all running is included.'
            : 'More complete history is needed before reviewing your baseline. No automatic increase is made.'}
        </p>
      </details>
    </section>
  );
}
export function WorkoutGuide({
  plan,
  onWorkout,
}: {
  plan: Plan;
  onWorkout: (w: Workout) => void;
}) {
  const [filter, setFilter] = useState('all');
  return (
    <section className="training-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Session library</span>
          <h2>Inside the workouts</h2>
        </div>
        <Choice
          label="Workout purpose"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All purposes' },
            ...Object.entries(stimulusLabel).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </div>
      <div className="workout-library">
        {WORKOUT_LIBRARY.filter(
          (t) => filter === 'all' || t.stimulus === filter,
        ).map((t) => (
          <article key={t.id}>
            <span className="eyebrow">{stimulusLabel[t.stimulus]}</span>
            <h3>{t.title}</h3>
            <p>{t.purpose}</p>
            <small>
              {t.hills ? 'Gentle hills · ' : ''}
              {t.goals.map((g) => g.toUpperCase()).join(' / ')} ·{' '}
              {t.phases.join(', ')}
            </small>
            {plan.workouts.find((w) => w.templateId === t.id) && (
              <button
                className="text-button"
                onClick={() =>
                  onWorkout(plan.workouts.find((w) => w.templateId === t.id)!)
                }
              >
                See it in your block <ArrowUpRight size={15} />
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
