'use client';

import { type Plan } from '@/lib/engine';
import { runFeedbackError } from '@/lib/form-values';
import { recordingCandidates } from '@/lib/training-history';
import type { SubmitEvent } from 'react';
import { useState } from 'react';
import { useDurableDraft } from '@/lib/durable-draft';
import { useRunFeedbackValidation } from '../run-feedback-validation';
import type { Activity } from '../settings';

export function useExtraRunForm({
  draftScope = '',
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
  draftScope?: string;
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
  const draft = {
    date,
    minutes: Number.isFinite(minutes) ? minutes : null,
    distance,
    effort,
    feeling,
    note,
    correctionReason,
    target,
  };
  const { draftStatus, clearDraft } = useDurableDraft({
    scope: draftScope,
    key: `extra-run:${existing?.id ?? imported?.id ?? today}`,
    value: draft,
    isValid: (value: unknown): value is typeof draft => {
      if (!value || typeof value !== 'object') return false;
      const v = value as typeof draft;
      return (
        [
          'date',
          'effort',
          'feeling',
          'note',
          'correctionReason',
          'target',
        ].every((key) => typeof v[key as keyof typeof draft] === 'string') &&
        (v.minutes === null ||
          (typeof v.minutes === 'number' && Number.isFinite(v.minutes))) &&
        (v.distance === null ||
          (typeof v.distance === 'number' && Number.isFinite(v.distance)))
      );
    },
    restore: (value) => {
      setDate(value.date);
      setMinutes(value.minutes ?? NaN);
      setDistance(value.distance);
      setEffort(value.effort);
      setFeeling(value.feeling);
      setNote(value.note);
      setCorrectionReason(value.correctionReason);
      setTarget(value.target);
    },
  });
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
  async function saveRun(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      if (!target)
        throw new Error('Choose where this recording belongs before saving.');
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
      clearDraft();
      (onSaved ?? onClose)();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    draftStatus,
    plan,
    today,
    onClose,
    onBackToRecordings,
    onSaved,
    onAction,
    busy,
    imported,
    existing,
    unit,
    date,
    setDate,
    minutes,
    setMinutes,
    distance,
    setDistance,
    effort,
    setEffort,
    feeling,
    setFeeling,
    note,
    setNote,
    correctionReason,
    setCorrectionReason,
    error,
    setError,
    target,
    setTarget,
    matches,
    extras,
    attachedFeedback,
    feedbackValidation,
    saveRun,
  };
}
