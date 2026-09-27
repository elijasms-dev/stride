# Marathon workout variety

The implementation now preserves the distinction between the primary and explicitly selected second weekday workout. Previously the marathon selector overwrote both slots with slot zero and accepted only threshold sessions, making existing interval and marathon-pace alternatives unreachable. The revised selector also receives the actual work allowance, so it can choose a complete smaller set before a larger recipe fails during allocation.

## Primary sources and limits

- [B.A.A. Boston Marathon Level Two](https://www.baa.org/sites/default/files/2018-07/Boston%20Marathon%20Level%20Two%20Training.pdf) uses several distinct structures: longer half-marathon-effort repeats, kilometre repeats, marathon-pace blocks, descending work, and alternating efforts. Its 20-week schedule is a reference for training purposes and shapes. Stride does not copy its mileage, number of weekly workouts, hill prescriptions or full sessions.
- [Jack Daniels, Marathon Training Phases](https://news.vdoto2.com/2019/11/marathon-training-phases/) distinguishes the runner's prior training, describes controlled interval/fartlek efforts of roughly three to four minutes with similar-duration easy recoveries, and alternates continuous tempo with cruise intervals. It also describes threshold and marathon-pace work as different weekly roles. That supports meaningful variety without making every workout faster or adding another training day.
- [V.O2, What's Your Threshold Pace?](https://news.vdoto2.com/2017/12/whats-threshold-pace/) describes cruise bouts commonly lasting five to fifteen minutes, separated by one to two minutes of recovery. It distinguishes a continuous threshold effort from intermittent threshold work and stresses controlled intensity. Shorter introductory doses and reduced complete sets in Stride are product adaptations, not published Daniels prescriptions.
- [Hal Higdon, Advanced 1 Marathon](https://www.halhigdon.com/training-programs/marathon-training/advanced-1-marathon/) rotates tempo, intervals and hills and includes separate marathon-pace practice. This is an advanced 18-week plan, not an entry-level default. We use its role variety as corroboration, without importing its long-run distances, hill efforts, pace-prediction shortcut or adjacent demanding-day schedule.

These sources differ in periodization and terminology. They do not establish one universally correct sequence, a minimum required diversity score, or guaranteed readiness. Selection frequency, complete-set thresholds and the existing 22% weekly work bound remain explicit Stride rules.

## Original Stride adaptations

| New family | Timed work structure | Easy recovery | Existing role |
| --- | --- | --- | --- |
| Five-minute cruise | 2–6 × 5 min | 1 min | Threshold |
| Eight-minute cruise | 2–4 × 8 min | 90 sec | Threshold |
| Short cruise ladder | 5 / 4 / 3 min, whole set | 1 min | Threshold |
| Controlled fartlek | 3–6 × 3 min | 3 min | Aerobic power |
| Short marathon blocks | 2–6 × 6 min | 2 min | Selected marathon pace |
| Descending marathon blocks | 10 / 8 / 6 min, whole set | 2 min | Selected marathon pace |

Distance counterparts use current numeric targets when available; an unknown pace leaves a timed alternative. The timed and measured versions are alternatives, not a claim that a kilometre always takes five minutes. Neither arbitrary target times nor faster recovery segments are introduced.

The existing history, phase and familiar-workout checks remain. The second slot's quicker work still requires the established-workout evidence used by the existing selector; gentle routines retain controlled effort. Standard one-workout marathon plans continue their threshold emphasis but can alternate complete executable structures. Explicit two-workout plans can now use their intended distinct secondary roles. A familiar preference retains familiar patterns; taper uses reduced familiar work. Completed or manually edited prescriptions are not rewritten by variety refresh.

Candidate selection prefers a non-recent, genuinely different main set when one fits. A repeated complete prescription remains preferable to exceeding the slot's work allowance, truncating a ladder, shortening required recovery, or fabricating extra weekly volume. Small introductory and tightly constrained doses may therefore repeat. Optional faster long-run work shares the same existing weekly work budget.

## Verification

`tests/marathon-purposeful-variety.test.mjs` adds 17 tests: generated one/two-workout plans × timed/measured formats × effort/automatic/manual targets; real work/recovery signatures excluding titles, padding and numerical pace changes; opening weekly and long-run baselines; selected count; weekly work fraction and forecast limits; whole ladders; fitting small slots; familiar preference; protected completed/manual/taper records; and repeated measurement conversion of paced long-run work.

In the representative 60 km/week, 20 km familiar long run, five-day, 18-week profile, the generated ordinary weekday sessions had 8–9 distinct executable signatures with one workout, or 18–21 with two. The latter included threshold, controlled intervals/fartlek and marathon-pace work. These counts demonstrate actual structural changes; they are not training recommendations or universal diversity targets.

The expanded focused suite passed **233/233** tests, including existing marathon dynamic, book, explicit frequency, baseline funding, structured export, custom-event and pacing coverage. The independent broader plan-quality audit is recorded separately in this directory.

The final snapshot migration review and its measurement regression are recorded in `marathon-variety-review.md`; historical fixtures remain unchanged.
