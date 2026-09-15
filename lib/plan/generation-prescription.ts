import {
  SIMPLE_PRESCRIPTION_POLICY,
  SECONDS_PER_MINUTE,
  RUN_WALK_VARIANT_STRIDE,
} from './generation-constants.ts';
import { type Phase, type Step, type WorkoutKind } from './types.ts';
import { runWalkSteps } from '../prescription.ts';

export const focus: Record<Phase, string> = {
  Foundation: 'Establish a rhythm. Most of this week should feel comfortable.',
  Maintenance:
    'Maintain familiar training at a stable workload before race preparation. Review your next eight weeks from actual running.',
  Build: 'Build on what you can already do. Keep the easy days easy.',
  'Race preparation': 'Practice controlled, sustained efforts for your race.',
  Recovery: 'A little less work. More room to absorb your training.',
  Taper: 'Reduce the volume while keeping a little rhythm in your legs.',
  'Race week': 'Arrive rested. Your preparation is already in the bank.',
};
export function buildSteps(
  kind: WorkoutKind,
  minutes: number,
  variant: number,
  gentle: boolean,
  runWalk = false,
): Step[] {
  const step = (
    label: string,
    mins: number,
    effort: string,
    intensity: number,
    type: Step['kind'],
  ): Step => ({
    label,
    seconds: Math.round(mins * SECONDS_PER_MINUTE),
    effort,
    intensity,
    kind: type,
  });
  if (runWalk)
    return runWalkSteps(
      minutes,
      Math.min(
        SIMPLE_PRESCRIPTION_POLICY.maximumRunWalkStage,
        Math.floor(variant / RUN_WALK_VARIANT_STRIDE),
      ),
    );
  if (['easy', 'long', 'race'].includes(kind))
    return [
      step(
        kind === 'race'
          ? 'Race'
          : kind === 'long'
            ? 'Easy long run'
            : 'Easy run',
        minutes,
        kind === 'race'
          ? 'Start controlled, finish by feel'
          : 'Conversational · 2–3 / 10',
        kind === 'race' ? 7 : 3,
        'work',
      ),
    ];
  const warmup = SIMPLE_PRESCRIPTION_POLICY.warmupMinutes,
    cooldown = SIMPLE_PRESCRIPTION_POLICY.cooldownMinutes,
    budget = minutes - warmup - cooldown;
  const reps =
    kind === 'tempo'
      ? Math.max(
          SIMPLE_PRESCRIPTION_POLICY.minimumTempoRepetitions,
          Math.min(
            SIMPLE_PRESCRIPTION_POLICY.maximumTempoRepetitions,
            Math.floor(
              budget / SIMPLE_PRESCRIPTION_POLICY.tempoBoutAllowanceMinutes,
            ),
          ),
        )
      : Math.max(
          SIMPLE_PRESCRIPTION_POLICY.minimumRepetitions,
          Math.min(
            SIMPLE_PRESCRIPTION_POLICY.maximumRepetitions,
            Math.floor(
              budget /
                (kind === 'fartlek'
                  ? SIMPLE_PRESCRIPTION_POLICY.fartlekBoutAllowanceMinutes
                  : SIMPLE_PRESCRIPTION_POLICY.intervalBoutAllowanceMinutes),
            ),
          ),
        );
  const rest =
    kind === 'fartlek'
      ? SIMPLE_PRESCRIPTION_POLICY.fartlekRecoveryMinutes
      : SIMPLE_PRESCRIPTION_POLICY.intervalRecoveryMinutes;
  const work = Math.max(
    SIMPLE_PRESCRIPTION_POLICY.minimumWorkMinutes,
    Math.floor((budget - (reps - 1) * rest) / reps),
  );
  const steps = [step('Warm up', warmup, 'Start gently · 2 / 10', 2, 'warmup')];
  for (let r = 0; r < reps; r++) {
    steps.push(
      step(
        kind === 'tempo'
          ? `Controlled effort ${r + 1}`
          : kind === 'fartlek'
            ? `Pick-up ${r + 1}`
            : `Rep ${r + 1} of ${reps}`,
        work,
        gentle
          ? 'Steady · 5–6 / 10'
          : kind === 'tempo'
            ? 'Comfortably hard · 6–7 / 10'
            : 'Quick, never sprinting · 7 / 10',
        gentle ? 5 : kind === 'tempo' ? 6 : 7,
        'work',
      ),
    );
    if (r < reps - 1)
      steps.push(
        step('Easy recovery', rest, 'Walk or jog · 1–2 / 10', 2, 'recovery'),
      );
  }
  steps.push(
    step(
      'Cool down',
      minutes -
        steps.reduce((sum, s) => sum + s.seconds / SECONDS_PER_MINUTE, 0),
      'Let your breathing settle · 2 / 10',
      2,
      'cooldown',
    ),
  );
  void variant;
  return steps;
}
