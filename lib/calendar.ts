import { stepLength } from './workout-names.ts';
import { targetLabel } from './workout-targets.ts';
import { isLongUltra } from './ultra-policy.ts';
import { addDays } from './plan/calendar.ts';
import { eventDistanceDisplay } from './plan/display.ts';
import { type Plan } from './plan/types.ts';
function escape(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
// RFC 5545 folds at 75 octets; never split a UTF-8 codepoint.
function fold(line: string) {
  const lines: string[] = [];
  let part = '',
    bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 75) {
      lines.push(part);
      part = ' ';
      bytes = 1;
    }
    part += ch;
    bytes += n;
  }
  lines.push(part);
  return lines.join('\r\n');
}
/** Deliberate all-day snapshot: no invented start times or timezone conversion. */
export function exportCalendar(
  plan: Plan,
  from: string,
  version: number,
  now = new Date(),
): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stride//Training calendar 0.3//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Stride training',
  ];
  for (const w of plan.workouts.filter(
    (w) => w.week >= 0 && w.date >= from && w.status === 'planned',
  )) {
    const summary =
      w.kind === 'race' && isLongUltra(plan.profile)
        ? `${w.title} · ${eventDistanceDisplay(w.estimatedKm, plan.profile.units)} ${plan.profile.units}`
        : `${w.session ? w.session + ' · ' : ''}${w.title} · ${w.minutes} min`;
    const details = [
      w.purpose,
      ...(w.steps.some((s) => s.metres !== undefined) && w.kind !== 'race'
        ? [
            'Session duration is a planning allowance; distance repetitions end at their prescribed distance.',
          ]
        : []),
      ...w.steps.map(
        (s, i) =>
          `${i + 1}. ${s.label}: ${stepLength(s)}; ${s.target ? targetLabel(s.target, plan.profile.units) + '; ' : ''}${s.effort}`,
      ),
      'Snapshot only. Later changes require a new export; check for duplicates in your calendar.',
    ].join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${encodeURIComponent(w.id)}@stride.local`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${version}`,
      `DTSTART;VALUE=DATE:${w.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDays(w.date, 1).replace(/-/g, '')}`,
      `SUMMARY:${escape(summary)}`,
      `DESCRIPTION:${escape(details)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
