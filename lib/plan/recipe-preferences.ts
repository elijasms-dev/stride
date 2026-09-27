import { schedulingEasyPace } from '../fitness-pacing.ts';
import { usesMarathonBook } from '../marathon-book.ts';
import { distanceEstimate, qualityWorkMinutes } from '../prescription.ts';
import { scaleTemplate, selectTemplate } from '../workout-library.ts';
import { withSpecificWorkoutName } from '../workout-names.ts';
import { withAllocatedWorkoutTargets as withWorkoutTargets } from '../workout-targets.ts';
import { trainingPhaseOn } from './generation-calendar.ts';
import { trainingFamily } from './profile.ts';
import { refreshWeekTotals } from './totals.ts';
import { type Plan, type Workout } from './types.ts';
import { refreshWorkoutVariety } from './variety.ts';

/** A recipe preference changes the shape of a saved work allowance, not the
 * runner's baseline or calendar. Reuse the normal selector/scaler with strict
 * bounds; a recipe that cannot fit keeps the existing executable session. */
export function refreshRecipePreferences(plan: Plan, asOf: string): Plan {
  const next = structuredClone(plan);
  const profile = { ...next.profile, goal: trainingFamily(next.profile) };
  if (next.returnState || (profile.method && profile.method !== 'balanced'))
    return next;
  const phase = (w: Workout) =>
    trainingPhaseOn(next.profile, next.weeks[w.week].phase, w.date);
  const protectedIds = new Set<string>();
  for (const taper of next.workouts.filter(
    (w) => w.week >= 0 && ['Taper', 'Race week'].includes(phase(w)),
  )) {
    if (!taper.templateId) continue;
    const anchor = next.workouts
      .filter(
        (w) =>
          w.date < taper.date &&
          w.status !== 'skipped' &&
          w.templateId === taper.templateId,
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (anchor) protectedIds.add(anchor.id);
  }
  const previous: Workout[] = [];
  for (const w of [...next.workouts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )) {
    if (
      w.week < 0 ||
      w.date < asOf ||
      w.status !== 'planned' ||
      !w.hard ||
      w.kind === 'long' ||
      w.kind === 'race' ||
      w.pairId ||
      w.returnRole ||
      protectedIds.has(w.id) ||
      (w.changed && w.changeSource !== 'preferences') ||
      ['Recovery', 'Taper', 'Race week'].includes(phase(w))
    ) {
      previous.push(w);
      continue;
    }
    const peers = next.workouts
      .filter(
        (item) =>
          item.week === w.week &&
          item.hard &&
          item.kind !== 'long' &&
          item.kind !== 'race',
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    const decision = selectTemplate(profile, phase(w), {
      previous: previous.filter(
        (item) => item.hard || item.stimulus === 'economy',
      ),
      availableMinutes: w.minutes,
      originalGoal: next.profile.goal,
      slot: peers.findIndex((item) => item.id === w.id),
      qualitySlots: peers.length,
      week: w.week,
      marathonModel: usesMarathonBook(next.profile),
    });
    const template = decision.template;
    const originalQuality = qualityWorkMinutes(w);
    const originalWork = w.steps.filter((s) => s.kind === 'work');
    const dose =
      template.stimulus === w.stimulus && template.id !== w.templateId
        ? scaleTemplate(
            template,
            w.minutes,
            profile.difficulty === 'gentle',
            phase(w),
            originalQuality,
            Math.min(originalQuality, decision.targetWorkMinutes),
            next.profile,
            undefined,
            { capBasis: 'prescribed' },
          )
        : null;
    const recoveries = w.steps.filter((s) => s.kind === 'recovery');
    const newRecoveries =
      dose?.steps.filter((s) => s.kind === 'recovery') ?? [];
    if (
      !dose ||
      dose.qualityMinutes < originalQuality * 0.75 ||
      dose.qualityMinutes > originalQuality + 1e-6 ||
      dose.steps.some(
        (s) =>
          s.kind === 'work' &&
          (s.intensity > Math.max(...originalWork.map((x) => x.intensity)) ||
            s.seconds > Math.max(...originalWork.map((x) => x.seconds))),
      ) ||
      newRecoveries.length < recoveries.length ||
      newRecoveries.some(
        (s) => s.seconds < Math.max(0, ...recoveries.map((x) => x.seconds)),
      ) ||
      (recoveries.some((s) => s.movement === 'walk') &&
        newRecoveries.some((s) => s.movement !== 'walk'))
    ) {
      previous.push(w);
      continue;
    }
    const spare =
      w.minutes * 60 - dose.steps.reduce((n, s) => n + s.seconds, 0);
    if (spare < -1e-6) {
      previous.push(w);
      continue;
    }
    if (spare > 1e-6) {
      const easy = dose.steps.find(
        (s) => s.kind === 'aerobic' && s.metres === undefined,
      );
      if (easy) easy.seconds += spare;
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
          : s.seconds / 60 / schedulingEasyPace(next.profile)),
      0,
    );
    if (template.workMetres && estimatedKm > w.estimatedKm + 0.01) {
      previous.push(w);
      continue;
    }
    const replacement = withWorkoutTargets(
      withSpecificWorkoutName({
        ...w,
        title: template.title,
        kind: template.kind,
        templateId: template.id,
        stimulus: template.stimulus,
        purpose: template.purpose,
        steps: dose.steps,
        qualityMinutes: dose.qualityMinutes,
        targetWorkMinutes: dose.qualityMinutes,
        varietyVersion: undefined,
        varietySourceTemplateId: undefined,
        changed: true,
        changeSource: 'preferences',
        reason:
          'Your workout preference changes this repetition pattern within its saved time and work allowance. Dates and allocated distances stay fixed.',
      }),
      next.profile,
    );
    // The target snapshot can change the estimate even when funded kilometres
    // stay fixed. Derive the display range from the final executable steps.
    replacement.distanceEstimate = distanceEstimate(
      replacement.steps,
      next.profile,
    );
    if (
      replacement.estimatedKm === w.estimatedKm &&
      replacement.minutes === w.minutes
    )
      Object.assign(w, replacement);
    previous.push(w);
  }
  refreshWeekTotals(next);
  return refreshWorkoutVariety(next, asOf);
}
