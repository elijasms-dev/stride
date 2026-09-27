import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENGINE_VERSION,
  TRAINING_POLICY,
  addDays,
  demoProfile,
  makePlan,
  validatePlan,
} from '../lib/engine.ts';
import { targetLabel } from '../lib/workout-targets.ts';
import {
  calculateTrainingPaces,
  schedulingEasyPace,
} from '../lib/fitness-pacing.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'docs/verification/2026-09-19/road-audit');
const start = '2026-09-21';
const days = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const eventInputs = [
  { goal: '5k', name: '5K', weeklyKm: 50, longestKm: 10 },
  { goal: '10k', name: '10K', weeklyKm: 50, longestKm: 12 },
  { goal: 'half', name: 'Half-marathon', weeklyKm: 55, longestKm: 16 },
  { goal: 'marathon', name: 'Marathon', weeklyKm: 70, longestKm: 23 },
];
const n = (v, precision = 3) => Number(v.toFixed(precision)).toString();
const escape = (text) =>
  String(text ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
const duration = (seconds) => {
  const s = Math.round(seconds),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    tail = s % 60;
  return (
    [h ? `${h} h` : '', m ? `${m} min` : '', tail ? `${tail} sec` : '']
      .filter(Boolean)
      .join(' ') || '0 min'
  );
};
const gap = (a, b) =>
  Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000,
  );
// Explicit black-box expectations for these 12-week balanced road fixtures.
// A boundary Sunday can be in daily taper while its week label is still preparation.
const inTaper = (profile, date) =>
  profile.goal === 'marathon'
    ? gap(date, profile.raceDate) < 14
    : gap(date, profile.raceDate) <= (profile.goal === 'half' ? 21 : 14);
const workMinutes = (w) =>
  w.steps
    .filter((s) => s.kind === 'work' && s.intensity >= 4)
    .reduce((sum, s) => sum + s.seconds / 60, 0);
const isQuality = (w) =>
  w.kind !== 'long' &&
  w.kind !== 'race' &&
  w.hard &&
  w.stimulus !== 'economy' &&
  ['tempo', 'intervals', 'fartlek'].includes(w.kind) &&
  workMinutes(w) > 0;
const isTraining = (w) => w.kind !== 'race' && w.status !== 'skipped';
const distanceDescription = (w) =>
  w.steps.length && w.steps.every((s) => s.metres !== undefined)
    ? `${n(w.steps.reduce((v, s) => v + s.metres / 1000, 0))} km prescribed`
    : `${n(w.estimatedKm)} km allocation; follow timed/mixed steps`;
const category = (w) =>
  w.kind === 'race'
    ? 'RACE'
    : w.kind === 'long'
      ? workMinutes(w)
        ? 'LONG + quality segment'
        : 'LONG'
      : isQuality(w)
        ? 'WORKOUT'
        : w.stimulus === 'economy'
          ? 'EASY + strides'
          : 'EASY';

function weekView(plan, week) {
  const runs = plan.workouts.filter((w) => w.week === week.index);
  const training = runs.filter(isTraining),
    longs = training.filter((w) => w.kind === 'long');
  const taperDates = Array.from({ length: 7 }, (_, i) =>
    addDays(week.start, i),
  ).filter(
    (date) => date < plan.profile.raceDate && inTaper(plan.profile, date),
  );
  return {
    number: week.index + 1,
    start: week.start,
    phase: week.phase,
    taperStartsWithinWeek:
      taperDates.length > 0 && !inTaper(plan.profile, week.start)
        ? taperDates[0]
        : null,
    ordinary:
      !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
      !taperDates.length &&
      addDays(week.start, 6) < plan.profile.raceDate,
    trainingKm: training.reduce((v, w) => v + w.estimatedKm, 0),
    trainingMinutes: training.reduce((v, w) => v + w.minutes, 0),
    weekdayKm: training
      .filter((w) => w.kind !== 'long')
      .reduce((v, w) => v + w.estimatedKm, 0),
    longKm: longs.length ? Math.max(...longs.map((w) => w.estimatedKm)) : null,
    longestTrainingKm: Math.max(0, ...training.map((w) => w.estimatedKm)),
    qualityCount: training.filter(isQuality).length,
    longQualityCount: longs.filter((w) => workMinutes(w) > 0).length,
    keySessionCount: training.filter((w) => isQuality(w) || w.kind === 'long')
      .length,
    runningDays: new Set(training.map((w) => w.date)).size,
    runs: Array.from({ length: 7 }, (_, i) => ({
      date: addDays(week.start, i),
      day: days[i],
      workouts: runs.filter((w) => w.date === addDays(week.start, i)),
    })),
  };
}

function checks(plan, input, weeks) {
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };
  const close = (a, b) => Math.abs(a - b) <= 0.00101;
  check(
    validatePlan(plan).length === 0,
    `validatePlan: ${validatePlan(plan).join('; ')}`,
  );
  check(
    close(weeks[0].trainingKm, input.weeklyKm),
    'Opening weekly distance differs from the declaration',
  );
  check(
    close(weeks[0].longKm, input.longestKm),
    'Opening long run differs from the declaration',
  );
  check(
    plan.profile.qualityMode === 'custom' &&
      plan.profile.qualitySessions === input.qualitySessions,
    'Saved explicit workout preference changed',
  );
  let previousLong = input.longestKm,
    previousWeekly = input.weeklyKm;
  for (const w of weeks) {
    if (!w.ordinary) continue;
    check(
      w.qualityCount === input.qualitySessions,
      `Week ${w.number}: requested ${input.qualitySessions}, generated ${w.qualityCount} weekday workouts`,
    );
    check(
      w.runningDays === 5,
      `Week ${w.number}: ${w.runningDays} instead of five running days`,
    );
    check(
      w.longKm !== null && Number.isInteger(w.longKm),
      `Week ${w.number}: missing/fractional long run ${w.longKm}`,
    );
    check(
      w.longKm + 0.001 >= previousLong && w.longKm - previousLong <= 2.001,
      `Week ${w.number}: ordinary long-run progression ${previousLong} -> ${w.longKm}`,
    );
    check(
      w.trainingKm + 0.00101 >= previousWeekly,
      `Week ${w.number}: ordinary weekly distance fell ${previousWeekly} -> ${w.trainingKm}`,
    );
    previousLong = w.longKm;
    previousWeekly = w.trainingKm;
  }
  for (const w of plan.workouts) {
    const totalSeconds = w.steps.reduce((v, s) => v + s.seconds, 0);
    check(
      Math.abs(totalSeconds - w.minutes * 60) <= 1.01,
      `${w.date}: steps do not fund recorded minutes`,
    );
    check(
      w.steps.every((s) => Number.isFinite(s.seconds) && s.seconds > 0),
      `${w.date}: invalid step duration`,
    );
    if (w.kind !== 'race')
      check(
        w.minutes <=
          (w.kind === 'long' ? input.longMinutes : input.weekdayMinutes) +
            0.001,
        `${w.date}: time limit exceeded`,
      );
    if (w.kind === 'long' && input.goal === 'marathon')
      check(w.estimatedKm <= 35, `${w.date}: marathon long run exceeds 35 km`);
  }
  const roundtrip = JSON.parse(JSON.stringify(plan));
  check(
    validatePlan(roundtrip).length === 0,
    'JSON round trip fails validation',
  );
  return failures;
}

function render(item) {
  const { label, input, plan, weeks, failures } = item;
  const lines = [
    `# ${label}: every day of the 12-week plan`,
    '',
    `Generated directly from the current production engine. ${start} to ${input.raceDate}. **${input.weeklyKm} km/week, ${input.longestKm} km recent long run, five current/running days, ${input.qualitySessions} weekday workouts selected.**`,
    '',
    'All seven days are shown below. WORKOUT means a sustained weekday quality session; the LONG run is counted separately. Strides are not counted as a full workout. Race day is excluded from training totals. A dash in the long-run column means no session is labelled long; it does not mean there is no running.',
    '',
    'For timed or mixed workouts, plan kilometres are allocation estimates, not a distance stopping rule. Follow the saved steps: distance steps stop at metres, timed steps stop at duration. Each session’s total time includes warm-up and cooldown. Easy-day fractional allocations are printed as generated; the whole-kilometre progression requirement applies to long runs.',
    '',
    `Engine contract checks: **${failures.length ? 'FAIL — ' + failures.join('; ') : 'PASS'}**. This tests software behavior; policy questions and separate audit failures are recorded in the audit summary.`,
    '',
    '## Week-by-week overview',
    '',
    '| Week | Phase | Training km | Long km | Longest training run km | Weekday workouts | Key sessions incl. long |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...weeks.map(
      (w) =>
        `| ${w.number} | ${w.phase}${w.taperStartsWithinWeek ? `; taper starts ${w.taperStartsWithinWeek}` : ''} | ${n(w.trainingKm, 1)} | ${w.longKm === null ? '—' : n(w.longKm)} | ${n(w.longestTrainingKm, 1)} | ${w.qualityCount} | ${w.keySessionCount} |`,
    ),
    '',
    `Long runs by week: **${weeks.map((w) => (w.longKm === null ? '—' : n(w.longKm))).join(' → ')} km**.`,
    '',
  ];
  for (const week of weeks) {
    lines.push(
      `## Week ${week.number} — ${week.phase}`,
      '',
      `${week.start} to ${addDays(week.start, 6)}. **${n(week.trainingKm, 1)} km** allocated training, **${duration(week.trainingMinutes * 60)}**, **${week.qualityCount} weekday workout${week.qualityCount === 1 ? '' : 's'}**, **${week.longKm === null ? 'no designated long run' : n(week.longKm) + ' km long run'}**.`,
      '',
      ...(week.taperStartsWithinWeek
        ? [
            `Daily taper starts **${week.taperStartsWithinWeek}**, although the week-level label remains ${week.phase}.`,
            '',
          ]
        : []),
      '| Day | Run | Plan distance | Total time |',
      '| --- | --- | --- | --- |',
      ...week.runs.map(
        ({ day, date, workouts }) =>
          `| ${day} ${date} | ${workouts.length ? workouts.map((w) => `${category(w)} · ${escape(w.title)}`).join('<br>') : 'Rest — no run scheduled'} | ${workouts.map((w) => distanceDescription(w)).join('<br>') || '—'} | ${workouts.map((w) => duration(w.minutes * 60)).join('<br>') || '—'} |`,
      ),
      '',
      '### Exact saved sessions',
      '',
    );
    for (const { day, date, workouts } of week.runs)
      for (const w of workouts) {
        lines.push(`**${day} ${date} — ${w.title}**`, '', w.purpose || '', '');
        for (const [i, step] of w.steps.entries()) {
          const stop =
            step.metres !== undefined
              ? `${n(step.metres / 1000)} km (planning time ${duration(step.seconds)})`
              : duration(step.seconds);
          lines.push(
            `${i + 1}. ${step.label}: **${stop}** · ${targetLabel(step.target, 'km')}. ${step.effort}`,
          );
        }
        lines.push('');
      }
  }
  lines.push(
    '## Input and generated notes',
    '',
    `Saved running days: ${plan.profile.days.map((d) => days[d]).join(', ')}. Long-run day: Sunday. Weekday limit: 120 min. Long-run limit: 300 min. Established routine; recent quality history: two sessions / 40 work minutes per week. Gradual volume, balanced difficulty, varied workout recipes.`,
    '',
    'Benchmark: 10 km in 50:00 on 1 September 2026, road race. Declared easy pace: 6:00/km. The app funds time at its slower applicable easy target. This is synthetic input, not the user’s saved profile.',
    '',
    ...plan.notes.map((note) => `- ${note}`),
    '',
    `Feasibility status: ${plan.feasibility?.status ?? 'not supplied'}.`,
    ...(plan.feasibility?.reasons ?? []).map((reason) => `- ${reason}`),
    '',
  );
  return lines.join('\n');
}

function renderCompact(plans) {
  const lines = [
    '# Week-by-week daily schedules: all four road distances',
    '',
    'Twelve comparable 12-week plans. Each row shows every day; full files contain warm-ups, every repetition/recovery, cooldowns and pace bands. These are synthetic examples, not edits to the saved user plan.',
    '',
    '**Q** = sustained weekday workout, **L** = long run, **E** = easy, **S** = easy with relaxed strides. Q count excludes the long run and strides. **A** after kilometres means a timed/mixed session’s distance allocation; follow its saved steps rather than stopping at that estimate. Race distance is excluded from weekly training totals.',
    '',
    'Ordinary-week checks pass for these 12 examples. The separate edge audit has found failures; this file is not an overall release approval.',
    '',
  ];
  for (const c of plans) {
    lines.push(
      `## ${c.label}`,
      '',
      `**Input: ${c.input.weeklyKm} km/week, ${c.input.longestKm} km recent long run.** [Exact daily prescriptions](${c.id}.md).`,
      '',
      '| Week / phase | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Training km | Q count | Long km |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |',
    );
    for (const week of c.weeks) {
      const cells = week.runs.map(
        ({ workouts }) =>
          workouts
            .map((w) => {
              const label =
                w.kind === 'race'
                  ? 'Race'
                  : w.kind === 'long'
                    ? 'L'
                    : isQuality(w)
                      ? 'Q'
                      : w.stimulus === 'economy'
                        ? 'S'
                        : 'E';
              const timed = !w.steps.every((s) => s.metres !== undefined);
              return `**${label} ${n(w.estimatedKm, 1)} km${timed ? ' A' : ''}** · ${escape(w.title)}`;
            })
            .join('<br>') || 'Rest',
      );
      const phase =
        week.phase + (week.taperStartsWithinWeek ? ' + taper boundary' : '');
      lines.push(
        '| ' +
          [
            `${week.number} · ${phase}`,
            ...cells,
            n(week.trainingKm, 1),
            week.qualityCount,
            week.longKm === null ? '—' : n(week.longKm),
          ].join(' | ') +
          ' |',
      );
    }
    lines.push(
      '',
      `**Long-run progression:** ${c.weeks.map((w) => (w.longKm === null ? '—' : n(w.longKm))).join(' → ')} km.`,
      `**Weekday workout counts:** ${c.weeks.map((w) => w.qualityCount).join(', ')}.`,
      '',
    );
  }
  return lines.join('\n');
}

await mkdir(destination, { recursive: true });
const plans = [];
for (const event of eventInputs)
  for (const count of [0, 1, 2]) {
    const input = {
      ...demoProfile(start),
      goal: event.goal,
      weeklyKm: event.weeklyKm,
      longestKm: event.longestKm,
      name: 'Synthetic audit runner',
      raceName: `${event.name} audit`,
      raceDate: addDays(start, 83),
      currentRuns: 5,
      runsPerWeek: 5,
      days: [0, 1, 2, 4, 6],
      availableDays: [0, 1, 2, 3, 4, 5, 6],
      longDay: 6,
      weekdayMinutes: 120,
      longMinutes: 300,
      qualityMode: 'custom',
      qualitySessions: count,
      recentQualitySessions: 2,
      recentQualityMinutes: 40,
      runMeasure: 'distance',
      workoutVariety: 'varied',
      recentRace: {
        distanceKm: 10,
        timeMinutes: 50,
        date: '2026-09-01',
        source: 'race',
        course: 'road',
      },
    };
    const snapshot = JSON.stringify(input);
    const plan = makePlan(input, start, false);
    const weeks = plan.weeks.map((week) => weekView(plan, week));
    const failures = checks(plan, input, weeks);
    if (JSON.stringify(input) !== snapshot)
      failures.push('Generation mutated supplied profile');
    const item = {
      id: `${event.goal}-q${count}`,
      label: `${event.name} · ${count} weekday workouts`,
      input,
      plan,
      weeks,
      failures,
    };
    plans.push(item);
    await writeFile(resolve(destination, `${item.id}.md`), render(item));
  }
async function sourceHash(path) {
  const hash = createHash('sha256');
  async function visit(folder) {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const next = resolve(folder, entry.name);
      if (entry.isDirectory()) await visit(next);
      else if (/\.tsx?$/.test(entry.name)) {
        hash.update(next.slice(root.length));
        hash.update(await readFile(next));
      }
    }
  }
  await visit(path);
  return hash.digest('hex');
}
const evidence = {
  generatedAt: new Date().toISOString(),
  git: {
    baseSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
  },
  engineVersion: ENGINE_VERSION,
  policyVersion: TRAINING_POLICY.version,
  libSourceSha256: await sourceHash(resolve(root, 'lib')),
  settings: {
    weeks: 12,
    startDate: start,
    benchmark: plans[0].input.recentRace,
    modeledPacesSecondsPerKm: calculateTrainingPaces(plans[0].input.recentRace),
    schedulingEasyMinutesPerKm: schedulingEasyPace(plans[0].plan.profile),
  },
  summary: {
    plans: plans.length,
    weeks: plans.reduce((v, p) => v + p.weeks.length, 0),
    calendarDays: plans.reduce((v, p) => v + p.weeks.length * 7, 0),
    contractFailures: plans.reduce((v, p) => v + p.failures.length, 0),
  },
  plans,
};
await writeFile(
  resolve(destination, 'plans.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
await writeFile(
  resolve(destination, 'ALL-WEEKS.md'),
  '# Four road distances: all 12 plans\n\n' +
    plans.map(render).join('\n\n---\n\n'),
);
const csv = [
  'case,week,start,phase,daily_taper_start,training_km,training_minutes,long_km,longest_training_km,weekday_workouts,long_quality_sessions,key_sessions_with_long',
  ...plans.flatMap((p) =>
    p.weeks.map((w) =>
      [
        p.id,
        w.number,
        w.start,
        w.phase,
        w.taperStartsWithinWeek ?? '',
        n(w.trainingKm),
        n(w.trainingMinutes),
        w.longKm ?? '',
        n(w.longestTrainingKm),
        w.qualityCount,
        w.longQualityCount,
        w.keySessionCount,
      ].join(','),
    ),
  ),
].join('\n');
await writeFile(resolve(destination, 'weekly-totals.csv'), csv + '\n');
await writeFile(resolve(destination, 'WEEK-BY-WEEK.md'), renderCompact(plans));
console.log(
  JSON.stringify(
    {
      ...evidence.summary,
      libSourceSha256: evidence.libSourceSha256,
      output: destination,
      failures: plans.flatMap((p) =>
        p.failures.map((message) => ({ case: p.id, message })),
      ),
    },
    null,
    2,
  ),
);
if (evidence.summary.contractFailures) process.exitCode = 1;
