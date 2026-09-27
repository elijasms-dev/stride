import {
  BEGINNER_PROGRAM,
  beginnerReview,
  beginnerSteps,
} from '../beginner-course.ts';
import { trainingRecords } from '../training-history.ts';
import { distanceEstimate } from '../prescription.ts';
import { applyPreferredStartTimes } from '../runner-customization.ts';
import { addDays, dayDiff, monday, weekday } from './calendar.ts';
import { PlanError } from './errors.ts';
import { ENGINE_VERSION, TRAINING_POLICY } from './policy.ts';
import { refreshWeekTotals } from './totals.ts';
import type { Plan, Profile, Workout } from './types.ts';
import { validatePlan } from './validate.ts';

export function beginnerFeasibility(
  plan: Plan,
  asOf: string,
): Plan['feasibility'] {
  const state = plan.beginner!;
  const remaining = (9 - state.stage) * 3;
  const slots = plan.workouts.filter(
    (w) => w.status === 'planned' && w.date >= asOf,
  ).length;
  return {
    status:
      state.completedAt && plan.profile.goal === '5k'
        ? 'forecast'
        : 'review-required',
    asOf,
    reasons: [
      ...(plan.profile.goal !== '5k'
        ? [
            'This is a learning-to-run foundation for your longer-term race goal. It does not establish race readiness. Review your measured running base before beginning distance-specific preparation.',
          ]
        : []),
      state.completedAt
        ? 'The 30-minute running milestone is complete. This does not establish a measured 5 km distance.'
        : `Couch to 5K stage ${state.stage + 1} of 9. Future sessions repeat this stage until a comfortable completion review unlocks the next. ${remaining} lessons remain before the 30-minute milestone, before allowing repeats. ${slots < remaining ? 'This finish date does not leave enough scheduled sessions to complete the course; continue in a later block.' : 'Allow longer whenever a stage needs repeating.'} Thirty minutes is not necessarily 5 km.`,
    ],
  };
}

function lessonWorkout(
  plan: Plan,
  date: string,
  lesson: number,
  previous?: Workout,
): Workout {
  const state = plan.beginner!;
  const steps = beginnerSteps(state.stage, lesson);
  return {
    id: previous?.id ?? crypto.randomUUID(),
    date,
    originalDate: previous?.originalDate ?? date,
    week: Math.floor(dayDiff(monday(plan.profile.startDate), date) / 7),
    title: `Couch to 5K · stage ${state.stage + 1}, lesson ${lesson + 1}`,
    kind: 'easy',
    minutes: steps.reduce((n, s) => n + s.seconds, 0) / 60,
    estimatedKm: 0,
    hard: false,
    steps,
    status: 'planned',
    stimulus: 'aerobic',
    qualityMinutes: 0,
    beginnerLesson: {
      stage: state.stage,
      lesson,
      stageStarted: state.stageStarted,
    },
    purpose:
      'Build comfortable running gradually. Walk for five minutes before and after; jogging stays conversational.',
    reason:
      'Repeat the current stage until all three lessons feel comfortable and your progress review is complete. Walk or stop if needed; record partial attempts honestly. No catch-up sessions.',
    distanceEstimate: distanceEstimate(steps, {
      ...plan.profile,
      easyPace: null,
      recentRace: undefined,
      workoutTargets: undefined,
    }),
  };
}

/** Retain journals and deliberate edits. A preference review cannot certify
 * fitness, reset course progress or reconstruct it from estimated kilometres. */
export function rebuildBeginner(
  plan: Plan,
  profile: Profile,
  from: string,
  resetLessons = false,
): Plan {
  const next = structuredClone(plan);
  next.profile = profile;
  next.policyVersion = TRAINING_POLICY.version;
  next.engineVersion = ENGINE_VERSION;
  next.constraintsFrom = from;
  const manual = next.workouts.filter(
    (w) =>
      w.date >= from && w.status === 'planned' && w.changeSource === 'manual',
  );
  const movedFrom = new Set(
    manual.filter((w) => w.originalDate !== w.date).map((w) => w.originalDate),
  );
  const retained = next.workouts.filter(
    (w) =>
      w.date < from ||
      w.status !== 'planned' ||
      (!resetLessons && w.changeSource === 'manual'),
  );
  const retainedIds = new Set(retained.map((w) => w.id));
  const reusable = new Map(
    next.workouts.filter((w) => !retainedIds.has(w.id)).map((w) => [w.date, w]),
  );
  const currentEarlier = retained.filter(
    (w) =>
      w.beginnerLesson?.stage === next.beginner!.stage &&
      w.beginnerLesson.stageStarted === next.beginner!.stageStarted &&
      w.date < from,
  );
  let lesson = resetLessons ? 0 : currentEarlier.length % 3;
  const workouts: Workout[] = [...retained];
  const observed = trainingRecords(next);
  for (
    let date = from > profile.startDate ? from : profile.startDate;
    date <= profile.raceDate;
    date = addDays(date, 1)
  ) {
    if (
      next.beginner!.breaks?.some(
        (range) => date >= range.from && date <= range.to,
      )
    )
      continue;
    const moved = manual.find((w) => w.date === date);
    if (
      (!profile.days.includes(weekday(date)) || movedFrom.has(date)) &&
      !moved
    )
      continue;
    const saved = retained.find((w) => w.date === date);
    if (saved) {
      if (saved.beginnerLesson?.stageStarted === next.beginner!.stageStarted)
        lesson = saved.beginnerLesson.lesson + 1;
      continue;
    }
    // Keep recovery after retained/moved/recorded sessions, even when new days
    // are requested midway through a week. Never add replacement catch-up runs.
    if (
      workouts.some(
        (w) => w.status === 'planned' && Math.abs(dayDiff(w.date, date)) < 2,
      ) ||
      observed.some((r) => Math.abs(dayDiff(r.date, date)) < 2)
    )
      continue;
    const weekStart = monday(date);
    if (
      workouts.filter(
        (w) => w.status !== 'skipped' && monday(w.date) === weekStart,
      ).length >= profile.days.length
    )
      continue;
    const workout = lessonWorkout(next, date, lesson++ % 3, reusable.get(date));
    if (moved) {
      workout.changed = true;
      workout.changeSource = 'manual';
    }
    workouts.push(workout);
  }
  next.workouts = workouts.sort((a, b) => a.date.localeCompare(b.date));
  const error = applyPreferredStartTimes(
    next.workouts.filter((w) => w.date >= from && w.status === 'planned'),
    profile,
    plan.profile,
  );
  if (error) throw new PlanError(error);
  refreshWeekTotals(next);
  next.feasibility = beginnerFeasibility(next, from);
  const errors = validatePlan(next);
  if (errors.length) throw new PlanError(errors[0]);
  return next;
}

export function makeBeginnerPlan(profile: Profile): Plan {
  const start = monday(profile.startDate);
  const weeks = Array.from(
    { length: Math.floor(dayDiff(start, profile.raceDate) / 7) + 1 },
    (_, index) => ({
      index,
      start: addDays(start, index * 7),
      phase: 'Foundation' as const,
      targetKm: 0,
      longKm: 0,
      focus:
        'Couch to 5K: timed, easy run/walk lessons. Progress after comfortable completion reviews; repeat as needed.',
    }),
  );
  const plan: Plan = {
    id: crypto.randomUUID(),
    engineVersion: ENGINE_VERSION,
    policyVersion: TRAINING_POLICY.version,
    profile,
    weeks,
    workouts: [],
    createdAt: new Date().toISOString(),
    beginner: {
      program: BEGINNER_PROGRAM,
      stage: 0,
      stageStarted: profile.startDate,
    },
    notes: [
      'Couch to 5K uses the NHS nine-stage, 27-session run/walk progression. Three sessions per week normally take at least nine weeks; two per week need at least fourteen weeks, and reviews or repeats can take longer.',
      'The calendar holds your current stage until you confirm all three lessons felt comfortable and review the next stage. Future dates never establish fitness. Keep at least one rest day between sessions.',
      'Begin with comfortable walking. If a one-minute jog is too much, walk, log a partial attempt and repeat; do not chase the next stage or the finish date.',
      'Every session includes a five-minute warm-up walk and five-minute cooldown. The final milestone is 30 minutes of continuous running, not a guaranteed 5 km or race appointment. Pace and distance stay unprescribed.',
    ],
  };
  return rebuildBeginner(plan, profile, profile.startDate, true);
}

export function advanceBeginner(plan: Plan, asOf: string): Plan {
  const review = beginnerReview(plan, asOf);
  if (!review.ready) throw new PlanError(review.reason);
  const next = structuredClone(plan);
  if (next.beginner!.stage === 8) {
    next.beginner!.completedAt = asOf;
    next.feasibility = beginnerFeasibility(next, asOf);
    return next;
  }
  if (asOf > plan.profile.raceDate)
    throw new PlanError(
      'This block has finished. Extend the course in a new reviewed block.',
    );
  delete next.beginner!.pausedUntil;
  next.beginner!.stage++;
  next.beginner!.stageStarted = asOf;
  return rebuildBeginner(next, next.profile, asOf, true);
}

export function pauseBeginner(
  plan: Plan,
  from: string,
  to: string,
  asOf: string,
): Plan {
  const next = structuredClone(plan);
  for (const w of next.workouts) {
    if (w.status === 'planned' && w.date >= from && w.date <= to) {
      w.status = 'skipped';
      w.skipReason = 'Planned beginner-course break';
      w.changed = true;
      w.changeSource = 'manual';
    }
  }
  next.beginner!.breaks = [...(next.beginner!.breaks ?? []), { from, to }];
  next.beginner!.stage =
    dayDiff(from, to) >= 13 ? 0 : Math.max(0, next.beginner!.stage - 1);
  next.beginner!.stageStarted = asOf;
  delete next.beginner!.completedAt;
  next.beginner!.pausedUntil =
    next.beginner!.pausedUntil && next.beginner!.pausedUntil > to
      ? next.beginner!.pausedUntil
      : to;
  next.notes.push(
    'A reviewed beginner break repeats an easier stage from today, preserving the rest dates and completed lessons. Only comfortable lessons after the break count toward the next progression review. Resume only when comfortable; no missed lessons are made up.',
  );
  return rebuildBeginner(next, next.profile, asOf, true);
}
