import { kmDisplay, type Step, type Workout } from '@/lib/engine';
import { duration, mainSetSummary, recoverySummary } from '@/lib/workout-names';

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
  // Instructions belong to the saved prescription, not its display name.
  const cues = [
    ...new Set(
      w.steps
        .filter((step) => step.kind === 'work')
        .map((step) => step.pacing?.guidance ?? step.effort)
        .filter(Boolean),
    ),
  ];
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
        <ul className="session-saved-guidance">
          {cues.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
