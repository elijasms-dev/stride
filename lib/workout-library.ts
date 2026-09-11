import { STRUCTURED_FORMATS } from './workout-formats.ts';
import { MARATHON_WORKOUTS } from './marathon-workouts.ts';
import { usesMarathonBook, marathonTaperFraction } from './marathon-book.ts';
import { stepLength, withSpecificWorkoutName } from './workout-names.ts';
import { withWorkoutTargets, workoutStepTarget } from './workout-targets.ts';
import { marathonRecipe, marathonSecondQuality } from './marathon-model.ts';
import {
  runWalkSteps,
  distanceEstimate,
  qualityWorkMinutes,
} from './prescription.ts';
import type {
  Goal,
  Phase,
  Profile,
  Step,
  Workout,
  WorkoutKind,
} from './engine';

export type Stimulus =
  | 'aerobic'
  | 'threshold'
  | 'aerobic-power'
  | 'economy'
  | 'race-rhythm';
export type WorkoutTemplate = {
  id: string;
  title: string;
  kind: WorkoutKind;
  stimulus: Stimulus;
  goals: Goal[];
  phases: Phase[];
  purpose: string;
  cue: string;
  workSeconds: number[];
  workMetres?: number[];
  completeSet?: boolean;
  planningPaceSecondsPerKm?: number;
  recoverySeconds: number;
  recoveryMovement?: 'run' | 'walk';
  setCount?: number;
  setRecoverySeconds?: number;
  floatSeconds?: number;
  floatMetres?: number;
  floatPlanningPaceSecondsPerKm?: number;
  minimumReps: number;
  maximumReps: number;
  intensity: number;
  hills?: boolean;
  spreadAerobic?: boolean;
  warmupSeconds?: number;
  cooldownSeconds?: number;
  maxWorkFraction?: number;
  recoveryRatio?: number;
  continuousStepSeconds?: number;
  minimumContinuousSeconds?: number;
};
const racePhases: Phase[] = ['Foundation', 'Build', 'Race preparation'];

// Original workout recipes. Sources explain training purposes, not these numerical doses.
export const WORKOUT_LIBRARY: WorkoutTemplate[] = [
  {
    id: 'threshold-three',
    title: 'Three-minute cruise intervals',
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k', 'half', 'marathon'],
    phases: ['Foundation', 'Build', 'Race preparation'],
    purpose:
      'Practice settling quickly into a controlled tempo rhythm, with brief easy resets.',
    cue: 'Even, comfortably hard · 6 / 10 · leave something in reserve',
    workSeconds: [180],
    recoverySeconds: 60,
    minimumReps: 2,
    maximumReps: 8,
    intensity: 6,
  },
  {
    id: 'threshold-five',
    title: 'Five-minute tempo blocks',
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k', 'half', 'marathon'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Hold a relaxed tempo rhythm for longer before each short easy recovery.',
    cue: 'Even, comfortably hard · 6 / 10 · leave something in reserve',
    workSeconds: [300],
    recoverySeconds: 90,
    minimumReps: 2,
    maximumReps: 5,
    intensity: 6,
  },
  {
    id: 'threshold-pyramid',
    title: 'Tempo pyramid',
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k', 'half', 'marathon'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Keep the effort even while the repetitions grow, then shorten; the final efforts should still feel controlled.',
    cue: 'Even, comfortably hard · 6 / 10 · leave something in reserve',
    workSeconds: [180, 240, 300, 240, 180],
    recoverySeconds: 90,
    minimumReps: 5,
    maximumReps: 5,
    intensity: 6,
  },
  {
    id: 'power-ninety',
    title: 'Ninety-second repetitions',
    kind: 'fartlek',
    stimulus: 'aerobic-power',
    goals: ['5k', '10k'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Keep quicker running smooth and repeatable through short efforts with equal easy recoveries.',
    cue: 'Quick and controlled · 7 / 10 · never sprint',
    workSeconds: [90],
    recoverySeconds: 90,
    minimumReps: 4,
    maximumReps: 10,
    intensity: 7,
  },
  {
    id: 'race-rhythm-5-short',
    title: '5K rhythm changes',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['5k'],
    phases: ['Race preparation'],
    purpose:
      'Return to the same sustainable 5K rhythm through alternating short and longer efforts.',
    cue: 'Your sustainable 5K effort · controlled, not all-out',
    workSeconds: [60, 120, 60, 120],
    recoverySeconds: 90,
    minimumReps: 4,
    maximumReps: 4,
    intensity: 7,
  },
  {
    id: 'race-rhythm-10-short',
    title: 'Three-minute 10K blocks',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['10k'],
    phases: ['Race preparation'],
    purpose:
      'Find your race rhythm in shorter blocks and keep it even through the last repetition.',
    cue: 'Your sustainable 10K effort · comfortably hard',
    workSeconds: [180],
    recoverySeconds: 90,
    minimumReps: 2,
    maximumReps: 5,
    intensity: 6,
  },
  {
    id: 'half-short-blocks',
    title: 'Four-minute half-marathon blocks',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['half'],
    phases: ['Foundation', 'Build', 'Race preparation'],
    purpose:
      'Rehearse controlled race effort in shorter blocks, resetting easily between them.',
    cue: 'Measured half-marathon effort · 5–6 / 10 · finish in control',
    workSeconds: [240],
    recoverySeconds: 90,
    minimumReps: 2,
    maximumReps: 6,
    intensity: 6,
  },
  {
    id: 'half-rhythm-ladder',
    title: 'Half-marathon rhythm ladder',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['half'],
    phases: ['Race preparation'],
    purpose:
      'Stay patient as each race-effort block gets longer; hold the same effort throughout.',
    cue: 'Measured half-marathon effort · 5–6 / 10 · finish in control',
    workSeconds: [240, 360, 480],
    recoverySeconds: 120,
    minimumReps: 3,
    maximumReps: 3,
    intensity: 6,
  },
  {
    id: 'marathon-six',
    title: 'Six-minute marathon blocks',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['marathon'],
    phases: ['Foundation', 'Build', 'Race preparation'],
    purpose:
      'Practice returning smoothly to marathon effort, using shorter blocks and easy resets.',
    cue: 'Patient marathon effort · 4–5 / 10 · finish with reserve',
    workSeconds: [360],
    recoverySeconds: 120,
    minimumReps: 1,
    maximumReps: 8,
    intensity: 5,
  },
  {
    id: 'marathon-rhythm-ladder',
    title: 'Marathon rhythm ladder',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['marathon'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Settle into marathon effort, hold the middle block, then finish with a short controlled reminder.',
    cue: 'Patient marathon effort · 4–5 / 10 · finish with reserve',
    workSeconds: [240, 480, 240],
    recoverySeconds: 120,
    minimumReps: 3,
    maximumReps: 3,
    intensity: 5,
  },
  {
    id: 'marathon-continuous',
    title: 'Continuous marathon rhythm',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['marathon'],
    phases: ['Race preparation'],
    purpose:
      'Rehearse a longer uninterrupted stretch of patient marathon effort without increasing the total work.',
    cue: 'Patient marathon effort · 4–5 / 10 · finish with reserve',
    workSeconds: [960],
    recoverySeconds: 120,
    minimumReps: 1,
    maximumReps: 1,
    intensity: 5,
  },
  {
    id: 'half-rhythm',
    title: 'Half-marathon rhythm',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['half'],
    phases: ['Foundation', 'Build', 'Race preparation'],
    purpose: 'Practice a measured half-marathon effort in repeatable blocks.',
    cue: 'Measured race effort · 5–6 / 10 · finish in control',
    workSeconds: [360],
    recoverySeconds: 120,
    minimumReps: 2,
    maximumReps: 3,
    intensity: 6,
  },
  {
    id: 'half-long-blocks',
    title: 'Sustained half-marathon blocks',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['half'],
    phases: ['Race preparation', 'Taper'],
    purpose:
      'Build on shorter race-effort repetitions with longer, controlled blocks.',
    cue: 'Measured half-marathon effort · 5–6 / 10 · keep the last block controlled',
    workSeconds: [480],
    recoverySeconds: 120,
    minimumReps: 2,
    maximumReps: 3,
    intensity: 6,
  },
  {
    id: 'marathon-steady',
    title: 'Marathon steady blocks',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['marathon'],
    phases: ['Foundation', 'Build', 'Race preparation'],
    purpose:
      'Rehearse patient, steady running for a marathon without turning an ordinary training day into a race.',
    cue: 'Steady and sustainable · 4–5 / 10 · well below an all-out effort',
    workSeconds: [480],
    recoverySeconds: 180,
    minimumReps: 1,
    maximumReps: 6,
    intensity: 5,
  },
  {
    id: 'marathon-long-run',
    title: 'Long run with marathon effort',
    kind: 'long',
    stimulus: 'race-rhythm',
    goals: ['marathon'],
    phases: ['Race preparation'],
    purpose:
      'Run mostly easy, then rehearse controlled marathon effort in the later part of the run. This replaces a weekday quality session.',
    cue: 'Patient marathon effort · 4–5 / 10 · ease off if it stops feeling controlled',
    workSeconds: [600],
    recoverySeconds: 180,
    minimumReps: 1,
    maximumReps: 3,
    intensity: 5,
  },
  {
    id: 'marathon-long-blocks',
    title: 'Sustained marathon blocks',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['marathon'],
    phases: ['Build', 'Race preparation', 'Taper'],
    purpose:
      'Extend continuous, controlled marathon-effort running after shorter steady blocks have become familiar.',
    cue: 'Patient marathon effort · 4–5 / 10 · finish with reserve',
    workSeconds: [600],
    recoverySeconds: 180,
    minimumReps: 2,
    maximumReps: 4,
    intensity: 5,
  },
  {
    id: 'ultra-steady',
    title: 'Ultra endurance rhythm',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['ultra'],
    phases: ['Foundation', 'Build', 'Race preparation'],
    purpose:
      'Practice sustainable effort and relaxed form for a long runnable course. Use planned walk breaks when needed.',
    cue: 'Sustainable all-day effort · 3–4 / 10 · walking is welcome',
    workSeconds: [600],
    recoverySeconds: 180,
    minimumReps: 1,
    maximumReps: 2,
    intensity: 4,
  },

  {
    id: 'threshold-cruise',
    title: 'Cruise intervals',
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k', 'half', 'marathon'],
    phases: racePhases,
    purpose:
      'Accumulate controlled, comfortably hard running with short easy breaks.',
    cue: 'Comfortably hard · 6–7 / 10 · short phrases',
    workSeconds: [240],
    recoverySeconds: 90,
    minimumReps: 2,
    maximumReps: 5,
    intensity: 6,
  },
  {
    id: 'threshold-sustain',
    title: 'Sustained tempo',
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Practice holding one even effort without turning the session into a race.',
    cue: 'Even and controlled · 6 / 10',
    workSeconds: [720],
    recoverySeconds: 90,
    minimumReps: 1,
    maximumReps: 1,
    intensity: 6,
  },
  {
    id: 'threshold-long',
    title: 'Long tempo blocks',
    kind: 'tempo',
    stimulus: 'threshold',
    goals: ['5k', '10k', 'half'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Extend the time you can stay relaxed at a purposeful aerobic effort.',
    cue: 'Comfortably hard · 6 / 10 · keep the last block as smooth as the first',
    workSeconds: [360],
    recoverySeconds: 120,
    minimumReps: 2,
    maximumReps: 3,
    intensity: 6,
  },
  {
    id: 'power-two',
    title: 'Two-minute repetitions',
    kind: 'intervals',
    stimulus: 'aerobic-power',
    goals: ['5k', '10k'],
    phases: ['Build', 'Race preparation'],
    purpose:
      'Practice quicker aerobic running, with enough recovery to keep the repetitions even.',
    cue: 'Quick and controlled · 7 / 10 · never sprint',
    workSeconds: [120],
    recoverySeconds: 120,
    minimumReps: 3,
    maximumReps: 7,
    intensity: 7,
  },
  {
    id: 'power-three',
    title: 'Three-minute repetitions',
    kind: 'intervals',
    stimulus: 'aerobic-power',
    goals: ['5k'],
    phases: ['Race preparation'],
    purpose:
      'Build confidence sustaining a quicker rhythm as the race approaches.',
    cue: 'Strong, repeatable effort · 7 / 10',
    workSeconds: [180],
    recoverySeconds: 120,
    minimumReps: 3,
    maximumReps: 5,
    intensity: 7,
  },
  {
    id: 'economy-relaxed',
    title: 'Relaxed strides',
    kind: 'fartlek',
    stimulus: 'economy',
    goals: ['5k', '10k', 'half', 'marathon', 'ultra'],
    phases: ['Foundation', 'Build', 'Taper'],
    purpose: 'Rehearse smooth, light-footed running with full easy recoveries.',
    cue: 'Smooth acceleration · relaxed form · no sprinting',
    workSeconds: [20],
    recoverySeconds: 100,
    minimumReps: 4,
    maximumReps: 6,
    intensity: 6,
  },
  {
    id: 'fartlek-one',
    title: 'One on, easy off',
    kind: 'fartlek',
    stimulus: 'aerobic-power',
    goals: ['5k', '10k'],
    phases: racePhases,
    purpose:
      'Introduce short changes of rhythm while staying in control of your breathing.',
    cue: 'Lively but repeatable · 6–7 / 10',
    workSeconds: [60],
    recoverySeconds: 90,
    minimumReps: 4,
    maximumReps: 10,
    intensity: 6,
  },
  {
    id: 'fartlek-ladder',
    title: 'Rhythm ladder',
    kind: 'fartlek',
    stimulus: 'aerobic-power',
    goals: ['5k'],
    phases: ['Build'],
    purpose:
      'Change the length of each effort while keeping a consistent, controlled intensity.',
    cue: 'Quicker rhythm · 6–7 / 10',
    workSeconds: [60, 120, 180, 120, 60],
    recoverySeconds: 90,
    minimumReps: 5,
    maximumReps: 5,
    intensity: 6,
  },
  {
    id: 'hills-short',
    title: 'Short hill repetitions',
    kind: 'intervals',
    stimulus: 'economy',
    goals: ['5k', '10k'],
    phases: ['Build'],
    purpose:
      'Use a gentle hill to practice a tall posture and quick, light steps.',
    cue: 'Controlled uphill effort · 6 / 10 · walk or jog back easily',
    workSeconds: [30],
    recoverySeconds: 120,
    minimumReps: 4,
    maximumReps: 8,
    intensity: 6,
    hills: true,
  },
  {
    id: 'hills-long',
    title: 'Uphill rhythm',
    kind: 'intervals',
    stimulus: 'aerobic-power',
    goals: ['5k', '10k'],
    phases: ['Build'],
    purpose:
      'Hold an even effort uphill. Choose a moderate slope and recover fully downhill.',
    cue: 'Steady, controlled uphill · 6–7 / 10',
    workSeconds: [60],
    recoverySeconds: 150,
    minimumReps: 3,
    maximumReps: 6,
    intensity: 6,
    hills: true,
  },
  {
    id: 'race-rhythm-5',
    title: '5K rhythm',
    kind: 'intervals',
    stimulus: 'race-rhythm',
    goals: ['5k'],
    phases: ['Race preparation', 'Taper'],
    purpose:
      'Rehearse a sustainable 5K effort in short pieces, without racing the workout.',
    cue: 'Your sustainable 5K effort · controlled, not all-out',
    workSeconds: [120],
    recoverySeconds: 120,
    minimumReps: 3,
    maximumReps: 5,
    intensity: 7,
  },
  {
    id: 'race-rhythm-10',
    title: '10K rhythm',
    kind: 'tempo',
    stimulus: 'race-rhythm',
    goals: ['10k'],
    phases: ['Race preparation', 'Taper'],
    purpose: 'Find the controlled rhythm you could sustain on race day.',
    cue: 'Your sustainable 10K effort · comfortably hard',
    workSeconds: [300],
    recoverySeconds: 120,
    minimumReps: 2,
    maximumReps: 3,
    intensity: 6,
  },
];
// Complete, independently authored sessions. Distance recipes are resolved only
// against an explicit pace band; an easy-pace estimate cannot calibrate them.
function addRecipe(
  baseId: string,
  patch: Partial<WorkoutTemplate> & { id: string },
) {
  WORKOUT_LIBRARY.push({
    ...WORKOUT_LIBRARY.find((t) => t.id === baseId)!,
    ...patch,
  });
}
addRecipe('threshold-long', {
  id: 'marathon-tempo-six',
  goals: ['marathon'],
  purpose:
    'Hold controlled tempo for longer than the opening cruise intervals. Keep every repetition even; extend the rhythm without increasing the pace.',
});
addRecipe('threshold-long', {
  id: 'marathon-tempo-eight',
  goals: ['marathon'],
  workSeconds: [480],
  maximumReps: 3,
  purpose:
    'Develop sustained aerobic strength in eight-minute tempo blocks. Settle early and leave enough reserve for your marathon endurance work.',
});
addRecipe('marathon-tempo-eight', {
  id: 'marathon-tempo-pyramid',
  workSeconds: [360, 480, 360],
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
  purpose:
    'Hold tempo effort through six, eight and six minutes. The middle block asks for patience; the final shorter block should feel controlled.',
});
addRecipe('marathon-tempo-eight', {
  id: 'marathon-tempo-bookends',
  workSeconds: [480, 240, 240, 480],
  minimumReps: 4,
  maximumReps: 4,
  completeSet: true,
  purpose:
    'Link two longer tempo blocks with shorter repetitions. Keep the same effort throughout and finish as evenly as you started.',
});
addRecipe('marathon-tempo-eight', {
  id: 'marathon-tempo-ladder',
  workSeconds: [240, 360, 480],
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
  purpose:
    'Settle into four, six and eight minutes at the same tempo effort. Extend the repetition without making it faster.',
});
addRecipe('marathon-tempo-eight', {
  id: 'marathon-tempo-five',
  workSeconds: [300],
  minimumReps: 3,
  maximumReps: 4,
  purpose:
    'Accumulate controlled five-minute tempo blocks with generous easy resets. A shorter format supports the week’s sustained endurance work.',
});
addRecipe('marathon-long-blocks', {
  id: 'marathon-twelve',
  phases: ['Build', 'Race preparation', 'Taper'],
  workSeconds: [720],
  maximumReps: 3,
  purpose:
    'Move from short marathon repeats into longer stretches at the same controlled effort. Rehearse settling into pace after each easy recovery.',
});
addRecipe('marathon-long-blocks', {
  id: 'marathon-sixteen',
  workSeconds: [960],
  maximumReps: 2,
  purpose:
    'Rehearse sustained marathon rhythm in two longer blocks, after shorter race-effort sessions. Patient pacing matters more than a faster finish.',
});
addRecipe('marathon-continuous', {
  id: 'marathon-continuous-rehearsal',
  workSeconds: [1800],
  purpose:
    'Practise one uninterrupted, controlled marathon-effort stretch after building through longer repetitions. Keep the same effort throughout.',
});
addRecipe('marathon-long-run', {
  id: 'marathon-long-split',
  recoverySeconds: 180,
  minimumReps: 2,
  spreadAerobic: true,
  purpose:
    'Break up easy endurance with marathon-effort blocks separated by longer easy running. Practise finding race rhythm again without pushing the easy sections.',
});
addRecipe('marathon-long-run', {
  id: 'marathon-long-finish',
  workSeconds: [1200],
  minimumReps: 1,
  maximumReps: 1,
  purpose:
    'Run easily before a controlled twenty-minute marathon-effort finish, then cool down. This is a pacing rehearsal, never an all-out fast finish.',
});
addRecipe('threshold-pyramid', {
  id: 'threshold-short-pyramid',
  title: 'Tempo pyramid',
  workSeconds: [120, 180, 120],
  recoverySeconds: 90,
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
});
addRecipe('threshold-pyramid', {
  id: 'threshold-compact-pyramid',
  title: 'Tempo pyramid',
  workSeconds: [180, 240, 180],
  recoverySeconds: 90,
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
});
addRecipe('threshold-pyramid', {
  id: 'threshold-descending',
  title: 'Cut-down tempo',
  workSeconds: [240, 180, 120],
  recoverySeconds: 90,
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
  purpose:
    'Practice keeping tempo effort even as each repetition gets shorter. The shorter finish should feel smoother, not faster.',
  cue: 'Controlled tempo · 6 / 10 · same effort as the reps shorten',
});
addRecipe('threshold-long', {
  id: 'threshold-long-descending',
  title: 'Cut-down tempo',
  workSeconds: [360, 300, 240],
  recoverySeconds: 120,
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
  purpose:
    'Spend sustained time at tempo effort, then finish with two shorter, controlled blocks.',
  cue: 'Even tempo effort · 6 / 10 · do not chase a faster last rep',
});
addRecipe('fartlek-ladder', {
  id: 'power-short-pyramid',
  title: 'Pyramid intervals',
  goals: ['5k', '10k'],
  workSeconds: [60, 90, 120, 90, 60],
  minimumReps: 5,
  maximumReps: 5,
  completeSet: true,
  purpose:
    'Find a smooth quicker rhythm as the efforts grow to two minutes, then come back down the pyramid.',
});
addRecipe('fartlek-ladder', {
  id: 'power-full-pyramid',
  title: 'Pyramid intervals',
  goals: ['5k', '10k'],
  completeSet: true,
});
addRecipe('half-rhythm-ladder', {
  id: 'half-descending',
  title: 'Cut-down half-marathon effort',
  workSeconds: [360, 300, 240],
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
  purpose:
    'Rehearse half-marathon effort in three shortening blocks. Settle early and keep the same controlled rhythm throughout.',
});
addRecipe('marathon-steady', {
  id: 'marathon-descending',
  title: 'Cut-down marathon effort',
  workSeconds: [480, 360, 240],
  minimumReps: 3,
  maximumReps: 3,
  completeSet: true,
  purpose:
    'Practice settling into marathon effort, then find that rhythm again after each easy reset. Shorter blocks are not an invitation to speed up.',
});
addRecipe('marathon-rhythm-ladder', {
  id: 'marathon-pyramid',
  title: 'Marathon effort pyramid',
  workSeconds: [240, 360, 480, 360, 240],
  recoverySeconds: 180,
  minimumReps: 5,
  maximumReps: 5,
  completeSet: true,
  purpose:
    'Build patience at marathon effort through a complete pyramid, holding the same rhythm as the blocks lengthen and shorten.',
});
addRecipe('race-rhythm-5', {
  id: 'race-rhythm-5-metres',
  title: '200 m race-rhythm repetitions',
  workSeconds: [],
  workMetres: [200],
  recoverySeconds: 120,
  minimumReps: 4,
  maximumReps: 10,
  purpose:
    'Practice relaxed 5K rhythm over short, exact-distance repetitions. These are controlled race-pace rehearsals, not sprints.',
});
addRecipe('power-two', {
  id: 'power-400-metres',
  title: '400 m intervals',
  workSeconds: [],
  workMetres: [400],
  recoverySeconds: 120,
  minimumReps: 4,
  maximumReps: 8,
  purpose:
    'Run repeatable 400 m intervals with an easy jog between them. Aim for even splits and a relaxed finish.',
});
addRecipe('power-400-metres', {
  id: 'power-300-metres',
  title: '300 m intervals',
  workMetres: [300],
  purpose:
    'Run smooth, repeatable 300 m intervals. Keep the effort controlled and use each easy jog to recover before repeating.',
});
addRecipe('power-full-pyramid', {
  id: 'power-pyramid-metres',
  title: 'Pyramid intervals',
  workSeconds: [],
  workMetres: [200, 400, 600, 400, 200],
  recoverySeconds: 120,
  minimumReps: 5,
  maximumReps: 5,
  completeSet: true,
  purpose:
    'Run a complete 200–400–600–400–200 m pyramid. Hold the same controlled effort on the way up and down; do not sprint the final 200 m.',
});
addRecipe('threshold-cruise', {
  id: 'threshold-800-metres',
  title: '800 m cruise intervals',
  workSeconds: [],
  workMetres: [800],
  recoverySeconds: 120,
  minimumReps: 3,
  maximumReps: 6,
  purpose:
    'Settle into controlled tempo effort for each 800 m, using the easy recoveries to reset your breathing.',
});
addRecipe('half-rhythm', {
  id: 'half-1000-metres',
  title: '1 km half-marathon blocks',
  workSeconds: [],
  workMetres: [1000],
  recoverySeconds: 120,
  minimumReps: 3,
  maximumReps: 6,
  purpose:
    'Rehearse half-marathon effort over measured kilometre blocks, with easy jogging between repeats.',
});
addRecipe('marathon-steady', {
  id: 'marathon-1000-metres',
  title: '1 km marathon blocks',
  workSeconds: [],
  workMetres: [1000],
  recoverySeconds: 180,
  minimumReps: 3,
  maximumReps: 7,
  purpose:
    'Make marathon rhythm familiar in repeatable kilometre blocks. Start each block calmly and finish with something in reserve.',
});
WORKOUT_LIBRARY.push(...STRUCTURED_FORMATS);
WORKOUT_LIBRARY.push(...MARATHON_WORKOUTS);
for (const t of WORKOUT_LIBRARY)
  if (t.workSeconds.length > 1) t.completeSet = true;

function resolveDistanceTemplate(
  t: WorkoutTemplate,
  p: Profile | undefined,
  gentle: boolean,
  existingSteps?: Step[],
): WorkoutTemplate | null {
  if (!t.workMetres) return t;
  const savedPace =
    existingSteps?.find((s) => s.metres !== undefined)
      ?.planningPaceSecondsPerKm ?? t.planningPaceSecondsPerKm;
  const sample = workoutStepTarget(
    {
      kind: t.kind,
      stimulus: t.stimulus,
      templateId: t.id,
    },
    {
      kind: 'work',
      seconds: 300,
      effort: gentle ? 'Steady and comfortable' : t.cue,
      intensity: gentle ? Math.min(5, t.intensity) : t.intensity,
    },
    p ?? { goal: t.goals[0] },
  );
  const slowPace =
    savedPace ?? (sample?.mode === 'pace' ? sample.high : undefined);
  if (!slowPace) return null;
  const planningPaceSecondsPerKm =
    savedPace ??
    (t.id.startsWith('marathon-book-')
      ? slowPace
      : Math.max(slowPace, (p?.easyPace ?? 7) * 60));
  const floatPace = t.floatMetres
    ? (existingSteps?.find((s) => s.kind === 'aerobic' && s.metres)
        ?.planningPaceSecondsPerKm ??
      (p?.workoutTargets?.mode === 'pace'
        ? p.workoutTargets.pace?.easy?.high
        : undefined))
    : undefined;
  if (t.floatMetres && !floatPace) return null;
  return {
    ...t,
    ...(t.floatMetres && floatPace
      ? {
          floatSeconds: Math.ceil((t.floatMetres * floatPace) / 1000),
          floatPlanningPaceSecondsPerKm: floatPace,
        }
      : {}),
    planningPaceSecondsPerKm,
    ...(t.recoveryRatio
      ? {
          recoverySeconds: Math.round(
            ((t.workMetres[0] * planningPaceSecondsPerKm) / 1000) *
              t.recoveryRatio,
          ),
        }
      : {}),
    workSeconds: t.workMetres.map((m) =>
      Math.ceil((m * planningPaceSecondsPerKm) / 1000),
    ),
  };
}

export const stimulusLabel: Record<Stimulus, string> = {
  aerobic: 'Aerobic endurance',
  threshold: 'Sustained aerobic effort',
  'aerobic-power': 'Quicker aerobic running',
  economy: 'Relaxed running form',
  'race-rhythm': 'Race-specific rhythm',
};
export type SelectionContext = {
  previous: Workout[];
  availableMinutes: number;
  slot: number;
  /** Slots the weekly schedule can actually fit, independent of availability. */
  qualitySlots?: number;
  week?: number;
  introduction?: boolean;
  marathonModel?: boolean;
};
export type TemplateDecision = {
  template: WorkoutTemplate;
  exposure: number;
  targetWorkMinutes: number;
  reason: string;
};

/** Choose an actual new session role before applying cosmetic variation. The
 * speed dose is deliberately smaller than tempo volume; availability is not
 * evidence that the runner can tolerate additional hard work.
 */
function structuredFormat(
  p: Profile,
  phase: Phase,
  context: SelectionContext,
  prior: Workout[],
  base: WorkoutTemplate,
  target: number,
): { template: WorkoutTemplate; target: number } | null {
  if (
    p.experience !== 'established' ||
    p.intent === 'finish' ||
    p.difficulty === 'gentle' ||
    context.introduction ||
    (p.method && p.method !== 'balanced') ||
    !['Build', 'Race preparation'].includes(phase) ||
    !['5k', '10k', 'half', 'marathon'].includes(p.goal)
  )
    return null;
  const tempo = prior.filter((w) => w.stimulus === 'threshold');
  const speed = prior.filter((w) => w.stimulus === 'aerobic-power');
  const lastSpeed = speed.at(-1);
  const marathonSpeed =
    p.goal === 'marathon' &&
    phase === 'Build' &&
    p.marathonApproach !== 'endurance' &&
    (p.recentQualitySessions ?? 0) >= 1 &&
    context.availableMinutes >= 40 &&
    tempo.length >= 3 &&
    (context.week === undefined ||
      !lastSpeed ||
      context.week - lastSpeed.week >= 2) &&
    (marathonSecondQuality(p)
      ? context.slot === 0
      : context.slot === 0 &&
        prior.at(-1)?.stimulus === 'race-rhythm' &&
        (!lastSpeed || (context.week ?? 0) - lastSpeed.week >= 3));
  const speedRole =
    (base.stimulus === 'aerobic-power' && speed.length % 2 === 0) ||
    marathonSpeed;
  let families: string[], budget: number;
  if (speedRole) {
    const rotation = [
      'short-repeats',
      'split-repeats',
      'long-into-short',
      'six-hundred',
    ];
    const offset =
      p.workoutVariety === 'familiar' ? 0 : speed.length % rotation.length;
    families = [...rotation.slice(offset), ...rotation.slice(0, offset)];
    // Six introductory minutes (eight with an established two-workout background), then three additional minutes per exposure.
    budget = Math.min(
      p.goal === 'marathon' ? 16 : 20,
      (marathonSecondQuality(p) ? 8 : 6) + speed.length * 3,
      lastSpeed ? (lastSpeed.qualityMinutes ?? 0) + 3 : Infinity,
    );
    if (!marathonSpeed) budget = Math.min(budget, target);
  } else {
    if (
      base.stimulus !== 'threshold' ||
      tempo.length < 2 ||
      tempo.length % 2 === 0
    )
      return null;
    const rotation = [
      'tempo-repeats',
      'on-off',
      'tempo-cut-down',
      'long-tempo',
    ];
    const offset =
      p.workoutVariety === 'familiar'
        ? 0
        : Math.floor(tempo.length / 2) % rotation.length;
    families = [...rotation.slice(offset), ...rotation.slice(0, offset)];
    budget = target;
  }
  for (const family of families) {
    for (const unit of p.workoutFormat === 'time'
      ? ['timed']
      : ['metres', 'timed']) {
      const authored = WORKOUT_LIBRARY.find(
        (t) => t.id === `session-${family}-${unit}`,
      )!;
      if (!authored.goals.includes(p.goal)) continue;
      const candidate = resolveDistanceTemplate(authored, p, false);
      if (!candidate) continue;
      if (!speedRole) {
        const previousLongest = Math.max(
          0,
          ...tempo
            .slice(-3)
            .flatMap((w) =>
              w.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
            ),
        );
        const actualLongest =
          candidate.workMetres && p.workoutTargets?.pace?.tempo
            ? (Math.max(...candidate.workMetres) *
                p.workoutTargets.pace.tempo.high) /
              1000
            : Math.max(...candidate.workSeconds);
        if (
          actualLongest > previousLongest * 1.3 ||
          (family === 'long-tempo' && (tempo.length < 4 || budget < 20))
        )
          continue;
      }
      const dose = scaleTemplate(
        candidate,
        context.availableMinutes,
        false,
        phase,
        budget,
        budget,
        p,
      );
      if (dose && (speedRole || dose.qualityMinutes >= target * 0.85))
        return { template: candidate, target: budget };
    }
  }
  return null;
}

function marathonStructuredChoice(
  p: Profile,
  phase: Phase,
  context: SelectionContext,
  families: string[],
  budget: number,
): WorkoutTemplate | null {
  for (const family of families) {
    for (const unit of p.workoutFormat === 'time'
      ? ['timed']
      : ['metres', 'timed']) {
      const authored = WORKOUT_LIBRARY.find(
        (t) => t.id === `marathon-book-${family}-${unit}`,
      );
      if (!authored) continue;
      const candidate = resolveDistanceTemplate(authored, p, false);
      if (!candidate) continue;
      const dose = scaleTemplate(
        candidate,
        context.availableMinutes,
        false,
        phase,
        budget,
        budget,
        p,
      );
      // A whole main set must fit; never slice a pyramid or discard its finish.
      if (dose && dose.qualityMinutes >= budget * 0.65) return candidate;
    }
  }
  return null;
}

function selectMarathonBookTemplate(
  p: Profile,
  phase: Phase,
  context: SelectionContext,
): TemplateDecision {
  const prior = context.previous.filter(
    (w) => w.status !== 'skipped' && w.kind !== 'race',
  );
  const untapered = prior.filter((w) => marathonTaperFraction(p, w.date) === 1);
  const tempo = untapered.filter((w) => w.stimulus === 'threshold');
  const speed = untapered.filter((w) => w.stimulus === 'aerobic-power');
  const taper = ['Taper', 'Race week'].includes(phase);
  // Unknown minutes do not mean unknown experience. This authored starting
  // allowance is provisional; an explicitly smaller recent dose takes priority.
  const familiar =
    p.recentQualityMinutes != null
      ? p.recentQualityMinutes / Math.max(1, p.recentQualitySessions ?? 1)
      : p.experience === 'established' &&
          p.weeklyKm >= 45 &&
          p.currentRuns >= 4 &&
          (p.recentQualitySessions ?? 0) >= 1
        ? 20
        : 0;
  const economy = WORKOUT_LIBRARY.find((t) => t.id === 'economy-relaxed')!;
  const easy = (reason: string): TemplateDecision => ({
    template: economy,
    exposure: 0,
    targetWorkMinutes: 0,
    reason,
  });
  if (taper && !prior.some((w) => w.hard || w.stimulus === 'economy'))
    return easy(
      'Keep the taper easy. This remaining block contains no familiar workout to reduce; missed preparation is not added.',
    );
  if (
    p.intent === 'finish' ||
    context.introduction ||
    phase === 'Maintenance' ||
    (context.slot > 0 &&
      !(p.qualityMode === 'custom' && p.qualitySessions === 2))
  )
    return {
      template: economy,
      exposure: 1,
      targetWorkMinutes: 4 / 3,
      reason:
        'An easy run with relaxed strides supports the endurance work. Additional running days do not add another hard workout.',
    };
  if (context.slot > 0) {
    // Optional second workout: keep its history separate from the primary
    // threshold progression and share the existing weekly work allowance.
    const secondary = untapered.filter(
      (w) =>
        w.kind !== 'long' &&
        (w.stimulus === 'aerobic-power' || w.stimulus === 'race-rhythm'),
    );
    if (taper)
      return easy(
        'The second workout becomes easy during taper. Keep only a reduced familiar primary session.',
      );
    if (p.difficulty !== 'gentle' && familiar >= 16) {
      const index = secondary.length;
      const marathonEffort =
        p.marathonApproach === 'endurance' || index % 3 === 2;
      const speedCount = secondary.filter(
        (w) => w.stimulus === 'aerobic-power',
      ).length;
      const rotation = [
        'six-hundred',
        'pyramid',
        'split-repeats',
        'long-into-short',
      ];
      const preferred =
        p.workoutVariety === 'familiar'
          ? rotation[0]
          : rotation[speedCount % rotation.length];
      const target = marathonEffort
        ? Math.min(36, 24 + Math.floor(index / 3) * 6)
        : Math.min(
            24,
            Math.max(14, familiar * 0.7) + Math.floor(speedCount / 2) * 2,
          );
      const template = marathonStructuredChoice(
        p,
        phase,
        context,
        marathonEffort
          ? ['marathon-blocks']
          : [preferred, ...rotation.filter((f) => f !== preferred)],
        target,
      );
      if (template)
        return {
          template,
          exposure: index + 1,
          targetWorkMinutes: target,
          reason: marathonEffort
            ? 'Marathon-pace rehearsal replaces this week’s intervals. Sustained tempo and race pace have different targets; a paced long run uses this slot instead.'
            : 'A separate interval session develops aerobic power and running economy alongside the week’s sustained tempo. The full set fits your existing weekly distance and work allowance.',
        };
    }
    const target =
      p.difficulty === 'gentle'
        ? 8
        : Math.min(
            24,
            Math.max(
              8,
              Math.floor(familiar / 8) * 8,
              8 + Math.floor(secondary.length / 2) * 8,
            ),
            8 + Math.floor(secondary.length / 2) * 8,
          );
    return {
      template: WORKOUT_LIBRARY.find(
        (t) => t.id === 'marathon-book-secondary-steady',
      )!,
      exposure: secondary.length + 1,
      targetWorkMinutes: target,
      reason:
        'Your chosen second workout adds controlled marathon-effort practice within the existing weekly budget. Marathon-effort long runs replace it; recovery and taper weeks contain less work.',
    };
  }
  if (p.difficulty === 'gentle') {
    const target = taper ? 4 : Math.min(12, 6 + tempo.length * 2);
    // The opening six-minute allowance cannot fund two four-minute efforts.
    // Use a complete short steady introduction; never raise its work allowance
    // just to satisfy a recipe's minimum repetition count.
    const introduction = !taper && target < 8;
    return {
      template: WORKOUT_LIBRARY.find(
        (t) =>
          t.id ===
          (introduction ? 'marathon-book-steady-intro' : 'threshold-cruise'),
      )!,
      exposure: tempo.length + 1,
      targetWorkMinutes: target,
      reason: introduction
        ? 'One short steady effort fits your introductory work allowance. The later progression remains a forecast within your time and recovery limits, not evidence of completed fitness.'
        : 'Short, controlled steady blocks adapt the marathon emphasis to your gentler workout preference.',
    };
  }
  if (
    phase === 'Race preparation' &&
    !(p.qualityMode === 'custom' && p.qualitySessions === 2) &&
    p.marathonApproach !== 'endurance' &&
    (tempo.length >= 2 || familiar >= 20) &&
    (!speed.length || (context.week ?? 0) - speed.at(-1)!.week >= 2)
  ) {
    const index = p.workoutVariety === 'familiar' ? 0 : speed.length;
    const metres = [600, 800, 1000, 1200, 1600][Math.min(4, index)];
    let template =
      p.workoutFormat !== 'time'
        ? resolveDistanceTemplate(
            WORKOUT_LIBRARY.find(
              (t) => t.id === `marathon-book-vo2-${metres}m`,
            )!,
            p,
            false,
          )
        : null;
    // No guessed pace, and no long repetitions outside the book's 2–6 min intent.
    if (
      !template ||
      template.workSeconds[0] < 120 ||
      template.workSeconds[0] > 360
    )
      template = WORKOUT_LIBRARY.find(
        (t) => t.id === `marathon-book-vo2-${[180, 240, 300][index % 3]}s`,
      )!;
    return {
      template,
      exposure: speed.length + 1,
      targetWorkMinutes: Math.min(24, 12 + speed.length * 3),
      reason:
        'Later race preparation: a small dose of current 5K-effort repetitions supports aerobic power while long and medium-long endurance remain in the week.',
    };
  }
  if (taper && phase !== 'Race week' && speed.length) {
    const last = [...speed].reverse().find((w) => {
      const template = WORKOUT_LIBRARY.find((t) => t.id === w.templateId);
      return template && !template.completeSet;
    });
    const authored =
      last && WORKOUT_LIBRARY.find((t) => t.id === last.templateId);
    const template =
      authored &&
      last &&
      resolveDistanceTemplate(authored, p, false, last.steps);
    if (template && last)
      return {
        template,
        exposure: speed.length,
        targetWorkMinutes: (last.qualityMinutes ?? 0) * 0.6,
        reason:
          'Fewer familiar repetitions retain intensity as total mileage falls toward race day.',
      };
  }
  const latest = tempo.at(-1)?.qualityMinutes ?? 0;
  if (taper && !latest)
    return easy(
      'Keep this run relaxed; there is no familiar tempo dose to reduce.',
    );
  const target = taper
    ? Math.min(9, latest * 0.5)
    : Math.min(
        Math.max(6, context.availableMinutes - 25),
        phase === 'Foundation' ? 25 : 40,
        Math.max(
          Math.min(25, familiar),
          latest ? latest + (latest < 15 ? 3 : 5) : 6,
        ),
      );
  const dose = [6, 9, 12, 15, 20, 25, 30, 35, 40]
    .filter((m) => m <= target)
    .at(-1);
  if (!dose)
    return easy(
      'Keep this run easy; the reduced tempo dose is too small for a useful continuous session.',
    );
  const template = WORKOUT_LIBRARY.find(
    (t) => t.id === `marathon-book-lt-${dose}`,
  )!;
  if (!taper && dose >= 20 && p.workoutVariety !== 'familiar') {
    const rotation = [
      'tempo-blocks',
      'on-off',
      'tempo-cut-down',
      'tempo-repeats',
    ];
    // Keep a continuous benchmark every third exposure, with genuinely
    // different complete main sets in between.
    if (tempo.length % 3 !== 0) {
      const preferred =
        rotation[Math.floor((tempo.length * 2) / 3) % rotation.length];
      const varied = marathonStructuredChoice(
        p,
        phase,
        context,
        [preferred, ...rotation.filter((f) => f !== preferred)],
        dose,
      );
      if (varied)
        return {
          template: varied,
          exposure: tempo.length + 1,
          targetWorkMinutes: dose,
          reason: `${phase}: ${varied.purpose} The work allowance progresses from your existing routine, with lighter recovery and taper weeks.`,
        };
    }
  }
  return {
    template,
    exposure: tempo.length + 1,
    targetWorkMinutes: dose,
    reason: taper
      ? 'A short dose of familiar tempo preserves rhythm without adding a new peak workout.'
      : `${phase}: ${dose < 20 ? 'A shorter introduction builds toward sustained tempo.' : 'Continuous tempo develops threshold endurance.'} The dose follows your recent workout background and earlier prescribed exposures; scheduled training is a forecast, not a completed result.`,
  };
}

/** Select a role from phase and accumulated stimulus, then progress a related prescription. */
export function selectTemplate(
  p: Profile,
  phase: Phase,
  context: SelectionContext,
): TemplateDecision {
  if (usesMarathonBook(p) && context.marathonModel !== false)
    return selectMarathonBookTemplate(p, phase, context);
  const secondEconomy =
    p.goal === 'marathon' &&
    context.slot > 0 &&
    (!p.method || p.method === 'balanced') &&
    !marathonSecondQuality(p);
  const prior = context.previous.filter(
    (w) =>
      w.status !== 'skipped' &&
      w.templateId &&
      w.kind !== 'race' &&
      w.kind !== 'long' &&
      (!(p.goal === 'marathon' && ['Taper', 'Race week'].includes(phase)) ||
        Math.max(
          0,
          ...w.steps.filter((s) => s.kind === 'work').map((s) => s.seconds),
        ) <= 600) &&
      (!secondEconomy || w.stimulus === 'economy'),
  );
  const threshold = prior.filter((w) => w.stimulus === 'threshold');
  const specific = prior.filter((w) => w.stimulus === 'race-rhythm');
  const last = (
    p.goal === 'marathon'
      ? prior.filter((w) => w.stimulus !== 'economy')
      : prior
  ).at(-1);
  const taper = phase === 'Taper' || phase === 'Race week';
  let familiarTaper = true;
  let id: string;
  if (taper) {
    // Retain a familiar specific stimulus; taper is not a place to introduce a new workout.
    id =
      [...prior]
        .reverse()
        .find((w) => p.goal === 'ultra' && w.templateId === 'ultra-steady')
        ?.templateId ??
      [...prior]
        .reverse()
        .find(
          (w) =>
            w.stimulus === (context.slot > 0 ? 'threshold' : 'race-rhythm'),
        )?.templateId ??
      [...prior].reverse().find((w) => w.stimulus === 'threshold')
        ?.templateId ??
      [...prior]
        .reverse()
        .find((w) => p.goal === 'ultra' && w.templateId === 'ultra-steady')
        ?.templateId ??
      [...prior].reverse().find((w) => w.templateId === 'economy-relaxed')
        ?.templateId ??
      'economy-relaxed';
    familiarTaper = prior.some((w) => w.templateId === id);
  } else if (p.intent === 'finish' || context.introduction || secondEconomy)
    id = 'economy-relaxed';
  else if (p.goal === 'ultra')
    id =
      context.slot > 0 && phase === 'Maintenance'
        ? 'economy-relaxed'
        : 'ultra-steady';
  else if (phase === 'Maintenance')
    id =
      context.slot > 0 || p.difficulty === 'gentle'
        ? 'economy-relaxed'
        : 'threshold-cruise';
  else if (phase === 'Foundation')
    id =
      (p.recentQualitySessions ?? 0) > context.slot &&
      p.experience === 'established'
        ? context.slot === 0 || p.method === 'threshold-singles'
          ? 'threshold-cruise'
          : p.goal === 'marathon'
            ? 'marathon-steady'
            : p.goal === 'half'
              ? 'half-rhythm'
              : 'fartlek-one'
        : 'economy-relaxed';
  else if (context.slot > 0) {
    id =
      p.method === 'threshold-singles'
        ? 'threshold-cruise'
        : ['5k', '10k'].includes(p.goal)
          ? 'power-two'
          : p.goal === 'half'
            ? phase === 'Race preparation'
              ? 'threshold-cruise'
              : 'half-rhythm'
            : p.goal === 'marathon' &&
                phase !== 'Race preparation' &&
                ['threshold', 'aerobic-power'].includes(last?.stimulus ?? '')
              ? 'marathon-steady'
              : 'threshold-cruise';
  } else if (phase === 'Race preparation') {
    id =
      p.goal === 'marathon'
        ? specific.length >= 3
          ? 'marathon-long-blocks'
          : 'marathon-steady'
        : p.goal === 'half'
          ? specific.length >= 2
            ? 'half-long-blocks'
            : 'half-rhythm'
          : p.goal === '5k'
            ? 'race-rhythm-5'
            : 'race-rhythm-10';
    if (p.method === 'threshold-singles' && last?.stimulus === 'race-rhythm')
      id = 'threshold-cruise';
  } else if (p.method === 'threshold-singles')
    id = threshold.length >= 3 ? 'threshold-long' : 'threshold-cruise';
  else if (
    p.goal === 'half' &&
    phase === 'Build' &&
    p.experience === 'established' &&
    p.difficulty === 'balanced' &&
    (!p.method || p.method === 'balanced') &&
    context.qualitySlots === 1 &&
    threshold.length >= 2 &&
    last?.stimulus !== 'race-rhythm'
  )
    // Race-effort practice belongs in a one-workout week too. Alternate it
    // with existing tempo work; selecting a second workout is not a prerequisite.
    id = 'half-rhythm';
  else if (p.goal === 'marathon' || p.goal === 'half') {
    id =
      threshold.length < 2 ||
      (specific.length >= 2 && last?.stimulus === 'race-rhythm')
        ? 'threshold-cruise'
        : p.goal === 'marathon'
          ? 'marathon-steady'
          : 'threshold-long';
  } else if (threshold.length >= 2 && last?.stimulus === 'threshold')
    id = 'power-two';
  else id = threshold.length >= 3 ? 'threshold-long' : 'threshold-cruise';
  id = marathonRecipe(id, p, phase, prior);
  let template = WORKOUT_LIBRARY.find((t) => t.id === id)!;
  const resolvedTemplate = resolveDistanceTemplate(
    template,
    p,
    p.difficulty === 'gentle',
    [...prior].reverse().find((w) => w.templateId === id)?.steps,
  );
  if (!resolvedTemplate)
    return {
      template: WORKOUT_LIBRARY.find((t) => t.id === 'economy-relaxed')!,
      exposure: 0,
      targetWorkMinutes: 0,
      reason:
        'Keep this session easy; the familiar distance prescription has no usable planning pace.',
    };
  template = resolvedTemplate;
  // A changed recipe still belongs to its original progression family. Completed
  // evidence must survive a presentation/structure variation during a later replan.
  const related = prior.filter(
    (w) => w.templateId === id || w.varietySourceTemplateId === id,
  );
  // The next dose follows repeated exposures, never the spare minutes in a time ceiling.
  let targetWorkMinutes =
    (template.workSeconds.slice(0, 1)[0] / 60) *
    Math.min(
      template.maximumReps,
      template.minimumReps +
        (p.difficulty === 'gentle'
          ? Math.floor(related.length / 2)
          : related.length),
    );
  // Declared experience is an opening-dose input, never a fabricated completion.
  // Missing work minutes stay unknown; mere availability does not increase intensity.
  const familiar =
    (p.recentQualitySessions ?? 0) > 0 && p.experience === 'established';
  const reportedPerSession =
    familiar && p.recentQualityMinutes != null
      ? p.recentQualityMinutes / Math.max(1, p.recentQualitySessions!)
      : 0;
  const entry = (template.minimumReps * template.workSeconds[0]) / 60;
  const familiarSeed =
    template.stimulus === 'threshold'
      ? Math.min(20, reportedPerSession * 0.8)
      : template.stimulus === 'race-rhythm' &&
          ['half', 'marathon'].includes(p.goal)
        ? Math.min(20, reportedPerSession * 0.8)
        : template.stimulus === 'race-rhythm' && ['5k', '10k'].includes(p.goal)
          ? // Recent tempo work is not equivalent to 5K/10K repetitions. Start
            // with at most half the reported dose, then progress complete reps.
            Math.min(16, reportedPerSession * 0.5)
          : 0;
  if (!taper && familiarSeed > entry)
    targetWorkMinutes = Math.max(
      targetWorkMinutes,
      Math.min(
        (template.maximumReps * template.workSeconds[0]) / 60,
        familiarSeed + (related.length * template.workSeconds[0]) / 60,
      ),
    );
  const comparable = prior.filter(
    (w) =>
      w.stimulus === template.stimulus &&
      w.templateId !== template.id &&
      w.stimulus !== 'economy',
  );
  if (!taper && phase !== 'Foundation' && comparable.length) {
    const priorDose = comparable.at(-1)?.qualityMinutes ?? 0;
    const repetitionMinutes = template.workSeconds[0] / 60;
    // Carry comparable work in complete repetitions. A 27-minute target for
    // ten-minute reps would otherwise floor twice, dropping 32 minutes to 20.
    const carriedDose = Math.min(
      priorDose,
      Math.ceil((priorDose * 0.85) / repetitionMinutes) * repetitionMinutes,
    );
    targetWorkMinutes = Math.max(
      targetWorkMinutes,
      Math.min(
        (template.maximumReps * template.workSeconds[0]) / 60,
        carriedDose,
      ),
    );
  }
  if (phase === 'Maintenance')
    targetWorkMinutes =
      template.stimulus === 'economy' ? 4 / 3 : Math.max(entry, familiarSeed);
  if (phase === 'Foundation')
    targetWorkMinutes = Math.min(
      targetWorkMinutes,
      Math.max(entry, familiarSeed),
    );
  if (['Taper', 'Race week'].includes(phase)) {
    const previous = related.at(-1)?.qualityMinutes ?? targetWorkMinutes;
    targetWorkMinutes = Math.max(
      template.workSeconds[0] / 60,
      previous * (phase === 'Race week' ? 0.4 : 0.65),
    );
  }
  if (p.intent === 'finish') targetWorkMinutes = Math.min(targetWorkMinutes, 2);
  if (
    !taper &&
    context.availableMinutes < 30 &&
    template.stimulus !== 'economy'
  ) {
    template = WORKOUT_LIBRARY.find((t) => t.id === 'economy-relaxed')!;
    targetWorkMinutes = 4 / 3;
  }
  const structured = structuredFormat(
    p,
    phase,
    context,
    prior,
    template,
    targetWorkMinutes,
  );
  if (structured) {
    template = structured.template;
    targetWorkMinutes = structured.target;
  }
  // A zero work budget makes the caller retain its easy-run fallback.
  if (taper && !familiarTaper) targetWorkMinutes = 0;
  return {
    template,
    exposure: related.length + 1,
    targetWorkMinutes,
    reason:
      phase === 'Maintenance'
        ? 'Maintain a controlled dose anchored to your declared quality background while holding weekly volume. Easy and endurance sessions share the remaining workload.'
        : ['Taper', 'Race week'].includes(phase)
          ? familiarTaper
            ? `A reduced dose of familiar ${template.title.toLowerCase()} preserves rhythm while overall running falls.`
            : 'Keep this run easy: no familiar structured session is available to reduce during the taper.'
          : structured
            ? `${phase}: ${template.purpose} This session replaces an existing workout slot and stays within the week’s work and time limits.`
            : `${phase}: ${template.purpose} ${related.length ? `This is exposure ${related.length + 1} to the same session family; work increases only within its dose and recovery limits.` : familiarSeed > entry ? 'The opening dose uses your declared recent work minutes, within this session’s limits.' : 'Begin with an introductory dose; missing recent work minutes have not been assumed.'}`,
  };
}

export function scaleTemplate(
  t: WorkoutTemplate,
  minutes: number,
  gentle: boolean,
  phase: Phase,
  qualityCapMinutes: number,
  targetWorkMinutes = Infinity,
  profile?: Profile,
  existingSteps?: Step[],
  options: { capBasis?: 'initial' | 'prescribed' } = {},
) {
  if (
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    Number.isNaN(qualityCapMinutes) ||
    qualityCapMinutes < 0 ||
    Number.isNaN(targetWorkMinutes) ||
    targetWorkMinutes < 0
  )
    return null;
  const resolved = resolveDistanceTemplate(t, profile, gentle, existingSteps);
  if (!resolved) return null;
  t = resolved;
  if (
    !t.workSeconds.length ||
    t.workSeconds.some((n) => !Number.isFinite(n) || n <= 0)
  )
    return null;
  const ceiling = Math.floor(minutes * 60),
    warm = t.warmupSeconds ?? 600,
    cool = t.cooldownSeconds ?? 300;
  const taper = ['Taper', 'Race week'].includes(phase);
  const workCap = Math.floor(
    Math.min(
      // A saved work allowance already includes difficulty adjustment. Repeated
      // edits must not reduce it again; fresh weekly allocations still do.
      qualityCapMinutes *
        (options.capBasis !== 'prescribed' && gentle && t.stimulus !== 'economy'
          ? 0.8
          : 1),
      targetWorkMinutes,
      t.kind === 'long' ? minutes * (t.maxWorkFraction ?? 0.25) : Infinity,
    ) * 60,
  );
  const minimum = taper && !t.completeSet ? 1 : t.minimumReps;
  if (t.continuousStepSeconds) {
    const seconds =
      Math.floor(
        Math.min(t.workSeconds[0], workCap, ceiling - warm - cool) /
          t.continuousStepSeconds,
      ) * t.continuousStepSeconds;
    if (seconds < (t.minimumContinuousSeconds ?? t.continuousStepSeconds))
      return null;
    t = { ...t, workSeconds: [seconds] };
  }
  let sequence: number[] = [];
  let elapsed = 0,
    hardSeconds = 0;
  const setCount = t.setCount ?? 1;
  for (let count = minimum; count <= t.maximumReps; count++) {
    if (count % setCount !== 0) continue;
    if (t.completeSet && count !== t.workSeconds.length) continue;
    const candidate = Array.from(
      { length: count },
      (_, i) => t.workSeconds[i % t.workSeconds.length],
    );
    const work = candidate.reduce((sum, seconds) => sum + seconds, 0);
    const cost =
      work +
      (count - 1) * t.recoverySeconds +
      (setCount - 1) * (t.setRecoverySeconds ?? 0) +
      count * (t.floatSeconds ?? 0);
    if (warm + cool + cost > ceiling || work > workCap + 1) break;
    sequence = candidate;
    elapsed = cost;
    hardSeconds = work;
  }
  if (sequence.length < minimum) return null;
  const spare = ceiling - warm - cool - elapsed;
  const splitEasy =
    t.spreadAerobic && sequence.length > 1
      ? Math.floor(
          Math.min(spare, (sequence.length - 1) * 1200) / (sequence.length - 1),
        )
      : 0;
  // Gentle book-marathon work replaces part of an already funded easy outing.
  // Keep the remaining easy time on that day: discarding it can inadvertently
  // reduce the whole week's endurance and its long-run allowance. This never
  // changes the supplied session ceiling or the permitted work dose.
  const retainGentleMarathonAerobic =
    gentle &&
    profile !== undefined &&
    usesMarathonBook(profile) &&
    ['marathon-book-steady-intro', 'threshold-cruise'].includes(t.id);
  const retainMarathonAerobic =
    profile !== undefined && usesMarathonBook(profile);
  // A strides day ends with brief accelerations. Other workout families retain
  // their existing bounded aerobic lead-in.
  const aerobic =
    t.kind === 'long' || retainGentleMarathonAerobic || retainMarathonAerobic
      ? spare - splitEasy * (sequence.length - 1)
      : Math.min(
          spare,
          t.stimulus === 'economy'
            ? taper
              ? 600
              : 1500
            : (t.goals.includes('marathon') && t.stimulus === 'race-rhythm') ||
                t.id === 'ultra-steady'
              ? 900
              : 1200,
        );
  const steps: Step[] = [
    {
      label: 'Warm up',
      seconds: warm,
      effort: 'Start gently · full sentences · 2–3 / 10',
      intensity: 2,
      kind: 'warmup',
      movement: 'run',
    },
  ];
  if (aerobic > 0)
    steps.push({
      label:
        t.kind === 'long'
          ? 'Easy endurance running'
          : t.stimulus === 'economy'
            ? 'Easy run before strides'
            : 'Aerobic running before the main set',
      seconds: aerobic,
      effort: 'Comfortable aerobic running · 2–3 / 10',
      intensity: 3,
      kind: 'aerobic',
      movement: 'run',
    });
  sequence.forEach((seconds, i) => {
    if (i) {
      if (t.recoverySeconds > 0)
        steps.push({
          label:
            t.recoveryMovement === 'walk'
              ? 'Walking recovery'
              : 'Easy recovery',
          seconds: t.recoverySeconds,
          effort: t.hills
            ? 'Walk or jog back; recover fully'
            : t.recoveryMovement === 'walk'
              ? 'Walk; let breathing settle before the next effort'
              : 'Easy jog; let breathing settle',
          intensity: 2,
          kind: 'recovery',
          movement: t.recoveryMovement ?? 'run',
        });
      if (t.setRecoverySeconds && i % (sequence.length / setCount) === 0)
        steps.push({
          label: 'Extra recovery between sets',
          seconds: t.setRecoverySeconds,
          effort: 'Additional walking reset after the regular recovery',
          intensity: 2,
          kind: 'recovery',
          movement: 'walk',
        });
      if (splitEasy > 0)
        steps.push({
          label: 'Easy endurance between marathon blocks',
          seconds: splitEasy,
          effort: 'Return to a fully conversational effort · 2–3 / 10',
          intensity: 3,
          kind: 'aerobic',
          movement: 'run',
        });
    }
    steps.push({
      label:
        sequence.length === 1
          ? 'Controlled effort'
          : `Effort ${i + 1} of ${sequence.length}`,
      seconds,
      ...(t.workMetres
        ? {
            metres: t.workMetres[i % t.workMetres.length],
            planningPaceSecondsPerKm: t.planningPaceSecondsPerKm,
          }
        : {}),
      effort:
        gentle && t.intensity >= 6 && t.stimulus !== 'economy'
          ? 'Steady and comfortable · 5–6 / 10'
          : t.cue,
      intensity:
        gentle && t.stimulus !== 'economy'
          ? Math.min(5, t.intensity)
          : t.intensity,
      kind: 'work',
      movement: 'run',
    });
    if (t.floatSeconds)
      steps.push({
        label: 'Easy off block',
        seconds: t.floatSeconds,
        ...(t.floatMetres
          ? {
              metres: t.floatMetres,
              planningPaceSecondsPerKm: t.floatPlanningPaceSecondsPerKm,
            }
          : {}),
        effort:
          'Fully conversational · 2–3 / 10 · let the effort come right down',
        intensity: 3,
        kind: 'aerobic',
        movement: 'run',
      });
  });
  for (const [index, step] of steps.filter((s) => s.kind === 'work').entries())
    step.label = `${stepLength(step)} ${t.stimulus === 'threshold' ? (gentle ? 'steady' : 'tempo') : t.stimulus === 'race-rhythm' ? 'race rhythm' : t.stimulus === 'economy' ? 'stride' : 'interval'}${sequence.length > 1 ? ` · ${index + 1} of ${sequence.length}` : ''}`;
  steps.push({
    label: 'Cool down',
    seconds: cool,
    effort: 'Easy running · finish relaxed',
    intensity: 2,
    kind: 'cooldown',
    movement: 'run',
  });
  return {
    steps,
    qualityMinutes: hardSeconds / 60,
    minutes: steps.reduce((n, s) => n + s.seconds, 0) / 60,
  };
}

/** Shortening preserves preparation and complete repetitions; a tiny cap becomes easy. */
export function resizeWorkout(
  w: Workout,
  p: Profile,
  phase: Phase,
  ceilingMinutes: number,
  workCap = w.qualityMinutes ?? Infinity,
): Workout {
  let template = WORKOUT_LIBRARY.find((t) => t.id === w.templateId);
  const savedWork = w.steps.filter(
    (s) => s.kind === 'work' && s.intensity >= 4,
  );
  if (
    template &&
    w.varietyVersion &&
    !template.workMetres &&
    savedWork.some((s) => s.seconds !== savedWork[0]?.seconds)
  ) {
    template = {
      ...template,
      workSeconds: savedWork.map((s) => s.seconds),
      minimumReps: savedWork.length,
      maximumReps: savedWork.length,
      completeSet: true,
      recoverySeconds: Math.max(
        0,
        ...w.steps.filter((s) => s.kind === 'recovery').map((s) => s.seconds),
      ),
    };
  }
  const dose = template
    ? scaleTemplate(
        template,
        ceilingMinutes,
        p.difficulty === 'gentle',
        phase,
        workCap,
        Math.min(w.qualityMinutes ?? workCap, workCap),
        p,
        w.steps,
        { capBasis: 'prescribed' },
      )
    : null;
  if (dose)
    return withWorkoutTargets(
      withSpecificWorkoutName({
        ...w,
        steps: dose.steps,
        minutes: dose.minutes,
        qualityMinutes: dose.qualityMinutes,
        distanceEstimate: distanceEstimate(dose.steps, p),
        estimatedKm: (w.estimatedKm * dose.minutes) / w.minutes,
      }),
      p,
    );
  // Never compress warm-up and recoveries to manufacture a very short hard workout.
  const minutes = Math.max(
    5,
    Math.min(
      w.minutes,
      ceilingMinutes,
      (w.kind === 'long'
        ? (p.longLimitKm ?? Infinity)
        : (p.easyLimitKm ?? Infinity)) * (p.easyPace ?? 7),
    ),
  );
  const runWalk =
    p.experience === 'new' ||
    w.steps.some(
      (s) =>
        s.movement === 'walk' &&
        (s.kind !== 'recovery' || !w.hard || !!w.returnRole),
    );
  const steps = runWalk
    ? runWalkSteps(minutes, p.runWalkStage ?? 0)
    : [
        {
          kind: 'work' as const,
          label: 'Easy running',
          seconds: Math.round(minutes * 60),
          intensity: 3,
          effort: 'Conversational · 2–3 / 10',
          movement: 'run' as const,
        },
      ];
  return withWorkoutTargets(
    withSpecificWorkoutName({
      ...w,
      minutes,
      estimatedKm: (w.estimatedKm * minutes) / w.minutes,
      hard: false,
      templateId: undefined,
      targetWorkMinutes: undefined,
      stimulus: 'aerobic',
      qualityMinutes: 0,
      title: runWalk
        ? 'Run & walk'
        : w.kind === 'long'
          ? 'Easy long run'
          : 'Easy run',
      kind: w.kind === 'long' ? 'long' : 'easy',
      steps,
      distanceEstimate: distanceEstimate(steps, p),
      purpose:
        'An easy alternative within the available time; there is no quality work to make up.',
    }),
    p,
  );
}

export const WORKOUT_VARIETY_VERSION = 'purposeful-variety-v3';
const VARIETY_ROTATIONS: Record<string, string[]> = {
  'threshold:marathon': [
    'marathon-tempo-pyramid',
    'marathon-tempo-five',
    'marathon-tempo-bookends',
    'marathon-tempo-six',
    'marathon-tempo-ladder',
    'threshold-long-descending',
    'threshold-short-pyramid',
    'threshold-descending',
    'threshold-800-metres',
    'threshold-compact-pyramid',
    'threshold-pyramid',
    'threshold-cruise',
  ],
  threshold: [
    'threshold-short-pyramid',
    'threshold-800-metres',
    'threshold-descending',
    'threshold-compact-pyramid',
    'threshold-long-descending',
    'threshold-three',
    'threshold-long',
    'threshold-five',
    'threshold-pyramid',
    'threshold-cruise',
    'threshold-sustain',
  ],
  'aerobic-power': [
    'power-400-metres',
    'power-300-metres',
    'power-short-pyramid',
    'power-pyramid-metres',
    'power-full-pyramid',
    'power-ninety',
    'fartlek-ladder',
    'power-three',
    'fartlek-one',
    'power-two',
  ],
  'race-rhythm:5k': [
    'race-rhythm-5-metres',
    'race-rhythm-5-short',
    'race-rhythm-5',
  ],
  'race-rhythm:10k': ['race-rhythm-10-short', 'race-rhythm-10'],
  'race-rhythm:half': [
    'half-1000-metres',
    'half-descending',
    'half-short-blocks',
    'half-rhythm-ladder',
    'half-rhythm',
    'half-long-blocks',
  ],
  'race-rhythm:marathon': [
    'marathon-1000-metres',
    'marathon-descending',
    'marathon-pyramid',
    'marathon-six',
    'marathon-rhythm-ladder',
    'marathon-steady',
    'marathon-continuous',
    'marathon-long-blocks',
  ],
};

/** The stimulus remains familiar while repetition lengths and easy recoveries vary.
 * Recipes and rotations are authored product choices, not Runna's private algorithm.
 * This changes the shape of already allocated work; it cannot add training load.
 */
export function variedWorkoutPrescription(
  workout: Workout,
  profile: Profile,
  phase: Phase,
  exposure: number,
  previousTemplateId?: string,
  targetProfile = profile,
  previousWorkout?: Workout,
): Workout {
  const familiarExposures = (profile.recentQualitySessions ?? 0) > 0 ? 1 : 2;
  if (
    profile.workoutVariety === 'familiar' ||
    workout.templateId?.startsWith('marathon-book-') ||
    workout.templateId?.startsWith('session-') ||
    exposure < familiarExposures ||
    workout.varietyVersion === WORKOUT_VARIETY_VERSION
  )
    return workout;
  const family =
    workout.stimulus === 'race-rhythm'
      ? `race-rhythm:${profile.goal}`
      : workout.stimulus === 'threshold' && profile.goal === 'marathon'
        ? 'threshold:marathon'
        : (workout.stimulus ?? '');
  const sourceRotation = VARIETY_ROTATIONS[family];
  if (!sourceRotation) return workout;
  const measured = (id: string) =>
    !!WORKOUT_LIBRARY.find((t) => t.id === id)?.workMetres;
  const rotation =
    profile.workoutFormat === 'time'
      ? sourceRotation.filter((id) => !measured(id))
      : profile.workoutFormat === 'distance'
        ? [
            ...sourceRotation.filter(measured),
            ...sourceRotation.filter((id) => !measured(id)),
          ]
        : sourceRotation;
  if (!rotation.length) return workout;
  const originalQuality = qualityWorkMinutes(workout);
  const originalWork = workout.steps.filter((step) => step.kind === 'work');
  const longestWork = Math.max(0, ...originalWork.map((step) => step.seconds));
  const highestEffort = Math.max(
    0,
    ...originalWork.map((step) => step.intensity),
  );
  // Familiar work comes first. An exposure counts a scheduled recipe, not proof of fitness.
  const previousIndex =
    profile.goal === 'marathon' && previousTemplateId
      ? rotation.indexOf(previousTemplateId)
      : -1;
  const offset =
    profile.workoutFormat === 'distance'
      ? 0
      : previousIndex >= 0
        ? (previousIndex + 1) % rotation.length
        : (exposure - familiarExposures) % rotation.length;
  for (let index = 0; index < rotation.length; index++) {
    const id = rotation[(offset + index) % rotation.length];
    const template = resolveDistanceTemplate(
      WORKOUT_LIBRARY.find((item) => item.id === id)!,
      targetProfile,
      profile.difficulty === 'gentle',
    );
    if (!template) continue;
    if (
      id === workout.templateId ||
      id === previousTemplateId ||
      !template.goals.includes(profile.goal) ||
      !template.phases.includes(phase) ||
      template.hills ||
      Math.max(...template.workSeconds) > longestWork
    )
      continue;
    const gentle = profile.difficulty === 'gentle';
    const effort = gentle
      ? Math.min(5, template.intensity)
      : template.intensity;
    if (effort > highestEffort) continue;
    // The source session already includes any gentle adjustment. Do not apply it twice.
    const dose = scaleTemplate(
      template,
      workout.minutes,
      gentle,
      phase,
      originalQuality,
      originalQuality,
      targetProfile,
      undefined,
      { capBasis: 'prescribed' },
    );
    if (
      !dose ||
      dose.qualityMinutes < originalQuality * 0.75 ||
      dose.qualityMinutes > originalQuality + 1e-6
    )
      continue;
    if (previousWorkout && sameMainSet(dose.steps, previousWorkout.steps))
      continue;
    const sourceRecovery = workout.steps.filter(
      (step) => step.kind === 'recovery',
    );
    const nextRecovery = dose.steps.filter((step) => step.kind === 'recovery');
    // A similar total dose is not equivalent if rests disappear or shrink.
    if (
      (sourceRecovery.some((s) => s.movement === 'walk') &&
        nextRecovery.some((s) => s.movement !== 'walk')) ||
      nextRecovery.length < sourceRecovery.length ||
      nextRecovery.some(
        (step) =>
          step.seconds < Math.max(0, ...sourceRecovery.map((s) => s.seconds)),
      )
    )
      continue;
    const spare = Math.round(workout.minutes * 60 - dose.minutes * 60);
    if (spare < 0) continue;
    // Keep the runner's booked time. Only easy running can replace unused work/recovery time.
    if (spare > 0) {
      const aerobic = dose.steps.find((step) => step.kind === 'aerobic');
      if (aerobic) aerobic.seconds += spare;
      else
        dose.steps.splice(1, 0, {
          label: 'Easy running before the main set',
          seconds: spare,
          effort: 'Comfortable aerobic running · 2–3 / 10',
          intensity: 3,
          kind: 'aerobic',
          movement: 'run',
        });
    }
    const estimatedKm = dose.steps.reduce(
      (n, s) =>
        n +
        (s.metres !== undefined
          ? s.metres / 1000
          : s.seconds / 60 / (profile.easyPace ?? 7)),
      0,
    );
    if (
      template.workMetres &&
      (estimatedKm > workout.estimatedKm + 0.01 ||
        estimatedKm > (profile.qualityLimitKm ?? Infinity) + 0.01)
    )
      continue;
    return withWorkoutTargets(
      withSpecificWorkoutName({
        ...workout,
        title: template.title,
        kind: template.kind,
        templateId: template.id,
        stimulus: template.stimulus,
        purpose: template.purpose,
        reason: `${phase}: ${template.purpose} A different repetition pattern keeps the same training purpose, within your existing session time and work allowance.`,
        steps: dose.steps,
        qualityMinutes: dose.qualityMinutes,
        targetWorkMinutes: dose.qualityMinutes,
        distanceEstimate: distanceEstimate(dose.steps, profile),
        varietyVersion: WORKOUT_VARIETY_VERSION,
        varietySourceTemplateId:
          workout.varietySourceTemplateId ?? workout.templateId,
      }),
      profile,
    );
  }
  const shaped = shapedWorkout(workout, profile, exposure);
  return previousWorkout && sameMainSet(shaped.steps, previousWorkout.steps)
    ? workout
    : shaped;
}

function sameMainSet(a: Step[], b: Step[]) {
  const shape = (steps: Step[]) =>
    steps
      .filter((s) => s.kind === 'work')
      .map((s) => [
        s.metres === undefined ? 'time' : 'distance',
        s.metres ?? s.seconds,
        s.intensity,
      ]);
  return JSON.stringify(shape(a)) === JSON.stringify(shape(b));
}

/** A second family of patterns keeps every recovery and never lengthens a repetition.
 * Unused work becomes easy running; dates, minutes and effort ceiling do not change.
 */
function shapedWorkout(
  workout: Workout,
  profile: Profile,
  exposure: number,
): Workout {
  const work = workout.steps.filter(
    (s) => s.kind === 'work' && s.intensity >= 4,
  );
  if (
    work.length < 2 ||
    work.some((s) => s.metres !== undefined || s.seconds < 90)
  )
    return workout;
  // Authored, repeatable patterns; never manufacture arbitrary second-by-second variations.
  const patterns: Record<number, number[][]> = {
    2: [
      [180, 120],
      [240, 180],
      [360, 300],
      [480, 420],
    ],
    3: [
      [120, 180, 120],
      [180, 240, 180],
      [240, 180, 120],
      [360, 300, 240],
      [480, 360, 240],
    ],
    4: [
      [120, 90, 90, 120],
      [180, 120, 120, 180],
      [240, 180, 180, 240],
      [360, 300, 300, 360],
    ],
    5: [
      [180, 240, 240, 240, 180],
      [180, 210, 240, 210, 180],
      [240, 210, 180, 210, 240],
      [360, 420, 480, 420, 360],
      [480, 420, 360, 420, 480],
      [60, 90, 120, 90, 60],
      [120, 180, 180, 180, 120],
      [180, 240, 300, 240, 180],
    ],
    6: [
      [480, 480, 360, 360, 480, 480],
      [360, 480, 480, 480, 480, 360],
      [120, 120, 90, 90, 120, 120],
      [180, 180, 120, 120, 180, 180],
      [240, 240, 180, 180, 240, 240],
    ],
    7: [
      [60, 90, 120, 120, 120, 90, 60],
      [120, 150, 180, 180, 180, 150, 120],
    ],
    8: [
      [120, 120, 90, 90, 90, 90, 120, 120],
      [180, 180, 150, 150, 150, 150, 180, 180],
    ],
  };
  const options = (patterns[work.length] ?? []).filter(
    (pattern) =>
      pattern.every((seconds, i) => seconds <= work[i].seconds) &&
      pattern.some((seconds, i) => seconds !== work[i].seconds) &&
      pattern.reduce((a, b) => a + b, 0) >=
        work.reduce((n, s) => n + s.seconds, 0) * 0.75,
  );
  if (!options.length) return workout;
  const selected = options[exposure % options.length];
  let index = 0,
    spare = 0;
  const steps = workout.steps.map((s) => {
    if (s.kind !== 'work' || s.intensity < 4) return { ...s };
    const seconds = selected[index++];
    spare += s.seconds - seconds;
    return {
      ...s,
      seconds,
      label: `${stepLength({ ...s, seconds })} effort · ${index} of ${work.length}`,
    };
  });
  if (spare <= 0) return workout;
  const aerobic = steps.find((s) => s.kind === 'aerobic');
  if (aerobic) aerobic.seconds += spare;
  else
    steps.splice(1, 0, {
      kind: 'aerobic',
      label: 'Easy running before the main set',
      seconds: spare,
      intensity: 3,
      effort: 'Comfortable aerobic running · 2–3 / 10',
      movement: 'run',
    });
  const quality = qualityWorkMinutes({ ...workout, steps });
  if (quality < qualityWorkMinutes(workout) * 0.75) return workout;
  return withWorkoutTargets(
    withSpecificWorkoutName({
      ...workout,
      steps,
      qualityMinutes: quality,
      targetWorkMinutes: quality,
      distanceEstimate: distanceEstimate(steps, profile),
      varietyVersion: WORKOUT_VARIETY_VERSION,
      varietySourceTemplateId:
        workout.varietySourceTemplateId ?? workout.templateId,
      reason: `${workout.purpose} Repetition lengths vary within this session. Every recovery stays intact; any unused work time becomes easy running.`,
    }),
    profile,
  );
}
