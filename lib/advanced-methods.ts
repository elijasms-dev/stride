import type { Profile, Workout, Step } from './engine';
export type TrainingMethod =
  | 'balanced'
  | 'threshold-singles'
  | 'easy-doubles'
  | 'double-threshold';
export function advancedEligibility(p: Profile): string[] {
  const method = p.method ?? 'balanced',
    errors: string[] = [];
  if (
    ![
      'balanced',
      'threshold-singles',
      'easy-doubles',
      'double-threshold',
    ].includes(method)
  )
    return ['Choose a supported training method.'];
  for (const [key, min, max] of [
    ['stableWeeks', 0, 520],
    ['easyDoubleWeeks', 0, 520],
    ['recentSessionsPerWeek', 0, 14],
    ['recentQualityMinutes', 0, 300],
  ] as const) {
    const value = p[key];
    if (
      value != null &&
      (!Number.isInteger(value) || value < min || value > max)
    )
      errors.push(`Check ${key}: use a whole number from ${min} to ${max}.`);
  }
  if (
    p.doubleGapHours != null &&
    (!Number.isFinite(p.doubleGapHours) || p.doubleGapHours % 0.5 !== 0)
  )
    errors.push('Use a recovery gap in half-hour increments.');
  if (p.thresholdCeiling !== undefined && !Number.isFinite(p.thresholdCeiling))
    errors.push('Enter a numeric, individually established threshold ceiling.');
  if (method === 'balanced') return errors;
  if (
    p.experience !== 'established' ||
    p.currentRuns < 5 ||
    p.weeklyKm < 40 ||
    (p.stableWeeks ?? 0) < 8
  )
    errors.push(
      'Advanced methods need an established five-day, 40 km routine maintained for at least eight weeks.',
    );
  if (
    method === 'threshold-singles' &&
    ((p.recentQualitySessions ?? 0) < 1 ||
      (p.recentQualityMinutes ?? 0) < 10 ||
      p.qualitySessions === 0 ||
      p.goal === 'base')
  )
    errors.push(
      'Threshold-focused training needs recent quality-session experience.',
    );
  if (method === 'easy-doubles' || method === 'double-threshold') {
    if (
      !Array.isArray(p.doubleDays) ||
      p.doubleDays.length !== 1 ||
      !p.doubleDays.every(
        (d) => p.days.includes(d) && d !== p.longDay && Number.isInteger(d),
      )
    )
      errors.push(
        'Choose one available day for the paired sessions, away from the long run.',
      );
    if ((p.doubleGapHours ?? 8) < 6 || (p.doubleGapHours ?? 8) > 12)
      errors.push(
        'Allow 6–12 hours of recovery after the morning session ends.',
      );
    if ((p.recentSessionsPerWeek ?? 0) < p.currentRuns)
      errors.push('Recent sessions must include all of your running days.');
  }
  if (method === 'double-threshold') {
    if (p.qualitySessions === 0)
      errors.push('A threshold pair requires quality training to be enabled.');
    if (
      Array.isArray(p.doubleDays) &&
      p.doubleDays.some(
        (d) =>
          Math.min(Math.abs(d - p.longDay), 7 - Math.abs(d - p.longDay)) < 2,
      )
    )
      errors.push(
        'Place the threshold pair at least two days from the long run.',
      );
    if (
      p.currentRuns < 6 ||
      p.days.length < 6 ||
      p.weeklyKm < 80 ||
      (p.stableWeeks ?? 0) < 12 ||
      (p.easyDoubleWeeks ?? 0) < 4 ||
      (p.recentSessionsPerWeek ?? 0) < 7 ||
      (p.recentQualitySessions ?? 0) < 2 ||
      (p.recentQualityMinutes ?? 0) < 40
    )
      errors.push(
        'Double threshold needs a recent six-day, 80 km routine, seven sessions, 12 stable weeks, four weeks with easy doubles, and at least two quality sessions totalling 40 work minutes weekly.',
      );
    if (!['heart-rate', 'lactate'].includes(p.thresholdControl ?? ''))
      errors.push(
        'Choose an individually established heart-rate or lactate ceiling for double threshold. Effort alone cannot reproduce lactate-guided training.',
      );
    if (
      p.thresholdControl === 'heart-rate' &&
      (!(p.thresholdCeiling! >= 100) || !(p.thresholdCeiling! <= 200))
    )
      errors.push(
        'Enter your individually established sub-threshold ceiling in beats per minute.',
      );
    if (
      p.thresholdControl === 'lactate' &&
      (!(p.thresholdCeiling! >= 1) || !(p.thresholdCeiling! <= 4))
    )
      errors.push(
        'Enter your individually established lactate ceiling in mmol/L (1–4). Do not use a population average.',
      );
    if (p.volume !== 'maintain')
      errors.push(
        'Hold weekly volume while introducing this paired threshold model.',
      );
    if (p.intent === 'finish')
      errors.push(
        'Choose performance intent for threshold modelling, or use easy doubles.',
      );
  }
  return errors;
}
const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
function thresholdSteps(
  minutes: number,
  workMinutes: number,
  p: Profile,
  pm: boolean,
): Step[] {
  const cue =
    p.thresholdControl === 'lactate'
      ? `Stay below your established ${p.thresholdCeiling} mmol/L ceiling; measure and shorten if needed.`
      : `Stay below your established ${p.thresholdCeiling} bpm ceiling; keep breathing controlled.`;
  const count = pm ? 6 : 3,
    work = Math.floor((workMinutes * 60) / count),
    rest = pm ? 60 : 90;
  const steps: Step[] = [
    {
      label: 'Easy warm-up',
      seconds: 600,
      intensity: 2,
      kind: 'warmup',
      effort: 'Unhurried, conversational running',
    },
  ];
  for (let i = 0; i < count; i++) {
    if (i)
      steps.push({
        label: 'Easy recovery',
        seconds: rest,
        intensity: 2,
        kind: 'recovery',
        effort: 'Easy jog; stay relaxed',
      });
    steps.push({
      label: `Controlled rep ${i + 1} of ${count}`,
      seconds: work,
      intensity: 5,
      kind: 'work',
      effort: cue,
    });
  }
  const remaining = minutes * 60 - steps.reduce((n, s) => n + s.seconds, 0);
  if (remaining < 300) return [];
  if (remaining > 300)
    steps.splice(1, 0, {
      label: 'Aerobic running before threshold work',
      seconds: Math.min(1500, remaining - 300),
      intensity: 3,
      kind: 'aerobic',
      effort: 'Conversational running before the controlled set',
      movement: 'run',
    });
  steps.push({
    label: 'Easy cool-down',
    seconds: 300,
    intensity: 2,
    kind: 'cooldown',
    effort: 'Finish with energy left; do not chase pace',
  });
  return steps;
}
export function applyAdvancedMethod(
  workouts: Workout[],
  p: Profile,
  phases: string[],
  phaseOn?: (workout: Workout) => string,
): Workout[] {
  const method = p.method ?? 'balanced';
  if (method !== 'easy-doubles' && method !== 'double-threshold')
    return workouts;
  const result: Workout[] = [];
  for (const w of workouts) {
    const day = (new Date(w.date + 'T12:00:00Z').getUTCDay() + 6) % 7;
    const eligible =
      p.doubleDays?.includes(day) &&
      w.week >= 2 &&
      ['Build', 'Race preparation'].includes(phaseOn?.(w) ?? phases[w.week]) &&
      w.kind !== 'long' &&
      w.kind !== 'race';
    if (!eligible) {
      result.push(w);
      continue;
    }
    if (method === 'easy-doubles' && (w.hard || w.minutes < 50)) {
      result.push(w);
      continue;
    }
    const pmMinutes =
      method === 'easy-doubles'
        ? Math.min(30, Math.floor(w.minutes * 0.4))
        : Math.floor(w.minutes / 2);
    const amMinutes = w.minutes - pmMinutes;
    const pairId = `pair:${w.id}`;
    if (method === 'double-threshold' && Math.min(amMinutes, pmMinutes) < 32) {
      result.push({
        ...w,
        kind: 'easy',
        hard: false,
        title: 'Easy run',
        templateId: undefined,
        stimulus: 'aerobic',
        qualityMinutes: 0,
        steps: [
          {
            label: 'Easy run',
            seconds: w.minutes * 60,
            effort: 'Conversational · 2–3 / 10',
            intensity: 3,
            kind: 'work',
          },
        ],
      });
      continue;
    }
    const totalWeekMinutes = workouts
      .filter((x) => x.week === w.week && x.kind !== 'race')
      .reduce((n, x) => n + x.minutes, 0);
    const perSessionWork = Math.min(
      p.difficulty === 'gentle' || p.thresholdControl === 'heart-rate'
        ? 12
        : 16,
      (p.recentQualityMinutes ?? 40) / 2,
      (totalWeekMinutes * 0.18) / 2,
      amMinutes - 18,
      pmMinutes - 20,
    );
    for (const [i, minutes] of [amMinutes, pmMinutes].entries()) {
      const steps =
        method === 'easy-doubles'
          ? [
              {
                label: 'Easy run',
                seconds: minutes * 60,
                effort: 'Conversational · 2–3 / 10',
                intensity: 3,
                kind: 'work' as const,
              },
            ]
          : thresholdSteps(minutes, Math.floor(perSessionWork), p, i === 1);
      if (!steps.length)
        throw new Error(
          'The paired threshold sessions do not fit the daily time budget.',
        );
      const actualMinutes = steps.reduce((n, s) => n + s.seconds, 0) / 60;
      result.push({
        ...w,
        id: i === 0 ? w.id : `${w.id}:pm`,
        session: i === 0 ? 'AM' : 'PM',
        pairId,
        pairType: method,
        startTime: time(
          i === 0 ? 420 : 420 + amMinutes + (p.doubleGapHours ?? 8) * 60,
        ),
        minutes: actualMinutes,
        estimatedKm:
          Math.round(((w.estimatedKm * actualMinutes) / w.minutes) * 1000) /
          1000,
        kind: method === 'easy-doubles' ? 'easy' : 'tempo',
        hard: method === 'double-threshold',
        title:
          method === 'easy-doubles'
            ? `${i === 0 ? 'Morning' : 'Evening'} easy run`
            : `${i === 0 ? 'Morning' : 'Evening'} controlled threshold`,
        templateId: method,
        stimulus: method === 'easy-doubles' ? 'aerobic' : 'threshold',
        qualityMinutes:
          method === 'easy-doubles'
            ? 0
            : steps
                .filter((s) => s.kind === 'work')
                .reduce((n, s) => n + s.seconds / 60, 0),
        steps,
        purpose:
          method === 'easy-doubles'
            ? 'Split existing easy volume across two relaxed runs. This adds no mileage.'
            : 'A controlled, individually monitored paired day. Stop the quality work if the ceiling or recovery cannot be maintained.',
        reason: `${w.reason} Paired day: ${amMinutes}+${pmMinutes} minutes, with at least ${p.doubleGapHours ?? 8} hours after the morning run. Both sessions remain within the original daily budget; no extra mileage is added.`,
      });
    }
  }
  return result;
}
