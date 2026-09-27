/** Finish times are elapsed durations, not wall-clock times or decimal minutes. */
export function parseElapsedTime(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const match =
    /^(?:(\d{1,2}):([0-5]\d)|([0-9]{1,3})):([0-5]\d)(?:[.,](\d{1,2}))?$/.exec(
      text,
    );
  if (!match) return NaN;
  const minutes =
    match[1] === undefined
      ? Number(match[3])
      : Number(match[1]) * 60 + Number(match[2]);
  return minutes + (Number(match[4]) + Number(`0.${match[5] || '0'}`)) / 60;
}

export function elapsedTimeText(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';
  const hundredths = Math.round(minutes * 6000);
  const hours = Math.floor(hundredths / 360000);
  const mins = Math.floor((hundredths % 360000) / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const fraction = hundredths % 100;
  return `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${fraction ? `.${String(fraction).padStart(2, '0').replace(/0$/, '')}` : ''}`;
}

export const BENCHMARK_DISTANCES = [
  { distanceKm: 5, label: '5K' },
  { distanceKm: 10, label: '10K' },
  { distanceKm: 21.0975, label: 'Half marathon' },
  { distanceKm: 42.195, label: 'Marathon' },
] as const;
