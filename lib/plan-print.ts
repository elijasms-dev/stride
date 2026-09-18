import { supportingSession } from './coaching-context.ts';
import { runDuration } from './journal-view.ts';
import { addDays, dateLabel, dayDiff, validDate } from './plan/calendar.ts';
import {
  eventDistanceDisplay,
  goalLabel,
  workoutDistanceLabel,
} from './plan/display.ts';
import type { Plan, Step, Workout } from './plan/types.ts';
import { trainingRecords, type RunRecord } from './run-records.ts';
import { prescribedDistanceKm } from './run-distance.ts';
import { duration, stepLength } from './workout-names.ts';
import { targetLabel } from './workout-targets.ts';

/** Text only: no profile, workout, or feedback field is trusted as markup. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]!;
  });
}

function distance(km: number, plan: Plan) {
  return `${eventDistanceDisplay(km, plan.profile.units)} ${plan.profile.units}`;
}

function dateText(date: string) {
  return dateLabel(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function stepHtml(step: Step, workout: Workout, plan: Plan) {
  const length =
    step.metres !== undefined && ['race', 'easy', 'long'].includes(workout.kind)
      ? distance(step.metres / 1000, plan)
      : stepLength(step);
  const allowance =
    step.metres !== undefined && workout.kind !== 'race'
      ? `Planning time: ${duration(step.seconds)}. Finish this step at its distance target.`
      : '';
  const movement = step.movement === 'walk' ? 'Walk. ' : '';
  const target = step.target
    ? targetLabel(step.target, plan.profile.units)
    : '';
  return `<li class="step ${escapeHtml(step.kind)}"><div class="step-heading"><strong>${escapeHtml(step.label)}</strong><span>${escapeHtml(length)}</span></div><p>${escapeHtml(movement + step.effort)}${target ? ` <strong class="target">${escapeHtml(target)}</strong>` : ''}</p>${allowance ? `<p class="muted">${escapeHtml(allowance)}</p>` : ''}</li>`;
}

function recordHtml(record: RunRecord, plan: Plan, title: string) {
  const metrics = [
    runDuration(record.minutes),
    record.km === null ? 'Distance not recorded' : distance(record.km, plan),
    `Effort ${record.effort}/10`,
    `Felt ${record.feeling}`,
  ];
  return `<div class="record"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(metrics.join(' · '))}</p>${record.note ? `<p class="note">${escapeHtml(record.note)}</p>` : ''}</div>`;
}

function workoutHtml(workout: Workout, plan: Plan, record?: RunRecord) {
  const timing = [workout.session, workout.startTime].filter(Boolean).join(' ');
  const metrics = [
    workoutDistanceLabel(workout, plan.profile),
    workout.kind === 'race'
      ? 'Race duration is not predicted'
      : `${runDuration(workout.minutes)} ${workout.steps.some((step) => step.metres !== undefined) ? 'planning time' : 'total time'}`,
  ];
  const actualDate = record?.date ?? workout.feedback?.actualDate;
  const status =
    workout.status === 'completed'
      ? `Completed${actualDate && actualDate !== workout.date ? ` on ${dateText(actualDate)}` : ''}`
      : workout.status === 'skipped'
        ? 'Skipped prescription'
        : 'Planned';
  const actual =
    record && record.date === workout.date
      ? recordHtml(record, plan, 'Recorded run')
      : '';
  return `<article class="workout ${escapeHtml(workout.kind)}"><header><h4>${escapeHtml(timing ? `${timing} · ${workout.title}` : workout.title)}</h4><span class="status">${escapeHtml(status)}</span></header><p class="metrics">${escapeHtml(metrics.join(' · '))}</p>${workout.purpose ? `<p>${escapeHtml(workout.purpose)}</p>` : ''}${workout.kind === 'race' ? '<p class="muted">Follow the event distance. Any time used to plan this session is not a finish-time target.</p>' : ''}${workout.skipReason ? `<p class="muted">${escapeHtml(workout.skipReason)}</p>` : ''}<ol class="steps">${workout.steps.map((step) => stepHtml(step, workout, plan)).join('')}</ol>${actual}</article>`;
}

function dayHtml(date: string, plan: Plan, records: RunRecord[]) {
  const sessions = plan.workouts
    .filter((workout) => workout.date === date)
    .sort((a, b) =>
      (a.startTime ?? (a.session === 'PM' ? '18:00' : '06:00')).localeCompare(
        b.startTime ?? (b.session === 'PM' ? '18:00' : '06:00'),
      ),
    );
  const supporting = supportingSession(plan, date);
  const actualOnDate = records.filter((record) => record.date === date);
  const otherActual = actualOnDate.filter(
    (record) => !sessions.some((workout) => workout.id === record.workoutId),
  );
  const noRun =
    !sessions.length && !actualOnDate.length
      ? `<p class="rest">${supporting ? 'No running scheduled.' : 'Rest day.'}</p>`
      : '';
  return `<section class="day" data-date="${escapeHtml(date)}"><h3><time datetime="${escapeHtml(date)}">${escapeHtml(dateText(date))}</time></h3><div class="day-content">${noRun}${sessions
    .map((workout) =>
      workoutHtml(
        workout,
        plan,
        records.find((record) => record.workoutId === workout.id),
      ),
    )
    .join('')}${otherActual
    .map((record) => {
      const workout = plan.workouts.find(
        (item) => item.id === record.workoutId,
      );
      return recordHtml(
        record,
        plan,
        workout
          ? `Completed: ${workout.title} (scheduled ${dateText(workout.date)})`
          : 'Additional recorded run',
      );
    })
    .join(
      '',
    )}${supporting ? `<aside class="supporting"><strong>Optional: ${escapeHtml(supporting.title)} · ${escapeHtml(runDuration(supporting.minutes))}</strong><p>${escapeHtml(supporting.notes)}</p></aside>` : ''}</div></section>`;
}

function weekSummary(plan: Plan, dates: string[], records: RunRecord[]) {
  const start = dates[0],
    end = dates.at(-1)!;
  const scheduled = plan.workouts.filter(
    (workout) =>
      workout.date >= start &&
      workout.date <= end &&
      workout.status !== 'skipped',
  );
  const training = scheduled.filter((workout) => workout.kind !== 'race');
  const races = scheduled.filter((workout) => workout.kind === 'race');
  const estimatedDistance = training.some(
    (workout) => prescribedDistanceKm(workout) === null,
  );
  const planningTime = training.some((workout) =>
    workout.steps.some((step) => step.metres !== undefined),
  );
  const km = training.reduce((sum, workout) => sum + workout.estimatedKm, 0);
  const minutes = training.reduce((sum, workout) => sum + workout.minutes, 0);
  const runningDays = new Set(training.map((workout) => workout.date)).size;
  const long = Math.max(
    0,
    ...training
      .filter((workout) => workout.kind === 'long')
      .map((workout) => workout.estimatedKm),
  );
  const raceIds = new Set(
    plan.workouts
      .filter((workout) => workout.kind === 'race')
      .map((workout) => workout.id),
  );
  const actual = records.filter(
    (record) =>
      record.date >= start &&
      record.date <= end &&
      !raceIds.has(record.workoutId ?? ''),
  );
  const known = actual.filter((record) => record.km !== null);
  const missing = actual.length - known.length;
  return `<p class="week-summary"><strong>${escapeHtml(distance(km, plan))} scheduled training${estimatedDistance ? ' (estimated distance)' : ''}</strong> · ${escapeHtml(runDuration(minutes))} ${planningTime ? 'planning time' : 'prescribed time'} · ${runningDays} running ${runningDays === 1 ? 'day' : 'days'}${long ? ` · Long run ${escapeHtml(distance(long, plan))}` : ''}</p>${
    races.length
      ? `<p class="race-summary">Race separately: ${escapeHtml(
          distance(
            races.reduce((sum, workout) => sum + workout.estimatedKm, 0),
            plan,
          ),
        )}. Excluded from the training total.</p>`
      : ''
  }${
    actual.length
      ? `<p class="actual-summary">Recorded training: ${escapeHtml(runDuration(actual.reduce((sum, record) => sum + record.minutes, 0)))} · ${
          known.length
            ? escapeHtml(
                distance(
                  known.reduce((sum, record) => sum + record.km!, 0),
                  plan,
                ),
              )
            : 'No distance recorded'
        }${missing ? ` (${missing} ${missing === 1 ? 'run has' : 'runs have'} no distance recorded; distance total is incomplete)` : ''}. Uses actual dates; excludes recorded races.</p>`
      : ''
  }`;
}

const printStyles = `
  @page { size: auto; margin: 15mm; }
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body { margin: 0; color: #0f172a; background: white; font: 11pt/1.45 Arial, Helvetica, sans-serif; }
  main { max-width: 850px; margin: 36px auto; padding: 0 24px; }
  h1, h2, h3, h4, p { margin: 0; }
  h1 { font-size: 28pt; line-height: 1.12; margin: 7px 0 12px; }
  h2 { font-size: 18pt; line-height: 1.25; }
  h3 { font-size: 10pt; }
  h4 { font-size: 12pt; }
  p { margin-top: 5px; }
  header, .week-heading { break-after: avoid; }
  .brand { color: #0057db; font-size: 14pt; font-weight: 800; }
  .intro { padding-bottom: 20px; border-bottom: 3px solid #0057db; }
  .intro p { max-width: 75ch; }
  .legend { color: #475569; font-size: 9pt; margin-top: 14px; }
  .week { margin-top: 30px; }
  .week-heading { padding: 10px 0; border-bottom: 2px solid #0f172a; }
  .week-range, .muted { color: #475569; font-size: 9pt; }
  .week-summary { font-size: 10pt; }
  .race-summary { font-weight: 700; }
  .actual-summary { font-size: 9pt; }
  .day { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 18px; padding: 14px 0; border-bottom: 1px solid #cbd5e1; }
  .day h3 { break-after: avoid; }
  .day-content { min-width: 0; }
  .day-content > :first-child { margin-top: 0; }
  .workout + .workout { border-top: 1px dashed #94a3b8; margin-top: 16px; padding-top: 14px; }
  .workout header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 3px 12px; }
  .status { font-size: 9pt; color: #475569; }
  .metrics { font-size: 10pt; font-weight: 700; }
  .steps { margin: 9px 0 0; padding-left: 21px; }
  .step { padding: 5px 0 5px 3px; break-inside: avoid; }
  .step + .step { border-top: 1px solid #e2e8f0; }
  .step-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; }
  .step-heading span { font-weight: 700; }
  .step p { font-size: 9pt; }
  .target { color: #0057db; }
  .rest { color: #475569; }
  .record, .supporting { margin-top: 10px; padding: 9px 12px; border-left: 3px solid #64748b; background: #f8fafc; font-size: 9pt; break-inside: avoid; }
  .note { white-space: pre-wrap; }
  .notes { margin-top: 24px; font-size: 10pt; }
  .notes li { margin: 6px 0; }
  p, li, h1, h2, h3, h4 { overflow-wrap: anywhere; }
  @media (max-width: 560px) { main { padding: 0 16px; margin-top: 20px; } .day { grid-template-columns: 1fr; gap: 8px; } }
  @media print { main { max-width: none; margin: 0; padding: 0; } body { font-size: 10pt; } .week { break-before: page; margin-top: 0; } .week:first-of-type { break-before: auto; margin-top: 20px; } .day { gap: 12px; grid-template-columns: 92px minmax(0, 1fr); } .step p { font-size: 8.5pt; } a { color: inherit; } }
`;

/** Portable read-only document; all labels and prescriptions come from saved data. */
export function trainingPlanHtml(plan: Plan): string {
  const { startDate, raceDate } = plan.profile;
  if (!validDate(startDate) || !validDate(raceDate) || raceDate < startDate)
    throw new Error('Check the plan dates before printing.');
  const records = trainingRecords(plan);
  const days = Array.from(
    { length: dayDiff(startDate, raceDate) + 1 },
    (_, i) => addDays(startDate, i),
  );
  const groups: { week: Plan['weeks'][number] | undefined; dates: string[] }[] =
    [];
  for (const date of days) {
    const week = plan.weeks.find(
      (item) => date >= item.start && date <= addDays(item.start, 6),
    );
    const last = groups.at(-1);
    if (last && last.week === week) last.dates.push(date);
    else groups.push({ week, dates: [date] });
  }
  const title = plan.profile.raceName || goalLabel(plan.profile.goal);
  const weeks = groups
    .map(
      ({ week, dates }, index) =>
        `<section class="week"><header class="week-heading"><h2>${escapeHtml(week ? `Week ${week.index + 1} · ${week.phase}` : `Schedule ${index + 1}`)}</h2><p class="week-range">${escapeHtml(dateText(dates[0]))} – ${escapeHtml(dateText(dates.at(-1)!))}</p>${weekSummary(plan, dates, records)}${week?.focus ? `<p>${escapeHtml(week.focus)}</p>` : ''}</header>${dates.map((date) => dayHtml(date, plan, records)).join('')}</section>`,
    )
    .join('');
  const outside = records.filter(
    (record) => record.date < startDate || record.date > raceDate,
  );
  const outsideWorkouts = plan.workouts.filter(
    (workout) => workout.date < startDate || workout.date > raceDate,
  );
  const appendix =
    outside.length || outsideWorkouts.length
      ? `<section class="week"><header class="week-heading"><h2>Saved sessions outside the plan dates</h2><p>These entries are retained for context and excluded from the scheduled weekly totals above.</p></header>${outsideWorkouts
          .map(
            (workout) =>
              `<section class="day"><h3>${escapeHtml(dateText(workout.date))}</h3><div>${workoutHtml(
                workout,
                plan,
                records.find((record) => record.workoutId === workout.id),
              )}</div></section>`,
          )
          .join('')}${outside
          .filter(
            (record) =>
              !outsideWorkouts.some(
                (workout) =>
                  workout.id === record.workoutId &&
                  workout.date === record.date,
              ),
          )
          .map((record) =>
            recordHtml(record, plan, `${dateText(record.date)} · Recorded run`),
          )
          .join('')}</section>`
      : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)} · Stride training plan</title><style>${printStyles}</style></head><body><main><header class="intro"><p class="brand">Stride</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(plan.profile.name ? `${plan.profile.name} · ${goalLabel(plan.profile.goal)}` : goalLabel(plan.profile.goal))}</p><p>${escapeHtml(dateText(startDate))} – ${escapeHtml(dateText(raceDate))} · ${days.length} days</p><p class="legend">Every calendar day is included. Workout steps appear in their saved order, including every repetition and recovery. Distance targets end at the stated distance; their time is a planning allowance. Timed steps end at the stated duration. Pace or heart-rate targets are shown only when saved; effort cues always apply.</p><p class="legend">Weekly scheduled distance is a planning estimate where runs are timed. Training totals exclude the race and skipped sessions, and include completed prescriptions on their scheduled dates. Recorded running is shown separately on its actual date. Optional supporting activities do not count toward running totals.</p></header>${weeks}${appendix}${plan.notes.length ? `<section class="notes"><h2>Plan notes</h2><ul>${plan.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul></section>` : ''}</main></body></html>`;
}

/** Print in an isolated document without opening a tab or granting an opener. */
export function printTrainingPlan(plan: Plan): void {
  const html = trainingPlanHtml(plan);
  const frame = document.createElement('iframe');
  frame.title = 'Print training plan';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:850px;height:1100px;border:0;';
  const cleanup = () => frame.remove();
  frame.onload = () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) {
      cleanup();
      downloadTrainingPlan(plan);
      return;
    }
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      cleanup();
      downloadTrainingPlan(plan);
    }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
  // Some browsers do not send afterprint when their print dialog is cancelled.
  window.setTimeout(cleanup, 300_000);
}

/** A printable offline copy, with no scripts, external fonts, or network requests. */
export function downloadTrainingPlan(plan: Plan): void {
  const blob = new Blob([trainingPlanHtml(plan)], {
    type: 'text/html;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stride-training-plan-${plan.profile.startDate}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
