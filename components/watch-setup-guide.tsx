'use client';
import { Check, ChevronRight, Watch } from 'lucide-react';
import { dateLabel } from '@/lib/engine';
import { type Workout } from '@/lib/plan/types';
import { watchSetupState, type WatchSetupInput } from '@/lib/watch-setup';

export type WatchSetupGuideProps = WatchSetupInput & {
  onWorkout: (workout: Workout) => void;
  disabled?: boolean;
};

export function WatchSetupGuide({
  onWorkout,
  disabled = false,
  ...input
}: WatchSetupGuideProps) {
  const state = watchSetupState(input);
  const bridgeSteps = [
    {
      title: 'Connect Intervals.icu',
      description: state.connected
        ? 'Your Intervals.icu connection is saved. Garmin planned-workout uploads must also be enabled in Intervals settings.'
        : 'Use the connection form below. The current watch route is Stride → Intervals.icu → Garmin Connect.',
    },
    {
      title: 'Open one workout and send it',
      description:
        state.mode === 'demo'
          ? 'Create your personal plan first. Example workouts cannot be sent.'
          : state.mode === 'empty'
            ? 'There are no unfinished workouts in the next seven days. A workout will be available here when it enters that window.'
            : 'Use a real upcoming session from your plan. Open its delivery controls to send it or check its existing receipt.',
    },
    {
      title: 'Check receipt in Intervals.icu',
      description: state.providerReceived
        ? 'Intervals.icu received this version of the workout. That does not establish delivery to your watch.'
        : state.needsReview
          ? 'The saved receipt needs a fresh check. Open the workout to review delivery for the current plan and connection.'
          : 'After sending, Stride checks the saved workout in Intervals.icu and shows its receipt in the delivery controls.',
    },
    {
      title: 'Find it on your watch',
      description: state.watchConfirmed
        ? 'You confirmed seeing this workout on your watch. This applies to this workout and connection.'
        : 'Sync Garmin Connect, open the scheduled workout on your compatible watch, and check its date and steps. Then use “I can see it on my watch” in the workout’s delivery controls.',
    },
  ];
  const steps =
    state.mode === 'fit'
      ? [
          {
            title: 'Open a workout and download its FIT file',
            description:
              'These workouts use heart-rate targets. A FIT file preserves those targets; no Intervals.icu connection is needed for the download.',
          },
          {
            title: 'Import the file using your device’s instructions',
            description:
              'Use your compatible watch’s supported workout-file import. A download has no Intervals receipt and does not confirm a device import.',
          },
          {
            title: 'Check the workout on your watch',
            description:
              'Open the workout and check its date, steps and heart-rate targets. Stride cannot verify a downloaded file reached your device.',
          },
        ]
      : bridgeSteps;
  const completedSteps =
    state.mode === 'fit' ? [false, false, false] : state.completedSteps;
  const currentStep = completedSteps.findIndex((complete) => !complete);
  const canOpen =
    !!state.workout && (state.connected || state.mode === 'fit') && !disabled;
  return (
    <section className="watch-setup-guide" aria-labelledby="watch-setup-title">
      <div className="watch-week-heading">
        <div>
          <h3 id="watch-setup-title">Check your first watch workout</h3>
          <p>Follow one session all the way to your watch.</p>
        </div>
        <Watch size={24} aria-hidden="true" />
      </div>
      <ol className="watch-setup-steps" aria-label="Watch setup progress">
        {steps.map((step, index) => (
          <li
            key={step.title}
            data-complete={completedSteps[index]}
            aria-current={currentStep === index ? 'step' : undefined}
          >
            <span className="watch-setup-marker" aria-hidden="true">
              {completedSteps[index] ? <Check size={15} /> : index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <span className="watch-setup-status">
                {completedSteps[index]
                  ? 'Complete'
                  : index === currentStep
                    ? 'Next step'
                    : 'Not yet verified'}
              </span>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {state.workout && (
        <div className="watch-setup-action">
          <p>
            {dateLabel(state.workout.date)} · {state.workout.title}
          </p>
          <button
            type="button"
            className="secondary-button"
            disabled={!canOpen}
            onClick={() => {
              if (canOpen && state.workout) onWorkout(state.workout);
            }}
          >
            {state.mode === 'fit'
              ? 'Open FIT download'
              : state.watchConfirmed
                ? 'Review verified workout'
                : 'Open this workout'}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="watch-setup-footnote">
        Watch confirmation comes from you. Stride cannot inspect your device;
        supported import options depend on your watch.
      </p>
    </section>
  );
}
