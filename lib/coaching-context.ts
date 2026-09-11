import { isLongUltra } from './ultra-policy.ts';
import {
  addDays,
  dayDiff,
  weekday,
  trainingPhaseOn,
  usesDailyTaperPhase,
  type Plan,
  type Workout,
} from './engine.ts';

export const crossTrainingLabel = {
  strength: 'Familiar strength routine',
  cycling: 'Easy cycling',
  swimming: 'Easy swimming',
  mobility: 'Gentle mobility',
} as const;

/** Supporting sessions are calendar intentions, never running load or completed evidence. */
export function supportingSession(plan: Plan, date: string) {
  if (date < plan.profile.startDate || date > plan.profile.raceDate)
    return null;
  if (
    plan.returnState &&
    plan.returnState.stage < 3 &&
    date >= plan.returnState.from
  )
    return null;
  if (plan.workouts.some((w) => w.date === date && w.status !== 'skipped'))
    return null;
  const session = plan.profile.crossTraining?.find(
    (s) => s.day === weekday(date),
  );
  if (!session) return null;
  const week = plan.weeks.find(
    (w) => date >= w.start && date <= addDays(w.start, 6),
  );
  if (!week) return null;
  const raceGap =
    plan.profile.goal === 'base'
      ? Infinity
      : dayDiff(date, plan.profile.raceDate);
  if (raceGap <= (session.activity === 'strength' ? 7 : 2)) return null;
  const phase = usesDailyTaperPhase(plan.profile)
    ? trainingPhaseOn(plan.profile, week.phase, date)
    : week.phase;
  const factor =
    phase === 'Recovery'
      ? 0.75
      : ['Taper', 'Race week'].includes(phase)
        ? 0.5
        : 1;
  return {
    ...session,
    date,
    title: crossTrainingLabel[session.activity],
    minutes: Math.max(5, Math.floor(session.minutes * factor)),
    notes:
      session.activity === 'strength'
        ? 'Use a familiar routine without training to failure. This is optional supporting work; reduce or skip it if it compromises running or recovery.'
        : 'Keep this easy and optional. It does not replace missed running or raise the plan’s running baseline.',
  };
}

export function weekSupportingSessions(plan: Plan, week: number) {
  return Array.from({ length: 7 }, (_, i) =>
    supportingSession(plan, addDays(plan.weeks[week].start, i)),
  ).filter((s) => s !== null);
}

/** Context is advisory. It does not add intervals, time, intensity, or provider targets. */
export function workoutGuidance(plan: Plan, workout: Workout): string[] {
  const p = plan.profile;
  const returning = plan.returnState && plan.returnState.stage < 3;
  const notes: string[] = [];
  if (workout.status !== 'planned' || workout.kind === 'race') return notes;
  if (isLongUltra(p) && workout.kind === 'long' && !returning)
    notes.push(
      'Rehearse short, deliberate walk breaks, simple aid-station stops and your carry system within this session. Keep the full outing easy; do not extend it to imitate race duration.',
    );
  if (p.raceTerrain === 'rolling')
    notes.push(
      'Use runnable rolling terrain for easy endurance practice. Hold the intended effort uphill and downhill; use a level, predictable route for fast repetitions. Walking is appropriate when running would exceed the prescribed effort.',
    );
  if (workout.minutes > 90 && !returning) {
    notes.push(
      p.carbsPerHour != null
        ? `Practice your already tolerated ${p.carbsPerHour} g carbohydrate/hour routine. Adjust for comfort and conditions; this saved preference is not a requirement to increase intake.`
        : 'Practice fueling with foods and amounts you already tolerate. Build gut tolerance gradually; do not introduce a large new intake on this run.',
    );
    notes.push(
      'Carry fluid appropriate to the route and weather. Drink in response to thirst; avoid forcing a fixed hourly amount.',
    );
  }
  const weekPhase = plan.weeks[workout.week]?.phase;
  const phase =
    weekPhase && usesDailyTaperPhase(p)
      ? trainingPhaseOn(p, weekPhase, workout.date)
      : weekPhase;
  if (workout.kind === 'long' && phase === 'Race preparation' && !returning)
    notes.push(
      'Rehearse familiar race shoes, clothing and how you carry fuel. Choose conditions relevant to your event without turning the whole outing into a race effort.',
    );
  if (
    (p.practiceInDark || (isLongUltra(p) && p.practiceInDark !== false)) &&
    !returning
  ) {
    const practiceWeeks = plan.weeks
      .filter((w) => w.phase === 'Race preparation')
      .filter((_, i) => i % 2 === 0)
      .slice(0, 3);
    if (practiceWeeks.some((w) => w.index === workout.week)) {
      const candidate = plan.workouts
        .filter(
          (w) =>
            w.week === workout.week &&
            w.kind === 'easy' &&
            (!usesDailyTaperPhase(p) ||
              trainingPhaseOn(p, plan.weeks[w.week].phase, w.date) ===
                'Race preparation') &&
            !w.hard &&
            !w.pairId &&
            w.minutes >= 20,
        )
        .sort(
          (a, b) => a.minutes - b.minutes || a.date.localeCompare(b.date),
        )[0];
      if (candidate?.id === workout.id)
        notes.push(
          'Optional headlamp practice: use 15–20 minutes of this existing easy run on a familiar, safe route near dusk, with company if possible. Test visibility and equipment; keep your normal sleep schedule.',
        );
    }
  }
  return notes;
}
