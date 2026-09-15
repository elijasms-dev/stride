'use client';
import { CustomizationSummary } from '../runner-customization-fields';

import { dateLabel, type Plan } from '@/lib/engine';
import { runDuration } from '@/lib/journal-view';
import { desiredRuns, requestedQualityCount } from '@/lib/training-structure';
import { ArrowRight } from 'lucide-react';
import { BusyButton } from '../action-progress';
import type { usePlanPreferences } from './use-plan-preferences';

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
  return (
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
          Recovery and taper weeks can be lighter. Completed runs and workouts
          you edited individually stay as saved.
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
        {changes.length} upcoming sessions change; {removed.length} are removed
        from the schedule. Race day remains {dateLabel(plan.profile.raceDate)}.
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
        <button className="text-button" onClick={() => setShowAll(!showAll)}>
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
