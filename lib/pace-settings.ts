import type { Profile, Workout } from './plan/types.ts';
import { resolveStepPacing, type PacingRole } from './source-pacing.ts';
import {
  paceText,
  parsePace,
  validateWorkoutTargets,
  type WorkoutTargets,
} from './workout-targets.ts';
import { parseElapsedTime, elapsedTimeText } from './benchmark-input.ts';

export type PaceRowDraft = {
  mode: 'source' | 'effort' | 'pace' | 'heart-rate';
  low: string;
  high: string;
};
export type PaceSettingsDraft = {
  rows: Partial<Record<PacingRole, PaceRowDraft>>;
  goalTime: string;
};

export function paceSettingsRows(profile: Profile, workouts: Workout[]) {
  const rows = new Map<PacingRole, ReturnType<typeof resolveStepPacing>>();
  for (const workout of workouts) {
    for (const step of workout.steps) {
      const resolution = resolveStepPacing(workout, step, profile);
      if (!rows.has(resolution.role)) rows.set(resolution.role, resolution);
    }
  }
  return [...rows.values()];
}

export function canOverridePacingRole(role: PacingRole) {
  return ![
    'effort',
    'recovery',
    'strides',
    'hills',
    'run-walk',
    'progressive',
  ].includes(role);
}

const eventRoles = new Set<PacingRole>(['race', 'current-race', 'goal-race']);
const scopeMatches = (profile: Profile) =>
  profile.workoutTargets?.raceScope ===
  `${profile.goal}:${profile.raceDistanceKm ?? ''}`;

export function initialPaceSettings(
  profile: Profile,
  workouts: Workout[],
): PaceSettingsDraft {
  const saved = profile.workoutTargets;
  const rows: PaceSettingsDraft['rows'] = {};
  for (const row of paceSettingsRows(profile, workouts)) {
    const override =
      !eventRoles.has(row.role) || scopeMatches(profile)
        ? saved?.overrides?.[row.role]
        : undefined;
    // Only saved manual choices populate editable values. Automatic results stay inherited.
    const manual =
      override && override.mode !== 'effort'
        ? override
        : row.target?.source === 'manual'
          ? row.target
          : undefined;
    const format = (n: number) =>
      manual?.mode === 'pace' ? paceText(n, profile.units) : String(n);
    rows[row.role] = {
      mode:
        override?.mode ??
        manual?.mode ??
        (saved?.mode === 'effort' ? 'effort' : 'source'),
      low: manual ? format(manual.low) : '',
      high: manual ? format(manual.high) : '',
    };
  }
  return {
    rows,
    goalTime: elapsedTimeText(
      scopeMatches(profile) ? saved?.goalTimeMinutes : undefined,
    ),
  };
}

export function paceSettingsConfig(
  profile: Profile,
  draft: PaceSettingsDraft,
): WorkoutTargets {
  const overrides = { ...profile.workoutTargets?.overrides };
  if (!scopeMatches(profile))
    for (const role of eventRoles) delete overrides[role];
  for (const [key, row] of Object.entries(draft.rows)) {
    if (!row) continue;
    const role = key as PacingRole;
    if (row.mode === 'source' || !canOverridePacingRole(role)) {
      delete overrides[role];
      continue;
    }
    if (row.mode === 'effort') {
      overrides[role] = { mode: 'effort' };
      continue;
    }
    const parse = (text: string) =>
      row.mode === 'pace'
        ? parsePace(text, profile.units)
        : text.trim()
          ? Number(text)
          : null;
    // One value is an explicit point target. No training tolerance is added.
    const low = parse(row.low);
    const high = row.high.trim() ? parse(row.high) : low;
    if (
      low === null ||
      high === null ||
      !Number.isFinite(low) ||
      !Number.isFinite(high)
    )
      throw new Error(
        'Enter a valid target in each edited row, or choose Programme guidance.',
      );
    const previous = profile.workoutTargets?.overrides?.[role];
    const sameDisplay =
      previous &&
      previous.mode === row.mode &&
      row.low ===
        (row.mode === 'pace'
          ? paceText(previous.low, profile.units)
          : String(previous.low)) &&
      row.high ===
        (row.mode === 'pace'
          ? paceText(previous.high, profile.units)
          : String(previous.high));
    overrides[role] = sameDisplay ? previous : { mode: row.mode, low, high };
  }
  const goalTimeMinutes = draft.goalTime.trim()
    ? parseElapsedTime(draft.goalTime)
    : undefined;
  if (
    goalTimeMinutes === null ||
    (goalTimeMinutes !== undefined &&
      (!Number.isFinite(goalTimeMinutes) || goalTimeMinutes <= 0))
  )
    throw new Error(
      'Enter your goal finish time as hours:minutes:seconds or minutes:seconds.',
    );
  return validateWorkoutTargets({
    mode: 'automatic',
    overrides,
    ...(goalTimeMinutes !== undefined ? { goalTimeMinutes } : {}),
    raceScope: `${profile.goal}:${profile.raceDistanceKm ?? ''}`,
  });
}
