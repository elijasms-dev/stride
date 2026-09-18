'use client';
import { CustomizationSummary } from '../runner-customization-fields';

import { dateLabel, type Plan } from '@/lib/engine';
import {
  preferenceOverviewRows,
  workoutComparisonRows,
  type WorkoutComparisonRow,
} from '@/lib/plan-change-summary';
import { WorkoutSteps } from '../workout-steps';
import { desiredRuns, requestedQualityCount } from '@/lib/training-structure';
import { ArrowRight } from 'lucide-react';
import { BusyButton } from '../action-progress';
import type { usePlanPreferences } from './use-plan-preferences';

function PrescriptionComparison({
  label,
  rows,
}: {
  label: string;
  rows: WorkoutComparisonRow[];
}) {
  return (
    <table className="prescription-comparison" aria-label={label}>
      <thead>
        <tr className="prescription-comparison-head">
          <th scope="col">Prescription</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            className="prescription-comparison-row"
            data-changed={row.changed}
            key={row.label}
          >
            <th scope="row">{row.label}</th>
            <td>{row.before}</td>
            <td>{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PreferencePreview({
  preview,
  plan,
  today,
  version,
  onClose,
  onAction,
  busy,
  submitted,
  previewVersion,
  effectiveDate,
  showAll,
  setShowAll,
  setPreview,
  setError,
  changes,
  removed,
}: ReturnType<typeof usePlanPreferences> & { preview: Plan }) {
  const overview = preferenceOverviewRows(plan, preview, today);
  const added = changes.filter(
    (w) => !plan.workouts.some((old) => old.id === w.id),
  );
  const entries = [
    ...changes.map((after) => ({
      before: plan.workouts.find((w) => w.id === after.id),
      after,
    })),
    ...removed.map((before) => ({ before, after: undefined })),
  ].sort((a, b) =>
    (a.after?.date ?? a.before!.date).localeCompare(
      b.after?.date ?? b.before!.date,
    ),
  );
  return (
    <div className="form-section preference-inspection">
      <div className="plan-review-choice">
        <strong>{desiredRuns(preview.profile)} running days</strong>
        <span>
          Up to {requestedQualityCount(preview.profile)} weekday quality
          {requestedQualityCount(preview.profile) === 1
            ? ' workout'
            : ' workouts'}{' '}
          per week
          {preview.workouts.some((w) => w.kind === 'long' && w.date >= today)
            ? ', plus the long run'
            : ''}
        </span>
        <p>
          Recovery and taper weeks can be lighter. Completed runs and workouts
          you edited individually stay as saved.
        </p>
      </div>
      <section
        className="preference-overview"
        aria-label="Plan totals before and after"
      >
        <div className="section-heading">
          <h3>See what changes</h3>
          {overview.weekStart && (
            <span>Week of {dateLabel(overview.weekStart)}</span>
          )}
        </div>
        <PrescriptionComparison
          label="Training totals comparison"
          rows={overview.rows}
        />
        <p className="plan-control-hint">
          Both columns use{' '}
          {preview.profile.units === 'mi' ? 'miles' : 'kilometres'}. Estimated
          distances are ranges, not extra targets. Times that include distance
          steps are planning estimates.
        </p>
      </section>
      <CustomizationSummary profile={preview.profile} />
      <div className="notice">
        {(previewVersion !== version || effectiveDate !== today) &&
          'This preview is out of date. Go back and preview again. '}
        {changes.length - added.length} upcoming sessions change; {added.length}{' '}
        are added; {removed.length} are removed from the schedule. Race day
        remains {dateLabel(plan.profile.raceDate)}.
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
      {!!preview.profile.practiceInDark !== !!plan.profile.practiceInDark && (
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
      {entries.length === 0 && (
        <p className="notice">
          No upcoming run prescriptions change. Your preference settings will
          still be saved.
        </p>
      )}
      <div
        className="session-change-list"
        aria-label="Upcoming workout changes"
      >
        {entries.slice(0, showAll ? undefined : 12).map(({ before, after }) => {
          const workout = after ?? before!;
          const rows = workoutComparisonRows(
            before,
            after,
            plan.profile,
            preview.profile,
          );
          const kind = !before ? 'Added' : !after ? 'Removed' : 'Updated';
          return (
            <article className="session-change" key={workout.id}>
              <header className="session-change-heading">
                <div>
                  <span>{dateLabel(workout.date)}</span>
                  <h3>{workout.title}</h3>
                </div>
                <span className="session-change-kind" data-kind={kind}>
                  {kind}
                </span>
              </header>
              <PrescriptionComparison
                label={`${dateLabel(workout.date)} workout comparison`}
                rows={rows}
              />
              <details className="change-reason">
                <summary>Why this changes</summary>
                <p>
                  {after?.reason ??
                    'This session is no longer scheduled with your revised preferences. The remaining sessions are shown in this preview.'}
                </p>
              </details>
              <details className="change-prescription-details">
                <summary>Compare every step</summary>
                <div className="change-step-comparison">
                  <section aria-label="Before workout steps">
                    <h4>Before</h4>
                    {before ? (
                      <WorkoutSteps
                        workout={before}
                        profile={{
                          ...plan.profile,
                          units: preview.profile.units,
                        }}
                      />
                    ) : (
                      <p>Not scheduled</p>
                    )}
                  </section>
                  <section aria-label="After workout steps">
                    <h4>After</h4>
                    {after ? (
                      <WorkoutSteps workout={after} profile={preview.profile} />
                    ) : (
                      <p>Not scheduled</p>
                    )}
                  </section>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      {entries.length > 12 && (
        <button className="text-button" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${entries.length} changes`}
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
                preferences: {
                  ...submitted,
                  recentRace: submitted?.recentRace ?? null,
                },
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
  );
}
