import { kmDisplay, type Step, type Workout } from '@/lib/engine';
import {
  isSteadyRaceAdaptation,
  steadyRaceBriefing,
} from '@/lib/steady-race-workout';
import {
  duration,
  mainSetSummary,
  recoverySummary,
  specificWorkoutName,
} from '@/lib/workout-names';

export function SessionBriefing({
  workout: w,
  units = 'km',
}: {
  workout: Workout;
  units?: 'km' | 'mi';
}) {
  const summary = mainSetSummary(w);
  if (!summary) return null;
  const length = (steps: Step[]) =>
    !steps.length
      ? ''
      : steps.every((s) => s.metres !== undefined)
        ? `${kmDisplay(
            steps.reduce((n, s) => n + s.metres! / 1000, 0),
            units,
          )} ${units}`
        : duration(steps.reduce((n, s) => n + s.seconds, 0));
  const warm = length(w.steps.filter((s) => s.kind === 'warmup'));
  const easy = length(
    w.steps
      .slice(
        0,
        w.steps.findIndex((s) => s.kind === 'work' && s.intensity >= 4),
      )
      .filter((s) => s.kind === 'aerobic'),
  );
  const cool = length(w.steps.filter((s) => s.kind === 'cooldown'));
  const name = specificWorkoutName(w);
  const cue = isSteadyRaceAdaptation(w)
    ? steadyRaceBriefing
    : /pyramid/i.test(name)
      ? 'Keep the same effort as the repetitions grow and shrink. The shorter final efforts should feel smooth; do not turn them into a sprint.'
      : /cut-down/i.test(name)
        ? 'Find your rhythm in the longest effort. As each repetition gets shorter, keep that effort steady instead of chasing a faster finish.'
        : /bookends/i.test(name)
          ? 'Settle into the opening blocks, stay relaxed through the shorter middle efforts, then return to the opening rhythm for the finish.'
          : w.stimulus === 'threshold'
            ? 'Keep the first repeat controlled. Aim to make the final repeat feel as composed as the first; use each recovery to reset your breathing.'
            : w.stimulus === 'race-rhythm'
              ? 'Rehearse the rhythm you want on race day. Settle into each block gradually and resist running faster just because there is a recovery coming.'
              : w.stimulus === 'economy'
                ? 'Build speed smoothly, keep your shoulders loose and ease off before your form becomes strained. Recover fully between strides.'
                : 'Start the first repetition under control. Keep your stride relaxed and repeat the same effort throughout, following the prescribed recoveries between repetitions.';
  return (
    <section className="session-briefing" aria-label="Main set briefing">
      <span className="session-briefing-label">Main set</span>
      <strong className="session-briefing-set">{summary}</strong>
      <p className="session-briefing-recovery">{recoverySummary(w)}</p>
      <div className="session-briefing-outline">
        {warm && <span>{warm} warm-up</span>}
        {easy && <span>{easy} easy before the set</span>}
        {cool && <span>{cool} cool-down</span>}
      </div>
      <details>
        <summary>How to run this session</summary>
        <p>{cue}</p>
        <p>
          Keep the warm-up and cool-down easy enough to talk. If you cannot
          recover comfortably between efforts, finish with easy running instead.
        </p>
      </details>
    </section>
  );
}
