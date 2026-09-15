import { validStepTarget } from './workout-targets.ts';
import { MAX_RECORDED_MINUTES } from './ultra-policy.ts';
import { validWorkoutEnjoyment } from './workout-enjoyment.ts';
import { validateRun } from './run-input.ts';
import { type ExtraRun } from './plan/types.ts';
import { distanceEstimate, qualityWorkMinutes } from './prescription.ts';
import {
  validDate,
  monday,
  addDays,
  dayDiff,
  todayInZone,
} from './plan/calendar.ts';
import { validateProfile } from './plan/profile.ts';
import { validatePlan } from './plan/validate.ts';
import { refreshWeekTotals } from './plan/totals.ts';
import { type Plan } from './plan/types.ts';
import { PlanError } from './plan/errors.ts';
export type RecoveryProfile = {
  display_name: string;
  city: string;
  units: 'km' | 'mi';
  timezone: string;
  accent: 'evergreen' | 'slate' | 'clay';
};
export type RecoveryFile = {
  format: 'stride-recovery-2';
  exportedAt: string;
  profile: RecoveryProfile | null;
  plan: Plan | null;
  standaloneRuns?: ExtraRun[];
};
const fail = (message: string): never => {
  throw new PlanError('This recovery file cannot be restored: ' + message);
};
function object(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(label + ' must be an object.');
}
function text(
  value: unknown,
  max: number,
  label: string,
  empty = true,
): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value))
    fail('check ' + label + '.');
}
function number(value: unknown, min: number, max: number, label: string) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail('check ' + label + '.');
}
function date(value: unknown, label: string): asserts value is string {
  if (!validDate(value)) fail('check ' + label + '.');
}
function tree(value: unknown, depth = 0) {
  if (depth > 16) fail('the file is nested too deeply.');
  if (value && typeof value === 'object')
    for (const [key, v] of Object.entries(value)) {
      if (
        [
          '__proto__',
          'constructor',
          'prototype',
          'encrypted_key',
          'access_token',
          'refresh_token',
        ].includes(key)
      )
        fail('it contains unsupported private or reserved fields.');
      tree(v, depth + 1);
    }
}
function feedback(raw: unknown, today: string) {
  object(raw, 'Run feedback');
  number(raw.actualMinutes, 1, MAX_RECORDED_MINUTES, 'recorded time');
  if (raw.actualKm !== null)
    number(raw.actualKm, 0.001, 250, 'recorded distance');
  number(raw.effort, 1, 10, 'effort');
  if (
    !Number.isInteger(raw.effort) ||
    !['good', 'okay', 'tired'].includes(String(raw.feeling))
  )
    fail('check run feedback.');
  if (raw.enjoyment !== undefined && !validWorkoutEnjoyment(raw.enjoyment))
    fail('check workout enjoyment feedback.');
  text(raw.note, 2000, 'run note');
  text(raw.recordedAt, 40, 'recorded time');
  if (!Number.isFinite(Date.parse(raw.recordedAt)))
    fail('check recorded timestamp.');
  if (raw.actualDate !== undefined) {
    date(raw.actualDate, 'actual date');
    if (raw.actualDate > today) fail('a recorded run is in the future.');
  }
  if (
    raw.execution !== undefined &&
    (typeof raw.execution !== 'string' ||
      ![
        'as-planned',
        'partial',
        'easy-substitute',
        'not-attempted',
        'unknown',
      ].includes(raw.execution))
  )
    fail('check execution feedback.');
  if (raw.completedQualityMinutes !== undefined)
    number(
      raw.completedQualityMinutes,
      0,
      Number(raw.actualMinutes),
      'quality minutes',
    );
  if (
    raw.executionSource !== undefined &&
    raw.executionSource !== 'self-report'
  )
    fail('unsupported execution source.');
  if (raw.activityId !== undefined)
    text(raw.activityId, 150, 'activity identity', false);
}
export function validateRecovery(input: unknown): RecoveryFile {
  tree(input);
  object(input, 'Recovery file');
  // Explicit adapter for previous exports: history remains in the original file;
  // the current plan already contains completed and extra running.
  if (!['stride-recovery-2', 'stride-journal-1'].includes(String(input.format)))
    fail('this format is not supported.');
  if (
    input.format === 'stride-recovery-2' &&
    (!Object.hasOwn(input, 'plan') || !Object.hasOwn(input, 'profile'))
  )
    fail(
      'the plan and profile keys must be explicitly present, even when empty.',
    );
  const value = structuredClone({
    format: 'stride-recovery-2',
    exportedAt: input.exportedAt,
    profile: input.profile ?? null,
    plan: input.plan ?? null,
    standaloneRuns: input.standaloneRuns ?? [],
  }) as RecoveryFile;
  text(value.exportedAt, 40, 'export timestamp');
  if (!Number.isFinite(Date.parse(value.exportedAt)))
    fail('check the export timestamp.');
  if (value.profile !== null) {
    object(value.profile, 'Profile');
    text(value.profile.display_name, 60, 'profile name');
    text(value.profile.city, 80, 'city');
    if (
      !['km', 'mi'].includes(value.profile.units) ||
      !['evergreen', 'slate', 'clay'].includes(value.profile.accent)
    )
      fail('check profile preferences.');
    text(value.profile.timezone, 80, 'timezone');
    try {
      new Intl.DateTimeFormat('en', {
        timeZone: value.profile.timezone,
      }).format();
    } catch {
      fail('unknown timezone.');
    }
  }
  if (
    !Array.isArray(value.standaloneRuns) ||
    value.standaloneRuns.length > 4000
  )
    fail('too many standalone runs.');
  const seenRuns = new Set<string>();
  const seenActivities = new Set<string>();
  for (const raw of value.standaloneRuns ?? []) {
    const r = validateRun(raw, todayInZone(value.profile?.timezone || 'UTC'));
    text(r.id, 200, 'run identity', false);
    text(r.recordedAt, 40, 'recorded timestamp', false);
    if (!Number.isFinite(Date.parse(r.recordedAt)) || seenRuns.has(r.id))
      fail('invalid or duplicate standalone run.');
    seenRuns.add(r.id);
    if (r.activityId) {
      if (seenActivities.has(r.activityId))
        fail('duplicate provider activity.');
      seenActivities.add(r.activityId);
    }
    Object.assign(raw, r);
  }
  for (const r of value.standaloneRuns ?? []) {
    if (r.corrections !== undefined) {
      if (!Array.isArray(r.corrections) || r.corrections.length > 20)
        fail('check the correction history.');
      for (const c of r.corrections) {
        object(c, 'Correction');
        text(c.at, 40, 'correction timestamp', false);
        if (!Number.isFinite(Date.parse(c.at))) fail('check correction time.');
        text(c.reason, 200, 'correction reason', false);
        validateRun(
          { ...c, id: r.id },
          todayInZone(value.profile?.timezone || 'UTC'),
        );
      }
    }
  }
  if (value.plan && value.standaloneRuns?.length)
    fail('standalone running must be part of the active plan journal.');
  if (
    new TextEncoder().encode(JSON.stringify(value.standaloneRuns)).byteLength >
    500000
  )
    fail('standalone running exceeds the recoverable size budget.');
  if (value.plan === null) return value;
  const p = value.plan;
  object(p, 'Plan');
  object(p.profile, 'Runner inputs');
  try {
    p.profile = validateProfile(
      p.profile,
      p.profile.startDate,
      /^stride-0\.[123]\./.test(p.engineVersion),
    );
  } catch (e) {
    fail(e instanceof Error ? e.message : 'check runner inputs.');
  }
  const today = todayInZone(p.profile.timezone);
  text(p.id, 200, 'plan identity', false);
  text(p.engineVersion, 80, 'engine version');
  text(p.policyVersion, 100, 'policy version');
  text(p.createdAt, 40, 'creation date');
  if (!/^stride-0\.(?:[1-9]|10)\.\d+$/.test(p.engineVersion))
    fail('this training engine version needs a newer recovery reader.');
  if (
    !Array.isArray(p.weeks) ||
    p.weeks.length < 1 ||
    p.weeks.length > 53 ||
    !Array.isArray(p.workouts) ||
    p.workouts.length > 4000 ||
    !Array.isArray(p.notes) ||
    p.notes.length > 100
  )
    fail('the plan is missing its schedule or exceeds recovery limits.');
  p.notes.forEach((n) => text(n, 4000, 'plan note'));
  p.weeks.forEach((w, i) => {
    object(w, 'Week');
    if (w.index !== i) fail('week indexes do not match the schedule.');
    date(w.start, 'week date');
    if (w.start !== addDays(monday(p.profile.startDate), i * 7))
      fail('week dates do not match this block.');
    if (
      ![
        'Foundation',
        'Maintenance',
        'Build',
        'Race preparation',
        'Recovery',
        'Taper',
        'Race week',
      ].includes(w.phase)
    )
      fail('unknown training phase.');
    text(w.phase, 40, 'phase');
    number(w.targetKm, 0, 500, 'weekly distance');
    text(w.focus, 500, 'week purpose');
  });
  const ids = new Set<string>(),
    activityIds = new Set<string>();
  function unique(id: string, set: Set<string>, label: string) {
    if (set.has(id)) fail('duplicate ' + label + '.');
    set.add(id);
  }
  for (const w of p.workouts) {
    object(w, 'Workout');
    text(w.id, 250, 'workout identity', false);
    unique(w.id, ids, 'workout identity');
    date(w.date, 'workout date');
    date(w.originalDate, 'original workout date');
    number(w.week, -1, 52, 'workout week');
    if (!Number.isInteger(w.week) || w.week >= p.weeks.length)
      fail('invalid workout week.');
    if (
      !['easy', 'long', 'intervals', 'tempo', 'fartlek', 'race'].includes(
        w.kind,
      ) ||
      !['planned', 'completed', 'skipped'].includes(w.status) ||
      typeof w.hard !== 'boolean'
    )
      fail('check workout type/status.');
    if (
      w.week === -1 &&
      w.status !== 'completed' &&
      w.date >= p.profile.startDate
    )
      fail('uncompleted archived workouts must precede this block.');
    if (
      w.week >= 0 &&
      Math.floor(dayDiff(monday(p.profile.startDate), w.date) / 7) !== w.week
    )
      fail('workout dates do not match their weeks.');
    if (
      w.pairId !== undefined ||
      w.session !== undefined ||
      w.startTime !== undefined ||
      w.pairType !== undefined
    ) {
      text(w.pairId, 200, 'paired day identity', false);
      if (
        !['AM', 'PM'].includes(w.session ?? '') ||
        !['easy-doubles', 'double-threshold'].includes(w.pairType ?? '') ||
        typeof w.startTime !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.startTime)
      )
        fail('check paired session identity and time.');
    }
    if (w.returnCeilingMinutes !== undefined)
      number(w.returnCeilingMinutes, 1, 1500, 'stored return ceiling');
    if (w.returnStage !== undefined || w.returnStageStarted !== undefined) {
      if (
        ![1, 2].includes(w.returnStage ?? 0) ||
        !validDate(w.returnStageStarted ?? '')
      )
        fail('invalid stored return stage.');
    }
    if (
      w.returnRole !== undefined &&
      !['easy', 'long', 'intervals', 'tempo', 'fartlek', 'race'].includes(
        w.returnRole,
      )
    )
      fail('unknown stored return role.');
    for (const key of ['templateId', 'role', 'stimulus'] as const)
      if (w[key] !== undefined) text(w[key], 100, key);
    if (w.changed !== undefined && typeof w.changed !== 'boolean')
      fail('invalid change marker.');
    if (w.qualityMinutes !== undefined)
      number(w.qualityMinutes, 0, 1500, 'quality work');
    if (w.targetWorkMinutes !== undefined)
      number(w.targetWorkMinutes, 0, 1500, 'target work');
    if (w.eventDistanceKm !== undefined)
      number(w.eventDistanceKm, 5, 30, 'workout event distance');
    number(
      w.minutes,
      0.1,
      w.kind === 'race' ? MAX_RECORDED_MINUTES : 1500,
      'prescribed duration',
    );
    number(w.estimatedKm, 0, 250, 'planning distance');
    text(w.title, 180, 'workout name');
    text(w.purpose, 4000, 'workout purpose');
    text(w.reason, 4000, 'workout explanation');
    if (!Array.isArray(w.steps) || w.steps.length < 1 || w.steps.length > 1000)
      fail('check workout steps.');
    for (const s of w.steps) {
      object(s, 'Workout step');
      text(s.label, 250, 'step label');
      text(s.effort, 500, 'effort cue');
      if (s.target !== undefined && !validStepTarget(s.target))
        fail('invalid workout target range.');
      number(
        s.seconds,
        0.1,
        w.kind === 'race' ? MAX_RECORDED_MINUTES * 60 : 90000,
        'step duration',
      );
      number(s.intensity, 0, 10, 'step effort');
      if (
        !['warmup', 'aerobic', 'work', 'recovery', 'cooldown'].includes(s.kind)
      )
        fail('unknown step type.');
      if (s.metres !== undefined)
        number(s.metres, 0.1, 250000, 'step distance');
      if (s.planningPaceSecondsPerKm !== undefined) {
        number(s.planningPaceSecondsPerKm, 120, 1200, 'distance planning pace');
        if (
          s.metres === undefined ||
          (s.metres * s.planningPaceSecondsPerKm) / 1000 > s.seconds + 1
        )
          fail('distance steps exceed their time allowance.');
      }
      if (s.movement !== undefined && !['run', 'walk'].includes(s.movement))
        fail('unknown movement type.');
    }
    if (
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) > 1
    )
      fail('workout steps do not match its total duration.');
    if (w.status === 'completed') {
      feedback(w.feedback, today);
      if ((w.feedback!.actualDate ?? w.date) > today)
        fail('a completed run is in the future.');
    } else if (w.feedback)
      fail('an uncompleted workout has recorded feedback.');
    if (w.feedback?.activityId)
      unique(w.feedback.activityId, activityIds, 'external activity');
    if (w.skipReason !== undefined) text(w.skipReason, 200, 'skip reason');
    w.distanceEstimate = distanceEstimate(w.steps, p.profile);
    w.qualityMinutes = qualityWorkMinutes(w);
  }
  if (p.extraRuns !== undefined) {
    if (!Array.isArray(p.extraRuns) || p.extraRuns.length > 4000)
      fail('too many extra runs.');
    for (const r of p.extraRuns) {
      object(r, 'Extra run');
      text(r.id, 250, 'extra run identity', false);
      unique(r.id, ids, 'run identity');
      date(r.date, 'extra run date');
      feedback(
        {
          actualDate: r.date,
          actualMinutes: r.minutes,
          actualKm: r.km,
          effort: r.effort,
          feeling: r.feeling,
          note: r.note,
          recordedAt: r.recordedAt,
          activityId: r.activityId,
        },
        today,
      );
      if (r.activityId) unique(r.activityId, activityIds, 'external activity');
    }
  }
  if (p.feasibility !== undefined) {
    object(p.feasibility, 'Feasibility');
    if (
      !['forecast', 'review-required', 'event-deferred'].includes(
        p.feasibility.status,
      ) ||
      !Array.isArray(p.feasibility.reasons) ||
      p.feasibility.reasons.length > 30
    )
      fail('check event feasibility.');
    p.feasibility.reasons.forEach((r) => text(r, 4000, 'feasibility reason'));
    date(p.feasibility.asOf, 'feasibility reference date');
  }
  if (p.baselineEvidence !== undefined) {
    const e = p.baselineEvidence;
    object(e, 'Baseline evidence');
    date(e.from, 'baseline start');
    date(e.asOf, 'baseline reference');
    number(e.coverage, 0, 100, 'history coverage');
    number(e.known, 0, 4000, 'known sessions');
    number(e.due, 0, 4000, 'due sessions');
    number(e.weeklyKm, 0, 200, 'baseline distance');
    number(e.weeklyMinutes, 0, 3000, 'baseline duration');
    number(e.longestKm, 0, 80, 'baseline long run');
    if (e.longestMinutes !== undefined)
      number(e.longestMinutes, 0, 1500, 'baseline long-run duration');
    if (
      e.supportsProgression !== undefined &&
      typeof e.supportsProgression !== 'boolean'
    )
      fail('invalid baseline progression evidence.');
    text(e.explanation, 4000, 'baseline explanation');
    if (!['declared-baseline', 'recorded-plan-history'].includes(e.source))
      fail('unknown baseline source.');
  }
  if (p.returnState !== undefined) {
    const r = p.returnState;
    object(r, 'Return stage');
    date(r.from, 'return break start');
    date(r.to, 'return break end');
    date(r.stageStarted, 'return stage start');
    if (r.to < r.from || ![1, 2, 3].includes(r.stage))
      fail('invalid return stage.');
    number(r.baselineKm, 0, 200, 'return baseline');
    number(r.longestKm, 0, 80, 'return long run');
    if (r.baselineMinutes !== undefined)
      number(r.baselineMinutes, 0, 3000, 'return baseline duration');
    if (r.longestMinutes !== undefined)
      number(r.longestMinutes, 0, 1500, 'return long-run duration');
    text(r.reason, 4000, 'return reason');
  }
  if (p.constraintsFrom !== undefined)
    date(p.constraintsFrom, 'constraint date');
  p.constraintsFrom = today;
  refreshWeekTotals(p);
  const issues = validatePlan(p);
  if (issues.length) fail(issues[0]);
  return value;
}
export function prepareRestoredPlan(plan: Plan | null): Plan | null {
  if (!plan) return null;
  const p = structuredClone(plan),
    id = crypto.randomUUID(),
    pairs = new Map<string, string>();
  p.id = id;
  for (const w of p.workouts) {
    w.id = `${id}:${crypto.randomUUID()}`;
    if (w.pairId) {
      if (!pairs.has(w.pairId)) pairs.set(w.pairId, crypto.randomUUID());
      w.pairId = pairs.get(w.pairId);
    }
    if (w.feedback)
      w.feedback.source = 'Recovered journal · unverified provider link';
  }
  for (const r of p.extraRuns ?? []) {
    r.id = crypto.randomUUID();
    r.source = 'Recovered journal · unverified provider link';
  }
  const restoreNote =
    'Restored from a recovery copy. Provider connections and delivery confirmations must be reviewed separately.';
  if (!p.notes.includes(restoreNote) && p.notes.length < 100)
    p.notes.push(restoreNote);
  return p;
}
export function recoveryCounts(plan: Plan | null) {
  return {
    planned: plan?.workouts.filter((w) => w.status === 'planned').length ?? 0,
    completed:
      plan?.workouts.filter((w) => w.status === 'completed').length ?? 0,
    extraRuns: plan?.extraRuns?.length ?? 0,
  };
}
