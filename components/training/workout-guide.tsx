'use client';

import { type Plan, type Workout } from '@/lib/engine';
import { WORKOUT_LIBRARY, stimulusLabel } from '@/lib/workout-library';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Choice } from '../stride-ui';

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
