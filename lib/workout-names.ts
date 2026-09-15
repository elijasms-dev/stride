import { workoutStepGroups } from './workout-groups.ts';
import { type Step, type Workout } from './plan/types.ts';
import {
  isSteadyRaceAdaptation,
  steadyRaceBriefing,
} from './steady-race-workout.ts';

export function duration(seconds: number) {
  return seconds % 60 === 0
    ? `${seconds / 60} min`
    : seconds < 120
      ? `${seconds} sec`
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
}
/** Track repetitions retain their authored unit, including on mile-based plans. */
export function repetitionDistance(metres: number) {
  return metres < 1000 ? `${metres} m` : `${metres / 1000} km`;
}
export function stepLength(step: Step) {
  return step.metres !== undefined
    ? repetitionDistance(step.metres)
    : duration(step.seconds);
}
/** Preserve conventional event names without rounding arbitrary custom distances. */
export function customRaceName(km: number) {
  if (Math.abs(km - 16.09344) < 0.00005) return '10-mile';
  if (km === 21.0975) return 'half-marathon';
  if (km === 42.195) return 'marathon';
  return Number.isInteger(km) ? `${km}K` : `${km} km`;
}
const workSteps = (w: Workout) =>
  w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4);
export function mainSetSummary(workout: Workout): string {
  const work = workSteps(workout);
  if (
    !work.length ||
    workout.kind === 'race' ||
    workout.returnRole ||
    workout.pairType
  )
    return '';
  const floats = workout.steps.filter(
    (s) => s.kind === 'aerobic' && s.label === 'Easy off block',
  );
  if (
    floats.length === work.length &&
    floats.length > 0 &&
    work.every((s) => stepLength(s) === stepLength(work[0])) &&
    floats.every((s) => stepLength(s) === stepLength(floats[0]))
  )
    return `${work.length} × (${stepLength(work[0])} tempo + ${stepLength(floats[0])} easy)`;
  if (workout.steps.some((s) => s.label === 'Extra recovery between sets')) {
    const sets = workoutStepGroups(workout.steps).filter(
      (g) => g.work.kind === 'work',
    );
    if (
      sets.length > 1 &&
      sets.every(
        (g) =>
          g.repetitions === sets[0].repetitions &&
          stepLength(g.work) === stepLength(sets[0].work),
      )
    )
      return `${sets.length} × (${sets[0].repetitions} × ${stepLength(sets[0].work)})`;
  }
  const groups: { length: string; count: number }[] = [];
  for (const step of work) {
    const length = stepLength(step),
      last = groups.at(-1);
    if (last?.length === length) last.count++;
    else groups.push({ length, count: 1 });
  }
  if (
    groups.length === work.length &&
    work.length > 2 &&
    work.every((s) => s.metres === undefined)
  )
    return (
      work
        .map((s) =>
          s.seconds % 60 === 0
            ? s.seconds / 60
            : `${Math.floor(s.seconds / 60)}:${String(s.seconds % 60).padStart(2, '0')}`,
        )
        .join('–') + ' min'
    );
  if (
    groups.length === work.length &&
    work.length > 2 &&
    work.every((s) => s.metres !== undefined && s.metres < 1000)
  )
    return work.map((s) => s.metres).join('–') + ' m';
  return groups
    .map((g) => `${g.count > 1 ? `${g.count} × ` : ''}${g.length}`)
    .join(' + ');
}
export function recoverySummary(workout: Workout): string {
  const extra = workout.steps.filter(
    (s) => s.label === 'Extra recovery between sets',
  );
  if (extra.length) {
    const regular = workout.steps.find(
      (s) => s.kind === 'recovery' && s.label !== 'Extra recovery between sets',
    );
    return `${regular ? `${stepLength(regular)} ${regular.movement === 'walk' ? 'walk' : 'easy jog'} between repetitions; ` : ''}${stepLength(extra[0])} extra walking recovery between sets.`;
  }
  if (workout.steps.some((s) => s.label === 'Easy off block'))
    return 'Run every off block at an easy conversational effort, including after the final tempo block.';
  const indices = workout.steps.flatMap((s, i) =>
    s.kind === 'work' && s.intensity >= 4 ? [i] : [],
  );
  const gaps = indices
    .slice(1)
    .map((to, i) => workout.steps.slice(indices[i] + 1, to));
  if (gaps.some((gap) => gap.some((s) => s.kind === 'aerobic'))) {
    const lengths = gaps.map((gap) =>
      gap.length > 0 && gap.every((s) => s.metres !== undefined)
        ? repetitionDistance(gap.reduce((n, s) => n + s.metres!, 0))
        : duration(gap.reduce((n, s) => n + s.seconds, 0)),
    );
    return lengths.every((length) => length === lengths[0])
      ? `${lengths[0]} easy running between efforts · ${gaps.length} ${gaps.length === 1 ? 'break' : 'breaks'}`
      : 'Follow the easy-running blocks between efforts in the steps below.';
  }
  const recovery = workout.steps.filter((s) => s.kind === 'recovery');
  if (!recovery.length)
    return workSteps(workout).length
      ? 'Continuous running; no recovery breaks.'
      : '';
  const same = recovery.every((s) => stepLength(s) === stepLength(recovery[0]));
  const movement = recovery.every((s) => s.movement === 'walk')
    ? 'walking'
    : /hill/.test(workout.templateId ?? '')
      ? 'walk or jog back'
      : 'easy jog';
  return same
    ? `${stepLength(recovery[0])} ${movement} between efforts · ${recovery.length} ${recovery.length === 1 ? 'recovery' : 'recoveries'}`
    : 'Follow the recovery after each effort in the steps below.';
}
function labelFor(workout: Workout, work: Step[]) {
  if (/hill/.test(workout.templateId ?? '')) return 'hill efforts';
  if (workout.stimulus === 'threshold')
    return work[0].intensity <= 5 ? 'steady efforts' : 'tempo';
  if (workout.stimulus === 'economy') return 'strides';
  if (workout.stimulus === 'race-rhythm') {
    if (isSteadyRaceAdaptation(workout)) return 'steady efforts';
    if (workout.eventDistanceKm !== undefined) {
      return `${customRaceName(workout.eventDistanceKm)} effort`;
    }
    const id = workout.templateId ?? '';
    return /marathon/.test(id)
      ? 'marathon effort'
      : /half/.test(id)
        ? 'half-marathon effort'
        : /race-rhythm-10/.test(id)
          ? '10K effort'
          : /race-rhythm-5/.test(id)
            ? '5K effort'
            : /ultra/.test(id)
              ? 'ultra steady'
              : 'race effort';
  }
  return workout.stimulus === 'aerobic-power' ? 'intervals' : 'steady';
}
/** Titles describe the saved steps, including after a shorter-session edit. */
export function specificWorkoutName(workout: Workout): string {
  if (
    workout.kind === 'race' ||
    workout.pairType ||
    workout.returnRole ||
    workout.steps.some((s) => s.movement === 'walk' && s.kind !== 'recovery')
  )
    return workout.title;
  const work = workSteps(workout);
  if (!work.length) return workout.title;
  const label = labelFor(workout, work),
    summary = mainSetSummary(workout);
  const lengths = work.map((s) => s.metres ?? s.seconds);
  const sameUnit = work.every(
    (s) => (s.metres !== undefined) === (work[0].metres !== undefined),
  );
  const uniform = sameUnit && lengths.every((n) => n === lengths[0]);
  if (workout.steps.some((s) => s.label === 'Easy off block'))
    return work[0].metres !== undefined
      ? 'On / off kilometres'
      : 'Tempo on / off';
  if (
    (workout.templateId?.startsWith('session-long-into-short') ||
      workout.templateId?.startsWith('marathon-book-long-into-short')) &&
    sameUnit &&
    lengths[0] !== lengths.at(-1)
  )
    return `${stepLength(work[0])} into ${stepLength(work.at(-1)!)}`;
  let title = `${summary} ${label}`;
  if (!uniform && sameUnit) {
    const middle = Math.floor(lengths.length / 2);
    const pyramid =
      lengths.length >= 3 &&
      lengths.every((n, i) => n === lengths[lengths.length - 1 - i]) &&
      lengths.slice(1, middle + 1).every((n, i) => n >= lengths[i]) &&
      lengths[middle] > lengths[0];
    const descending = lengths.every((n, i) => !i || n < lengths[i - 1]);
    const ascending = lengths.every((n, i) => !i || n > lengths[i - 1]);
    if (pyramid)
      title =
        label === 'intervals'
          ? 'Pyramid intervals'
          : `${label[0].toUpperCase() + label.slice(1)} pyramid`;
    else if (
      lengths.length >= 4 &&
      lengths.every((n, i) => n === lengths[lengths.length - 1 - i]) &&
      lengths[middle] < lengths[0]
    )
      title = `${label === 'tempo' ? 'Tempo' : label === 'intervals' ? 'Interval' : label[0].toUpperCase() + label.slice(1)} bookends`;
    else if (descending) title = `Cut-down ${label}`;
    else if (ascending)
      title = `${label[0].toUpperCase() + label.slice(1)} ladder`;
  }
  return workout.kind === 'long'
    ? `${workout.templateId === 'marathon-long-split' ? 'Split long run' : workout.templateId === 'marathon-long-finish' ? 'Progression long run' : 'Long run'} · ${title}`
    : title;
}
export function withSpecificWorkoutName(workout: Workout): Workout {
  return { ...workout, title: specificWorkoutName(workout) };
}

/** Authoring/review only: keep instructions aligned with an already reduced dose.
 * Reading a saved workout must never rewrite its historical/exported snapshot.
 */
export function withSteadyRaceInstructions(workout: Workout): Workout {
  if (!isSteadyRaceAdaptation(workout)) return workout;
  return withSpecificWorkoutName({
    ...workout,
    purpose: steadyRaceBriefing,
    reason:
      'Your gentler workout setting replaces race-pace practice with steady aerobic work. The saved repetitions, recoveries and session time still apply; no faster running needs to be made up.',
    steps: workout.steps.map((step) =>
      step.kind === 'work' && step.intensity >= 4
        ? {
            ...step,
            label: `${stepLength(step)} steady${step.label.match(/ · \d+ of \d+$/)?.[0] ?? ''}`,
          }
        : step,
    ),
  });
}
