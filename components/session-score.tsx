'use client';
import { targetLabel } from '@/lib/workout-targets';

import { useState, type CSSProperties } from 'react';
import { eventDistanceDisplay, type Step, type Workout } from '@/lib/engine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

function stepDuration(step: Step, unit: 'km' | 'mi') {
  if (step.metres !== undefined) {
    return `${eventDistanceDisplay(step.metres / 1000, unit)} ${unit}`;
  }
  const minutes = Math.floor(step.seconds / 60);
  const seconds = Math.round(step.seconds % 60);
  return seconds
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${minutes} min`;
}

/** A read-only view of the prescribed steps. Selection never changes the workout. */
export function SessionScore({
  workout,
  unit,
}: {
  workout: Workout;
  unit: 'km' | 'mi';
}) {
  const [selected, setSelected] = useState(0);
  if (!workout.steps.length) return null;
  const single = workout.steps.length === 1;
  return (
    <section className="session-score" aria-label="Workout sequence">
      <div className="score-heading">
        <h3>Session sequence</h3>
        <span>
          {single ? 'One continuous effort' : 'Select a step to explore'}
        </span>
      </div>
      <Tabs
        value={Math.min(selected, workout.steps.length - 1)}
        onValueChange={(value) => setSelected(Number(value))}
        className="score-tabs"
      >
        <div className="score-scroll">
          <TabsList
            className="score-bars"
            aria-label="Workout steps"
            style={{
              minWidth: `${Math.min(1200, workout.steps.length * 44)}px`,
            }}
          >
            {workout.steps.map((step, index) => (
              <TabsTrigger
                key={index}
                value={index}
                className="score-step"
                aria-label={`Step ${index + 1}: ${step.label}, ${stepDuration(step, unit)}`}
                style={
                  {
                    '--step-height': `${22 + Math.max(0, Math.min(10, step.intensity)) * 7}%`,
                    flexGrow: Math.max(1, step.seconds / 60),
                  } as CSSProperties
                }
              >
                <span
                  className="score-bar"
                  data-kind={step.kind}
                  aria-hidden="true"
                />
                <span className="score-step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {workout.steps.map((step, index) => (
          <TabsContent key={index} value={index} className="score-detail">
            <div className="score-step-title">
              <span>
                Step {index + 1} of {workout.steps.length}
              </span>
              <h4>{step.label}</h4>
            </div>
            <strong className="score-duration">
              {stepDuration(step, unit)}
            </strong>
            <p>{step.effort}</p>
            {step.target && (
              <span className="step-target">
                {targetLabel(step.target, unit)}
              </span>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <p className="score-caption">Bars show effort in session order.</p>
    </section>
  );
}
