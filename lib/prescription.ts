import {
  calculateTrainingPaceRanges,
  schedulingEasyPace,
} from './fitness-pacing.ts';
import type { Profile, Step, Workout } from './engine';

/** One estimate from the executable step endpoints, never from the old allocation. */
export function distanceEstimate(
  steps: Step[],
  p: Pick<Profile, 'easyPace' | 'recentRace' | 'workoutTargets'>,
) {
  if (steps.length > 0 && steps.every((s) => s.metres !== undefined)) {
    const km = steps.reduce((n, s) => n + s.metres!, 0) / 1000;
    return {
      lowerKm: km,
      upperKm: km,
      basis: 'Exact distance prescribed in every step.',
    };
  }
  const hasPaceBasis =
    !!p.easyPace ||
    !!(p.workoutTargets?.mode === 'pace' && p.workoutTargets.pace?.easy) ||
    !!(p.recentRace && calculateTrainingPaceRanges(p.recentRace));
  let lower = 0,
    upper = 0,
    inferred = false;
  for (const s of steps) {
    if (s.metres !== undefined) {
      lower += s.metres / 1000;
      upper += s.metres / 1000;
    } else if (s.target?.mode === 'pace') {
      lower += s.seconds / s.target.high;
      upper += s.seconds / s.target.low;
    } else {
      if (!hasPaceBasis)
        return {
          lowerKm: null,
          upperKm: null,
          basis:
            'No reliable pace supplied; duration and effort are prescribed.',
        };
      inferred = true;
      const minutes = s.seconds / 60;
      const walk = s.movement === 'walk';
      // Effort-only portions have deliberately broad scenario bounds.
      const slow = walk
        ? 20
        : schedulingEasyPace(p) * (s.kind === 'recovery' ? 1.5 : 1.15);
      const quick = walk
        ? 10
        : schedulingEasyPace(p) *
          (s.kind === 'work' && s.intensity >= 5 ? 0.8 : 0.95);
      lower += minutes / slow;
      upper += minutes / quick;
    }
  }
  return {
    lowerKm: Math.floor(lower * 10 + 1e-9) / 10,
    upperKm: Math.ceil(upper * 10 - 1e-9) / 10,
    basis: inferred
      ? 'Broad estimate from the current easy-pace basis; effort-only running, recoveries and walking are uncertain.'
      : 'Calculated from prescribed distances, durations and pace ranges; not measured distance.',
  };
}

/** Distance ends the step. Its old time allowance is not the delivered work dose. */
export function stepDurationRange(step: Step) {
  if (step.metres !== undefined && step.target?.mode === 'pace')
    return {
      lowerSeconds: (step.metres * step.target.low) / 1000,
      upperSeconds: (step.metres * step.target.high) / 1000,
    };
  return { lowerSeconds: step.seconds, upperSeconds: step.seconds };
}
export function qualityWorkMinutes(w: Workout) {
  if (w.kind === 'race') return 0;
  return w.steps
    .filter(
      (s) => s.kind === 'work' && s.intensity >= 4 && w.stimulus !== 'aerobic',
    )
    .reduce((n, s) => n + stepDurationRange(s).upperSeconds / 60, 0);
}

/** Unrounded bounds exist only when all endpoints/pace ranges specify distance. */
export function executableDistanceRange(steps: Step[]) {
  if (
    !steps.length ||
    steps.some((s) => s.metres === undefined && s.target?.mode !== 'pace')
  )
    return null;
  if (steps.every((s) => s.metres !== undefined)) {
    const km = steps.reduce((n, s) => n + s.metres!, 0) / 1000;
    return { lowerKm: km, upperKm: km };
  }
  return steps.reduce(
    (range, s) => {
      if (s.metres !== undefined) {
        range.lowerKm += s.metres / 1000;
        range.upperKm += s.metres / 1000;
      } else if (s.target?.mode === 'pace') {
        range.lowerKm += s.seconds / s.target.high;
        range.upperKm += s.seconds / s.target.low;
      }
      return range;
    },
    { lowerKm: 0, upperKm: 0 },
  );
}

/** Refresh derived metadata together; callers decide when a draft allocation becomes fixed. */
export function resolvePrescription(
  w: Workout,
  p: Profile,
  preserveAllocation = false,
): Workout {
  const steps = w.steps.map((s) => {
    if (
      s.metres === undefined ||
      s.target?.mode !== 'pace' ||
      w.kind === 'race'
    )
      return s;
    const needed = (s.metres * s.target.high) / 1000;
    // Preserve the existing one-second/metre conversion tolerance; rounding
    // must not manufacture an extra second beyond a fully funded session cap.
    const seconds =
      needed <= s.seconds + 1
        ? Math.min(s.seconds, Math.ceil(needed - 1e-9))
        : Math.ceil(needed - 1e-9);
    return { ...s, seconds, planningPaceSecondsPerKm: s.target.high };
  });
  const range = executableDistanceRange(steps);
  const estimatedKm =
    !preserveAllocation && w.kind !== 'race' && range
      ? Math.max(range.lowerKm, Math.min(range.upperKm, w.estimatedKm))
      : w.estimatedKm;
  return {
    ...w,
    prescriptionVersion: 'pace-resolved-v1',
    prescriptionPaceBasis:
      distanceEstimate(steps, p).lowerKm !== null
        ? schedulingEasyPace(p)
        : undefined,
    steps,
    minutes: steps.reduce((n, s) => n + s.seconds, 0) / 60,
    estimatedKm,
    distanceEstimate: distanceEstimate(steps, p),
    qualityMinutes: qualityWorkMinutes({ ...w, steps }),
  };
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
