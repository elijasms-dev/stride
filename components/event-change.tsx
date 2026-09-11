'use client';
import { UltraDistanceChoices, UltraRoutineFields } from './ultra-fields';
import { BusyButton } from './action-progress';
import { planWeekFocus } from '@/lib/plan-guidance';
import { runDuration } from '@/lib/journal-view';
import { NumericInput } from './numeric-input';
import { useState, useRef, useEffect } from 'react';
import { Modal, Field, Choice, api } from './stride-ui';
import RacePicker from './race-picker';
import {
  addDays,
  dateLabel,
  eventDistanceDisplay,
  raceDistance,
  preparationRequirements,
  MAX_EVENT_KM,
  type Plan,
  type Profile,
} from '@/lib/engine';
import type { EventPatch } from '@/lib/event-transition';
import type { Action } from './workout-detail';
export default function EventChange({
  plan,
  version,
  today,
  onAction,
  onClose,
  busy,
  presentation = 'dialog',
}: {
  plan: Plan;
  version: number;
  today: string;
  onAction: Action;
  onClose: () => void;
  busy: boolean;
  presentation?: 'dialog' | 'page';
}) {
  const flight = useRef(false);
  const [submitted, setSubmitted] = useState<EventPatch | null>(null);
  const finished = plan.profile.raceDate <= today;
  const [profile, setProfile] = useState<Profile>({
      ...plan.profile,
      raceName: plan.profile.raceName || 'My next training block',
      ...(finished
        ? {
            goal: 'base' as const,
            raceName: 'Next base block',
            raceDate: addDays(today, 55),
          }
        : {}),
    }),
    [preview, setPreview] = useState<{
      plan: Plan;
      version: number;
      effectiveDate: string;
    } | null>(null),
    [error, setError] = useState(''),
    [checking, setChecking] = useState(false);
  const event: EventPatch = {
    goal: profile.goal,
    raceName: profile.raceName,
    raceDate: profile.raceDate,
    raceDistanceKm: profile.raceDistanceKm,
    raceTerrain: profile.raceTerrain,
    stableWeeks: profile.stableWeeks,
    ultraWeeklyMinutes: profile.ultraWeeklyMinutes,
    ultraLongestMinutes: profile.ultraLongestMinutes,
  };
  const edit = (next: Profile) => {
    setProfile(next);
    setPreview(null);
    setError('');
  };
  const page = presentation === 'page';
  const completedCount = plan.workouts.filter(
    (w) => w.status === 'completed',
  ).length;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusState = useRef({ entered: false, preview: false, error: '' });
  const focusPending = useRef(false);
  const title = preview
    ? page
      ? 'Review your restart'
      : 'Review your event change'
    : page
      ? 'Restart plan'
      : finished
        ? 'Your next block'
        : 'Change your event';
  const description =
    'Rebuild from today using your recent running. Keep your goal or choose a new one. Completed runs stay in your journal.';
  useEffect(() => {
    const previous = focusState.current;
    if (
      page &&
      (!previous.entered ||
        previous.preview !== !!preview ||
        (error && error !== previous.error))
    ) {
      focusPending.current = true;
    }
    focusState.current = { entered: page, preview: !!preview, error };
    // A corrective keystroke can clear an error without leaving the field.
    if (page && !busy && !checking && focusPending.current) {
      focusPending.current = false;
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [page, preview, error, busy, checking]);
  const content = (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!preview ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (flight.current) return;
            flight.current = true;
            const snapshot = structuredClone(event);
            setSubmitted(snapshot);
            setChecking(true);
            setError('');
            try {
              setPreview(
                await api('/api/plan', {
                  method: 'POST',
                  body: JSON.stringify({
                    action: 'eventPreview',
                    version,
                    event: snapshot,
                  }),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              flight.current = false;
              setChecking(false);
            }
          }}
        >
          <fieldset className="form-content" disabled={checking || busy}>
            <RacePicker profile={profile} onChange={edit} />
            <div className="form-grid section-space">
              <Field label="Plan">
                <Choice
                  label="Plan"
                  value={profile.goal}
                  onChange={(goal) =>
                    edit({
                      ...profile,
                      goal: goal as Profile['goal'],
                      raceDistanceKm:
                        goal === 'ultra' ? 50 : profile.raceDistanceKm,
                    })
                  }
                  options={[
                    { value: 'base', label: 'Base building' },
                    { value: '5k', label: '5K' },
                    { value: '10k', label: '10K' },
                    { value: 'half', label: 'Half marathon' },
                    { value: 'marathon', label: 'Marathon' },
                    {
                      value: 'ultra',
                      label: 'Runnable ultra · up to 100 miles',
                    },
                    { value: 'custom', label: 'Custom distance' },
                  ]}
                />
              </Field>
              <Field
                label={profile.goal === 'base' ? 'Block ends' : 'Race date'}
              >
                <input
                  required
                  type="date"
                  min={today}
                  value={profile.raceDate}
                  onChange={(e) =>
                    edit({ ...profile, raceDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Event or block name">
                <input
                  required
                  maxLength={80}
                  value={profile.raceName}
                  onChange={(e) =>
                    edit({ ...profile, raceName: e.target.value })
                  }
                />
              </Field>
              {profile.goal === 'ultra' && (
                <UltraDistanceChoices profile={profile} onChange={edit} />
              )}
              <UltraRoutineFields profile={profile} onChange={edit} />
              {['custom', 'ultra'].includes(profile.goal) && (
                <Field
                  label="Exact distance in kilometres"
                  hint="Use up to four decimal places. Event distance is stored separately from training estimates."
                >
                  <NumericInput
                    name="eventDistance"
                    value={profile.raceDistanceKm}
                    onValueChange={(v) =>
                      edit({ ...profile, raceDistanceKm: v ?? NaN })
                    }
                    required
                    min={profile.goal === 'ultra' ? 42.1951 : 1}
                    max={MAX_EVENT_KM}
                  />
                </Field>
              )}
              <Field label="Course">
                <Choice
                  label="Course"
                  value={profile.raceTerrain ?? 'road'}
                  onChange={(value) =>
                    edit({
                      ...profile,
                      raceTerrain: value as Profile['raceTerrain'],
                    })
                  }
                  options={[
                    { value: 'road', label: 'Road / flat' },
                    { value: 'rolling', label: 'Runnable rolling terrain' },
                    {
                      value: 'mountain',
                      label: 'Technical mountain · unsupported',
                    },
                  ]}
                />
              </Field>
            </div>
            {['custom', 'ultra'].includes(profile.goal) && (
              <p className="notice">
                Preparation band: {preparationRequirements(profile).band}. No
                minimum plan length.{' '}
                {preparationRequirements(profile).minWeekly} recent km/week and
                a {preparationRequirements(profile).minLong} km longest run.
                Baseline requirements vary with exact distance; required running
                days remain whole-day gates.
              </p>
            )}
            <p className="notice">
              This rebuild holds your current baseline and keeps your available
              days and time limits. A completed race adds a recovery window.
              Technical mountain events need a different training model.
            </p>
            <BusyButton
              busy={checking}
              busyLabel="Building the new block…"
              className="primary-button"
              disabled={checking}
            >
              {checking
                ? 'Checking the new block…'
                : page
                  ? 'Preview restart'
                  : 'Review new block'}
            </BusyButton>
          </fieldset>
        </form>
      ) : (
        <>
          <h3>{preview.plan.profile.raceName}</h3>
          <p>
            {profile.goal === 'base'
              ? 'Base building'
              : `${eventDistanceDisplay(raceDistance(profile), profile.units)} ${profile.units}`}{' '}
            · {dateLabel(profile.raceDate)}
          </p>
          <p className="notice">{preview.plan.baselineEvidence?.explanation}</p>
          {preview.plan.returnState && (
            <p className="notice">
              Post-race rest is followed by an easy return. Progression requires
              a review of completed running.
            </p>
          )}
          <p>
            {
              plan.workouts.filter(
                (w) => w.status === 'planned' && w.date >= today,
              ).length
            }{' '}
            future sessions replaced. {completedCount} completed{' '}
            {completedCount === 1 ? 'run' : 'runs'} retained.
          </p>
          <div className="changed-runs">
            {preview.plan.weeks.map((week) => (
              <details key={week.index} className="reason-details">
                <summary>
                  Week {week.index + 1} · {week.phase} ·{' '}
                  {runDuration(week.trainingMinutes ?? 0)} training
                </summary>
                <p>{planWeekFocus(preview.plan, week)}</p>
                {preview.plan.workouts
                  .filter((w) => w.week === week.index)
                  .map((w) => (
                    <p key={w.id}>
                      {dateLabel(w.date)} —{' '}
                      {w.status === 'skipped' ? 'Rest' : w.title}{' '}
                      {w.status !== 'skipped' && `· ${runDuration(w.minutes)}`}
                    </p>
                  ))}
              </details>
            ))}
          </div>
          {(preview.version !== version || preview.effectiveDate !== today) && (
            <output className="notice">
              Your plan or today’s date has changed. Choose{' '}
              {page ? 'Edit restart' : 'Edit event'} and build a fresh preview
              before applying it.
            </output>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              {page ? 'Edit restart' : 'Edit event'}
            </button>
            <BusyButton
              busy={busy}
              busyLabel="Saving your next block…"
              className="primary-button"
              disabled={
                busy ||
                preview.version !== version ||
                preview.effectiveDate !== today
              }
              onClick={async () => {
                setError('');
                try {
                  await onAction('changeEvent', {
                    event: submitted,
                    version: preview.version,
                    effectiveDate: preview.effectiveDate,
                  });
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {busy
                ? 'Saving…'
                : page
                  ? 'Restart with this plan'
                  : 'Start this block'}
            </BusyButton>
          </div>
        </>
      )}
    </>
  );
  if (page)
    return (
      <section
        className="view-wrapper restart-plan"
        aria-labelledby="restart-plan-title"
        aria-busy={checking || busy}
      >
        <div className="page-heading">
          <h1 id="restart-plan-title" ref={heading} tabIndex={-1}>
            {title}
          </h1>
        </div>
        <p className="restart-intro">{description}</p>
        {content}
      </section>
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      wide
      locked={checking || busy}
    >
      {content}
    </Modal>
  );
}
