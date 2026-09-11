import type { Profile, Step, Workout } from './engine';

/** Labels and estimates describe the prescription; they are never pace targets or actuals. */
export function distanceEstimate(steps: Step[], p: Pick<Profile, 'easyPace'>) {
  if (steps.length > 0 && steps.every((s) => s.metres !== undefined)) {
    const km = steps.reduce((n, s) => n + s.metres! / 1000, 0);
    return {
      lowerKm: km,
      upperKm: km,
      basis: 'Exact distance prescribed in every step.',
    };
  }
  if (!p.easyPace)
    return {
      lowerKm: null,
      upperKm: null,
      basis: 'No reliable pace supplied; duration and effort are prescribed.',
    };
  let lower = 0,
    upper = 0;
  for (const s of steps) {
    if (s.metres !== undefined) {
      lower += s.metres / 1000;
      upper += s.metres / 1000;
      continue;
    }
    const minutes = s.seconds / 60;
    // Broad scenario bounds, independently authored; no inferred race/threshold pace.
    const walk = s.movement === 'walk';
    const slow = walk ? 20 : p.easyPace * (s.kind === 'recovery' ? 1.5 : 1.15);
    const quick = walk
      ? 10
      : p.easyPace * (s.kind === 'work' && s.intensity >= 5 ? 0.8 : 0.95);
    lower += minutes / slow;
    upper += minutes / quick;
  }
  return {
    lowerKm: Math.floor(lower * 10) / 10,
    upperKm: Math.ceil(upper * 10) / 10,
    basis:
      'Broad estimate from declared easy pace; faster work, recoveries and walking are uncertain.',
  };
}
export function qualityWorkMinutes(w: Workout) {
  if (w.kind === 'race') return 0;
  return w.steps
    .filter(
      (s) => s.kind === 'work' && s.intensity >= 4 && w.stimulus !== 'aerobic',
    )
    .reduce((n, s) => n + s.seconds / 60, 0);
}
export function summaryEffort(w: Workout) {
  if (w.stimulus === 'economy' || (!w.hard && w.kind !== 'race')) return '2–3';
  return (
    w.steps
      .find(
        (s) => s.kind === 'work' && /\d(?:[–-]\d)?\s*\/\s*10/.test(s.effort),
      )
      ?.effort.match(/\d(?:[–-]\d)?(?=\s*\/\s*10)/)?.[0] ??
    (w.pairType === 'double-threshold'
      ? '4–5'
      : w.kind === 'race'
        ? 'By feel'
        : '6–7')
  );
}
export function easySteps(minutes: number, label = 'Easy running'): Step[] {
  return [
    {
      kind: 'work',
      label,
      seconds: Math.round(minutes * 60),
      intensity: 3,
      effort: 'Conversational · full sentences · 2–3 / 10',
      movement: 'run',
    },
  ];
}

/** Keep walking as an explicit prescription, including after shortening or a return. */
export function runWalkIntervalSeconds(stage = 0) {
  return [60, 120, 180, 300, 480][Math.max(0, Math.min(4, stage))];
}
export function runWalkSteps(minutes: number, stage = 0): Step[] {
  const runSeconds = runWalkIntervalSeconds(stage);
  const walkSeconds = stage < 2 ? 120 : 90;
  const steps: Step[] = [];
  let remaining = Math.round(minutes * 60),
    running = true;
  while (remaining > 0) {
    const seconds = Math.min(remaining, running ? runSeconds : walkSeconds);
    steps.push({
      kind: running ? 'work' : 'recovery',
      label: running ? 'Comfortable jog' : 'Walk',
      seconds,
      effort: running
        ? 'Easy · full sentences · 2–3 / 10'
        : 'Relax and recover',
      intensity: running ? 3 : 1,
      movement: running ? 'run' : 'walk',
    });
    remaining -= seconds;
    running = !running;
  }
  return steps;
}
