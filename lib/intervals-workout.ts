import { paceText } from './workout-targets.ts';
import type { Workout } from './engine';

/** Native workout text preserves open targets that Intervals' FIT importer changes to HR zones. */
export function intervalsWorkoutText(workout: Workout): string {
  return workout.steps
    .map((step) => {
      const cue = `${step.label} · ${step.effort}`.replace(/\s+/g, ' ').trim();
      // m means minutes in the provider grammar; mtr means metres.
      const duration =
        step.metres !== undefined ? `${step.metres}mtr` : `${step.seconds}s`;
      const intensity =
        step.kind === 'warmup'
          ? 'warmup'
          : step.kind === 'cooldown'
            ? 'cooldown'
            : step.kind === 'recovery'
              ? 'recovery'
              : 'active';
      if (step.target?.mode === 'heart-rate')
        throw new Error(
          'Direct BPM targets are not yet supported by the Intervals connector. Download the Garmin FIT file, or choose pace or effort.',
        );
      const target =
        step.target?.mode === 'pace'
          ? `${paceText(step.target.low)}-${paceText(step.target.high)}/km Pace`
          : 'freeride';
      return `- ${cue} ${duration} ${target} intensity=${intensity}`;
    })
    .join('\n');
}
