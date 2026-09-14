import { schedulingEasyPace } from './fitness-pacing.ts';
import { isLongUltra } from './ultra-policy.ts';
import type { Profile } from './engine';
import { runningDayLimit } from './runner-customization.ts';
import { marathonSupportsMedium, usesMarathonBook } from './marathon-book.ts';

const separation = (a: number, b: number) =>
  Math.min(Math.abs(a - b), 7 - Math.abs(a - b));

export const desiredRuns = (p: Pick<Profile, 'days' | 'runsPerWeek'>) =>
  p.runsPerWeek ?? p.days.length;
export const availableRunningDays = (
  p: Pick<Profile, 'days' | 'availableDays'>,
) => p.availableDays ?? p.days;
export function classicQualityCount(
  p: Pick<Profile, 'days' | 'runsPerWeek' | 'goal' | 'raceDistanceKm'>,
): 0 | 1 | 2 {
  const count = desiredRuns(p);
  return isLongUltra(p)
    ? 1
    : p.goal === 'base' || count === 2
      ? 0
      : count >= 5
        ? 2
        : 1;
}

export function usesMarathonRhythm(
  p: Pick<Profile, 'goal' | 'raceDistanceKm' | 'method'>,
): boolean {
  const marathon =
    p.goal === 'marathon' ||
    (['custom', 'ultra'].includes(p.goal) &&
      (p.raceDistanceKm ?? 0) > 30 &&
      (p.raceDistanceKm ?? 0) <= 45);
  return marathon && (!p.method || p.method === 'balanced');
}

/** Number of weekday quality slots; standard marathon longs supply the second session. */
export function requestedQualityCount(p: Profile): 0 | 1 | 2 {
  if (usesMarathonRhythm(p)) return 1;
  if (p.goal === 'base' || desiredRuns(p) === 2) return 0;
  const requested =
    p.qualityMode === 'automatic'
      ? classicQualityCount(p)
      : (p.qualitySessions ?? 1);
  return p.intent === 'finish' ||
    isLongUltra(p) ||
    (usesMarathonBook(p) && p.qualityMode !== 'custom')
    ? (Math.min(1, requested) as 0 | 1)
    : requested;
}

/** Original classic templates, rotated around the chosen long-run day. */
export function classicRunningDays(count: number, longDay: number): number[] {
  const offsets: Record<number, number[]> = {
    2: [-3, 0],
    3: [-4, -2, 0],
    4: [-5, -4, -2, 0],
    5: [-5, -4, -3, -2, 0],
    6: [-5, -4, -3, -2, -1, 0],
    7: [-6, -5, -4, -3, -2, -1, 0],
  };
  return (offsets[count] ?? [])
    .map((d) => (longDay + d + 7) % 7)
    .sort((a, b) => a - b);
}
const classicHardDays = (p: Profile) =>
  (desiredRuns(p) >= 5 ? [-4, -2] : [-4]).map((d) => (p.longDay + d + 7) % 7);

/** Availability is a set of options, not a prescription to run on every day. */
export function resolveRunningDays(p: Profile): number[] {
  const available = [...availableRunningDays(p)]
    .filter((d) => !p.crossTraining?.some((s) => s.day === d))
    .sort((a, b) => a - b);
  const count = desiredRuns(p);
  if (
    p.availableDays === undefined &&
    p.runsPerWeek === undefined &&
    !p.crossTraining?.length
  )
    return [...p.days].sort((a, b) => a - b);
  let best: number[] = [],
    bestScore = -Infinity;
  for (let mask = 0; mask < 1 << available.length; mask++) {
    const days = available.filter((_, i) => mask & (1 << i));
    if (days.length !== count || !days.includes(p.longDay)) continue;
    if (
      p.doubleDays?.some((d) => !days.includes(d)) &&
      ['double-threshold', 'easy-doubles'].includes(p.method ?? '')
    )
      continue;
    const candidate = { ...p, days };
    const quality = qualitySchedule(candidate);
    const gaps = days.map((d, i) => (days[(i + 1) % days.length] - d + 7) % 7);
    const score =
      quality.length * 1000000 +
      (p.preferredHardDays?.filter((d) => quality.includes(d)).length ?? 0) *
        100000 +
      quality.filter((d) => classicHardDays(p).includes(d)).length * 10000 +
      days.filter((d) => classicRunningDays(count, p.longDay).includes(d))
        .length *
        1000 -
      gaps.reduce((n, gap) => n + gap * gap, 0) * 10 +
      days.filter((d) => p.days.includes(d)).length;
    if (score > bestScore) {
      best = days;
      bestScore = score;
    }
  }
  return best;
}

/** Solve the whole week: a greedy first choice can hide a feasible second slot. */
export function qualitySchedule(p: Profile): number[] {
  if (desiredRuns(p) === 2) return [];
  const available = (
    p.method === 'double-threshold' ? (p.doubleDays ?? []) : p.days
  )
    .filter(
      (d) =>
        d !== p.longDay &&
        runningDayLimit(p, d) >= 30 &&
        separation(d, p.longDay) >= 2 &&
        !(p.method === 'easy-doubles' && p.doubleDays?.includes(d)),
    )
    .sort((a, b) => a - b);
  const requested = requestedQualityCount(p);
  let best: number[] = [],
    bestScore = -Infinity;
  for (let mask = 0; mask < 1 << available.length; mask++) {
    const chosen = available.filter((_, i) => mask & (1 << i));
    if (
      chosen.length > requested ||
      chosen.some((d, i) =>
        chosen.slice(i + 1).some((other) => separation(d, other) < 2),
      )
    )
      continue;
    const score =
      chosen.length * 10000 +
      chosen.reduce(
        (n, d) =>
          n +
          (p.preferredHardDays?.includes(d) ? 1000 : 0) +
          (classicHardDays(p).includes(d) ? 100 : 0) +
          separation(d, p.longDay) * 10 +
          (!p.days.includes((d + 6) % 7) ? 1 : 0),
        0,
      );
    if (score > bestScore) {
      best = chosen;
      bestScore = score;
    }
  }
  return best;
}

/** Allocate an existing weekly budget. More available time never creates volume. */
export function allocateRunningMinutes(
  total: number,
  slots: { key: string; weight: number; cap: number }[],
): Map<string, number> {
  // The allocator never creates minutes, even for an underfunded budget.
  if (!Number.isFinite(total) || total <= 0)
    return new Map(slots.map((s) => [s.key, 0]));
  slots = slots.map((s) => ({
    ...s,
    cap: Math.max(0, Number.isNaN(s.cap) ? 0 : Math.floor(s.cap)),
    weight: Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1,
  }));
  let initial = Math.floor(total);
  const allocation = new Map(
    slots.map((s) => {
      const minutes = Math.min(initial, 5, s.cap);
      initial -= minutes;
      return [s.key, minutes];
    }),
  );
  let remaining = Math.max(
    0,
    Math.floor(total) - [...allocation.values()].reduce((a, b) => a + b, 0),
  );
  while (remaining > 0) {
    const open = slots.filter(
      (s) => allocation.get(s.key)! < Math.floor(s.cap),
    );
    if (!open.length) break;
    const weights = open.reduce((n, s) => n + s.weight, 0);
    let used = 0;
    for (const s of open) {
      const add = Math.min(
        Math.floor(s.cap) - allocation.get(s.key)!,
        Math.floor((remaining * s.weight) / weights),
      );
      allocation.set(s.key, allocation.get(s.key)! + add);
      used += add;
    }
    if (!used) {
      const next = [...open].sort(
        (a, b) =>
          allocation.get(a.key)! / a.weight - allocation.get(b.key)! / b.weight,
      )[0];
      allocation.set(next.key, allocation.get(next.key)! + 1);
      used = 1;
    }
    remaining -= used;
  }
  return allocation;
}

export function aerobicSupportDay(
  p: Profile,
  family: string,
  quality: number[],
) {
  // With two selected workouts, protect room for their full main sets. A
  // compulsory medium-long run otherwise consumes the remaining weekday
  // mileage and squeezes both quality days into introductory sessions.
  if (
    usesMarathonBook(p) &&
    p.qualityMode === 'custom' &&
    p.qualitySessions === 2 &&
    p.marathonApproach !== 'endurance'
  )
    return undefined;
  if (
    p.experience !== 'established' ||
    (p.days.length < 5 && !marathonSupportsMedium(p)) ||
    !['10k', 'half', 'marathon', 'ultra'].includes(family) ||
    p.weeklyKm < 40 ||
    ['double-threshold', 'easy-doubles'].includes(p.method ?? '')
  )
    return undefined;
  return p.days
    .filter(
      (d) =>
        d !== p.longDay &&
        !quality.includes(d) &&
        separation(d, p.longDay) >= 2,
    )
    .sort(
      (a, b) => separation(b, p.longDay) - separation(a, p.longDay) || a - b,
    )[0];
}

export function sessionWeight(
  day: number,
  longDay: number,
  quality: number[],
  support?: number,
  endurance = false,
) {
  if (quality.includes(day)) return 1.1;
  if (day === support) return endurance ? 1.5 : 1.35;
  if (
    day === (longDay + 1) % 7 ||
    day === (longDay + 6) % 7 ||
    quality.some((d) => day === (d + 1) % 7)
  )
    return 0.7;
  return 1;
}

/** Authored allocation bounds, not universal physiological thresholds. */
export function longRunShareLimit(p: Profile) {
  if (p.days.length <= 2) return 0.5;
  if (p.days.length === 3 && p.experience === 'established') return 0.5;
  const ordinary = p.days.length >= 6 ? 0.4 : 0.45;
  // Adding an easy day does not erase the runner's reported long-run background.
  const familiar =
    p.experience === 'established' && p.weeklyKm > 0
      ? Math.min(0.45, p.longestKm / p.weeklyKm)
      : 0;
  return Math.max(ordinary, familiar);
}

/** Recovery is a short supporting role, never a reservoir for unused mileage. */
export function recoveryRunCap(p: Profile, weeklyMinutes: number) {
  return Math.min(60, Math.max(15, (weeklyMinutes / p.days.length) * 0.85));
}

/** Suggestions come from declared running; editing time availability stays explicit. */
export function suggestedSessionLimits(
  p: Pick<Profile, 'weeklyKm' | 'longestKm' | 'currentRuns' | 'easyPace'>,
  futureLongKm = p.longestKm,
  plannedRuns = p.currentRuns,
  longShare = 0.45,
) {
  const pace = schedulingEasyPace(p);
  const ordinary =
    p.currentRuns > 1
      ? Math.max(0, p.weeklyKm - p.longestKm) / (p.currentRuns - 1)
      : p.weeklyKm / Math.max(1, p.currentRuns);
  const supportingMinutes =
    plannedRuns > 2 && futureLongKm > p.longestKm
      ? (futureLongKm * pace * (1 - longShare)) /
          longShare /
          (plannedRuns - 1) +
        10
      : 0;
  return {
    weekdayMinutes: Math.min(
      120,
      Math.max(
        20,
        Math.ceil(Math.max(ordinary * pace, supportingMinutes) / 5) * 5,
      ),
    ),
    longMinutes: Math.min(
      300,
      Math.max(
        30,
        Math.ceil((Math.max(p.longestKm, futureLongKm) * pace) / 5) * 5,
      ),
    ),
  };
}
