'use client';

import { useId, useState } from 'react';
import type { Profile, Step, Workout } from '@/lib/engine';
import { eventDistanceDisplay, kmDisplay } from '@/lib/engine';
import { workoutStepGroups } from '@/lib/workout-groups';
import { stepLength } from '@/lib/workout-names';
import { targetLabel } from '@/lib/workout-targets';
import { DrawnBracket, DrawnSelection, DrawnUnderline } from './drawn-ui';

/** Use saved steps for a headline; a mixed main set has no single target. */
export function workoutTargetSummary(
  workout: Workout,
  units: Profile['units'],
) {
  const work = workout.steps.filter((step) => step.kind === 'work');
  const steps = work.length
    ? work
    : workout.steps.filter((step) => step.kind === 'aerobic');
  if (!steps.length) return null;
  const signatures = new Set(
    steps.map((step) =>
      JSON.stringify([
        step.target?.mode,
        step.target?.low,
        step.target?.high,
        step.pacing?.role ?? step.effortRole ?? null,
      ]),
    ),
  );
  if (signatures.size > 1) {
    const allPace = steps.every((step) => step.target?.mode === 'pace');
    const values = new Set(
      steps.map((step) =>
        JSON.stringify([step.target?.low, step.target?.high]),
      ),
    );
    return {
      value:
        allPace && values.size > 1
          ? 'Varied paces'
          : steps.every((step) => !step.target)
            ? 'Varied efforts'
            : 'Varied targets',
      label: 'Follow each segment',
    };
  }
  const step = steps[0];
  return step.target
    ? {
        value: targetLabel(step.target, units),
        label:
          step.pacing?.label ??
          (step.target.mode === 'pace' ? 'Target pace' : 'Target heart rate'),
      }
    : null;
}

export function SavedPaceExplanation({ step }: { step: Step }) {
  const pacing = step.pacing;
  if (!pacing) return null;
  return (
    <details className="saved-pace-explanation">
      <summary>{step.target ? 'Why this target?' : 'Why by effort?'}</summary>
      <p>{pacing.reason}</p>
      <p className="saved-pace-source">
        {pacing.source.url ? (
          <a href={pacing.source.url} target="_blank" rel="noreferrer">
            {pacing.source.title}
          </a>
        ) : (
          pacing.source.title
        )}
        {pacing.method === 'manual-override' && ' · Your own target'}
      </p>
    </details>
  );
}

const labels: Record<Step['kind'], string> = {
  warmup: 'Warm-up',
  aerobic: 'Easy running',
  work: 'Main set',
  recovery: 'Recovery',
  cooldown: 'Cool-down',
};

/** Keep authored track repetitions in metres; ordinary running follows display units. */
export function sessionStepLength(
  step: Step,
  workout: Workout,
  units: Profile['units'],
) {
  if (
    step.metres !== undefined &&
    (['race', 'easy', 'long'].includes(workout.kind) ||
      ['warmup', 'aerobic', 'cooldown'].includes(step.kind))
  ) {
    const distance =
      workout.kind === 'race'
        ? eventDistanceDisplay(step.metres / 1000, units)
        : kmDisplay(step.metres / 1000, units);
    return `${distance} ${units}`;
  }
  return stepLength(step);
}

export function SessionSequence({
  workout,
  units,
  compact = false,
  selectedIndex,
  onSelect,
}: {
  workout: Workout;
  units: Profile['units'];
  compact?: boolean;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const groups = workoutStepGroups(workout.steps);
  const [localSelection, setLocalSelection] = useState(0);
  const selected = selectedIndex ?? localSelection;
  const active = groups.find((group) => group.start === selected) ?? groups[0];
  const id = useId();
  if (!active) return null;
  const choose = (index: number) => {
    setLocalSelection(index);
    onSelect?.(index);
  };
  const groupLabel = (group: (typeof groups)[number]) =>
    `${group.repetitions > 1 ? `${group.repetitions} × ` : ''}${sessionStepLength(group.work, workout, units)}`;
  return (
    <section
      className={`session-sequence ${compact ? 'is-compact' : ''}`}
      aria-label="Session sequence"
    >
      {!compact && (
        <h3 className="ink-heading">
          The shape of this run
          <DrawnUnderline />
        </h3>
      )}
      <div className="sequence-scroll">
        <ol className="sequence-blocks">
          {groups.map((group) => {
            const step = group.work;
            const content = (
              <>
                <span className="sequence-kind">{labels[step.kind]}</span>
                <strong>{groupLabel(group)}</strong>
                {group.reset && group.repetitions > 1 && (
                  <span className="sequence-recovery-cue">
                    {group.resetAfterLast
                      ? group.repetitions
                      : group.repetitions - 1}{' '}
                    × {sessionStepLength(group.reset, workout, units)} recovery
                    {group.reset.movement === 'walk' ? ' walk' : ''}
                  </span>
                )}
                {!compact && (
                  <span className="sequence-role">
                    {step.pacing?.label ??
                      step.label.replace(/ · \d+ of \d+$/, '')}
                  </span>
                )}
                {group.repetitions > 1 && (
                  <span className="sequence-repeat-mark" aria-hidden="true">
                    <DrawnBracket />
                  </span>
                )}
              </>
            );
            return (
              <li key={group.start} data-kind={step.kind}>
                {compact ? (
                  <div className="sequence-block">{content}</div>
                ) : (
                  <button
                    type="button"
                    className="sequence-block"
                    aria-pressed={group.start === active.start}
                    aria-controls={`${id}-instruction`}
                    onClick={() => choose(group.start)}
                  >
                    {content}
                    {group.start === active.start && <DrawnSelection />}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {compact ? (
        <p className="sequence-note">Session order · not to scale</p>
      ) : (
        <>
          <p className="sequence-note">
            Schematic, not to scale or a pace graph. Select a block to read its
            instructions.
          </p>
          <div
            id={`${id}-instruction`}
            className="sequence-instruction"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>
              {active.work.pacing?.label ??
                active.work.label.replace(/ · \d+ of \d+$/, '')}
            </strong>
            {active.work.target && (
              <span className="sequence-target">
                {targetLabel(active.work.target, units)}
              </span>
            )}
            <p>{active.work.pacing?.guidance ?? active.work.effort}</p>
            {active.reset && active.repetitions > 1 && (
              <p className="sequence-reset">
                {sessionStepLength(active.reset, workout, units)}{' '}
                {active.reset.movement === 'walk' ? 'walking' : 'easy'} recovery{' '}
                {active.resetAfterLast
                  ? 'after every repeat, including the last'
                  : `between repeats (${active.repetitions - 1} ${active.repetitions === 2 ? 'recovery' : 'recoveries'})`}
                .
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
