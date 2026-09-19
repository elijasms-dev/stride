'use client';

import { type Plan, type PreferencePatch, type Profile } from '@/lib/engine';
import type { SubmitEvent } from 'react';
import { useRef, useState } from 'react';
import { api } from '../stride-ui';
import { upcomingPlanChanges } from '@/lib/plan-change-summary';

export function usePlanPreferences({
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
  const [p, setP] = useState<Profile>({
      ...plan.profile,
      ...initialPatch,
      recentRace:
        initialPatch.recentRace === null
          ? undefined
          : (initialPatch.recentRace ?? plan.profile.recentRace),
    }),
    [previewVersion, setPreviewVersion] = useState(version),
    [effectiveDate, setEffectiveDate] = useState(today),
    [showAll, setShowAll] = useState(false),
    [preview, setPreview] = useState<Plan | null>(null),
    [error, setError] = useState(''),
    [checking, setChecking] = useState(false);
  const { changes, removed } = preview
    ? upcomingPlanChanges(plan, preview, today)
    : { changes: [], removed: [] };
  async function previewPreferences(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (flight.current) return;
    flight.current = true;
    setChecking(true);
    const snapshot = structuredClone(p);
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
          preferences: {
            ...snapshot,
            recentRace: snapshot.recentRace ?? null,
          },
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
  }
  return {
    initialPatch,
    plan,
    today,
    version,
    onClose,
    onAction,
    busy,
    submitted,
    p,
    setP,
    previewVersion,
    effectiveDate,
    showAll,
    setShowAll,
    preview,
    setPreview,
    error,
    setError,
    checking,
    changes,
    removed,
    previewPreferences,
  };
}
