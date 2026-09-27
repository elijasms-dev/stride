/** Review exact road examples without replacing historical reports. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { makePlan, validatePlan } from '../lib/engine.ts';
import { mainSetSummary } from '../lib/workout-names.ts';
const label = process.argv[2] ?? 'initial';
assert.match(label, /^[a-zA-Z0-9_-]+$/);
const out = new URL(
  `../docs/verification/2026-09-25/plan-quality-review/road-variety-${label}.json`,
  import.meta.url,
);
assert.ok(
  !existsSync(out),
  'Use a new label; historical reports are retained.',
);
const examples = JSON.parse(
  readFileSync(
    new URL(
      '../docs/verification/2026-09-25/plan-quality-review/example-plans.json',
      import.meta.url,
    ),
  ),
);
const quality = (p) =>
  p.workouts.filter((w) => w.hard && !['long', 'race'].includes(w.kind));
const signature = (w) =>
  JSON.stringify(
    w.steps
      .filter((s) => s.kind === 'work' || s.kind === 'recovery')
      .map((s) => [
        s.kind,
        s.metres === undefined ? 'seconds' : 'metres',
        s.metres ?? s.seconds,
        s.effortRole,
        s.intensity,
      ]),
  );
const rows = [];
for (const c of examples.filter((c) => /^(5k|10k|half)-q[12]$/.test(c.id))) {
  const input = structuredClone(c.input);
  const p = makePlan(input, input.startDate, false);
  assert.deepEqual(input, c.input);
  assert.deepEqual(validatePlan(p), []);
  assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))), []);
  const history = (p) =>
    p.workouts.map((w) => [w.id, w.date, w.originalDate, w.week, w.status]);
  assert.deepEqual(history(p), history(c.plan));
  const work = quality(p);
  assert.ok(new Set(work.slice(0, 4).map(signature)).size >= 2);
  let longestStreak = 0,
    streak = 0,
    previous;
  for (const w of work) {
    if (['Taper', 'Race week'].includes(p.weeks[w.week].phase)) continue;
    const shape = signature(w);
    streak = shape === previous ? streak + 1 : 1;
    longestStreak = Math.max(streak, longestStreak);
    previous = shape;
  }
  assert.ok(longestStreak <= 2);
  const describe = (p) =>
    quality(p).map((w) => ({
      date: w.date,
      week: w.week + 1,
      phase: p.weeks[w.week].phase,
      title: w.title,
      mainSet: mainSetSummary(w),
      minutes: w.minutes,
      qualityMinutes: w.qualityMinutes,
      templateId: w.templateId,
      signature: signature(w),
    }));
  rows.push({
    id: c.id,
    input,
    longestIdenticalStreak: longestStreak,
    distinctMainSets: new Set(work.map(signature)).size,
    before: describe(c.plan),
    current: describe(p),
  });
}
writeFileSync(
  out,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), plans: rows.length, rows },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    rows.map(({ id, longestIdenticalStreak, distinctMainSets }) => ({
      id,
      longestIdenticalStreak,
      distinctMainSets,
    })),
  ),
);
