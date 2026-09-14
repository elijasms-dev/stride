import type { Phase, Profile, Workout } from './engine';

/** Original adaptive rules informed by the user-supplied Advanced Marathoning,
 * third edition, chapters 1, 3, 6 and 8–12. These are not transcribed schedules.
 * Reference tiers guide emphasis; the runner's baseline funds every session.
 */
export const MARATHON_BOOK_VERSION = 'endurance-marathon-v1';
const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000,
  );

export const usesMarathonBook = (p: Pick<Profile, 'goal' | 'method'>) =>
  p.goal === 'marathon' && (!p.method || p.method === 'balanced');

export function marathonReference(p: Profile) {
  // Entry evidence, not desired mileage, selects an approximate reference band.
  const band =
    p.currentRuns >= 6 && p.weeklyKm >= 113 && p.longestKm >= 24
      ? 'high-volume'
      : p.currentRuns >= 6 && p.weeklyKm >= 89 && p.longestKm >= 24
        ? 'higher-mileage'
        : p.currentRuns >= 5 && p.weeklyKm >= 72 && p.longestKm >= 20
          ? 'established'
          : 'foundation';
  return {
    band,
    peakCeilingKm:
      band === 'high-volume'
        ? 150
        : band === 'higher-mileage'
          ? 137
          : band === 'established'
            ? 113
            : 89,
    longCeilingKm: 35,
    mediumCeilingKm: band === 'foundation' ? 21 : 24,
    compact: daysBetween(p.startDate, p.raceDate) + 1 <= 84,
  };
}

/** 18-week reference: 6 endurance / 5 LT / 4 race preparation / 3 taper.
 * 12-week reference: 4 / 3 / 3 / 2. Shorter blocks enter the remaining phases;
 * they never accelerate the omitted development. Longer blocks add easy lead-in.
 */
export function marathonBlockPhase(p: Profile, date: string): Phase {
  const left = daysBetween(date, p.raceDate);
  const compact = marathonReference(p).compact;
  if (left < 7) return 'Race week';
  if (left < (compact ? 14 : 21)) return 'Taper';
  if (left < (compact ? 35 : 49)) return 'Race preparation';
  if (left < (compact ? 56 : 84)) return 'Build';
  if (left < (compact ? 84 : 126)) return 'Foundation';
  return 'Maintenance';
}

export function marathonTaperDays(p: Pick<Profile, 'startDate' | 'raceDate'>) {
  return daysBetween(p.startDate, p.raceDate) + 1 <= 84 ? 14 : 21;
}

export function marathonTaperFraction(
  p: Pick<Profile, 'startDate' | 'raceDate'>,
  date: string,
) {
  const left = daysBetween(date, p.raceDate);
  if (left < 7) return 0.4;
  if (left < 14) return 0.6;
  return left < marathonTaperDays(p) ? 0.75 : 1;
}

export function marathonRecoveryFactor(p: Profile) {
  return usesMarathonBook(p) ? 0.7 : 0.82;
}

export function marathonSupportsMedium(p: Profile) {
  return (
    usesMarathonBook(p) &&
    p.experience === 'established' &&
    p.days.length >= 4 &&
    p.weeklyKm >= 40
  );
}

export function marathonMediumTargetKm(
  p: Profile,
  weeklyKm: number,
  longKm: number,
) {
  return Math.min(
    marathonReference(p).mediumCeilingKm,
    weeklyKm * 0.25,
    longKm * 0.8,
  );
}

/** Four race-relative opportunities; unavailable ones are skipped, not caught up.
 * A history/time gate still decides whether each opportunity becomes a rehearsal.
 */
export function marathonPaceOpportunity(
  p: Profile,
  date: string,
  history: Workout[],
) {
  if (
    !usesMarathonBook(p) ||
    p.intent === 'finish' ||
    p.difficulty === 'gentle' ||
    p.experience !== 'established' ||
    p.weeklyKm < 50 ||
    p.longestKm < 16 ||
    (p.qualitySessions ?? 0) === 0
  )
    return false;
  const left = daysBetween(date, p.raceDate);
  const anchor = (
    marathonReference(p).compact ? [70, 49, 35] : [105, 77, 56, 35]
  ).find((d) => left >= d && left < d + 7);
  if (anchor === undefined) return false;
  const previous = history.filter(
    (w) => w.status !== 'skipped' && w.date < date,
  );
  if (
    previous.some(
      (w) => w.kind === 'long' && w.hard && daysBetween(w.date, date) < 14,
    )
  )
    return false;
  const declared =
    (p.recentQualityMinutes ?? 0) / Math.max(1, p.recentQualitySessions ?? 1);
  return (
    declared >= 20 ||
    previous.filter(
      (w) => w.stimulus === 'threshold' && (w.qualityMinutes ?? 0) >= 12,
    ).length >= 2
  );
}

export function marathonPaceDose(
  p: Profile,
  history: Workout[],
  longMinutes: number,
) {
  const previous = history.filter(
    (w) =>
      w.kind === 'long' &&
      w.stimulus === 'race-rhythm' &&
      w.status !== 'skipped',
  );
  const familiar =
    (p.recentQualityMinutes ?? 0) / Math.max(1, p.recentQualitySessions ?? 1);
  const opening = Math.max(
    20,
    Math.min(50, Math.floor((familiar * 2) / 5) * 5),
  );
  const prior = previous.at(-1)?.qualityMinutes;
  const target = Math.min(
    90,
    longMinutes * 0.6,
    prior == null ? opening : prior + 15,
  );
  return Math.max(0, Math.floor(target / 5) * 5);
}

export function marathonBookNote(p: Profile) {
  const r = marathonReference(p);
  return `Marathon endurance model · ${r.compact ? '12' : '18'}-week reference, adapted to your dates and current running. Easy endurance comes first. The workouts shown in each week reflect your background, preferences and available time; the reference does not require every type of speed work. Mileage follows your baseline and limits, not a copied schedule. ${daysBetween(p.startDate, p.raceDate) < 83 ? 'This is a shortened remaining block, not a full book preparation.' : ''}`.trim();
}
