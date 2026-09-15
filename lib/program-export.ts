import { addDays, dayDiff, dayNames, weekday } from './plan/calendar.ts';
import { type Plan, type Step, type Workout } from './plan/types.ts';
import { distanceEstimate } from './prescription.ts';
import { supportingSession, workoutGuidance } from './coaching-context.ts';
import { planWeekFocus } from './plan-guidance.ts';

function targetMetrics(step: Step, workout: Workout, plan: Plan) {
  const match = step.effort.match(/(\d+)(?:[–-](\d+))?\s*\/\s*10/);
  return {
    pace_range:
      step.target?.mode === 'pace'
        ? {
            minimum_seconds_per_km: step.target.low,
            maximum_seconds_per_km: step.target.high,
          }
        : null,
    heart_rate_range_bpm:
      step.target?.mode === 'heart-rate'
        ? { minimum: step.target.low, maximum: step.target.high }
        : null,
    hr_zone: null,
    heart_rate_ceiling_bpm:
      workout.pairType === 'double-threshold' &&
      step.kind === 'work' &&
      plan.profile.thresholdControl === 'heart-rate'
        ? (plan.profile.thresholdCeiling ?? null)
        : null,
    rpe: match
      ? {
          minimum: Number(match[1]),
          maximum: Number(match[2] ?? match[1]),
          scale: 10,
        }
      : null,
    cue: step.effort,
    basis: step.target
      ? 'Explicit runner-supplied range, with effort cues retained.'
      : 'Effort-led prescription. No race-equivalent pace, age-derived heart-rate zone, or unmeasured threshold is inferred.',
  };
}
const category = (w: Workout) =>
  w.kind === 'race'
    ? 'Race'
    : w.kind === 'long'
      ? 'Long'
      : !w.hard
        ? 'Easy'
        : w.kind === 'tempo'
          ? 'Tempo'
          : 'Interval';
function session(workout: Workout, plan: Plan) {
  const steps = workout.steps.map((step) => ({
    label: step.label,
    duration_seconds: step.metres ? null : step.seconds,
    distance_metres: step.metres ?? null,
    movement: step.movement ?? 'run',
    kind: step.kind,
    target_metrics: targetMetrics(step, workout, plan),
  }));
  return {
    id: workout.id,
    workout_category: category(workout),
    title: workout.title,
    session: workout.session ?? null,
    start_time: workout.startTime ?? null,
    status: workout.status,
    duration_minutes: workout.kind === 'race' ? null : workout.minutes,
    duration_basis:
      workout.kind === 'race'
        ? 'Not predicted'
        : workout.steps.some((s) => s.metres !== undefined)
          ? 'Planning allowance; distance steps end at their distance target'
          : 'Prescribed time',
    distance_km: workout.steps.every((s) => s.metres != null)
      ? workout.steps.reduce((n, s) => n + s.metres!, 0) / 1000
      : null,
    estimated_distance:
      workout.kind === 'race'
        ? null
        : distanceEstimate(workout.steps, plan.profile),
    warmup: steps.filter((s) => s.kind === 'warmup'),
    main_set: steps.filter((s) => !['warmup', 'cooldown'].includes(s.kind)),
    cooldown: steps.filter((s) => s.kind === 'cooldown'),
    main_set_description: workout.steps
      .filter((s) => !['warmup', 'cooldown'].includes(s.kind))
      .map(
        (s) =>
          `${s.label}: ${s.metres ? `${s.metres} m` : `${s.seconds} s`} — ${s.effort}`,
      )
      .join('; '),
    coach_notes: [
      workout.purpose,
      workout.reason,
      ...workoutGuidance(plan, workout),
    ],
    recorded: workout.feedback
      ? {
          actual_date: workout.feedback.actualDate ?? workout.date,
          duration_minutes: workout.feedback.actualMinutes,
          distance_km: workout.feedback.actualKm,
          effort: workout.feedback.effort,
          feeling: workout.feedback.feeling,
          enjoyment: workout.feedback.enjoyment ?? null,
        }
      : null,
  };
}

/** A portable coaching view; it is intentionally separate from journal recovery files. */
export function exportProgram(plan: Plan) {
  return {
    format: 'stride-training-program-1',
    engine_version: plan.engineVersion,
    policy_version: plan.policyVersion,
    plan_id: plan.id,
    configuration: structuredClone(plan.profile),
    conventions: {
      day_index: 'Monday=0 through Sunday=6',
      duration:
        'Timed training duration is prescribed. Sessions containing distance steps have a planning allowance. Race duration is null; it is not a finish-time prediction.',
      distance:
        'Exact distance targets are separate from broad scheduling estimates.',
      cross_training:
        'Optional supporting work is excluded from running totals, fitness evidence and running-watch exports.',
      intensity:
        'Warm-up and recovery count as easy time. No fixed 20% quota is filled with extra quality work.',
    },
    weeks: plan.weeks.map((week) => ({
      week_index: week.index,
      start_date: week.start,
      phase: week.phase,
      purpose: planWeekFocus(plan, week),
      running_minutes: plan.workouts
        .filter(
          (w) =>
            w.week === week.index &&
            w.kind !== 'race' &&
            w.status !== 'skipped',
        )
        .reduce((n, w) => n + w.minutes, 0),
      days: Array.from({ length: 7 }, (_, i) => addDays(week.start, i))
        .filter(
          (date) =>
            date >= plan.profile.startDate && date <= plan.profile.raceDate,
        )
        .map((date) => {
          const runs = plan.workouts
            .filter((w) => w.date === date && w.week === week.index)
            .sort((a, b) =>
              (a.session ?? 'AM').localeCompare(b.session ?? 'AM'),
            );
          const active = runs.filter((w) => w.status !== 'skipped');
          const cross = supportingSession(plan, date);
          return {
            day_index: weekday(date),
            day: dayNames[weekday(date)],
            date,
            workout_category:
              active.length > 1
                ? 'Multiple runs'
                : active.length
                  ? category(active[0])
                  : cross
                    ? 'Cross-Train'
                    : 'Rest',
            sessions: runs.map((w) => session(w, plan)),
            cross_training: cross
              ? {
                  activity: cross.activity,
                  duration_minutes: cross.minutes,
                  coach_notes: [cross.notes],
                  optional: true,
                }
              : null,
            coach_notes:
              active.length || cross
                ? []
                : [
                    runs.length
                      ? 'No catch-up work is scheduled for skipped runs.'
                      : 'No running prescribed. Rest or normal daily activity.',
                  ],
          };
        }),
    })),
    calendar_days: dayDiff(plan.profile.startDate, plan.profile.raceDate) + 1,
  };
}
