'use client';

import {
  revisePreferences,
  trainingFamily,
  type Plan,
  type PreferencePatch,
} from '@/lib/engine';
import { useMemo, useState } from 'react';
import { metrics } from './comparison-metrics';

export function useTrainingTools({
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
  return {
    plan,
    today,
    isDemo,
    onPreferences,
    onNew,
    option,
    setOption,
    section,
    setSection,
    selectedWeek,
    setSelectedWeek,
    compare,
    current,
    candidate,
    unit,
    family,
    scale,
    trainingDisplay,
  };
}
