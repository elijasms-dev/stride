import type { WorkoutTemplate } from './workout-library';

// Original prescriptions inspired by the supplied workout structures. Screenshot
// titles alone do not establish a dose; these are bounded Stride recipes.
const speed = {
  kind: 'fartlek',
  stimulus: 'aerobic-power',
  goals: ['5k', '10k', 'half', 'marathon'],
  phases: ['Build', 'Race preparation'],
  cue: 'Quick and controlled · 7 / 10 · smooth form, never sprint',
  intensity: 7,
  recoverySeconds: 60,
  recoveryMovement: 'walk',
} as const;
const tempo = {
  kind: 'tempo',
  stimulus: 'threshold',
  goals: ['10k', 'half', 'marathon'],
  phases: ['Build', 'Race preparation'],
  cue: 'Controlled tempo · 6 / 10 · keep the same effort to the finish',
  intensity: 6,
  recoverySeconds: 120,
  recoveryMovement: 'walk',
} as const;

function pair(
  id: string,
  base: Omit<WorkoutTemplate, 'id'>,
  metres: number[],
  floatMetres?: number,
): WorkoutTemplate[] {
  return [
    { ...base, id: `session-${id}-timed` },
    {
      ...base,
      id: `session-${id}-metres`,
      workMetres: metres,
      ...(floatMetres ? { floatMetres } : {}),
    },
  ];
}

export const STRUCTURED_FORMATS: WorkoutTemplate[] = [
  ...pair(
    'short-repeats',
    {
      ...speed,
      goals: [...speed.goals],
      phases: [...speed.phases],
      title: 'Short controlled repeats',
      workSeconds: [60],
      minimumReps: 4,
      maximumReps: 8,
      purpose:
        'Introduce quicker running in small, repeatable efforts. Walk the recoveries and keep the final repeat as relaxed as the first.',
    },
    [200],
  ),
  ...pair(
    'split-repeats',
    {
      ...speed,
      goals: [...speed.goals],
      phases: [...speed.phases],
      title: 'Two sets of repeats',
      workSeconds: [90],
      minimumReps: 4,
      maximumReps: 10,
      setCount: 2,
      setRecoverySeconds: 60,
      purpose:
        'Practise even quicker repetitions in two sets. Take the normal walking recovery plus an extra minute between sets, then repeat the same controlled effort.',
    },
    [400],
  ),
  ...pair(
    'long-into-short',
    {
      ...speed,
      goals: [...speed.goals],
      phases: [...speed.phases],
      title: 'Long into short intervals',
      workSeconds: [180, 180, 60, 60],
      minimumReps: 4,
      maximumReps: 4,
      completeSet: true,
      recoverySeconds: 90,
      purpose:
        'Settle into two longer repetitions, then two shorter ones at the same controlled effort. The shorter finish is for relaxed form, not sprinting.',
    },
    [600, 600, 200, 200],
  ),
  ...pair(
    'six-hundred',
    {
      ...speed,
      goals: [...speed.goals],
      phases: [...speed.phases],
      title: 'Controlled longer intervals',
      workSeconds: [180],
      minimumReps: 3,
      maximumReps: 6,
      recoverySeconds: 90,
      purpose:
        'Hold an even, repeatable rhythm through longer intervals. Use the walking resets to restore your breathing before each effort.',
    },
    [600],
  ),
  ...pair(
    'tempo-repeats',
    {
      ...tempo,
      goals: [...tempo.goals],
      phases: [...tempo.phases],
      title: 'Tempo repeats',
      workSeconds: [300],
      minimumReps: 2,
      maximumReps: 4,
      purpose:
        'Practise sustained tempo rhythm with a walking reset. Start patiently and keep every repetition at the same comfortably hard effort.',
    },
    [1000],
  ),
  ...pair(
    'long-tempo',
    {
      ...tempo,
      goals: [...tempo.goals],
      phases: [...tempo.phases],
      title: 'Long tempo repeats',
      workSeconds: [600],
      minimumReps: 2,
      maximumReps: 3,
      purpose:
        'Extend a familiar tempo rhythm into longer repetitions. The walking reset separates two controlled blocks; it is not permission to race either one.',
    },
    [2000],
  ),
  ...pair(
    'tempo-cut-down',
    {
      ...tempo,
      goals: [...tempo.goals],
      phases: [...tempo.phases],
      title: 'Tempo cut-down',
      workSeconds: [360, 240, 120],
      minimumReps: 3,
      maximumReps: 3,
      completeSet: true,
      purpose:
        'Run a descending tempo sequence at an even effort. Start with the longest block, then keep your form composed as the blocks shorten.',
    },
    [1500, 1000, 500],
  ),
  ...pair(
    'on-off',
    {
      ...tempo,
      goals: [...tempo.goals],
      phases: [...tempo.phases],
      title: 'Tempo on / off',
      workSeconds: [300],
      minimumReps: 2,
      maximumReps: 3,
      recoverySeconds: 0,
      floatSeconds: 300,
      purpose:
        'Alternate controlled tempo with genuinely easy running. Each on block has a full easy off block, including the last; this is not continuous threshold running.',
    },
    [1000],
    1000,
  ),
];
