import type { Profile } from './plan/types.ts';
import type { NumericDraft } from '../components/numeric-input.tsx';
import { durableDraftKey, readDurableDraft } from './durable-draft.ts';
import { validTimezone, trainingDay } from './form-values.ts';
import { validDate } from './plan/calendar.ts';
import { validateWorkoutTargets } from './workout-targets.ts';

export type OnboardingDraft = {
  profile: Profile;
  raw: Record<string, NumericDraft>;
  step: number;
  scheduleTouched: boolean;
};
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const maxBytes = 64 * 1024;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown) =>
  v === null || (typeof v === 'number' && Number.isFinite(v));
const day = (v: unknown) =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 6;
const days = (v: unknown) =>
  Array.isArray(v) &&
  v.length <= 7 &&
  v.every(day) &&
  new Set(v).size === v.length;
const enums: Record<string, readonly string[]> = {
  goal: ['5k', '10k', 'half', 'marathon', 'ultra', 'custom', 'base'],
  units: ['km', 'mi'],
  planLevel: ['beginner', 'standard'],
  experience: ['returning', 'established', 'new'],
  difficulty: ['gentle', 'balanced'],
  volume: ['maintain', 'gradual'],
  qualityMode: ['automatic', 'custom'],
  terrain: ['flat', 'hills'],
  raceTerrain: ['road', 'rolling', 'mountain'],
  intent: ['finish', 'improve'],
  marathonApproach: ['balanced', 'endurance'],
  method: ['balanced', 'threshold-singles', 'easy-doubles', 'double-threshold'],
  thresholdControl: ['effort', 'heart-rate', 'lactate'],
  workoutFormat: ['automatic', 'time', 'distance'],
  workoutVariety: ['varied', 'familiar'],
  runMeasure: ['distance', 'time'],
};
const numericKeys = [
  'weeklyKm',
  'longestKm',
  'currentRuns',
  'weekdayMinutes',
  'longMinutes',
  'easyPace',
  'runsPerWeek',
  'runWalkStage',
  'qualitySessions',
  'recoveryWeeks',
  'raceDistanceKm',
  'easyLimitKm',
  'qualityLimitKm',
  'longLimitKm',
  'peakWeeklyKm',
  'recentQualitySessions',
  'stableWeeks',
  'ultraWeeklyMinutes',
  'ultraLongestMinutes',
  'easyDoubleWeeks',
  'recentSessionsPerWeek',
  'recentQualityMinutes',
  'doubleGapHours',
  'thresholdCeiling',
  'weeklyMinutesLimit',
  'carbsPerHour',
];

/** Validate editable shape, not training eligibility: blank/incomplete numeric
 * input is retained, and the existing preview/API still validates the profile. */
export function validOnboardingDraft(value: unknown): value is OnboardingDraft {
  if (
    !object(value) ||
    !object(value.profile) ||
    !object(value.raw) ||
    !Number.isInteger(value.step) ||
    Number(value.step) < 0 ||
    Number(value.step) > 2 ||
    typeof value.scheduleTouched !== 'boolean'
  )
    return false;
  const p = value.profile;
  if (
    !['name', 'raceName', 'raceDate', 'startDate'].every(
      (key) => typeof p[key] === 'string' && p[key].length <= 100,
    ) ||
    typeof p.timezone !== 'string' ||
    !validTimezone(p.timezone) ||
    !days(p.days) ||
    !day(p.longDay)
  )
    return false;
  for (const key of ['goal', 'units', 'experience', 'difficulty', 'volume'])
    if (typeof p[key] !== 'string' || !enums[key].includes(p[key]))
      return false;
  for (const key of [
    'weeklyKm',
    'longestKm',
    'currentRuns',
    'weekdayMinutes',
    'longMinutes',
    'easyPace',
  ])
    if (!Object.hasOwn(p, key) || !number(p[key])) return false;
  for (const [key, v] of Object.entries(p)) {
    if (
      [
        'name',
        'raceName',
        'raceDate',
        'startDate',
        'timezone',
        'days',
        'longDay',
      ].includes(key)
    )
      continue;
    if (Object.hasOwn(enums, key)) {
      if (typeof v !== 'string' || !enums[key].includes(v)) return false;
      continue;
    }
    if (numericKeys.includes(key)) {
      if (!number(v)) return false;
      continue;
    }
    if (['availableDays', 'doubleDays', 'preferredHardDays'].includes(key)) {
      if (!days(v)) return false;
      continue;
    }
    if (key === 'practiceInDark') {
      if (typeof v !== 'boolean') return false;
      continue;
    }
    if (key === 'recentRace') {
      if (
        !object(v) ||
        !number(v.distanceKm) ||
        !number(v.timeMinutes) ||
        (v.date !== undefined &&
          (typeof v.date !== 'string' || v.date.length > 10)) ||
        (v.source !== undefined &&
          (typeof v.source !== 'string' ||
            !['race', 'time-trial'].includes(v.source))) ||
        (v.course !== undefined &&
          (typeof v.course !== 'string' ||
            !['road', 'track', 'trail', 'treadmill'].includes(v.course)))
      )
        return false;
      continue;
    }
    if (key === 'dayPreferences') {
      if (
        !Array.isArray(v) ||
        v.length > 7 ||
        v.some(
          (d) =>
            !object(d) ||
            !day(d.day) ||
            (d.maxMinutes !== undefined && !number(d.maxMinutes)) ||
            (d.startTime != null &&
              (typeof d.startTime !== 'string' || d.startTime.length > 5)),
        )
      )
        return false;
      continue;
    }
    if (key === 'crossTraining') {
      if (
        !Array.isArray(v) ||
        v.length > 7 ||
        v.some(
          (d) =>
            !object(d) ||
            !day(d.day) ||
            !number(d.minutes) ||
            !['strength', 'cycling', 'swimming', 'mobility'].includes(
              String(d.activity),
            ),
        )
      )
        return false;
      continue;
    }
    if (key === 'workoutTargets') {
      try {
        validateWorkoutTargets(v);
      } catch {
        return false;
      }
      continue;
    }
    return false;
  }
  const entries = Object.entries(value.raw);
  return (
    entries.length <= 128 &&
    entries.every(
      ([key, v]) =>
        key.length <= 100 &&
        !['__proto__', 'prototype', 'constructor'].includes(key) &&
        object(v) &&
        typeof v.text === 'string' &&
        v.text.length <= 2048 &&
        typeof v.value === 'string' &&
        v.value.length <= 100 &&
        typeof v.factor === 'number' &&
        Number.isFinite(v.factor) &&
        v.factor > 0 &&
        typeof v.pace === 'boolean',
    )
  );
}

export function onboardingDraftIdentity(scope: string) {
  const split = scope.indexOf(':restart:');
  const accountScope = split < 0 ? scope : scope.slice(0, split);
  const kind = split < 0 ? 'onboarding' : `onboarding${scope.slice(split)}`;
  return {
    scope,
    accountScope,
    storageKey: durableDraftKey(accountScope, kind),
    legacyKey: `stride-onboarding:${scope}`,
  };
}
export function loadOnboardingDraft(
  scope: string,
  local?: DraftStorage,
  session?: DraftStorage,
  now = Date.now(),
): { draft: OnboardingDraft | null; unavailable: boolean } {
  if (!scope || (typeof window === 'undefined' && !local && !session))
    return { draft: null, unavailable: false };
  const identity = onboardingDraftIdentity(scope);
  let unavailable = false;
  let saved: OnboardingDraft | null = null;
  try {
    const storage = local ?? localStorage;
    const raw = storage.getItem(identity.storageKey);
    saved = readDurableDraft(raw, validOnboardingDraft, now);
    if (raw && !saved) storage.removeItem(identity.storageKey);
  } catch {
    unavailable = true;
  }
  if (!saved)
    try {
      const legacyStorage = session ?? sessionStorage;
      const raw = legacyStorage.getItem(identity.legacyKey);
      if (raw && raw.length <= maxBytes) {
        const legacy = JSON.parse(raw);
        const value = {
          profile: legacy.profile,
          raw: legacy.raw ?? {},
          step: Math.min(2, legacy.step),
          scheduleTouched: legacy.scheduleTouched ?? legacy.step >= 2,
        };
        const envelope = JSON.stringify({
          version: 1,
          savedAt: legacy.savedAt,
          value,
        });
        saved = readDurableDraft(envelope, validOnboardingDraft, now);
        if (saved)
          try {
            (local ?? localStorage).setItem(identity.storageKey, envelope);
            legacyStorage.removeItem(identity.legacyKey);
          } catch {
            unavailable = true;
          }
        else legacyStorage.removeItem(identity.legacyKey);
      }
    } catch {
      unavailable = true;
    }
  if (saved)
    saved = {
      ...saved,
      profile: {
        ...saved.profile,
        availableDays: saved.profile.availableDays ?? [...saved.profile.days],
        runsPerWeek: saved.profile.runsPerWeek ?? saved.profile.days.length,
        startDate: validDate(saved.profile.startDate)
          ? saved.profile.startDate
          : trainingDay(saved.profile.timezone),
        raceDate: validDate(saved.profile.raceDate)
          ? saved.profile.raceDate
          : '',
      },
    };
  return { draft: saved, unavailable };
}
export function saveOnboardingDraft(
  scope: string,
  value: OnboardingDraft,
  storage?: DraftStorage,
  now = Date.now(),
) {
  if (!scope) return false;
  try {
    const raw = JSON.stringify({ version: 1, savedAt: now, value });
    if (raw.length > maxBytes) return false;
    (storage ?? localStorage).setItem(
      onboardingDraftIdentity(scope).storageKey,
      raw,
    );
    return true;
  } catch {
    return false;
  }
}
export function clearOnboardingDraft(
  scope: string,
  local?: DraftStorage,
  session?: DraftStorage,
) {
  if (!scope) return false;
  const identity = onboardingDraftIdentity(scope);
  let cleared = true;
  try {
    (local ?? localStorage).removeItem(identity.storageKey);
  } catch {
    cleared = false;
  }
  try {
    (session ?? sessionStorage).removeItem(identity.legacyKey);
  } catch {
    cleared = false;
  }
  return cleared;
}
