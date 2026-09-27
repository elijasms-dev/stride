/** Deterministic, read-only road generation audit. Uses production makePlan;
 * independent arithmetic checks do not call its allocation/validation helpers.
 * Run: node --experimental-strip-types scripts/audit-road-boundaries.mjs
 * Replay one input: add --case CASE_ID. No account data or network is accessed. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  makePlan,
  validatePlan,
  ENGINE_VERSION,
  TRAINING_POLICY,
} from '../lib/engine.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const start = '2026-09-21';
const plus = (date, days) =>
  new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000)
    .toISOString()
    .slice(0, 10);
const gap = (a, b) =>
  Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000,
  );
const day = (date) => (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7;
const fixed = (n) => Math.round(n * 1000) / 1000;
const eventDistances = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 };
const comfortable = {
  '5k': [50, 12],
  '10k': [50, 14],
  half: [60, 18],
  marathon: [70, 23],
};
const schedules = {
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 4, 6],
  5: [0, 1, 2, 4, 6],
  6: [0, 1, 2, 3, 4, 6],
};
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
function base(goal, count) {
  const [weeklyKm, longestKm] = comfortable[goal];
  return {
    name: 'Synthetic road boundary runner',
    goal,
    raceName: `Synthetic ${goal} audit`,
    startDate: start,
    raceDate: plus(start, 83),
    weeklyKm,
    longestKm,
    currentRuns: 5,
    runsPerWeek: 5,
    days: schedules[5],
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    longDay: 6,
    weekdayMinutes: 120,
    longMinutes: 300,
    experience: 'established',
    difficulty: 'balanced',
    intent: 'improve',
    volume: 'gradual',
    timezone: 'Europe/Dublin',
    units: 'km',
    easyPace: 6,
    qualityMode: 'custom',
    qualitySessions: count,
    recentQualitySessions: count,
    recentQualityMinutes: count ? count * 20 : 0,
    runMeasure: 'distance',
    workoutVariety: 'varied',
  };
}
/** Input contradictions against explicit published product choices, not a claim
 * that every controlled rejection is the right coaching or product decision. */
function knownInputConflicts(p) {
  const reasons = [];
  // Literal copies of the reviewed named-event entry table. The checks use the
  // requested input, not a production error message or validation result.
  const [minWeekly, minLong, minRuns, maxWeekly] = {
    '5k': [10, 3, 2, 80],
    '10k': [18, 5, 2, 100],
    half: [24, 8, 3, 80],
    marathon: [32, 12, 4, 150],
  }[p.goal];
  if (
    p.weeklyKm < minWeekly ||
    p.longestKm < minLong ||
    p.currentRuns < minRuns ||
    p.experience === 'new'
  )
    reasons.push(
      `named-event entry requires ${minWeekly} km/week, ${minLong} km recent long run, ${minRuns} current running days and a non-new routine`,
    );
  if (p.weeklyKm > maxWeekly)
    reasons.push(
      `declared weekly distance exceeds the named-event ${maxWeekly} km policy ceiling`,
    );
  if (
    p.goal === 'marathon' &&
    p.weeklyKm > 100 &&
    (p.experience !== 'established' ||
      p.currentRuns < 6 ||
      p.runsPerWeek < 6 ||
      p.longestKm < 24)
  )
    reasons.push(
      'above 100 km the marathon model requires an established six-day routine and 24 km recent long run',
    );
  if (p.longestKm > p.weeklyKm && p.weeklyKm > 0)
    reasons.push('declared longest run exceeds declared weekly distance');
  if (p.runsPerWeek === 2 && p.qualitySessions > 0)
    reasons.push(
      'requested workouts conflict with the two-day easy-only model',
    );
  if (
    p.qualitySessions === 2 &&
    (p.runsPerWeek < 5 ||
      p.currentRuns < 5 ||
      p.weeklyKm < 45 ||
      p.experience !== 'established' ||
      p.recentQualitySessions < 2)
  )
    reasons.push(
      'explicit two-workout choice lacks the existing five-day/45km/established/two-workout prerequisites',
    );
  if (p.runsPerWeek > p.availableDays.length)
    reasons.push('requested running days exceed available days');
  if (!p.availableDays.includes(p.longDay))
    reasons.push('long-run day is unavailable');
  if (p.currentRuns > 0 && p.runsPerWeek > p.currentRuns + 1)
    reasons.push('more than one additional running day requested');
  if (p.easyPace < 3 || p.easyPace > 15)
    reasons.push('easy pace is outside the existing 3–15 min/km input range');
  if (
    p.weekdayMinutes < 20 ||
    p.weekdayMinutes > 120 ||
    p.longMinutes < 30 ||
    p.longMinutes > 300
  )
    reasons.push(
      'time input is outside the weekday 20–120 / long-run 30–300 minute input ranges',
    );
  const crossDays = p.crossTraining?.map((s) => s.day) ?? [];
  if (crossDays.includes(p.longDay))
    reasons.push('cross-training conflicts with the requested long-run day');
  if (
    p.runsPerWeek > p.availableDays.filter((d) => !crossDays.includes(d)).length
  )
    reasons.push(
      'reserved cross-training leaves too few available running days',
    );
  return reasons;
}
export function roadBoundaryCases() {
  const cases = [],
    seen = new Set();
  const add = (goal, count, axis, label, patch = {}) => {
    const profile = { ...base(goal, count), ...patch };
    const key = JSON.stringify(canonical(profile));
    if (seen.has(key)) return;
    seen.add(key);
    cases.push({
      id: `${goal}-q${count}-${axis}-${label}`,
      axis,
      profile,
      knownInputConflicts: knownInputConflicts(profile),
    });
  };
  for (const goal of Object.keys(eventDistances))
    for (const count of [0, 1, 2]) {
      add(goal, count, 'reference', '12weeks');
      for (const [weeklyKm, longestKm] of [
        [0, 0],
        [8, 2],
        [15, 5],
        [30, 10],
        [30, 20],
        [30.5, 10.7],
        [45, 16],
        [60, 20],
        [90, 28],
      ])
        for (const runsPerWeek of [2, 3, 4, 5, 6])
          add(
            goal,
            count,
            'baseline',
            `${weeklyKm}-${longestKm}-${runsPerWeek}days`,
            {
              weeklyKm,
              longestKm,
              currentRuns: runsPerWeek,
              runsPerWeek,
              days: schedules[runsPerWeek],
            },
          );
      for (const [label, patch] of [
        ['weekday10', { weekdayMinutes: 10 }],
        ['weekday20', { weekdayMinutes: 20 }],
        ['weekday30', { weekdayMinutes: 30 }],
        ['weekday45', { weekdayMinutes: 45 }],
        ['weekday240', { weekdayMinutes: 240 }],
        ['long20', { longMinutes: 20 }],
        ['long60', { longMinutes: 60 }],
        ['long90', { longMinutes: 90 }],
        ['long150', { longMinutes: 150 }],
        ['weekly150', { weeklyMinutesLimit: 150 }],
        ['weekly480', { weeklyMinutesLimit: 480 }],
        ['quality1km', { qualityLimitKm: 1 }],
        ['quality5km', { qualityLimitKm: 5 }],
        ['long10km', { longLimitKm: 10 }],
      ])
        add(goal, count, 'limit', label, patch);
      for (const days of [1, 7, 14, 28, 42, 56, 112, 168, 364])
        add(goal, count, 'timeline', `${days}days`, {
          raceDate: plus(start, days - 1),
        });
      for (const easyPace of [3, 4.5, 6, 8, 10, 12, 15, 20])
        for (const runMeasure of ['distance', 'time'])
          add(goal, count, 'pace', `${easyPace}-${runMeasure}`, {
            easyPace,
            runMeasure,
          });
      for (const weeks of [4, 12, 20])
        for (let weekday = 0; weekday < 7; weekday++)
          add(goal, count, 'raceweekday', `${weeks}weeks-${weekday}`, {
            raceDate: plus(start, weeks * 7 - 7 + weekday),
          });
      for (const longestKm of [0, 0.5, 3.2, 10.7, 16.5, 20, 23, 35, 36])
        add(goal, count, 'longanchor', `${longestKm}km`, { longestKm });
      for (const [label, patch] of [
        ['returning', { experience: 'returning' }],
        ['new-positive', { experience: 'new' }],
        [
          'new-zero',
          {
            experience: 'new',
            weeklyKm: 0,
            longestKm: 0,
            currentRuns: 0,
            runsPerWeek: 3,
            days: schedules[3],
          },
        ],
        [
          'returning-half-history',
          {
            experience: 'returning',
            weeklyKm: 30,
            longestKm: 20,
            currentRuns: 4,
            runsPerWeek: 4,
            days: schedules[4],
          },
        ],
        ['gentle', { difficulty: 'gentle' }],
        ['finish', { intent: 'finish' }],
      ])
        add(goal, count, 'experience', label, patch);
      add(goal, count, 'availability', 'weekdays-tuesday-long', {
        availableDays: [0, 1, 2, 3, 4],
        days: [0, 1, 2, 3, 4],
        longDay: 1,
      });
      add(goal, count, 'availability', 'saturday-long', { longDay: 5 });
      for (const [label, patch] of [
        [
          'consecutive-three',
          {
            currentRuns: 3,
            runsPerWeek: 3,
            days: [0, 1, 2],
            availableDays: [0, 1, 2],
            longDay: 2,
          },
        ],
        [
          'separated-three',
          {
            currentRuns: 3,
            runsPerWeek: 3,
            days: [0, 2, 5],
            availableDays: [0, 2, 5],
            longDay: 5,
          },
        ],
        [
          'compressed-five-preferred-hard',
          {
            days: [0, 1, 2, 3, 4],
            availableDays: [0, 1, 2, 3, 4],
            longDay: 4,
            preferredHardDays: [1, 3],
          },
        ],
        [
          'preferred-hard-day-caps',
          {
            preferredHardDays: [1, 3],
            dayPreferences: [
              { day: 1, maxMinutes: 20 },
              { day: 3, maxMinutes: 20 },
            ],
          },
        ],
        [
          'cross-training-long-conflict',
          { crossTraining: [{ day: 6, activity: 'cycling', minutes: 30 }] },
        ],
      ])
        add(goal, count, 'schedule', label, patch);
    }
  if (cases.length > 1500)
    throw new Error(`Audit bounded at 1500 inputs, received ${cases.length}`);
  return cases;
}
// Independent interpretation of the current documented race-relative taper:
// short roads <=14 days, half <=21, marathon <14 for <=12-week blocks, otherwise <21.
function inTaper(p, date) {
  const left = gap(date, p.raceDate);
  if (p.goal === 'marathon')
    return left < (gap(p.startDate, p.raceDate) + 1 <= 84 ? 14 : 21);
  return left <= (p.goal === 'half' ? 21 : 14);
}
function qualityMinutes(w) {
  if (w.stimulus === 'aerobic') return 0;
  return w.steps
    .filter((s) => s.kind === 'work' && s.intensity >= 4)
    .reduce((n, s) => n + s.seconds / 60, 0);
}
function inspect(item, p) {
  const failures = [],
    exceptions = [];
  const fail = (code, detail) => failures.push({ code, detail });
  const close = (a, b) => Math.abs(a - b) <= 0.00101;
  const full = (week) =>
    week.start >= p.profile.startDate &&
    plus(week.start, 6) < p.profile.raceDate;
  const ordinary = (week) =>
    full(week) &&
    !['Recovery', 'Taper', 'Race week'].includes(week.phase) &&
    !inTaper(p.profile, plus(week.start, 6));
  if (JSON.stringify(item.profile) !== item.inputSnapshot)
    fail('input-mutated', 'makePlan mutated the supplied profile');
  if (
    p.profile.qualityMode !== 'custom' ||
    p.profile.qualitySessions !== item.profile.qualitySessions
  )
    fail(
      'explicit-setting-changed',
      `Requested ${item.profile.qualitySessions}; saved ${p.profile.qualitySessions} (${p.profile.qualityMode})`,
    );
  if (
    !close(p.profile.weeklyKm, item.profile.weeklyKm) ||
    !close(p.profile.longestKm, item.profile.longestKm)
  )
    fail(
      'declared-baseline-changed',
      'Saved declared weekly or longest distance differs from input',
    );
  const recovered = JSON.parse(JSON.stringify(p));
  if (JSON.stringify(recovered) !== JSON.stringify(p))
    fail('serialization', 'Plan does not survive JSON serialization');
  const finite = (v, path = 'plan') => {
    if (typeof v === 'number' && !Number.isFinite(v))
      fail('nonfinite-number', path);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) finite(x, `${path}.${k}`);
  };
  finite(p);
  const ids = new Set(),
    dates = new Set();
  for (const w of p.workouts) {
    if (ids.has(w.id)) fail('duplicate-id', w.id);
    ids.add(w.id);
    if (w.date < p.profile.startDate || w.date > p.profile.raceDate)
      fail('out-of-range-date', `${w.id}: ${w.date}`);
    if (w.kind === 'race') continue;
    if (dates.has(w.date)) fail('duplicate-running-day', w.date);
    dates.add(w.date);
    if (
      w.minutes <= 0 ||
      w.estimatedKm <= 0 ||
      w.steps.some((s) => s.seconds <= 0)
    )
      fail('nonpositive-prescription', w.id);
    if (
      Math.abs(w.steps.reduce((n, s) => n + s.seconds, 0) - w.minutes * 60) >
      1.01
    )
      fail('step-total-mismatch', w.id);
    const d = day(w.date),
      cap =
        p.profile.dayPreferences?.find((x) => x.day === d)?.maxMinutes ??
        (d === p.profile.longDay
          ? p.profile.longMinutes
          : p.profile.weekdayMinutes);
    if (w.minutes > cap + 1 / 60 + 0.001)
      fail('session-time-cap', `${w.date}: ${fixed(w.minutes)} > ${cap}`);
    if (!p.profile.days.includes(d)) fail('unexpected-running-day', w.date);
  }
  const races = p.workouts.filter((w) => w.kind === 'race');
  if (
    races.length !== 1 ||
    races[0]?.date !== item.profile.raceDate ||
    !close(races[0]?.estimatedKm ?? 0, eventDistances[item.profile.goal])
  )
    fail('race-contract', 'Race date/count/distance differs from request');
  const demanding = p.workouts
    .filter((w) => w.kind !== 'race' && (w.hard || w.kind === 'long'))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < demanding.length; i++)
    if (gap(demanding[i - 1].date, demanding[i].date) < 2)
      fail(
        'demanding-spacing',
        `${demanding[i - 1].date} → ${demanding[i].date}: no easy/rest day between demanding runs`,
      );
  let priorLong, priorKm;
  const weeks = p.weeks.map((week) => {
    const runs = p.workouts.filter(
      (w) => w.week === week.index && w.kind !== 'race',
    );
    const km = runs.reduce((n, w) => n + w.estimatedKm, 0),
      minutes = runs.reduce((n, w) => n + w.minutes, 0);
    const long = runs.find((w) => w.kind === 'long');
    const quality = runs.filter(
      (w) => w.kind !== 'long' && w.hard && qualityMinutes(w) > 0,
    );
    const isOrdinary = ordinary(week);
    const introductory =
      runs.some((w) =>
        w.steps.some((s) => s.movement === 'walk' && s.kind !== 'recovery'),
      ) ||
      (p.profile.experience !== 'established' &&
        week.phase === 'Foundation' &&
        p.profile.goal !== 'marathon');
    if (
      isOrdinary &&
      !introductory &&
      p.profile.days.length >= 3 &&
      quality.length !== item.profile.qualitySessions
    )
      fail(
        'ordinary-frequency',
        `Week ${week.index + 1}: requested ${item.profile.qualitySessions}, prescribed ${quality.length}`,
      );
    if (isOrdinary && introductory)
      exceptions.push({
        week: week.index + 1,
        reason: 'introductory/return phase may have fewer workouts',
        requested: item.profile.qualitySessions,
        actual: quality.length,
      });
    if (isOrdinary && p.profile.days.length === 2)
      exceptions.push({
        week: week.index + 1,
        reason: 'two-day policy uses easy outings without a separate long run',
        requested: item.profile.qualitySessions,
        actual: quality.length,
      });
    if (isOrdinary) {
      if (priorKm !== undefined && km + 0.011 < priorKm)
        fail(
          'ordinary-weekly-regression',
          `Week ${week.index + 1}: ${fixed(priorKm)} -> ${fixed(km)} km`,
        );
      priorKm = km;
      if (p.profile.days.length >= 3 && !long)
        fail('missing-long-run', `Week ${week.index + 1}`);
      if (long) {
        if (priorLong !== undefined && long.estimatedKm + 0.001 < priorLong)
          fail(
            'ordinary-long-regression',
            `Week ${week.index + 1}: ${priorLong} -> ${long.estimatedKm} km`,
          );
        if (priorLong !== undefined && long.estimatedKm - priorLong > 2.001)
          fail(
            'excessive-long-increment',
            `Week ${week.index + 1}: ${priorLong} -> ${long.estimatedKm} km exceeds the documented 2 km ordinary step`,
          );
        if (
          !close(long.estimatedKm, Math.round(long.estimatedKm)) &&
          !close(long.estimatedKm, item.profile.longestKm)
        )
          fail(
            'fractional-long-increment',
            `Week ${week.index + 1}: ${long.estimatedKm} km, declared ${item.profile.longestKm} km`,
          );
        priorLong = long.estimatedKm;
      }
    }
    if (
      p.profile.weeklyMinutesLimit &&
      minutes > p.profile.weeklyMinutesLimit + 1 / 60 + 0.01
    )
      fail(
        'weekly-time-cap',
        `Week ${week.index + 1}: ${fixed(minutes)} > ${p.profile.weeklyMinutesLimit}`,
      );
    if (p.profile.goal === 'marathon' && long && long.estimatedKm > 35.001)
      fail(
        'marathon-long-ceiling',
        `Week ${week.index + 1}: ${long.estimatedKm} km`,
      );
    if (week.index === 0 && isOrdinary && item.profile.weeklyKm > 0) {
      if (!close(km, item.profile.weeklyKm))
        fail(
          'opening-weekly-baseline',
          `Declared ${item.profile.weeklyKm}, prescribed ${fixed(km)} km`,
        );
      if (
        item.profile.longestKm > 0 &&
        p.profile.days.length >= 3 &&
        !close(long?.estimatedKm ?? 0, item.profile.longestKm)
      )
        fail(
          'opening-long-baseline',
          `Declared ${item.profile.longestKm}, prescribed ${long?.estimatedKm ?? 'missing'} km`,
        );
    }
    return {
      week: week.index + 1,
      start: week.start,
      phase: week.phase,
      ordinary: isOrdinary,
      introductory,
      km: fixed(km),
      minutes: fixed(minutes),
      longKm: long?.estimatedKm ?? null,
      weekdayWorkouts: quality.length,
      runningDays: runs.length,
    };
  });
  const validation = validatePlan(p);
  if (validation.length) fail('production-validator', validation.join(' | '));
  return { failures, exceptions, weeks };
}
export function auditRoadBoundaries({ caseId } = {}) {
  const selected = roadBoundaryCases().filter(
    (c) => !caseId || c.id === caseId,
  );
  if (!selected.length) throw new Error(`Unknown case ${caseId}`);
  const results = selected.map((item) => {
    const inputSnapshot = JSON.stringify(item.profile);
    try {
      const p = makePlan(item.profile, start, false);
      const result = inspect({ ...item, inputSnapshot }, p);
      return {
        ...item,
        status: result.failures.length
          ? 'accepted-invariant-failure'
          : 'accepted-pass',
        savedWorkoutCount: p.profile.qualitySessions,
        ...result,
      };
    } catch (error) {
      return {
        ...item,
        status:
          error.name === 'PlanError'
            ? 'controlled-rejection'
            : 'unexpected-exception',
        rejectionClassification:
          error.name === 'PlanError'
            ? item.knownInputConflicts.length
              ? 'confirmed-input-conflict'
              : 'needs-product-review'
            : undefined,
        error: { name: error.name, message: error.message },
      };
    }
  });
  const count = (status) => results.filter((r) => r.status === status).length;
  const groups = {};
  for (const r of results)
    for (const key of [
      `event:${r.profile.goal}`,
      `requested-workouts:${r.profile.qualitySessions}`,
      `axis:${r.axis}`,
    ]) {
      const g = (groups[key] ??= {
        inputs: 0,
        accepted: 0,
        failed: 0,
        rejected: 0,
        unexpected: 0,
      });
      g.inputs++;
      if (r.status.startsWith('accepted')) g.accepted++;
      if (r.status === 'accepted-invariant-failure') g.failed++;
      if (r.status === 'controlled-rejection') g.rejected++;
      if (r.status === 'unexpected-exception') g.unexpected++;
    }
  const issueCounts = {};
  for (const r of results)
    for (const code of new Set(r.failures?.map((f) => f.code) ?? []))
      issueCounts[code] = (issueCounts[code] ?? 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    git: {
      sha: execFileSync('git', ['rev-parse', 'HEAD'], {
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
    start,
    scope: ['5k', '10k', 'half', 'marathon'],
    summary: {
      inputs: results.length,
      acceptedPass: count('accepted-pass'),
      acceptedInvariantFailure: count('accepted-invariant-failure'),
      controlledRejection: count('controlled-rejection'),
      confirmedInputConflictRejections: results.filter(
        (r) => r.rejectionClassification === 'confirmed-input-conflict',
      ).length,
      rejectionsNeedingReview: results.filter(
        (r) => r.rejectionClassification === 'needs-product-review',
      ).length,
      unexpectedExceptions: count('unexpected-exception'),
      ordinaryWeeksChecked: results.reduce(
        (n, r) => n + (r.weeks?.filter((w) => w.ordinary).length ?? 0),
        0,
      ),
    },
    groups,
    issueCounts,
    results,
  };
}
function markdown(report) {
  const s = report.summary;
  const halfCases = [0, 1, 2]
    .map((q) =>
      report.results.find((r) => r.id === `half-q${q}-baseline-30-20-5days`),
    )
    .filter(Boolean);
  const halfRows = halfCases
    .map((r) => {
      const [a, b] = r.weeks ?? [];
      return `| ${r.profile.qualitySessions} | ${r.status} | ${a ? `${a.km} / ${a.longKm}` : '—'} | ${b ? `${b.km} / ${b.longKm}` : '—'} | ${r.weeks ? r.weeks.map((w) => w.longKm ?? '—').join(' → ') : r.error.message} |`;
    })
    .join('\n');
  const halfSection =
    halfCases.length === 3
      ? `## Half-marathon 30 km/week + 20 km long-run regression

These exact inputs use five running days, a 12-week block, easy pace 6 min/km, and 120/300-minute weekday/long-run limits. Existing recent quality history matches the explicit choice. Each input is retained verbatim in JSON.

| Requested weekday workouts | Result | Week 1 total / long km | Week 2 total / long km | Long-run km, weeks 1–12 (or rejection) |
|---:|---|---|---|---|
${halfRows}

${halfCases
  .filter((r) => r.weeks)
  .map(
    (r) =>
      `- **${r.profile.qualitySessions} workouts:** weekly training km [${r.weeks.map((w) => w.km).join(', ')}]; weekday-workout counts [${r.weeks.map((w) => w.weekdayWorkouts).join(', ')}].`,
  )
  .join('\n')}

The accepted 0/1 choices retain **30 km total and 20 km long run in week 1**, then **31.6 km total and 20 km long run in week 2**. Weeks 4 and 8 are recovery. Week 9 enters the race-relative taper on its Sunday long-run date even though its weekly phase still reads Race preparation; weeks 10–12 are taper/race weeks. “—” means no separate training long run, with the race excluded from these totals. The explicit 2 choice is rejected by the existing **45 km/week minimum**, not silently reduced to 1.

`
      : '';
  const suspectIds = [
    'marathon-q1-pace-3-distance',
    '5k-q2-experience-finish',
    '10k-q2-experience-finish',
    'half-q2-experience-finish',
  ];
  const reviewCases = report.results.filter(
    (r) => suspectIds.includes(r.id) && r.status === 'controlled-rejection',
  );
  const reviewSection =
    reviewCases.length === suspectIds.length
      ? `## Concrete allocation findings among controlled rejections

- **Confirmed numerical allocation defect:** \`marathon-q1-pace-3-distance\` declares 70 km/week, 23 km long run, five runs, one weekday workout, easy pace 3 min/km, and generous 120/300-minute limits. Week 6 rejects maintaining 75.933 km. A separate read-only loader trace (no production file edit) found \`fundWeek\` adding a 33 m remainder to a displayed 1.600 km / 300-second easy run. It tries 1.633 km / 294 seconds, then fails the five-minute minimum despite a 7,200-second day cap. The inconsistency is between rounded distance and minimum duration, not an exhausted time ceiling. Source: \`lib/plan/generation-baseline.ts\`, \`fundWeek\` / \`assign\`. Full input is in JSON; replay the case to reproduce the controlled error.
- **Explicit-two/finish-intent conflict needs resolution:** \`5k-q2-experience-finish\`, \`10k-q2-experience-finish\`, and \`half-q2-experience-finish\` meet the explicit-two entry prerequisites and reject in week 1 with generous caps. Their corresponding improve-intent reference profiles pass. Recipe selection still sends finish intent to \`economy-relaxed\` before the explicit-two recipe branch (\`lib/workout-library.ts\`), while the new frequency contract refuses to accept fewer workouts. This exposes a policy/implementation conflict; the engine should either support the explicit choice or reject the incompatible preference directly with an accurate reason.

These are included among the ${s.rejectionsNeedingReview} allocation/capacity review cases above, not counted as accepted plans or successful rejections. No fix was applied during this audit.

`
      : '';
  const rows = Object.entries(report.groups)
    .filter(([k]) => k.startsWith('event:'))
    .map(
      ([k, g]) =>
        `| ${k.slice(6)} | ${g.inputs} | ${g.accepted - g.failed} | ${g.failed} | ${g.rejected} | ${g.unexpected} |`,
    )
    .join('\n');
  const issues = Object.entries(report.issueCounts)
    .map(([code, count]) => {
      const examples = report.results
        .filter((r) => r.failures?.some((f) => f.code === code))
        .slice(0, 3);
      return `### ${code}: ${count} accepted inputs\n\n${examples
        .map(
          (r) =>
            `- \`${r.id}\`: ${r.failures
              .filter((f) => f.code === code)
              .slice(0, 2)
              .map((f) => f.detail)
              .join(
                '; ',
              )}.\n  Replay: \`node --experimental-strip-types scripts/audit-road-boundaries.mjs --case ${r.id} --report-dir /private/tmp/stride-boundary-replay\``,
        )
        .join('\n')}\n`;
    })
    .join('\n');
  const rejectionGroups = {};
  for (const r of report.results.filter(
    (r) => r.status === 'controlled-rejection',
  )) {
    const message = r.error.message;
    const g = (rejectionGroups[message] ??= {
      count: 0,
      example: r.id,
      classification: r.rejectionClassification,
    });
    g.count++;
  }
  const rejectionTable = Object.entries(rejectionGroups)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(
      ([msg, g]) =>
        `| ${g.count} | ${msg.replaceAll('|', '/')} | \`${g.example}\` |`,
    )
    .join('\n');
  return `# Road-event generation boundary audit\n\nRead-only working-tree audit generated ${report.generatedAt}. Base Git SHA: \`${report.git.sha}\`; dirty working tree: **${report.git.dirty}**. Engine \`${report.engineVersion}\`, policy \`${report.policyVersion}\`. No account data, network, custom events or ultras were used. No production code was changed by this audit.\n\n## Result\n\n${s.inputs} distinct inputs: **${s.acceptedPass} accepted without an audited invariant failure**, **${s.acceptedInvariantFailure} accepted with a failure**, **${s.controlledRejection} controlled PlanError rejections**, **${s.unexpectedExceptions} unexpected exceptions**. ${s.ordinaryWeeksChecked} ordinary weeks were examined.\n\n| Event | Inputs | Accepted pass | Accepted failure | Controlled rejection | Unexpected exception |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## What was checked\n\n- Explicit 0/1/2 weekday-workout choices retained in the saved profile; eligible full ordinary weeks deliver that count separately from long runs. Introductory/return Foundation and run-walk weeks are labelled separately, as are two-day easy-only routines. Recovery and race-relative taper weeks have no ordinary-frequency requirement.\n- Exact positive declared opening weekly and long-run distance on complete ordinary opening weeks; JSON round-trip; finite positive prescriptions; unique workout/date identities; race date and exact race distance; step-duration sums; running-day/session/weekly time caps.\n- Ordinary long runs stay level or increase, with whole kilometres except an unchanged declared fractional anchor; ordinary increases stay within 2 km; ordinary weekly distance does not regress; demanding outings retain an easy/rest day between them; marathon long runs do not exceed 35 km. Taper boundaries are independently interpreted from the documented date rules, not through the production taper helper.\n- Production validatePlan was also run, but its acceptance alone is not treated as independent proof. Every accepted case includes week-by-week totals/counts in boundaries.json.\n\n${halfSection}## Coverage\n\nFour road events and all three explicit counts; starting distances including 30 km/week with a 20 km long run, zero and low baselines, fractional weekly and long anchors, 2–6 running days, constrained/generous session and weekly limits, 1–364-day blocks, supported pace values 3–15 min/km plus an invalid 20 min/km boundary, both time/distance modes, returning/new/gentle/finish runners, every race weekday in 4-, 12- and 20-week spans, consecutive/separated three-day availability, compressed five-day availability, preferred hard days with per-day caps, and cross-training conflicting with the long day. Inputs are a bounded orthogonal sweep, not the full Cartesian product.\n\n## Accepted-case findings\n\n${issues || 'No accepted input failed these independent checks.'}\n\nThe accepted setting failures are a real configuration defect: two-day 5K/10K routines silently rewrite an explicit 1/2 selection to 0. The two-easy-outing policy can justify rejecting the incompatible input, but does not justify silently saving a different explicit choice. The normalization occurs before explicit-two eligibility in \`lib/plan/profile.ts\`. No production fix was made during this audit.\n\n## Rejections require interpretation\n\n${s.confirmedInputConflictRejections} rejections coincide with an independently checked conflict against the literal named-event entry table and declared input bounds (\`lib/plan/policy.ts\`, \`lib/plan/policy-constants.ts\`). This confirms an input conflict exists, not that each coaching threshold is scientifically validated or that the returned message explains every conflict. The other **${s.rejectionsNeedingReview} controlled rejections remain product-review cases**, not automatically correct outcomes. The complete input and message for every rejection are in boundaries.json. A controlled error prevents a broken plan being silently accepted, but can still reveal an unnecessarily restrictive rule.\n\nMost frequent messages:\n\n| Count | Message | Example input |\n|---:|---|---|\n${rejectionTable}\n\n${reviewSection}## Reproduction and limitations\n\nRun \`node --experimental-strip-types scripts/audit-road-boundaries.mjs\`; use \`--case CASE_ID --report-dir /private/tmp/stride-boundary-replay\` to replay an exact input without overwriting the full report. The script calls production \`makePlan(profile, referenceDate, false)\`: alternative-date search is disabled to keep rejection runs bounded; the training generation and validation paths are unchanged.\n\nThis audit concerns fresh generation, not server concurrency, saved-plan edits, watch delivery or coaching effectiveness. The root report covers representative daily plans and separate lifecycle checks. Passing assertions is not independent coaching approval. Very short/race-week starts intentionally do not force a full declared opening week; two-day routines have no separately labelled long run. All such scope distinctions are visible in JSON rather than counted as ordinary-week successes.\n`;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const args = process.argv.slice(2);
  let caseId,
    reportDir = resolve(root, 'docs/verification/2026-09-19/road-audit');
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--case') caseId = args[i + 1];
    else if (args[i] === '--report-dir') reportDir = resolve(args[i + 1]);
    else
      throw new Error(
        'Usage: audit-road-boundaries.mjs [--case CASE_ID] [--report-dir DIR]',
      );
  }
  const report = auditRoadBoundaries({ caseId });
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    resolve(reportDir, 'boundaries.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(resolve(reportDir, 'boundaries.md'), markdown(report));
  console.log(
    JSON.stringify(
      { summary: report.summary, issueCounts: report.issueCounts, reportDir },
      null,
      2,
    ),
  );
}
