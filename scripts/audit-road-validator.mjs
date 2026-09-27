/** Read-only negative-case audit. Deliberately damaged copies are never saved as
 * app plans. Reports findings without adding expected failures to normal CI. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { makePlan, validatePlan } from '../lib/engine.ts';
import { scaleTemplate, WORKOUT_LIBRARY } from '../lib/workout-library.ts';

const directory = new URL('../docs/verification/2026-09-19/road-audit/', import.meta.url);
const source = JSON.parse(await readFile(new URL('plans.json', directory), 'utf8'));
const mainMinutes = (w) => w.steps.filter((s) => s.kind === 'work' && s.intensity >= 4)
  .reduce((sum, s) => sum + s.seconds / 60, 0);
const meaningfulQuality = (w) => !['long', 'race', 'easy'].includes(w.kind) && w.hard &&
  !['economy', 'aerobic'].includes(w.stimulus) && mainMinutes(w) > 0;
const weekSummary = (plan, week) => {
  const runs = plan.workouts.filter((w) => w.week === week && w.kind !== 'race');
  return {
    runs: runs.length,
    selectedWeekdayWorkouts: plan.profile.qualitySessions,
    meaningfulWeekdayWorkouts: runs.filter(meaningfulQuality).length,
    hardFlaggedNonLongSessions: runs.filter((w) => w.hard && w.kind !== 'long').length,
    allocatedKm: runs.reduce((sum, w) => sum + w.estimatedKm, 0),
  };
};
const findings = [];
for (const example of source.plans.filter((p) => p.id.endsWith('-q2'))) {
  const plan = makePlan(example.input, example.input.startDate, false);
  const baselineErrors = validatePlan(plan);
  if (baselineErrors.length) throw new Error(`${example.id}: untouched generated plan is invalid: ${baselineErrors.join('; ')}`);
  const original = plan.workouts.find((w) => w.week === 2 && meaningfulQuality(w));
  if (!original) throw new Error(`${example.id}: no ordinary week-3 quality session`);
  const before = weekSummary(plan, original.week);
  const missing = structuredClone(plan);
  missing.workouts = missing.workouts.filter((w) => w.id !== original.id);
  findings.push({
    caseId: `${example.id}-missing-session`, sourcePlan: example.id,
    category: 'unmarked-missing-session', mutation: 'Remove one ordinary-week weekday quality session without recording a skip or manual change.',
    input: example.input, week: original.week + 1, date: original.date,
    before, after: weekSummary(missing, original.week),
    baselineErrors, validatorErrors: validatePlan(missing),
  });
  const strides = structuredClone(plan), changed = strides.workouts.find((w) => w.id === original.id);
  const template = WORKOUT_LIBRARY.find((t) => t.id === 'economy-relaxed');
  const dose = scaleTemplate(template, changed.minutes, false, strides.weeks[changed.week].phase,
    99, 99, strides.profile, undefined, { capBasis: 'prescribed' });
  if (!dose) throw new Error(`${example.id}: real economy recipe cannot fit the session`);
  const spare = changed.minutes * 60 - dose.steps.reduce((sum, s) => sum + s.seconds, 0);
  if (spare < 0) throw new Error('Synthetic economy recipe exceeds original duration');
  dose.steps.find((s) => s.kind === 'warmup').seconds += spare;
  Object.assign(changed, {
    title: template.title, kind: template.kind, stimulus: template.stimulus,
    templateId: template.id, purpose: template.purpose,
    steps: dose.steps, qualityMinutes: dose.qualityMinutes,
    // Deliberately retain the stale hard:true classifier to test independent validation.
  });
  findings.push({
    caseId: `${example.id}-strides-stale-hard-flag`, sourcePlan: example.id,
    category: 'economy-counted-as-workout', mutation: 'Replace one quality prescription with the real economy-relaxed strides recipe while retaining its old hard:true flag.',
    input: example.input, week: original.week + 1, date: original.date,
    before, after: weekSummary(strides, original.week),
    substitutedRecipe: { templateId: changed.templateId, kind: changed.kind, stimulus: changed.stimulus,
      hard: changed.hard, mainWorkMinutes: mainMinutes(changed), steps: changed.steps },
    baselineErrors, validatorErrors: validatePlan(strides),
  });
}
for (const finding of findings) finding.invalidMutationAccepted = finding.validatorErrors.length === 0;
const report = {
  format: 'stride-road-validator-audit-1', generatedAt: new Date().toISOString(),
  source: 'plans.json input profiles regenerated through current makePlan; mutated copies checked by current validatePlan',
  scope: 'Four road distances, two selected weekday workouts, complete ordinary week 3; no custom or ultra plans.',
  severity: 'P2 validation-gate gaps: current generated examples are valid; these deliberately invalid mutations should be rejected before saving.',
  productionModified: false,
  summary: { generatedBaselines: findings.length / 2, invalidGeneratedBaselines: 0,
    deliberateNegativeCases: findings.length,
    invalidMutationsAccepted: findings.filter((f) => f.invalidMutationAccepted).length },
  findings,
};
const rows = findings.map((f) => `| ${f.caseId} | ${f.before.meaningfulWeekdayWorkouts} → ${f.after.meaningfulWeekdayWorkouts} | ${f.before.runs} → ${f.after.runs} | ${f.invalidMutationAccepted ? 'Incorrectly accepted' : 'Rejected'} |`);
const markdown = `# Road-plan validator negative-case audit

Run: \`node --experimental-strip-types scripts/audit-road-validator.mjs\` after generating \`plans.json\`.

**These are deliberately mutated copies, not generated-plan failures.** All ${report.summary.generatedBaselines} untouched road plans pass validation. The audit then damages each plan in two ways. Current validation incorrectly accepts ${report.summary.invalidMutationsAccepted}/${findings.length} negative cases. No production code, app data or normal CI tests are changed.

| Case | Meaningful weekday workouts | Running sessions | Validator result |
| --- | --- | --- | --- |
${rows.join('\n')}

## P2: Unmarked disappearance bypasses the explicit frequency guard

Removing one weekday quality session leaves only one of the selected two workouts. \`eligibleWeeks()\` excludes weeks whose run count differs from \`profile.days.length\`, and the weekly progression validator similarly skips incomplete schedules. There is no recorded skip, manual change or taper/recovery exception here.

Practical scope: this does not show the current generator removing sessions. It shows that a future generation/editing regression can remove a workout and still pass the production validator. Deliberate skip/move/partial-week behavior must remain allowed, but an untouched complete week with an unmarked missing session needs a validation error.

## P2: A stale hard flag lets strides satisfy the selected workout count

The second mutation uses the actual \`economy-relaxed\` library recipe, containing two minutes of strides, while retaining the previous \`hard: true\` flag. The explicit validator counts non-long hard sessions with positive work; it does not exclude the economy stimulus. An independent recipe-aware count correctly finds one meaningful weekday workout.

Practical scope: current generated examples do not contain this mislabeled recipe. The gap matters if a future substitution or recipe edit forgets to clear its old classifier. Exclude economy/strides explicitly when certifying the selected workout count; keep brief taper efforts separate from the ordinary build-week guarantee.

## Interpretation

Neither finding establishes unsafe training or a live user-data incident. Both weaken the software guard intended to stop the recurring missing-workout regression. Source-level evidence is in \`lib/plan/generation-rhythm.ts\` and \`lib/plan/validate.ts\`; exact inputs, mutations and validator outputs are in [validator.json](validator.json). This audit exits successfully after recording findings; it is not a passing release-gate assertion.
`;
await mkdir(directory, { recursive: true });
await writeFile(new URL('validator.json', directory), JSON.stringify(report, null, 2) + '\n');
await writeFile(new URL('validator.md', directory), markdown);
console.log(JSON.stringify(report.summary));
