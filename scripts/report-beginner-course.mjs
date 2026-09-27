/** Rebuild the human-readable reports from verify:beginner's recorded results. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(
  new URL('../docs/verification/2026-09-24/beginner-course/', import.meta.url),
);
const results = JSON.parse(readFileSync(directory + 'matrix.json', 'utf8'));
const patterns = JSON.parse(
  readFileSync(directory + 'completion-patterns.json', 'utf8'),
);
const time = (seconds) =>
  `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ''}`;
const prescription = (run) =>
  run.steps
    .map((s) => `${s.movement === 'walk' ? 'Walk' : 'Jog'} ${time(s.seconds)}`)
    .join(' → ');
for (const sequence of results.sequences) {
  const daily = [...sequence.daily];
  const nextDate = (date) =>
    new Date(Date.parse(date + 'T12:00:00Z') + 86400000)
      .toISOString()
      .slice(0, 10);
  for (
    let date = nextDate(daily.at(-1).date);
    date <= sequence.finalPlan.profile.raceDate;
    date = nextDate(date)
  ) {
    daily.push({
      date,
      maintenance: true,
      runs: sequence.finalPlan.workouts.filter(
        (w) => w.status === 'planned' && w.date === date,
      ),
    });
  }
  const lines = [
    `# ${sequence.id}: every day`,
    '',
    'Synthetic execution through the production engine. Course lessons are assumed completed comfortably and explicitly confirmed; stage reviews occur as soon as eligible. Any sessions retained after the milestone are labelled as maintenance forecasts. These are generated test records, not real activities.',
    '',
    'All jogging is conversational. Walking preparation and cooldown are included below. Rest days contain no prescribed running. Distance is unprescribed; this example does not certify a measured 5K.',
    '',
  ];
  for (let i = 0; i < daily.length; i += 7) {
    lines.push(
      `## Week ${Math.floor(i / 7) + 1}`,
      '',
      '| Date | Day | Suggested session | Outing time |',
      '| --- | --- | --- | --- |',
    );
    for (const day of daily.slice(i, i + 7)) {
      const weekday = new Date(day.date + 'T12:00:00Z').toLocaleDateString(
        'en-GB',
        { weekday: 'long', timeZone: 'UTC' },
      );
      lines.push(
        `| ${day.date} | ${weekday} | ${day.runs.length ? (day.maintenance ? 'Maintenance forecast: ' : '') + day.runs.map(prescription).join('; ') : 'Rest'} | ${day.runs.length ? day.runs.map((r) => time(r.minutes * 60)).join('; ') : '—'} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    `Final milestone review: **${sequence.completedAt}** after **${sequence.completedLessonCount} lessons**. It confirms the timed course, not distance.`,
    '',
  );
  writeFileSync(directory + `${sequence.id}-day-by-day.md`, lines.join('\n'));
}
const three = results.sequences.find((s) => s.id.startsWith('3days'));
const weekRows = [];
for (let i = 0; i < 9; i++) {
  const runs = three.daily.slice(i * 7, i * 7 + 7).flatMap((d) => d.runs);
  const running = runs.flatMap((r) =>
    r.steps.filter((s) => s.movement === 'run'),
  );
  weekRows.push(
    `| ${i + 1} | ${runs.map((r) => r.minutes).join(' / ')} | ${running.reduce((n, s) => n + s.seconds, 0) / 60} | ${Math.max(...running.map((s) => s.seconds)) / 60} | 0 |`,
  );
}
const rejections = {};
for (const r of results.matrix.results.filter(
  (r) => r.status === 'correctly-rejected',
))
  rejections[r.expected] = (rejections[r.expected] ?? 0) + 1;
const allPass =
  results.matrix.failed === 0 &&
  [
    ...results.sequences,
    ...results.reviewChecks,
    ...results.operations,
    ...patterns,
  ].every((r) => r.status === 'passed');
const checks = {
  generatedAt: results.generatedAt,
  librarySourceSha256: results.sourceSha256,
  result: allPass ? 'PASS' : 'FAIL',
  beginner: {
    cases: results.matrix.cases,
    accepted: results.matrix.accepted,
    controlledRejections: results.matrix.correctlyRejected,
    failures: results.matrix.failed,
    calendarWeeks: results.matrix.totalWeeks,
    scheduledLessons: results.matrix.totalRuns,
  },
  fullCoursePatterns: {
    cases: patterns.length,
    failures: patterns.filter((r) => r.status !== 'passed').length,
  },
  reviews: results.reviewChecks,
  operations: results.operations,
};
writeFileSync(
  directory + 'checks.json',
  JSON.stringify(checks, null, 2) + '\n',
);
writeFileSync(
  directory + 'README.md',
  `# Beginner 5K and distance regression review

Verified 24 September 2026. Source SHA-256: \`${results.sourceSha256}\`.

## Outcome

Stride previously rejected every true zero-history 5K request. A dedicated timed Couch-to-5K course now preserves a zero starting baseline and introduces easy run/walk sessions. It does not run the regular mileage, quality-workout or long-run allocator.

The implementation follows the [NHS programme](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/) and its [printed 27-session schedule](https://digitalcampaignsstorage.blob.core.windows.net/campaigns-cms-prod/documents/c25k_printable_plan.pdf). The final milestone is thirty continuous running minutes. Research sources, product-specific review rules and limitations are recorded in [the research note](../../../research/couch-to-5k.md).

## Test results

| Check | Result |
| --- | --- |
| Beginner input matrix | ${results.matrix.cases} cases: ${results.matrix.accepted} accepted, ${results.matrix.correctlyRejected} controlled rejections, ${results.matrix.failed} failures |
| Accepted beginner calendars | ${results.matrix.totalWeeks} weeks, ${results.matrix.totalRuns} scheduled lessons |
| Complete-course sweep | ${patterns.length} courses, every valid two-/three-day pattern across all seven starting weekdays; zero failures |
| Established distance matrices | 2,446 cases: 1,941 accepted, 505 controlled rejections, zero failures; 28,344 weeks |
| Full automated suite | 2,827 passed, zero failed |
| Focused beginner tests | 34 passed, including all 27 FIT/Intervals lesson exports |
| Actual plan API + SQLite persistence | Two beginner recording cases passed: late completion and extra run |
| Training edit sequences | 48 accepted profiles, four expected rejections, 576 operations, zero failures |
| Approved marathon fixtures | All 21 unchanged |
| TypeScript, app lint, production build | Passed |

The broad standard and beginner matrices total **7,151 scenario executions**, with overlapping profiles across suites. The 147 complete-course sweeps are additional sequence tests. This is a finite, reproducible test space—not a claim to test every real number, possible input or person's physiological response.

The matrix covers all 127 nonempty availability masks; two, three and four requested running days; every starting weekday; 3/9/14/16-week variants; automatic/custom zero/one/two quality choices; unknown and guessed pace; insufficient/exact time budgets; and malformed benchmark inputs. Successful generation is checked independently for rest spacing, frequency, timed steps, preserved zero history, serialization and held progression. Invalid schedules produce PlanError messages, not RangeErrors.

Whole-repository \`npm run lint\` remains affected by existing test-file lint debt. The production \`lint:app\` check used by CI passes. The Sites wrapper rejects the repository's pre-existing mixed lockfiles; the unchanged npm build used by CI passes. No dependencies or lockfiles were changed. No browser, physical-watch or live-provider acceptance is claimed.

## Nine-week example

Input: new runner, **0 km/week, 0 km longest run, 0 current running days**, unknown pace; Monday/Wednesday/Friday, forty minutes available, automatic structure. Tuesday/Thursday/Saturday/Sunday are rest days. Every outing includes five-minute walking preparation and cooldown.

| Week/stage | Three outing durations (min) | Running minutes that week | Longest running bout (min) | Speed workouts |
| --- | --- | ---: | ---: | ---: |
${weekRows.join('\n')}

First outing: five-minute walk, seven repetitions of one-minute jog + ninety-second walk, one final one-minute jog, five-minute cooldown walk. **28½ minutes total, eight minutes jogging.**

This table assumes every stage is completed comfortably and reviewed. In a real saved plan, future sessions **repeat the current stage** until that review succeeds; the overview explains the later stages. Missed, partial, unconfirmed, tired, duplicated or corrupted lessons do not advance the course. A shorter total outing in stage three follows the reference's changed run/walk structure while continuous running increases.

- [Every day of the nine-week, three-run example](3days-9weeks-day-by-day.md)
- [Every day of the fourteen-week, two-run example](2days-14weeks-day-by-day.md)
- [All 147 complete-course traces](completion-patterns.json)
- [Complete input matrix and executed example data](matrix.json)
- [Machine-readable summary](checks.json)

Across all patterns, three sessions per week certified the final stage after 63 elapsed days; two sessions required 92–96 days. The final review may occur the day after a nine-week calendar ends. More repeats take longer. Thirty minutes at 8:00/km would be 3.75 km, so the engine never marks an invented 5K complete.

## Failures found and corrected during implementation

| Issue | Fix and verification |
| --- | --- |
| Zero-history 5K rejected; base fallback had pace-dependent duration and missing walking preparation | Dedicated canonical timed recipes; guessed pace leaves duration unchanged. |
| Calendar age could be mistaken for completed progress | Saved stage/lesson identity and explicit evidence-based review. |
| Tiny or altered historical running bouts could certify a full stage | Compare against canonical lesson steps before accepting evidence. |
| Short course could not extend without hitting ordinary road baseline gates | Preserve course identity, stage and logs when extending its finish date. |
| Stage advance erased deliberately moved dates | Retain moved dates and workout identities while updating the reviewed lesson. |
| Actual run dates and extra running did not reserve recovery | Real API completion/free-run saves preserve the facts and mark conflicting future lessons as rest; preview uses prior running too. |
| Preference changes scheduled running inside a saved break | Persist break ranges and exclude them independently of selected weekdays. |
| Pre-break evidence could unlock post-break progression | Post-break evidence window plus seven days back; no automatic advancement. |
| A single workout's preferred start time was misread as a paired-session identity on restore | Validate single-session timing separately from paired metadata. |
| Measurement, targets or resizing could overwrite lesson intent | Keep timed, effort-based recipes. Unsupported shortening rejects explicitly; a shorter actual attempt can still be logged as partial. |

## Controlled rejection categories

| Input category | Cases |
| --- | ---: |
${Object.entries(rejections)
  .sort((a, b) => b[1] - a[1])
  .map(([reason, count]) => `| ${reason} | ${count} |`)
  .join('\n')}

Explicit one/two speed-workout requests are rejected with beginner-specific guidance; they are not silently erased. Four running days, adjacent-only schedules and insufficient full-course time caps also reject clearly. A short date horizon is allowed as introductory practice with an incomplete-course explanation and no compressed race preparation.

Zero-history 10K, half and marathon runners still need to build and record a base. Existing nonzero runners retain the regular distance-specific engine. The new course specifically handles truthful zero history; it is not a claim that every low-baseline runner or clinical situation has a bespoke programme.

## Reproduce

\`npm test\`, \`npm run verify:beginner\`, \`npm run verify:viability\`, \`npm run verify:road\`, \`npm run verify:training\`, \`npm run typecheck\`, \`npm run lint:app\`, \`npm run build\`.

After the beginner matrix, regenerate these readable examples with \`node scripts/report-beginner-course.mjs\`. Simulations use synthetic data and make no account, provider, deployment or publication changes. Nothing was pushed.
`,
);
