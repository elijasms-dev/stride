/** Timed beginner lessons adapted from the current NHS Couch to 5K printable
 * schedule. Source and modelling decisions: docs/research/couch-to-5k.md.
 * A stage is three lessons, not a calendar week or evidence of a 5 km run. */
import type { Plan, Profile, Step, Workout } from './plan/types.ts';
import { addDays, dayDiff, validDate } from './plan/calendar.ts';
import { trainingRecords } from './training-history.ts';
import { clockMinutes, runningDayLimit } from './runner-customization.ts';

export const BEGINNER_PROGRAM = 'nhs-c25k-v1' as const;
export const isBeginnerProfile = (p: Profile) =>
  (p.goal === '5k' ||
    (p.planLevel === 'beginner' &&
      ['10k', 'half', 'marathon'].includes(p.goal))) &&
  (p.experience === 'new' || p.planLevel === 'beginner') &&
  p.weeklyKm === 0 &&
  p.longestKm === 0 &&
  p.currentRuns === 0;

// Alternating run/walk minutes, always ending in running. The separate five
// minute cooldown replaces (rather than duplicates) a final recovery walk.
const repeated = (run: number, walk: number, count: number) =>
  Array.from({ length: count * 2 - 1 }, (_, i) => (i % 2 ? walk : run));
const same = (recipe: number[]) => [recipe, recipe, recipe];
export const BEGINNER_LESSONS: readonly (readonly (readonly number[])[])[] = [
  same(repeated(1, 1.5, 8)),
  same(repeated(1.5, 2, 6)),
  same([1.5, 1.5, 3, 3, 1.5, 1.5, 3]),
  same([3, 1.5, 5, 2.5, 3, 1.5, 5]),
  [[5, 3, 5, 3, 5], [8, 5, 8], [20]],
  [[5, 3, 8, 3, 5], [10, 3, 10], [25]],
  same([25]),
  same([28]),
  same([30]),
];

export function beginnerSteps(stage: number, lesson: number): Step[] {
  const walking = (kind: 'warmup' | 'cooldown'): Step => ({
    label: kind === 'warmup' ? '5 min warm-up walk' : '5 min cooldown walk',
    seconds: 300,
    movement: 'walk',
    intensity: 1,
    kind,
    effort: 'Comfortable walking',
  });
  return [
    walking('warmup'),
    ...BEGINNER_LESSONS[stage][lesson].map(
      (minutes, i): Step => ({
        label: `${minutes} min ${i % 2 ? 'walk' : 'easy jog'}`,
        seconds: minutes * 60,
        movement: i % 2 ? 'walk' : 'run',
        intensity: i % 2 ? 1 : 3,
        kind: i % 2 ? 'recovery' : 'aerobic',
        effort:
          i % 2
            ? 'Walk comfortably; recover your breathing'
            : 'Conversational effort; slow down or walk if needed',
      }),
    ),
    walking('cooldown'),
  ];
}

export function separatedBeginnerDays(days: number[]) {
  return days.every((a, i) =>
    days
      .slice(i + 1)
      .every((b) => Math.min(Math.abs(a - b), 7 - Math.abs(a - b)) >= 2),
  );
}

/** Search real availability; an arbitrary long-day preference is irrelevant. */
export function beginnerDays(p: Profile, available: number[], runs: number) {
  const feasible = available.filter(
    (day) =>
      runningDayLimit(p, day) >= 40 &&
      clockMinutes(
        p.dayPreferences?.find((d) => d.day === day)?.startTime ?? '00:00',
      ) +
        40 <=
        1440,
  );
  const fixed = p.availableDays === undefined && p.runsPerWeek === undefined;
  if (fixed)
    return separatedBeginnerDays(p.days) &&
      p.days.every((d) => feasible.includes(d))
      ? p.days
      : [];
  const options: number[][] = [];
  for (let mask = 1; mask < 1 << feasible.length; mask++) {
    const days = feasible.filter((_, i) => mask & (1 << i));
    if (days.length === runs && separatedBeginnerDays(days)) options.push(days);
  }
  // Prefer the current pattern, preserving it when additional availability opens.
  options.sort(
    (a, b) =>
      b.filter((d) => p.days.includes(d)).length -
      a.filter((d) => p.days.includes(d)).length,
  );
  return options[0] ?? [];
}

export function matchesBeginnerLesson(w: Workout) {
  const stamp = w.beginnerLesson;
  if (
    !stamp ||
    !Number.isInteger(stamp.stage) ||
    stamp.stage < 0 ||
    stamp.stage > 8 ||
    ![0, 1, 2].includes(stamp.lesson)
  )
    return false;
  const expected = beginnerSteps(stamp.stage, stamp.lesson);
  return (
    !w.hard &&
    w.kind === 'easy' &&
    !w.templateId &&
    w.estimatedKm === 0 &&
    w.minutes === expected.reduce((n, s) => n + s.seconds, 0) / 60 &&
    w.steps.length === expected.length &&
    w.steps.every(
      (s, i) =>
        s.seconds === expected[i].seconds &&
        s.movement === expected[i].movement &&
        s.kind === expected[i].kind &&
        s.intensity === expected[i].intensity &&
        s.target === undefined &&
        s.metres === undefined &&
        s.planningPaceSecondsPerKm === undefined,
    )
  );
}

export function beginnerReview(plan: Plan, asOf: string) {
  const state = plan.beginner!;
  const reviewStart = state.pausedUntil
    ? [state.stageStarted, addDays(state.pausedUntil, 1)].sort().at(-1)!
    : state.stageStarted;
  const from = [reviewStart, addDays(asOf, -28)].sort().at(-1)!;
  const recent = trainingRecords(plan).filter(
    (r) => r.date >= from && r.date <= asOf,
  );
  const byId = new Map(plan.workouts.map((w) => [w.id, w]));
  const matching = recent
    .filter((r) => {
      const w = byId.get(r.workoutId ?? '');
      return (
        w &&
        w.week >= 0 &&
        matchesBeginnerLesson(w) &&
        w.beginnerLesson?.stage === state.stage &&
        w.beginnerLesson.stageStarted === state.stageStarted &&
        r.date < asOf &&
        r.expectedEasy &&
        r.feeling !== 'tired' &&
        r.effort <= 4 &&
        r.minutes >= w.minutes
      );
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  // Three copies of lesson one cannot certify the two longer, different lessons.
  let completed = 0;
  let lastDate = '';
  for (const r of matching) {
    const w = byId.get(r.workoutId!)!;
    if (
      w.feedback?.execution === 'as-planned' &&
      w.beginnerLesson!.lesson === completed &&
      (!lastDate || dayDiff(lastDate, r.date) >= 2)
    ) {
      completed++;
      lastDate = r.date;
    }
  }
  const fatigue = recent.some((r) => r.feeling === 'tired' || r.effort >= 7);
  const ready = !fatigue && completed === 3 && dayDiff(reviewStart, asOf) >= 7;
  return {
    ready: ready && !state.completedAt,
    stage: state.stage,
    completed,
    required: 3,
    windowDays: 28,
    heldForFatigue: fatigue,
    unconfirmedWorkoutIds: matching
      .filter(
        (r) =>
          !byId.get(r.workoutId!)?.feedback?.execution ||
          byId.get(r.workoutId!)?.feedback?.execution === 'unknown',
      )
      .map((r) => r.workoutId!),
    reason:
      state.pausedUntil && dayDiff(reviewStart, asOf) < 7
        ? 'This reviewed break repeats an easier stage. Complete and review three comfortable lessons after the break, with at least seven days back; earlier running cannot certify the return.'
        : state.completedAt
          ? 'You completed the 30-minute running course. Distance remains unconfirmed until measured.'
          : fatigue
            ? 'Recent running includes tired feedback or high effort. Repeat comfortable lessons and review recovery before progressing.'
            : 'Complete all three lessons in order on separate days with rest between, confirm the running intervals and log comfortable effort. Review after at least seven days; today does not yet count. Repeat this stage as needed.',
    evidence: `beginner:${state.stage}:${state.stageStarted}:${recent.map((r) => [r.id, r.date, r.recordedAt, r.feeling, r.effort, r.minutes, byId.get(r.workoutId ?? '')?.feedback?.execution].join(':')).join('|')}`,
  };
}

/** Also used on recovery imports: no numeric target or corrupted lesson may
 * turn a beginner prescription into a distance/pace workout. */
export function beginnerPlanErrors(plan: Plan): string[] {
  const state = plan.beginner;
  if (!state)
    return isBeginnerProfile(plan.profile) ||
      plan.workouts.some((w) => w.week >= 0 && w.beginnerLesson)
      ? ['The beginner course is missing its saved progression state.']
      : [];
  if (
    state.program !== BEGINNER_PROGRAM ||
    !Number.isInteger(state.stage) ||
    state.stage < 0 ||
    state.stage > 8 ||
    !validDate(state.stageStarted) ||
    state.stageStarted < plan.profile.startDate ||
    (state.completedAt !== undefined &&
      (!validDate(state.completedAt) ||
        state.completedAt < state.stageStarted ||
        state.stage !== 8)) ||
    (state.pausedUntil !== undefined && !validDate(state.pausedUntil)) ||
    (state.breaks !== undefined &&
      (!Array.isArray(state.breaks) ||
        state.breaks.length > 100 ||
        state.breaks.some(
          (range) =>
            !range ||
            !validDate(range.from) ||
            !validDate(range.to) ||
            range.to < range.from ||
            range.from < plan.profile.startDate,
        ))) ||
    !isBeginnerProfile(plan.profile) ||
    plan.returnState
  )
    return ['The beginner course has invalid saved progression state.'];
  const errors: string[] = [];
  let previous: Workout | undefined;
  for (const w of [...plan.workouts]
    .filter((w) => w.week >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    const stamp = w.beginnerLesson;
    if (
      !stamp ||
      !Number.isInteger(stamp.stage) ||
      stamp.stage < 0 ||
      stamp.stage > 8 ||
      ![0, 1, 2].includes(stamp.lesson) ||
      !validDate(stamp.stageStarted) ||
      stamp.stageStarted > w.date
    ) {
      errors.push('A beginner lesson has invalid progression metadata.');
      continue;
    }
    // A deliberate recovery may repeat an earlier stage; historical recipes remain intact.
    if (
      w.status === 'planned' &&
      w.date >= state.stageStarted &&
      (stamp.stage !== state.stage || stamp.stageStarted !== state.stageStarted)
    )
      errors.push('Future beginner lessons must stay at the reviewed stage.');
    if (!matchesBeginnerLesson(w))
      errors.push(
        'Beginner lessons must retain the full timed run/walk recipe, walking preparation and cooldown, with conversational effort.',
      );
    if (w.status === 'planned') {
      if (
        state.breaks?.some(
          (range) => w.date >= range.from && w.date <= range.to,
        )
      )
        errors.push(
          'A beginner lesson cannot fall inside a reviewed rest break.',
        );
      if (previous && dayDiff(previous.date, w.date) < 2)
        errors.push(
          'Keep at least one rest day between beginner running sessions, including across weeks.',
        );
      previous = w;
      if (
        w.date >= (plan.constraintsFrom ?? plan.profile.startDate) &&
        trainingRecords(plan).some((r) => Math.abs(dayDiff(r.date, w.date)) < 2)
      )
        errors.push(
          'Leave a rest day after recorded running before the next beginner session. Review upcoming dates.',
        );
    }
  }
  return errors;
}

/** Recorded activity is authoritative. Keep it, reserve recovery, and never
 * fill a removed lesson with an extra run elsewhere in the week. */
export function reserveBeginnerRecovery(
  plan: Plan,
  asOf: string,
  dates = trainingRecords(plan).map((r) => r.date),
) {
  plan.constraintsFrom = asOf;
  for (const w of plan.workouts) {
    if (w.status !== 'planned' || w.date < asOf) continue;
    if (dates.some((date) => Math.abs(dayDiff(date, w.date)) < 2)) {
      w.status = 'skipped';
      w.skipReason =
        'Rest after recorded running; repeat the beginner stage before progressing.';
      w.changed = true;
      w.changeSource = 'preferences';
    }
  }
}
