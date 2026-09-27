import { firstRaceFeasibility } from './first-race.ts';
import { beginnerFeasibility } from './beginner.ts';
/** Derived preparation evidence. Assessments never change a prescription or log. */
import { schedulingEasyPace } from '../fitness-pacing.ts';
import { roadPreparationConstraint } from '../road-feasibility.ts';
import { trainingRecords } from '../run-records.ts';
import {
  isLongUltra,
  LONG_ULTRA_POLICY,
  longUltraCapacityMessage,
} from '../ultra-policy.ts';
import { todayInZone } from './calendar.ts';
import { round } from './math.ts';
import { TRAINING_POLICY } from './policy.ts';
import { customExposureKm, raceDistance, trainingFamily } from './profile.ts';
import {
  type FeasibilityCheck,
  type FeasibilityEvidence,
  type Plan,
} from './types.ts';

/** Recognize only the old computed exposure checks. Other constraints survive. */
function legacyComputedCheck(message: string) {
  return [
    'The six weeks before taper',
    'The remaining long-ultra block',
    'The remaining block reaches',
    'These limits leave a longest training exposure',
    'This short block reaches',
  ].some((prefix) => message.startsWith(prefix));
}

export function feasibilityEvidence(
  plan: Plan,
  asOf: string,
): FeasibilityEvidence {
  const longUltra = isLongUltra(plan.profile);
  const required = longUltra
    ? LONG_ULTRA_POLICY.rehearsalMinutes
    : ['custom', 'ultra'].includes(plan.profile.goal)
      ? customExposureKm(raceDistance(plan.profile))
      : TRAINING_POLICY.family[trainingFamily(plan.profile)]
          .minimumTrainingExposureKm;
  // Two-run plans deliberately use easy outings instead of a long-run label;
  // this matches the generation check without changing their prescriptions.
  const qualifies = (w: Plan['workouts'][number]) =>
    w.kind === 'long' || (plan.profile.days.length === 2 && w.kind === 'easy');
  const canonicalWorkouts = new Map<string, Plan['workouts'][number]>();
  for (const w of plan.workouts)
    if (w.status === 'completed' && w.feedback && !canonicalWorkouts.has(w.id))
      canonicalWorkouts.set(w.id, w);
  // Match the ultra capacity ledger: a retained race recording must not become
  // preparation merely because an old import also linked it to a training slot.
  const races = plan.workouts.filter((w) => w.kind === 'race');
  const raceIds = new Set(races.map((w) => w.id));
  const raceActivities = new Set(
    races.flatMap((w) =>
      w.feedback?.activityId ? [w.feedback.activityId] : [],
    ),
  );
  const recorded = trainingRecords(plan).filter((r) => {
    const w = r.workoutId ? canonicalWorkouts.get(r.workoutId) : undefined;
    return (
      w &&
      qualifies(w) &&
      r.date <= asOf &&
      r.date < plan.profile.raceDate &&
      !raceIds.has(w.id) &&
      !(r.activityId && raceActivities.has(r.activityId))
    );
  });
  const planned = plan.workouts.filter(
    (w) => w.week >= 0 && w.status === 'planned' && qualifies(w),
  );
  const remaining = planned.filter(
    (w) => w.date >= asOf && w.date < plan.profile.raceDate,
  );
  return {
    unit: longUltra ? 'minutes' : 'km',
    required,
    phase:
      asOf < plan.profile.startDate
        ? 'before-start'
        : asOf > plan.profile.raceDate
          ? 'after-event'
          : 'active',
    recorded: {
      sessions: recorded.length,
      longest: Math.max(
        0,
        ...recorded.map((r) => (longUltra ? r.minutes : (r.km ?? 0))),
      ),
      unknownDistanceSessions: recorded.filter((r) => r.km == null).length,
      longestEstimatedKm: Math.max(
        0,
        ...recorded
          .filter((r) => r.km == null)
          .map((r) => r.minutes / schedulingEasyPace(plan.profile)),
      ),
    },
    remaining: {
      sessions: remaining.length,
      longest: Math.max(
        0,
        ...remaining.map((w) => (longUltra ? w.minutes : w.estimatedKm)),
      ),
    },
    unresolved: {
      sessions: planned.filter(
        (w) => w.date < asOf && w.date < plan.profile.raceDate,
      ).length,
    },
  };
}

/** Current evidence is derived on read, so calendar advance needs no journal edit. */
export function assessFeasibility(
  plan: Plan,
  asOf: string,
): Plan['feasibility'] {
  if (plan.beginner) return beginnerFeasibility(plan, asOf);
  if (plan.firstRace) return firstRaceFeasibility(plan, asOf);
  if (
    plan.profile.goal === 'base' ||
    plan.feasibility?.status === 'event-deferred'
  )
    return plan.feasibility;
  const evidence = feasibilityEvidence(plan, asOf);
  const previous = plan.feasibility;
  const computedMessages = new Set(
    (Array.isArray(previous?.checks) ? previous.checks : [])
      .filter(
        (c) =>
          c && ['training-exposure', 'long-ultra-capacity'].includes(c.code),
      )
      .map((c) => c.message),
  );
  const checks: FeasibilityCheck[] = (previous?.reasons ?? [])
    .filter(
      (reason) => !computedMessages.has(reason) && !legacyComputedCheck(reason),
    )
    .map((message) => ({ code: 'retained-constraint', message }));
  const exposure = Math.max(
    evidence.recorded.longest,
    evidence.remaining.longest,
  );
  if (exposure + 0.01 < evidence.required) {
    const unknown = evidence.unresolved.sessions
      ? ` ${evidence.unresolved.sessions} past training ${evidence.unresolved.sessions === 1 ? 'session is' : 'sessions are'} unlogged and remain unknown.`
      : '';
    const distanceUnknown =
      evidence.unit === 'km' && evidence.recorded.unknownDistanceSessions
        ? ` ${evidence.recorded.unknownDistanceSessions} recorded ${evidence.recorded.unknownDistanceSessions === 1 ? 'session has' : 'sessions have'} no measured distance; planning-pace estimates are not recorded distance.`
        : '';
    const scope =
      plan.profile.days.length === 2
        ? 'planned easy-run slots'
        : 'planned long-run slots';
    checks.push({
      code: 'training-exposure',
      message: `For ${scope}, recorded training reaches ${round(evidence.recorded.longest)} ${evidence.unit}; remaining planned training reaches ${round(evidence.remaining.longest)} ${evidence.unit}. Neither establishes this event policy's ${round(evidence.required)} ${evidence.unit} preparation exposure.${unknown}${distanceUnknown}${roadPreparationConstraint(plan.profile, evidence.required)} Review this check alongside your other recorded running. Extra runs are included in weekly review and progress, not this slot-based check. Missing sessions are never made up.`,
    });
  }
  if (isLongUltra(plan.profile)) {
    const message = longUltraCapacityMessage(plan, asOf);
    if (message) checks.push({ code: 'long-ultra-capacity', message });
  }
  return {
    status: checks.length ? 'review-required' : 'forecast',
    asOf,
    reasons: checks.map((c) => c.message),
    checks,
    evidence,
  };
}

export function withCurrentFeasibility(
  plan: Plan,
  asOf = todayInZone(plan.profile.timezone),
): Plan {
  return { ...plan, feasibility: assessFeasibility(plan, asOf) };
}

export function refreshFeasibility(plan: Plan, asOf: string) {
  plan.feasibility = assessFeasibility(plan, asOf);
}
