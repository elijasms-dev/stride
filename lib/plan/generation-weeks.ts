import {
  GENERATION_POLICY,
  SESSION_POLICY,
  DAYS_PER_WEEK,
  RUN_WALK_VARIANT_STRIDE,
} from './generation-constants.ts';
import { allocateGenerationWeek } from './generation-allocation.ts';

import { marathonPaceDose } from '../marathon-book.ts';

import { isLongUltra } from '../ultra-policy.ts';
import {
  usesMarathonRhythm,
  allocateRunningMinutes,
  recoveryRunCap,
} from '../training-structure.ts';

import { marathonLongRecipe, marathonWeekFocus } from '../marathon-model.ts';

import { distanceEstimate } from '../prescription.ts';

import {
  selectTemplate,
  scaleTemplate,
  WORKOUT_LIBRARY,
} from '../workout-library.ts';
import { recentTemplateIds, usesFiveDaySplit } from '../progression-engine.ts';
import { addDays, dayDiff, weekday, dateLabel } from './calendar.ts';
import { round } from './math.ts';
import { raceDistance, trainingFamily } from './profile.ts';
import { type Week, type Workout, type WorkoutKind } from './types.ts';
import {
  trainingPhaseOn,
  usesDailyTaperPhase,
  raceWeekSessionCap,
} from './generation-calendar.ts';
import { buildSteps, focus } from './generation-prescription.ts';
import { calculateWeekLoad } from './generation-load.ts';
import type { GenerationPolicy, ReplanContext } from './generation-policy.ts';

/** Build sessions in date order; each choice sees only the preceding generated history. */
export function generatePlanWeeks(
  context: GenerationPolicy,
  replan?: ReplanContext,
) {
  const {
    p,
    bookMarathon,
    start,
    count,
    recordedQuality,
    pace,
    isNovice,
    family,
    longPace,
    taperWeeks,
    initialLoad,
    qualityDays,
    mediumDay,
    preparationWeeks,
  } = context;
  const weeks: Week[] = [],
    workouts: Workout[] = [];
  let load = initialLoad;
  for (let w = 0; w < count; w++) {
    const weekLoad = calculateWeekLoad(context, w, load);
    load = weekLoad.load;
    const { remaining, maintenance, taper, taperAtWeekStart, recovery, phase } =
      weekLoad;
    const {
      dates,
      regularDates,
      longDate,
      allocation,
      weights,
      longDistance,
      desired,
      wholeWeekAllocation,
      activeReviewWeek,
      weekQualityDays,
      support,
      strideDay,
      mixedLong,
      previousSpecific,
    } = allocateGenerationWeek(context, weekLoad, w, workouts, weeks, replan);
    for (const date of dates) {
      const sessionPhase = trainingPhaseOn(p, phase, date);
      const isLong =
        p.days.length > SESSION_POLICY.easyOnlyMaximumRuns &&
        weekday(date) === p.longDay &&
        (p.goal === 'base' ||
          dayDiff(date, p.raceDate) >=
            (bookMarathon
              ? SESSION_POLICY.bookLongMinimumDaysBeforeRace
              : SESSION_POLICY.longMinimumDaysBeforeRace));
      const isQuality =
        !isNovice &&
        p.goal !== 'base' &&
        !recovery &&
        (!bookMarathon ||
          dayDiff(date, p.raceDate) >=
            SESSION_POLICY.qualityMinimumDaysBeforeRace) &&
        (remaining > 1 ||
          (remaining === 1 &&
            dayDiff(date, p.raceDate) >=
              SESSION_POLICY.qualityMinimumDaysBeforeRace)) &&
        weekQualityDays.includes(weekday(date)) &&
        (usesMarathonRhythm(p) ||
          phase !== 'Foundation' ||
          p.experience === 'established');
      const pairedQuality =
        p.method === 'double-threshold' &&
        p.doubleDays?.includes(weekday(date)) &&
        w >= SESSION_POLICY.pairedIntroductionWeeks &&
        ['Build', 'Race preparation'].includes(
          usesDailyTaperPhase(p) ? sessionPhase : phase,
        );
      const useMedium =
        mediumDay !== undefined &&
        !recovery &&
        !taper &&
        dates.length >= SESSION_POLICY.mediumLongMinimumRuns;
      const isMedium = useMedium && weekday(date) === mediumDay;
      const budget = isLong
        ? longDistance
        : (allocation.get(date) ?? GENERATION_POLICY.minimumSessionMinutes) /
          pace;
      const cap = isLong
        ? p.longMinutes
        : Math.min(
            p.weekdayMinutes,
            raceWeekSessionCap(p, date),
            (isQuality ? p.qualityLimitKm : p.easyLimitKm) != null
              ? (isQuality ? p.qualityLimitKm! : p.easyLimitKm!) *
                  pace *
                  (pairedQuality ? SESSION_POLICY.pairedSessionCount : 1)
              : Infinity,
          );
      let minutes = Math.max(
        GENERATION_POLICY.minimumSessionMinutes,
        isLong && family === 'marathon'
          ? Math.ceil(budget * longPace - 1e-9)
          : Math.floor(Math.min(budget * pace, cap)),
      );
      let kind: WorkoutKind = isLong ? 'long' : 'easy';
      const gentle = p.difficulty === 'gentle';
      let steps = buildSteps(
        kind,
        minutes,
        isNovice
          ? (p.runWalkStage ?? 0) * RUN_WALK_VARIANT_STRIDE
          : recovery
            ? Math.max(0, w - 1)
            : w,
        gentle,
        isNovice,
      );
      let hard = false,
        templateId: string | undefined,
        stimulus = 'aerobic',
        qualityMinutes = 0,
        targetWorkMinutes: number | undefined,
        selectionReason = '';
      let title = isNovice
        ? 'Run & walk'
        : isLong
          ? isLongUltra(p)
            ? 'Ultra time on feet'
            : 'Easy long run'
          : isMedium
            ? bookMarathon
              ? minutes / pace >= SESSION_POLICY.mediumLongLabelKm
                ? 'Medium-long endurance run'
                : 'Midweek endurance run'
              : p.marathonApproach === 'endurance'
                ? 'Medium-long aerobic run'
                : 'Aerobic endurance run'
            : usesFiveDaySplit(p) || (!isNovice && (weights.get(date) ?? 1) < 1)
              ? 'Recovery run'
              : bookMarathon
                ? 'General aerobic run'
                : 'Easy run';
      let purpose = isMedium
        ? bookMarathon
          ? 'Midweek endurance reinforces the long run. Keep a controlled conversational effort; ease back if the preceding workout has left you tired. Its distance comes from your existing weekly volume.'
          : 'A second aerobic endurance outing, funded by the week’s existing easy volume. Keep it fully conversational.'
        : isLong
          ? isLongUltra(p)
            ? 'Build easy time on feet on terrain like your runnable race course. Walk climbs before the effort rises, and rehearse familiar fueling and equipment.'
            : p.goal === '5k'
              ? 'Easy endurance supports your 5K preparation. Keep this conversational, without a fast finish; its length follows your recent running and the room in this week.'
              : 'Build endurance at a pace you could happily hold a conversation.'
          : usesFiveDaySplit(p) || (weights.get(date) ?? 1) < 1
            ? 'A shorter easy outing to recover between the week’s key sessions. Keep the effort relaxed.'
            : 'Comfortable running that builds your aerobic base and leaves room to recover.';
      if (
        isQuality &&
        minutes >= SESSION_POLICY.introductoryWorkoutMinutes &&
        (p.method !== 'double-threshold' || phase === 'Maintenance')
      ) {
        const decision = selectTemplate(
          { ...p, goal: trainingFamily(p) },
          sessionPhase,
          {
            previous: [...recordedQuality, ...workouts].filter(
              (w) =>
                (w.hard || w.stimulus === 'economy') &&
                (phase === 'Maintenance' || w.week >= count - preparationWeeks),
            ),
            availableMinutes: minutes,
            marathonModel: bookMarathon,
            week: w,
            slot: qualityDays.indexOf(weekday(date)),
            qualitySlots: weekQualityDays.length,
            excludeTemplateIds: recentTemplateIds(
              [...recordedQuality, ...workouts],
              w,
            ),
            introduction:
              // A late calendar entry does not establish tolerance for speed.
              (w === 0 && p.days.length > p.currentRuns) ||
              ((phase === 'Foundation' ||
                w < GENERATION_POLICY.foundationWeeks) &&
                (p.recentQualitySessions ?? 0) === 0) ||
              (qualityDays.indexOf(weekday(date)) > 0 &&
                (p.recentQualitySessions ?? 0) <
                  SESSION_POLICY.secondaryQualityEvidenceSessions &&
                [...recordedQuality, ...workouts].filter(
                  (s) =>
                    s.week < w &&
                    s.hard &&
                    s.kind !== 'long' &&
                    s.kind !== 'race' &&
                    s.status !== 'skipped',
                ).length < SESSION_POLICY.secondaryQualityEvidenceSessions),
          },
        );
        const template = decision.template;
        targetWorkMinutes = decision.targetWorkMinutes;
        selectionReason = decision.reason;
        const dose = scaleTemplate(
          template,
          minutes,
          gentle,
          sessionPhase,
          p.method === 'threshold-singles'
            ? Math.min(
                desired * pace * SESSION_POLICY.thresholdSinglesWorkFraction,
                p.recentQualityMinutes ?? 0,
              ) / Math.max(1, qualityDays.length)
            : (desired * pace * SESSION_POLICY.qualityWorkFraction) /
                Math.max(1, qualityDays.length),
          targetWorkMinutes,
          p,
        );
        if (dose) {
          kind = template.kind;
          steps = dose.steps;
          minutes = dose.minutes;
          hard = template.stimulus !== 'economy';
          title = template.title;
          purpose = template.purpose;
          templateId = template.id;
          stimulus = template.stimulus;
          qualityMinutes = dose.qualityMinutes;
        } else {
          targetWorkMinutes = 0;
          selectionReason =
            'Keep this run easy: the structured dose cannot fit the current time or work allowance. No faster work is prescribed.';
        }
      }
      if (
        !hard &&
        !pairedQuality &&
        !isLong &&
        p.easyLimitKm != null &&
        minutes / pace > p.easyLimitKm
      ) {
        minutes = Math.max(
          GENERATION_POLICY.minimumSessionMinutes,
          Math.floor(p.easyLimitKm * pace),
        );
        steps = buildSteps(
          'easy',
          minutes,
          isNovice ? (p.runWalkStage ?? 0) * RUN_WALK_VARIANT_STRIDE : w,
          gentle,
          isNovice,
        );
      }
      if (isLong && mixedLong) {
        const exposures = workouts.filter(
          (s) => s.kind === 'long' && s.stimulus === 'race-rhythm',
        ).length;
        const bookDose = bookMarathon
          ? marathonPaceDose(p, [...recordedQuality, ...workouts], minutes)
          : 0;
        let recipe = bookMarathon
          ? `marathon-book-mp-${Math.max(SESSION_POLICY.marathonPaceMinimumMinutes, bookDose)}`
          : marathonLongRecipe(exposures);
        if (
          recipe === 'marathon-long-finish' &&
          !previousSpecific.some((s) =>
            s.steps.some(
              (step) =>
                step.kind === 'work' &&
                step.seconds >=
                  SESSION_POLICY.continuousRaceEffortEvidenceSeconds,
            ),
          )
        )
          recipe = 'marathon-long-split';
        const template = WORKOUT_LIBRARY.find((t) => t.id === recipe)!;
        const target = bookMarathon
          ? bookDose
          : Math.min(
              SESSION_POLICY.independentMarathonPaceMaximumMinutes,
              SESSION_POLICY.marathonPaceMinimumMinutes +
                exposures * SESSION_POLICY.marathonPaceStepMinutes,
              previousSpecific.at(-1)?.qualityMinutes ??
                SESSION_POLICY.marathonPaceMinimumMinutes,
            );
        const dose = scaleTemplate(
          template,
          minutes,
          false,
          phase,
          desired *
            pace *
            (bookMarathon
              ? SESSION_POLICY.qualityWorkFraction
              : SESSION_POLICY.independentLongWorkFraction),
          target,
          p,
        );
        if (dose) {
          steps = dose.steps;
          hard = true;
          templateId = template.id;
          stimulus = template.stimulus;
          qualityMinutes = dose.qualityMinutes;
          targetWorkMinutes = target;
          title = template.title;
          purpose = template.purpose;
          selectionReason = bookMarathon
            ? 'The long run includes controlled marathon effort alongside the weekday tempo. Its faster segment shares the existing weekly work allowance.'
            : 'Marathon effort replaces one weekday quality session this week. Most of this long run stays easy; the aim is controlled race practice, not racing tired legs.';
        }
      }
      if (
        weekday(date) === strideDay &&
        !hard &&
        !isMedium &&
        !isLong &&
        minutes >= SESSION_POLICY.stridesMinimumSessionMinutes
      ) {
        const template = WORKOUT_LIBRARY.find(
          (t) => t.id === 'marathon-book-strides',
        )!;
        const dose = scaleTemplate(
          template,
          minutes,
          false,
          sessionPhase,
          SESSION_POLICY.stridesWorkCeilingMinutes,
          SESSION_POLICY.stridesWorkMinutes,
          p,
        );
        if (dose) {
          steps = dose.steps;
          minutes = dose.minutes;
          templateId = template.id;
          stimulus = 'economy';
          qualityMinutes = dose.qualityMinutes;
          targetWorkMinutes = SESSION_POLICY.stridesWorkMinutes;
          title = template.title;
          purpose = template.purpose;
          selectionReason =
            'Short, fully recovered strides support running form within an existing easy day. They are not another hard workout.';
        }
      }
      workouts.push({
        id: `${start}-${date}-${kind}`,
        date,
        originalDate: date,
        week: w,
        title,
        kind,
        minutes,
        estimatedKm:
          isLong && family === 'marathon'
            ? longDistance
            : round(minutes / pace, 3),
        hard,
        templateId,
        stimulus,
        qualityMinutes,
        targetWorkMinutes,
        distanceEstimate: distanceEstimate(steps, p),
        role: isLong
          ? 'long'
          : isMedium
            ? 'medium-long'
            : templateId
              ? stimulus
              : (weights.get(date) ?? 1) < 1
                ? 'recovery'
                : 'easy',
        purpose,
        reason: `${selectionReason} ${usesDailyTaperPhase(p) ? sessionPhase : phase} · ${isLong ? 'Independent long-run progression' : hard ? `${stimulus} session chosen for your ${p.goal.toUpperCase()} phase, within a separate quality-work budget` : 'Easy volume within your weekly and time limits'}. ${p.easyPace ? 'Distance estimated from your easy pace.' : 'Distance estimated at 7 min/km for scheduling only; this is not a pace target.'}`,
        steps,
        status: 'planned',
      });
    }
    const ordinary = workouts.filter(
      (s) => s.week === w && regularDates.includes(s.date),
    );
    const allocated = [...allocation.values()].reduce((n, m) => n + m, 0);
    const unused = taper
      ? 0
      : Math.max(0, allocated - ordinary.reduce((n, s) => n + s.minutes, 0));
    const donors = ordinary.filter((s) => !s.templateId && !s.hard);
    const extra = allocateRunningMinutes(
      unused + donors.length * GENERATION_POLICY.minimumSessionMinutes,
      donors.map((s) => ({
        key: s.id,
        weight: weights.get(s.date) ?? 1,
        cap:
          GENERATION_POLICY.minimumSessionMinutes +
          Math.max(
            0,
            Math.min(
              p.weekdayMinutes,
              !isNovice && longDate && weekday(s.date) !== support
                ? Math.floor(longDistance * pace)
                : Infinity,
              (weights.get(s.date) ?? 1) < 1 &&
                !['easy-doubles', 'double-threshold'].includes(p.method ?? '')
                ? recoveryRunCap(
                    p,
                    (activeReviewWeek ? wholeWeekAllocation : desired) * pace,
                  )
                : Infinity,
              raceWeekSessionCap(p, s.date),
              (p.easyLimitKm ?? Infinity) * pace,
            ) - s.minutes,
          ),
      })),
    );
    for (const run of donors) {
      const added =
        (extra.get(run.id) ?? GENERATION_POLICY.minimumSessionMinutes) -
        GENERATION_POLICY.minimumSessionMinutes;
      if (added <= 0) continue;
      run.minutes += added;
      run.steps = buildSteps(
        'easy',
        run.minutes,
        isNovice ? (p.runWalkStage ?? 0) * RUN_WALK_VARIANT_STRIDE : w,
        p.difficulty === 'gentle',
        isNovice,
      );
      run.estimatedKm = round(run.minutes / pace, 3);
      run.distanceEstimate = distanceEstimate(run.steps, p);
    }
    if (p.goal !== 'base' && remaining === 1) {
      const distance = raceDistance(p),
        minutes = Math.round(distance * pace);
      workouts.push({
        id: `${start}-race`,
        date: p.raceDate,
        originalDate: p.raceDate,
        week: w,
        title: p.raceName || `${round(distance, 4)} km race day`,
        kind: 'race',
        minutes,
        estimatedKm: distance,
        hard: true,
        purpose:
          'Start with patience, settle into your effort, and use what you have left at the finish.',
        reason:
          'Your race date anchors the taper. Race duration is an estimate, not a prediction.',
        steps: [
          {
            ...buildSteps('race', minutes, 0, false)[0],
            metres: Math.round(distance * 10000) / 10,
          },
        ],
        status: 'planned',
      });
    }
    const sessions = workouts.filter((s) => s.week === w);
    weeks.push({
      index: w,
      start: addDays(start, w * DAYS_PER_WEEK),
      phase,
      targetKm: round(sessions.reduce((sum, s) => sum + s.estimatedKm, 0)),
      longKm: round(
        Math.max(
          0,
          ...sessions
            .filter((s) => s.kind === 'long')
            .map((s) => s.estimatedKm),
        ),
      ),
      focus: maintenance
        ? `${focus[phase]} Maintenance block ${Math.floor(w / SESSION_POLICY.maintenanceReviewWeeks) + 1}; review on ${dateLabel(addDays(start, Math.min(count - preparationWeeks, (Math.floor(w / SESSION_POLICY.maintenanceReviewWeeks) + 1) * SESSION_POLICY.maintenanceReviewWeeks) * DAYS_PER_WEEK))}. No ongoing volume growth is forecast in this phase.`
        : family === 'marathon'
          ? marathonWeekFocus(phase, p)
          : family !== 'ultra' &&
              taper &&
              !taperAtWeekStart &&
              phase !== 'Race week'
            ? `${focus[phase]} Taper begins on ${dateLabel(addDays(p.raceDate, -taperWeeks * DAYS_PER_WEEK))}; earlier runs keep this week's training focus.`
            : focus[phase],
    });
  }
  return { weeks, workouts };
}
