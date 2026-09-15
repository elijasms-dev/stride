'use client';

import { type Plan, type PreferencePatch, type Workout } from '@/lib/engine';
import { SlidersHorizontal } from 'lucide-react';
import { TrainingComparison } from './training-comparison';
import { TrainingOverview } from './training-overview';
import { TrainingResearch } from './training-research';
import { useTrainingTools } from './use-training-tools';

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
  const tools = useTrainingTools({
    plan,
    today,
    isDemo,
    onPreferences,
    onNew,
  });
  const { section, setSection } = tools;
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
      <TrainingOverview {...tools} />
      <TrainingComparison {...tools} />
      <TrainingResearch {...tools} />
    </div>
  );
}
