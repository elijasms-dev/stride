import type { Plan, Profile, Step } from './plan/types.ts';
import { validDate } from './plan/calendar.ts';
import { comparePlanPreferences } from './plan-preferences-summary.ts';
import {
  workoutComparisonRows,
  type WorkoutComparisonRow,
} from './plan-change-summary.ts';
import { targetLabel } from './workout-targets.ts';
import { runDuration } from './journal-view.ts';

export type RevisionMetadata = {
  version: number;
  label: string;
  created_at: string;
};
export type RevisionSessionChange = {
  id: string;
  date: string;
  title: string;
  kind: 'Added' | 'Removed' | 'Moved' | 'Updated';
  rows: WorkoutComparisonRow[];
};
export type RevisionReview = {
  revision: RevisionMetadata;
  previousVersion: number | null;
  boundary: 'first' | 'recovery' | 'new-block' | 'empty' | null;
  explanation: string;
  versions: {
    before: { engine: string; policy: string } | null;
    after: { engine: string; policy: string } | null;
  };
  preferences: WorkoutComparisonRow[];
  sessions: RevisionSessionChange[];
  totalSessions: number;
  nextOffset: number | null;
  recordedChanges: number;
};

/** Correction reasons are free text; they stay in the private journal itself. */
export function revisionLabel(label: string) {
  if (label.startsWith('Corrected a run log:')) return 'Corrected a run log';
  if (label.startsWith('Corrected an extra run:'))
    return 'Corrected an extra run';
  return label.slice(0, 240);
}

/** Read legacy saved snapshots without running today's engine or changing them. */
export function parseRevisionPlan(raw: string): Plan | null {
  const plan = JSON.parse(raw) as Plan | null;
  if (plan === null) return null;
  if (
    !plan ||
    typeof plan !== 'object' ||
    !plan.profile ||
    !Array.isArray(plan.profile.days) ||
    !Array.isArray(plan.workouts) ||
    typeof plan.id !== 'string' ||
    !['km', 'mi'].includes(plan.profile.units) ||
    plan.workouts.some(
      (w) =>
        !w ||
        typeof w.id !== 'string' ||
        !validDate(w.date) ||
        typeof w.title !== 'string' ||
        !Number.isFinite(w.minutes) ||
        !Number.isFinite(w.estimatedKm) ||
        !Array.isArray(w.steps) ||
        w.steps.some(
          (s) =>
            !s ||
            typeof s.label !== 'string' ||
            typeof s.effort !== 'string' ||
            !Number.isFinite(s.seconds),
        ),
    )
  )
    throw new Error('Unreadable saved revision');
  return plan;
}

const detailFields: [keyof Profile, string][] = [
  ['goal', 'Training goal'],
  ['raceDistanceKm', 'Event distance (km)'],
  ['raceDate', 'Event date'],
  ['startDate', 'Start date'],
  ['weeklyKm', 'Starting weekly distance (km)'],
  ['longestKm', 'Starting long run (km)'],
  ['currentRuns', 'Recent runs per week'],
  ['experience', 'Running experience'],
  ['difficulty', 'Training difficulty'],
  ['volume', 'Volume progression'],
  ['easyPace', 'Easy pace (minutes/km)'],
  ['runWalkStage', 'Run/walk stage'],
  ['recoveryWeeks', 'Recovery week interval'],
  ['terrain', 'Training terrain'],
  ['raceTerrain', 'Event terrain'],
  ['easyLimitKm', 'Easy-run limit (km)'],
  ['qualityLimitKm', 'Workout limit (km)'],
  ['longLimitKm', 'Long-run limit (km)'],
  ['peakWeeklyKm', 'Peak weekly limit (km)'],
  ['intent', 'Training intent'],
  ['recentQualitySessions', 'Recent workouts per week'],
  ['marathonApproach', 'Marathon approach'],
  ['method', 'Training method'],
  ['stableWeeks', 'Stable training weeks'],
  ['ultraWeeklyMinutes', 'Starting weekly time (minutes)'],
  ['ultraLongestMinutes', 'Starting long-run time (minutes)'],
  ['easyDoubleWeeks', 'Weeks of easy doubles'],
  ['recentSessionsPerWeek', 'Recent sessions per week'],
  ['recentQualityMinutes', 'Recent quality time (minutes)'],
  ['doubleDays', 'Double-session days'],
  ['doubleGapHours', 'Double-session gap (hours)'],
  ['thresholdControl', 'Threshold control'],
  ['thresholdCeiling', 'Threshold ceiling'],
  ['preferredHardDays', 'Preferred workout days'],
  ['availableDays', 'Available days'],
  ['carbsPerHour', 'Practised carbohydrate intake (g/hour)'],
  ['practiceInDark', 'Headlamp practice'],
  ['workoutFormat', 'Workout format'],
  ['workoutVariety', 'Workout variety'],
  ['runMeasure', 'Run target measure'],
  ['units', 'Display units'],
  ['timezone', 'Training timezone'],
];
const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const choiceLabels: Record<string, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half marathon',
  marathon: 'Marathon',
  ultra: 'Ultra',
  custom: 'Custom distance',
  base: 'Base building',
  returning: 'Returning to running',
  established: 'Established runner',
  new: 'New runner',
  gentle: 'Gentle',
  balanced: 'Balanced',
  maintain: 'Maintain current volume',
  gradual: 'Gradual build',
  flat: 'Flat',
  hills: 'Hills',
  road: 'Road',
  rolling: 'Rolling',
  mountain: 'Mountain',
  finish: 'Finish the event',
  improve: 'Improve performance',
  endurance: 'Endurance',
  'threshold-singles': 'Threshold singles',
  'easy-doubles': 'Easy doubles',
  'double-threshold': 'Double threshold',
  effort: 'By effort',
  'heart-rate': 'Heart rate',
  lactate: 'Lactate',
  automatic: 'Automatic',
  time: 'Time',
  distance: 'Distance',
  varied: 'Varied',
  familiar: 'Familiar',
  km: 'Kilometres',
  mi: 'Miles',
  race: 'Race result',
  'time-trial': 'Time trial',
  trail: 'Trail',
  track: 'Track',
  treadmill: 'Treadmill',
};
const value = (v: unknown): string =>
  v == null
    ? 'Not set'
    : typeof v === 'boolean'
      ? v
        ? 'On'
        : 'Off'
      : Array.isArray(v)
        ? v.map(value).join(', ') || 'None'
        : typeof v === 'string'
          ? Object.hasOwn(choiceLabels, v)
            ? choiceLabels[v]
            : v
          : typeof v === 'number'
            ? String(v)
            : 'Not set';
function preferenceValue(p: Profile, key: keyof Profile) {
  if (['availableDays', 'doubleDays', 'preferredHardDays'].includes(key)) {
    const days = p[key];
    return Array.isArray(days)
      ? [...(days as number[])]
          .sort((a, b) => a - b)
          .map((day) => weekdayNames[day] ?? 'Unknown day')
          .join(', ') || 'None'
      : 'Not set';
  }
  return value(p[key]);
}
function row(
  label: string,
  before: string,
  after: string,
): WorkoutComparisonRow {
  return { label, before, after, changed: before !== after };
}
function preferences(before: Profile, after: Profile) {
  const rows = comparePlanPreferences(before, after);
  rows.push(
    ...detailFields.map(([key, label]) =>
      row(label, preferenceValue(before, key), preferenceValue(after, key)),
    ),
  );
  for (const [key, label] of [
    ['distanceKm', 'Benchmark distance (km)'],
    ['timeMinutes', 'Benchmark time (minutes)'],
    ['date', 'Benchmark date'],
    ['source', 'Benchmark source'],
    ['course', 'Benchmark course'],
  ] as const)
    rows.push(
      row(
        label,
        value(before.recentRace?.[key]),
        value(after.recentRace?.[key]),
      ),
    );
  for (const band of [
    'easy',
    'steady',
    'tempo',
    'threshold',
    'interval',
    'repetition',
    'race',
  ] as const) {
    for (const mode of ['pace', 'heartRate'] as const) {
      const range = (p: Profile) => {
        const saved = p.workoutTargets?.[mode]?.[band];
        return saved
          ? targetLabel(
              { ...saved, mode: mode === 'pace' ? 'pace' : 'heart-rate' },
              after.units,
            )
          : 'By effort';
      };
      rows.push(
        row(
          `${band} ${mode === 'pace' ? 'pace' : 'heart-rate'} range`,
          range(before),
          range(after),
        ),
      );
    }
  }
  for (let day = 0; day < 7; day++) {
    const start = (p: Profile) =>
      p.dayPreferences?.find((d) => d.day === day)?.startTime ?? 'Open start';
    rows.push(
      row(`${weekdayNames[day]} start time`, start(before), start(after)),
    );
  }
  const support = (p: Profile) =>
    p.crossTraining
      ?.map((s) => `${weekdayNames[s.day]}: ${s.activity}, ${s.minutes} min`)
      .join('; ') || 'None';
  rows.push(row('Supporting training', support(before), support(after)));
  return rows.filter((r) => r.changed);
}

function stepSummary(s: Step | undefined, units: Profile['units']) {
  if (!s) return 'No step';
  return [
    s.kind,
    s.label,
    s.metres == null
      ? `${s.seconds} seconds`
      : `${s.metres} metres; ${s.seconds} seconds estimated`,
    s.effort,
    targetLabel(s.target, units),
    s.movement ?? 'run',
    `intensity ${s.intensity}`,
    s.planningPaceSecondsPerKm == null
      ? null
      : `${s.planningPaceSecondsPerKm} seconds/km planning pace`,
  ]
    .filter(Boolean)
    .join(' · ');
}
const versions = (plan: Plan | null) =>
  plan
    ? {
        engine: String(plan.engineVersion || 'Not recorded').slice(0, 80),
        policy: String(plan.policyVersion || 'Not recorded').slice(0, 80),
      }
    : null;

/** Compare all saved dates, including removed sessions and moves into the past. */
export function reviewRevision(
  before: Plan | null,
  after: Plan | null,
  revision: RevisionMetadata,
  previousVersion: number | null,
  offset = 0,
): RevisionReview {
  const boundary =
    previousVersion === null
      ? 'first'
      : revision.label.startsWith('Restored a recovery copy')
        ? 'recovery'
        : !before || !after
          ? 'empty'
          : before.id !== after.id
            ? 'new-block'
            : null;
  const base: RevisionReview = {
    revision: { ...revision, label: revisionLabel(revision.label) },
    previousVersion,
    boundary,
    explanation:
      boundary === 'first'
        ? 'This is the first available saved revision. No earlier snapshot is available to compare.'
        : boundary === 'recovery'
          ? 'A recovery copy replaced the journal. This is a history boundary, not an automatic training adjustment.'
          : boundary === 'new-block'
            ? 'A new training block started. Preferences are compared; sessions belong to different blocks and are not presented as rescheduled copies.'
            : boundary === 'empty'
              ? 'This revision crosses an empty-journal boundary. There are no matching training sessions to compare.'
              : 'Compared with the immediately preceding saved revision. These are historical prescriptions, not a recalculation with today’s engine.',
    versions: { before: versions(before), after: versions(after) },
    preferences:
      before && after ? preferences(before.profile, after.profile) : [],
    sessions: [],
    totalSessions: 0,
    nextOffset: null,
    recordedChanges: 0,
  };
  if (boundary || !before || !after) return base;
  const old = new Map(before.workouts.map((w) => [w.id, w])),
    current = new Map(after.workouts.map((w) => [w.id, w]));
  const changes: RevisionSessionChange[] = [];
  for (const id of new Set([...old.keys(), ...current.keys()])) {
    const a = old.get(id),
      b = current.get(id),
      workout = b ?? a!;
    const rows = workoutComparisonRows(
      a,
      b,
      before.profile,
      after.profile,
    ).filter((r) => r.changed);
    rows.push(
      ...[
        row(
          'Session purpose',
          a?.purpose ?? 'Not scheduled',
          b?.purpose ?? 'Not scheduled',
        ),
        row(
          'Why this session',
          a?.reason ?? 'Not scheduled',
          b?.reason ?? 'Not scheduled',
        ),
      ].filter((r) => r.changed),
    );
    for (
      let i = 0;
      i < Math.max(a?.steps.length ?? 0, b?.steps.length ?? 0);
      i++
    ) {
      const change = row(
        `Step ${i + 1}`,
        stepSummary(a?.steps[i], after.profile.units),
        stepSummary(b?.steps[i], after.profile.units),
      );
      if (change.changed) rows.push(change);
    }
    if (a?.session !== b?.session)
      rows.push(
        row(
          'Time of day',
          a?.session ?? 'Single session',
          b?.session ?? 'Single session',
        ),
      );
    const oldFeedback = a?.feedback,
      newFeedback = b?.feedback;
    if (JSON.stringify(oldFeedback) !== JSON.stringify(newFeedback)) {
      base.recordedChanges++;
      rows.push(
        ...[
          row(
            'Recorded time',
            oldFeedback
              ? runDuration(oldFeedback.actualMinutes)
              : 'Not recorded',
            newFeedback
              ? runDuration(newFeedback.actualMinutes)
              : 'Not recorded',
          ),
          row(
            'Recorded distance (km)',
            value(oldFeedback?.actualKm),
            value(newFeedback?.actualKm),
          ),
          row(
            'Recorded date',
            value(oldFeedback?.actualDate),
            value(newFeedback?.actualDate),
          ),
        ].filter((r) => r.changed),
      );
    }
    if (rows.length)
      changes.push({
        id,
        date: workout.date,
        title: workout.title,
        kind: !a
          ? 'Added'
          : !b
            ? 'Removed'
            : a.date !== b.date
              ? 'Moved'
              : 'Updated',
        rows,
      });
  }
  const extraBefore = new Map((before.extraRuns ?? []).map((r) => [r.id, r])),
    extraAfter = new Map((after.extraRuns ?? []).map((r) => [r.id, r]));
  for (const id of new Set([...extraBefore.keys(), ...extraAfter.keys()]))
    if (
      JSON.stringify(extraBefore.get(id)) !== JSON.stringify(extraAfter.get(id))
    )
      base.recordedChanges++;
  changes.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  base.totalSessions = changes.length;
  base.sessions = changes.slice(offset, offset + 20);
  base.nextOffset = offset + 20 < changes.length ? offset + 20 : null;
  return base;
}
