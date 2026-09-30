import { validateRecentRace, type RecentRace } from './fitness-pacing.ts';
import { beginnerReview } from './beginner-course.ts';
import { addDays } from './plan/calendar.ts';
import { PlanError } from './plan/errors.ts';
import { refreshFeasibility } from './plan/feasibility.ts';
import type { Plan, Profile } from './plan/types.ts';
import { validatePlan } from './plan/validate.ts';
import {
  updateWorkoutTargets,
  validateWorkoutTargets,
  type WorkoutTargets,
} from './workout-targets.ts';

/** Omitted evidence is retained; explicit null clears it. This deliberately
 * cannot change training background, programme choice or the running schedule. */
export type PacingEvidencePatch = { recentRace?: RecentRace | null };

export function validatePacingEvidence(
  value: unknown,
  asOf: string,
): PacingEvidencePatch | undefined {
  if (value === undefined) return;
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== 'recentRace')
  )
    throw new PlanError(
      'Check your pace evidence. Only a recent race result can be changed here.',
    );
  const patch = value as PacingEvidencePatch;
  if (patch.recentRace === undefined) return {};
  if (patch.recentRace === null) return { recentRace: null };
  try {
    return { recentRace: validateRecentRace(patch.recentRace, asOf) };
  } catch (error) {
    throw new PlanError((error as Error).message);
  }
}

export type QualityReadinessReview = {
  preference: 'automatic' | 'custom';
  requestedSessions: 0 | 1 | 2 | null;
  status:
    | 'foundation'
    | 'review-required'
    | 'explicit-opt-out'
    | 'source-managed';
  title: string;
  message: string;
  evidence: string[];
  nextSteps: string[];
  automaticTransition: false;
};

/** A pace result is not a quality-readiness assessment. The current catalogue
 * contains foundation and easy first-race courses, but no approved automatic
 * transition to a faster programme. Expose that gap rather than invent one. */
export function qualityReadinessReview(
  plan: Plan,
  asOf: string,
): QualityReadinessReview {
  const preference: QualityReadinessReview['preference'] =
    plan.profile.qualityMode === 'custom' ? 'custom' : 'automatic';
  const common = {
    preference,
    requestedSessions:
      preference === 'custom' ? (plan.profile.qualitySessions ?? 1) : null,
    automaticTransition: false as const,
  };
  const retainedPreference =
    preference === 'automatic'
      ? 'Automatic progression remains selected'
      : 'Your faster-workout preference remains saved';
  if (preference === 'custom' && plan.profile.qualitySessions === 0)
    return {
      ...common,
      status: 'explicit-opt-out',
      title: 'Easy-only preference retained',
      message:
        'You chose zero faster workouts. Updating pace evidence does not change that choice.',
      evidence: ['Your saved choice is custom: zero weekday workouts.'],
      nextSteps: [
        'To introduce faster running later, review your programme and workout preference together.',
      ],
    };
  if (plan.beginner) {
    const review = beginnerReview(plan, asOf);
    const completed = !!plan.beginner.completedAt;
    return {
      ...common,
      status: completed ? 'review-required' : 'foundation',
      title: completed
        ? 'Review your next programme'
        : 'Build comfortable running first',
      message: completed
        ? `Your 30-minute course is complete. ${retainedPreference}, but a faster programme needs an entry and recovery review; a benchmark alone cannot approve it.`
        : `${retainedPreference}. This stage uses conversational run/walk lessons; a new benchmark or calendar date does not introduce speedwork.`,
      evidence: [review.reason],
      nextSteps: completed
        ? [
            'Review your measured recent running, comfortable continuous duration and recovery.',
            'Compare that background with the next programme’s published entry requirements before accepting a transition. No automatic faster-programme transition is currently available.',
          ]
        : [
            'Complete and review the current lessons comfortably; repeat the stage when needed.',
          ],
    };
  }
  if (plan.firstRace || plan.profile.planLevel === 'beginner')
    return {
      ...common,
      status: 'review-required',
      title: 'Review before introducing faster running',
      message: `Your beginner programme stays easy. ${retainedPreference}; adding faster sessions requires a reviewed programme transition.`,
      evidence: [
        'A new pace benchmark does not confirm tolerance of faster sessions or recovery from them.',
      ],
      nextSteps: [
        'Review completed running, recent consistency, comfortable duration and recovery.',
        'Choose a programme whose published entry requirements and first faster sessions match that background. No automatic faster-programme transition is currently available.',
      ],
    };
  return {
    ...common,
    status: 'source-managed',
    title: 'Workout structure retained',
    message:
      'This review changes pace guidance only. Your programme, running days and choice of faster workouts remain unchanged.',
    evidence: [],
    nextSteps: [],
  };
}

/** Reject the old preference path when it would replan merely to edit a result. */
export function assertNoPacingPreferenceChange(
  profile: Profile,
  value: unknown,
  asOf: string,
) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.hasOwn(value, 'recentRace')
  )
    return;
  const recentRace = validatePacingEvidence(
    { recentRace: (value as PacingEvidencePatch).recentRace },
    asOf,
  )?.recentRace;
  if (
    recentRace !== undefined &&
    JSON.stringify(recentRace ?? null) !==
      JSON.stringify(profile.recentRace ?? null)
  )
    throw new PlanError(
      'Update your recent result in Training paces and preview the targets. A pace change must not rebuild your running schedule.',
    );
}

export function preparePaceReview(
  plan: Plan,
  targets: unknown,
  pacing: unknown,
  asOf: string,
  protectedIds: readonly string[] = [],
) {
  let config: WorkoutTargets | null;
  try {
    config = targets === null ? null : validateWorkoutTargets(targets);
  } catch (error) {
    throw new PlanError((error as Error).message);
  }
  const patch = validatePacingEvidence(pacing, asOf);
  // The watch may receive first-time sends through today + 6. Retain those
  // snapshots even before a delivery receipt is recorded.
  const effectiveDate = addDays(asOf, 7);
  const candidate = updateWorkoutTargets(
    plan,
    config,
    effectiveDate,
    protectedIds,
    patch,
  );
  // Saving/reading state recomputes this display assessment. Preview must show
  // the same assessment for the changed estimates before asking for approval.
  refreshFeasibility(candidate, asOf);
  const protectedSet = new Set(protectedIds);
  if (candidate.workouts.length !== plan.workouts.length)
    throw new PlanError(
      'A pace review cannot add or remove training sessions.',
    );
  for (let i = 0; i < plan.workouts.length; i++) {
    const previous = plan.workouts[i];
    const next = candidate.workouts[i];
    if (
      previous.id !== next.id ||
      previous.date !== next.date ||
      previous.kind !== next.kind ||
      previous.status !== next.status ||
      previous.hard !== next.hard ||
      previous.templateId !== next.templateId
    )
      throw new PlanError(
        'A pace review cannot change your running schedule or workout selection.',
      );
    if (
      previous.status !== 'planned' ||
      previous.week < 0 ||
      previous.date < effectiveDate ||
      protectedSet.has(previous.id)
    ) {
      if (JSON.stringify(previous) !== JSON.stringify(next))
        throw new PlanError(
          'A pace review cannot change recorded or protected workouts.',
        );
    } else if (
      previous.steps.length !== next.steps.length ||
      previous.steps.some((step, index) => {
        const updated = next.steps[index];
        return (
          step.kind !== updated.kind ||
          step.movement !== updated.movement ||
          step.intensity !== updated.intensity ||
          (step.metres !== undefined
            ? step.metres !== updated.metres
            : updated.metres !== undefined || step.seconds !== updated.seconds)
        );
      })
    ) {
      throw new PlanError(
        'A pace review must retain the prescribed work and recovery distances or durations.',
      );
    }
  }
  // Legacy saved plans may predate current scheduling rules. They cannot acquire
  // a new failure, but updating their paces is not permission to rebuild them.
  const priorIssues = new Set(validatePlan(plan));
  const issue = validatePlan(candidate).find(
    (message) => !priorIssues.has(message),
  );
  if (issue) throw new PlanError(issue);
  return {
    plan: candidate,
    effectiveDate,
    qualityReview: qualityReadinessReview(candidate, asOf),
    protectedCount: plan.workouts.filter(
      (w) => w.status === 'planned' && w.date >= asOf && protectedSet.has(w.id),
    ).length,
    protectedWindowCount: plan.workouts.filter(
      (w) => w.status === 'planned' && w.date >= asOf && w.date < effectiveDate,
    ).length,
  };
}

export async function paceReviewFingerprint(
  plan: Plan,
  effectiveDate: string,
  protectedIds: readonly string[],
) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify({
        plan,
        effectiveDate,
        // New deliveries invalidate a preview even if that run was already inside
        // the protected window and therefore does not alter the candidate itself.
        protectedIds: [...new Set(protectedIds)].sort(),
      }),
    ),
  );
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
