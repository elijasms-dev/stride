import { deviceJournal } from './journal-store.js';
const element = (id) => document.getElementById(id);
let scope;
let journal;
let saving = false;
const localDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const trainingToday = () => {
  const zone = journal?.snapshot?.plan?.profile?.timezone;
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const value = (kind) => parts.find((part) => part.type === kind).value;
      return `${value('year')}-${value('month')}-${value('day')}`;
    } catch {
      /* Older snapshots without a valid zone use the device date. */
    }
  }
  return localDay(new Date());
};
const report = (message) => {
  element('status').textContent = message;
};
function pending() {
  const container = element('pending');
  container.replaceChildren();
  for (const entry of journal.pending) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${entry.body.action} · ${new Date(entry.createdAt).toLocaleString()} · ${entry.status === 'review' ? 'Review when online' : 'Waiting to sync'}`;
    const content = document.createElement('p');
    const run = entry.body.run ?? entry.body.feedback ?? {};
    content.textContent = `${run.date ?? run.actualDate ?? ''} · ${run.minutes ?? run.actualMinutes ?? ''} min · ${run.km ?? run.actualKm ?? 'Unknown distance'} km · Effort ${run.effort ?? ''}/10. ${run.note ?? ''}`;
    details.append(summary, content);
    container.append(details);
  }
  if (!journal.pending.length) container.textContent = 'No pending entries.';
}
function schedule() {
  const start = element('week').value;
  const end = new Date(`${start}T12:00:00`);
  end.setDate(end.getDate() + 7);
  const runs = (journal.snapshot?.plan?.workouts ?? []).filter(
    (run) => run.date >= start && run.date < localDay(end),
  );
  const container = element('runs');
  container.replaceChildren();
  for (const run of runs) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = `${run.date} · ${run.title ?? run.kind}`;
    const body = document.createElement('p');
    body.textContent = `${run.estimatedKm ?? ''} km · ${run.minutes ?? ''} min · ${run.status ?? 'planned'}`;
    const steps = document.createElement('p');
    steps.textContent = (run.steps ?? [])
      .map(
        (step) =>
          `${step.label}: ${step.metres ? `${step.metres} m` : step.seconds % 60 === 0 ? `${step.seconds / 60} min` : `${Math.floor(step.seconds / 60)}m ${step.seconds % 60}s`} · ${step.effort}`,
      )
      .join(' / ');
    article.append(heading, body, steps);
    container.append(article);
  }
  if (!runs.length)
    container.textContent = 'No saved runs scheduled in this week.';
}
try {
  journal = await deviceJournal();
  if (!journal?.enabled || !journal.snapshot)
    report(
      'No offline plan is available. Connect to the internet and enable Offline access in Settings on this device.',
    );
  else {
    scope = journal.scope;
    report('An offline copy is available on this device.');
    element('unlock').hidden = false;
  }
} catch (error) {
  report(error.message);
}
element('open').onclick = () => {
  element('unlock').hidden = true;
  element('journal').hidden = false;
  report('Offline · changes remain local until Stride confirms a sync.');
  element('saved').textContent =
    `Plan last saved ${new Date(journal.savedAt).toLocaleString()}. This copy may be out of date.`;
  element('week').value = trainingToday();
  element('log').elements.date.value = trainingToday();
  if (journal.offlineDraft)
    for (const [key, value] of Object.entries(journal.offlineDraft)) {
      if (element('log').elements.namedItem(key))
        element('log').elements.namedItem(key).value = value;
    }
  schedule();
  pending();
};
element('week').onchange = schedule;
element('erase').onclick = async () => {
  if (
    !confirm(
      'Erase the offline plan and all unsynced entries on this device? This cannot be undone.',
    )
  )
    return;
  try {
    await deviceJournal((current) => {
      if (current?.scope !== scope)
        throw new Error(
          'The local account changed. Reconnect before erasing this device’s copy.',
        );
      return null;
    });
    element('unlock').hidden = true;
    report('Local journal erased.');
  } catch (error) {
    report(error.message);
  }
};
element('log').onsubmit = async (event) => {
  event.preventDefault();
  if (saving) return;
  const form = element('log');
  const values = new FormData(form);
  const field = (name) => {
    const value = values.get(name);
    return typeof value === 'string' ? value : '';
  };
  const minutes = Number(values.get('minutes'));
  const km = values.get('km') === '' ? null : Number(values.get('km'));
  const effort = Number(values.get('effort'));
  const date = field('date');
  const feeling = field('feeling');
  if (
    !Number.isFinite(minutes) ||
    minutes < 1 ||
    minutes > 4320 ||
    (km !== null &&
      (!Number.isFinite(km) ||
        km <= 0 ||
        km > 250 ||
        km / (minutes / 60) > 45)) ||
    !Number.isInteger(effort) ||
    effort < 1 ||
    effort > 10 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(new Date(`${date}T12:00:00Z`).getTime()) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
    date > trainingToday() ||
    !['good', 'okay', 'tired'].includes(feeling)
  ) {
    element('result').textContent =
      'Check the duration, distance, date and effort. This entry has not been saved.';
    return;
  }
  const id = crypto.randomUUID();
  saving = true;
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    journal = await deviceJournal((current) => {
      if (current?.scope !== scope || !current.enabled)
        throw new Error(
          'The local account changed. Reconnect before adding a run.',
        );
      if (current.pending.length >= 100)
        throw new Error('Sync your pending entries before adding more.');
      return {
        ...current,
        offlineDraft: undefined,
        pending: [
          ...current.pending,
          {
            id,
            createdAt: new Date().toISOString(),
            status: 'pending',
            body: {
              action: 'freeRun',
              version: current.snapshot.version,
              mutationId: id,
              run: {
                date,
                minutes,
                km,
                effort,
                feeling,
                note: field('note'),
                source: 'Manual',
              },
            },
          },
        ],
      };
    });
    element('result').textContent =
      'Run saved on this device. Reopen Stride online to sync.';
    form.reset();
    form.elements.date.value = trainingToday();
    pending();
  } catch (error) {
    element('result').textContent = error.message;
  } finally {
    saving = false;
    form.querySelector('button[type="submit"]').disabled = false;
  }
};
element('log').oninput = async () => {
  if (saving) return;
  const draft = Object.fromEntries(new FormData(element('log')).entries());
  try {
    await deviceJournal((current) => {
      if (current?.scope !== scope || !current.enabled)
        throw new Error(
          'The local account changed. Reconnect before editing this entry.',
        );
      return { ...current, offlineDraft: draft };
    });
  } catch (error) {
    element('result').textContent =
      `Draft could not be stored: ${error.message}`;
  }
};
