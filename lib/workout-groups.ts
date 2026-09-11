import type { Step } from './engine';

export type StepGroup = {
  start: number;
  repetitions: number;
  work: Step;
  reset?: Step;
  resetAfterLast: boolean;
};
const signature = (s: Step) =>
  JSON.stringify([
    s.kind,
    s.seconds,
    s.metres,
    s.movement,
    s.intensity,
    s.effort,
    s.target,
  ]);

/** Presentation only: collapse genuinely identical repetitions without changing
 * the canonical chronology used by workload calculations and watch exports.
 */
export function workoutStepGroups(steps: Step[]): StepGroup[] {
  const result: StepGroup[] = [];
  let i = 0;
  while (i < steps.length) {
    const start = i,
      work = steps[i];
    const reset = steps[i + 1];
    const repeatable =
      work.kind === 'work' &&
      work.intensity >= 4 &&
      reset &&
      (reset.kind === 'recovery' ||
        (reset?.kind === 'aerobic' && reset.label === 'Easy off block'));
    let repetitions = 1;
    if (repeatable) {
      while (
        steps[i + 2] &&
        signature(steps[i + 2]) === signature(work) &&
        signature(steps[i + 1]) === signature(reset)
      ) {
        repetitions++;
        i += 2;
      }
    }
    const resetAfterLast =
      repetitions > 1 &&
      reset?.kind === 'aerobic' &&
      !!steps[i + 1] &&
      signature(steps[i + 1]) === signature(reset);
    result.push({
      start,
      repetitions,
      work,
      ...(repetitions > 1 ? { reset } : {}),
      resetAfterLast,
    });
    i += resetAfterLast ? 2 : 1;
  }
  return result;
}
