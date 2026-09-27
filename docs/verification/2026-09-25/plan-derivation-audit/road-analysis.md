# Road plan derivation audit — 25 September 2026

Read-only audit of the nine saved 5K, 10K and half-marathon examples. No runtime code or previous evidence was changed. Each input was regenerated and compared byte-for-byte to its saved plan. A temporary instrumented copy of the generator also recorded intermediate allocations for selected examples; it produced the identical final plans.

Authoritative full-stage evidence: [week-by-week generator traces](week-by-week-derivations.md), [machine-readable derivations](derivations.json), and the repeatable [audit script](../../../../scripts/audit-plan-derivations.mjs). These observations cover all 12 original examples plus matched input combinations; this road-only analysis independently reproduced all nine road plans byte-for-byte.

## Main finding

The schedules do not originate from one published plan. They are the intersection of an authored weekly-volume forecast, an independent authored long-run ladder, a weekday allocator, an authored workout library, pace-based conversions, recovery/taper envelopes, and repeated correction passes. The code explicitly labels the road bands and doses as independently authored (lib/road-training-policy.ts:32; lib/road-workouts.ts:9). A code-level explanation exists for each number, but that is not an external coaching justification.

## Rules actually used

1. Capacity band: developing unless established experience, at least four existing runs and weekly volume ≥ 20 km (5K),25 km (10K),35 km (half). Advanced needs at least five existing runs, ≥ 45 km (5K/10K) or 55 km (half), and recent long ≥ 10/12/16 km respectively. Everything else is established. See lib/road-training-policy.ts:15.
2. Road peak long: max(familiar long, min(authored distance ceiling, authored minute ceiling / scheduling easy pace)). The result is floored to a whole kilometre during the ladder. The saved examples use the slow end of the benchmark-derived easy pace: 7:14/km for5K,6:56/km for10K,6:57/km forhalf. See lib/road-training-policy.ts:134; lib/fitness-pacing.ts:250; lib/progression-engine.ts:101.
3. Long progression: spread the required whole-kilometre advances over available ordinary weeks using floor(ordinary-ordinal × required-advances / total-ordinary-opportunities). Exclude recovery weeks. Maximum step1 km for5K/10K;2 km forhalf with an existing long >=12 km. A small difference between start and peak therefore produces long plateaus. See lib/progression-engine.ts:110; lib/road-training-policy.ts:117.
4. Nominal weekly load: add min(band weekly step, current load × growth fraction), within a baseline multiplier and absolute ceiling, only in the preparation window and outside recovery/taper. Established: steps1.5/2/2.5 km, fraction6%, multiplier1.45. Advanced: steps2/2.5/3 km, fraction4%, multiplier1.3. These are authored numbers. See lib/plan/generation-load.ts:129; lib/road-training-policy.ts:106.
5. Run days: classic four-day pattern is Tuesday/Wednesday/Friday/Sunday; six-day pattern Tuesday through Sunday. Solver prioritises complete separated workout slots and classic days over the submitted days when all seven days are available. See lib/training-structure.ts:89 and :106.
6. Standard non-recovery mix: q0 =3 easy +1 long (four-day examples); q1 =2 easy +1 weekday workout +1 long; q2 =3 easy +2 weekday workouts +1 long (six-day examples). The easy long is not counted in q. Recovery sets every weekday quality slot to easy. See lib/plan/generation-weeks.ts:98.
7. Non-long minutes are allocated by weights: quality 1.1, aerobic support 1.35, recovery-position easy 0.7, other easy 1. Each gets a minimum5 minutes before weighted allocation. See lib/training-structure.ts:194 and :282; lib/plan/generation-allocation.ts:358.
8. Later role caps: easy <=80% of long, or65% when adjacent to long / before another running day. Those caps can override the original allocation and reduce the total. Road quality sessions can have up to10/15/20 minutes aerobic padding (developing/established/advanced) beyond the complete recipe. See lib/plan/session-balance.ts:11; lib/road-training-policy.ts:150.
9. Opening mileage is min(reported mileage, capacity of every future ordinary complete week), not solely the first week. A shorter later recipe can determine the opening total. Then ordinary totals are forced non-decreasing, bounded by the growth rule and future capacity; easy runs absorb the remainder. See lib/plan/generation-baseline.ts:543 and :660.
10. Recovery: every fourth week unless the profile changes the interval. Initial long =floor(ladder distance ×0.8). Nominal road weekly recovery factor is 0.82. Later recovery minutes are capped against the preceding complete actual prescription, rounded to whole minutes, followed by another whole-kilometre long floor and easy-role reductions. This can create a much deeper reduction than either nominal fraction. See lib/plan/generation-load.ts:64; lib/marathon-book.ts:75; lib/plan/allocate.ts:268; lib/plan/generation-reconcile.ts:100.
11. Taper: final 7 days for5K/10K at 60%; final 14 days forhalf at 80%then 50%. A normal weekday before a tapered Sunday is explicitly exempt from comparing its length to that shortened long, so apparent easy≈long patterns can return in mixed boundary weeks. See lib/road-training-policy.ts:121; lib/plan/session-balance.ts:19.

## The comparison changes the runner as well as the workout choice

The q2 examples are not the q0/q1 runner with a second workout added. The example script switches to a different weekly baseline, recent long and running frequency at q2, and changes declared recent quality history with each choice. See scripts/report-stress-example-plans.mjs:11 and :54. This makes q2 look different for multiple simultaneous reasons and cannot isolate the effect of the workout setting.

| Event | q0/q1 input: weekly / long / days | q2 input: weekly / long / days |
|---|---|---|
|5K|30 /8 /4|55 /13 /6|
|10K|36 /11 /4|60 /16 /6|
|Half|45 /16 /4|65 /18 /6|

## Concrete calculations and faults

- **5K q0 opening 26 km:** long 8 +Tuesday(8×0.65=5.2) +Wednesday(8×0.8=6.4) +Friday(8×0.8=6.4). All three supporting days hit the new cap. Weeks1,2,3 and5 repeat exactly because long remains8. The nominal forecast grows30→31.5→33 but those extra kilometres cannot be allocated. There is no source plan prescribing this four-week plateau.
- **5K q0 peak 10 km:** established ceiling10 km beats80/7.2333=11.06 km. The ladder has only two1-km advances across seven ordinary opportunities, so they land inweeks 6 and10. The final ordinary week totals30.75 km, barely above the reported30 km after starting at 26.
- **5K q2 peak 13 km:** advanced ceiling14 km is further limited to100/7.2333=13.8249 km, then floored13. Since the familiar long already equals13, every ordinary long holds13. This is a time-cap/rounding consequence, not a universal13-km rule for5K.
- **10K q0 opening 35.75 km:**11 +(11×0.65=7.15) +(11×0.8=8.8) +(11×0.8=8.8). Established peak 13 allows only two1-km advances, again weeks 6 and10.
- **10K q1 opening 34.45 km:**7.15 easy +7.5 quality +8.8 easy +11 long. The same runner loses an additional1.3 km versus q0 because the bounded workout recipe contributes less distance than the old easy slot and the other easy slots are already capped.
- **Half q1 opening 45 km:**10.4 easy +7.5 workout +11.1 easy +16 long. The shorter workout shifts more of the remaining29 km onto Tuesday and Friday. This does not mean the runner physiologically needs11.1 km on Friday; it is an allocation remainder.
- **Half q1 week 14:**14.53 km easy,7.7 km workout,14.964 km easy,15 km long. The near-identical Friday/long remains by design because Sunday is inside taper while Friday is outside it. The weekly label still says Race preparation. This is a genuine user-facing explanation gap despite being permitted by the validator.
- **Workout starts are generic across events:** all three q1 examples begin7×2 min threshold,9×90 sec threshold,7×2 min threshold,9×90 sec threshold across their first four quality exposures. Input recent quality is 20 min; seed=max(6,min(14,20×0.8))=14. Initial maximum bout2 min gives7×2. The90-second variant fits9×90=13.5. Then the generation context excludes weeks earlier than count−preparationWeeks, so pre-preparation exposures are not carried into the new progression. This resets the early stage atweek 3. See lib/road-workouts.ts:278 and :348; lib/plan/generation-weeks.ts:227.
- **Why the first workout is50 minutes /~7.2–7.5 km:**14 min work +6×1 min recovery +10 min warmup +5 min cooldown +15 min permitted aerobic padding. Distance is converted from the prescribed paces. Its50 minutes is a recipe plus a padding allowance, not a50-minute workout selected from a cited plan.
- **Quality dose is formulaic:** after every two related exposures add3 minutes (4 forhalf-specific;2 controlled), until role ceiling; duration stages also change after every two exposures (three controlled). Role selection mostly alternates threshold with race effort after introductory threshold sessions. Variety selects an executable different work/recovery shape. These are specific authored rules, not direct reproductions. See lib/road-workouts.ts:237–315 and :348–455.

### Verified recovery quantisation traces

The selected stages below match the authoritative [generator trace](week-by-week-derivations.md), and an independent temporary instrumented generator reproduced the saved final JSON byte-for-byte. Selected week 4 stages:

|Plan|Initial constructed week /long|After minute envelope /long|After whole-km long +role caps|Final|
|---|---|---|---|---|
|5Kq0|23.835 /6|unchanged|19.5 /6|19.5 /6|
|5Kq1|25.632 /6|24.806 /5.806|16.25 /5|16.25 /5|
|5Kq2|46.636 /10|45.851 /9.815|37.886 /9|37.75 /9|
|Halfq1|38.762 /12|38.508 /11.942|35.583 /11|35.55 /11|

Halfq1 illustrates an actual implementation artifact:12 km at 6:57/km takes 83.4 minutes. A minute cap rounds that down to 83 minutes, reducing the distance only to 11.942 km. Whole-kilometre normalization then rounds it all the way to 11. The easy caps shrink again because the long is now shorter. There is no coaching basis for turning a24-second adjustment into an extra kilometre removed.

5Kq1 week 3→4 goes26.8→16.25 km, a39.4%reduction, compared with5Kq0 26→19.5 (25%). The observed difference follows the composition/rounding pipeline, not an authored source saying a one-workout runner needs that larger cutback.

## Every saved road combination

Below, run order follows the actual calendar: four-day examples Tue/Wed/Fri/Sun; six-day examples Tue/Wed/Thu/Fri/Sat/Sun. E=easy,L=long,Q=weekdayquality,R=race. Totals exclude race distance and use actual session sums rather than the rounded weekly header. All distances are kilometres. A missing long in the last two weeks means its calendar slot has become an easy run or race.

### 5k-q0

Input 30 km/week; recent long 8 km; 4 running days. Capacity band **established**. Policy long ceiling 10 km /80 min; calculated target10 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|5.2E /6.4E /6.4E /8L|26|8|0|
|2 Foundation|5.2E /6.4E /6.4E /8L|26|8|0|
|3 Build|5.2E /6.4E /6.4E /8L|26|8|0|
|4 Recovery|3.9E /4.8E /4.8E /6L|19.5|6|0|
|5 Build|5.2E /6.4E /6.4E /8L|26|8|0|
|6 Build|5.353E /6.573E /6.574E /9L|27.5|9|0|
|7 Build|5.779E /7.11E /7.111E /9L|29|9|0|
|8 Recovery|4.55E /5.6E /5.6E /7L|22.75|7|0|
|9 Race preparation|5.85E /7.2E /7.2E /9L|29.25|9|0|
|10 Race preparation|6.002E /7.373E /7.375E /10L|30.75|10|0|
|11 Race preparation|6.5E /8E /8E /5.9E|28.4|—|0|
|12 Race week|3.5E /4.4E /3.4E /5R|11.3|—|0|

### 5k-q1

Input 30 km/week; recent long 8 km; 4 running days. Capacity band **established**. Policy long ceiling 10 km /80 min; calculated target10 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|5.2E /7.2Q /6.4E /8L|26.8|8|7 × 2 min tempo|
|2 Maintenance|5.155E /7.3Q /6.345E /8L|26.8|8|9 × 90 sec tempo|
|3 Build|5.2E /7.2Q /6.4E /8L|26.8|8|7 × 2 min tempo|
|4 Recovery|3.25E /4E /4E /5L|16.25|5|0|
|5 Build|5.2E /7.3Q /6.4E /8L|26.9|8|9 × 90 sec tempo|
|6 Build|5.606E /6.9Q /6.894E /9L|28.4|9|7 × 90 sec 5K effort|
|7 Build|5.717E /7.2Q /7.033E /9L|28.95|9|5 × 3 min tempo|
|8 Recovery|3.9E /4.8E /4.8E /6L|19.5|6|0|
|9 Race preparation|5.85E /6.9Q /7.2E /9L|28.95|9|10 × 200 m 5K effort|
|10 Race preparation|5.725E /7.7Q /7.025E /10L|30.45|10|10 × 90 sec tempo|
|11 Race preparation|6.5E /7.7Q /8E /5.9E|28.1|—|7 × 2 min 5K effort|
|12 Race week|3.3E /4.366Q /3.456E /5R|11.122|—|2 × 2 min 5K effort|

### 5k-q2

Input 55 km/week; recent long 13 km; 6 running days. Capacity band **advanced**. Policy long ceiling 14 km /100 min; calculated target13.825 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|8.45E /8.4Q /8.45E /7.5Q /8.45E /13L|54.25|13|8 × 2 min tempo; 7 × 90 sec 5K effort|
|2 Maintenance|8.45E /7.6Q /8.4E /8.4Q /8.4E /13L|54.25|13|10 × 200 m 5K effort; 10 × 90 sec tempo|
|3 Build|8.45E /7.9Q /8.25E /8.4Q /8.25E /13L|54.25|13|11 × 1 min 5K effort; 8 × 2 min tempo|
|4 Recovery|5.85E /5.85E /5.6E /5.85E /5.6E /9L|37.75|9|0|
|5 Build|8.45E /7.5Q /8.45E /8.4Q /8.45E /13L|54.25|13|7 × 90 sec 5K effort; 10 × 90 sec tempo|
|6 Build|8.416E /8.4Q /8.416E /8.6Q /8.418E /13L|55.25|13|7 × 2 min 5K effort; 6 × 3 min tempo|
|7 Build|8.45E /8.5Q /8.45E /8.4Q /8.45E /13L|55.25|13|13 × 200 m 5K effort; 8 × 2 min tempo|
|8 Recovery|5.85E /5.85E /5.85E /5.85E /5.85E /9L|38.25|9|0|
|9 Race preparation|8.45E /8.5Q /8.45E /8.9Q /8.45E /13L|55.75|13|5 × 3 min 5K effort; 5 × 4 min tempo|
|10 Race preparation|8.45E /9Q /8.45E /8.8Q /8.45E /13L|56.15|13|8 × 400 m 5K effort; 6 × 600 m tempo|
|11 Race preparation|8.45E /10Q /8.45E /9.9Q /8.45E /6.221E|51.471|—|10 × 2 min 5K effort; 5 × 5 min tempo|
|12 Race week|4.9E /5.427Q /4.147E /3.456E /2.765E /5R|20.695|—|2 × 5 min tempo|

### 10k-q0

Input 36 km/week; recent long11 km; 4 running days. Capacity band **established**. Policy long ceiling 13 km /100 min; calculated target13 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|7.15E /8.8E /8.8E /11L|35.75|11|0|
|2 Foundation|7.15E /8.8E /8.8E /11L|35.75|11|0|
|3 Build|7.15E /8.8E /8.8E /11L|35.75|11|0|
|4 Recovery|5.2E /6.4E /6.4E /8L|26|8|0|
|5 Build|7.15E /8.8E /8.8E /11L|35.75|11|0|
|6 Build|7.443E /9.153E /9.154E /12L|37.75|12|0|
|7 Build|7.8E /9.6E /9.6E /12L|39|12|0|
|8 Recovery|5.85E /7.2E /7.2E /9L|29.25|9|0|
|9 Race preparation|7.8E /9.6E /9.6E /12L|39|12|0|
|10 Race preparation|8.093E /9.953E /9.954E /13L|41|13|0|
|11 Race preparation|8.45E /10.4E /10.4E /6.4E|35.65|—|0|
|12 Race week|4.7E /5.8E /3.5E /10R|14|—|0|

### 10k-q1

Input 36 km/week; recent long11 km; 4 running days. Capacity band **established**. Policy long ceiling 13 km /100 min; calculated target13 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|7.15E /7.5Q /8.8E /11L|34.45|11|7 × 2 min tempo|
|2 Maintenance|7.143E /7.6Q /8.707E /11L|34.45|11|9 × 90 sec tempo|
|3 Build|7.15E /7.5Q /8.8E /11L|34.45|11|7 × 2 min tempo|
|4 Recovery|4.55E /5.6E /5.6E /7L|22.75|7|0|
|5 Build|7.15E /7.6Q /8.8E /11L|34.55|11|9 × 90 sec tempo|
|6 Build|7.8E /7Q /9.6E /12L|36.4|12|4 × 3 min 10K effort|
|7 Build|7.8E /7.5Q /9.6E /12L|36.9|12|5 × 3 min tempo|
|8 Recovery|5.2E /6.4E /6.4E /8L|26|8|0|
|9 Race preparation|7.8E /7.7Q /9.6E /12L|37.1|12|7 × 2 min 10K effort|
|10 Race preparation|8.116E /8Q /9.984E /13L|39.1|13|10 × 90 sec tempo|
|11 Race preparation|8.45E /7.6Q /10.4E /6.429E|32.879|—|10K effort pyramid|
|12 Race week|4.8E /4.509Q /3.571E /10R|12.88|—|3 min 10K effort|

### 10k-q2

Input 60 km/week; recent long16 km; 6 running days. Capacity band **advanced**. Policy long ceiling 16 km /110 min; calculated target16 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|9.508E /8.7Q /10.4E /7.7Q /7.692E /16L|60|16|8 × 2 min tempo; 4 × 3 min 10K effort|
|2 Foundation|9.307E /8.7Q /10.4E /8.4Q /7.193E /16L|60|16|10 × 90 sec tempo; 7 × 2 min 10K effort|
|3 Build|9.514E /8.9Q /10.4E /8.3Q /7.571E /16L|60.685|16|6 × 3 min tempo; 10K effort pyramid|
|4 Recovery|7.15E /7.15E /6.4E /7.15E /6.4E /11L|45.25|11|0|
|5 Build|10.4E /8.7Q /10.4E /8.5Q /8.143E /16L|62.143|16|8 × 2 min tempo; 5 × 600 m 10K effort|
|6 Build|10.4E /9.2Q /10.4E /9.5Q /8.429E /16L|63.929|16|5 × 4 min tempo; 4 × 5 min 10K effort|
|7 Build|10.4E /9Q /10.4E /8.6Q /9.857E /16L|64.257|16|6 × 600 m tempo; 4 × 800 m 10K effort|
|8 Recovery|7.15E /7.15E /7.15E /7.15E /7.15E /11L|46.75|11|0|
|9 Race preparation|10.4E /10.3Q /10.4E /8.9Q /10.286E /16L|66.286|16|5 × 5 min tempo; 3 × 6 min 10K effort|
|10 Race preparation|10.4E /9.4Q /10.4E /10Q /10.4E /16L|66.6|16|5 × 800 m tempo; 7 × 600 m 10K effort|
|11 Race preparation|10.4E /10Q /10.4E /10.6Q /10.4E /6.429E|58.229|—|4 × 6 min tempo; 5 × 5 min 10K effort|
|12 Race week|6.058E /5.44Q /4.286E /3.571E /2.857E /10R|22.212|—|2 × 5 min 10K effort|

### half-q0

Input 45 km/week; recent long16 km; 4 running days. Capacity band **established**. Policy long ceiling 19 km /135 min; calculated target19 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|9.715E /9.715E /9.57E /16L|45|16|0|
|2 Foundation|9.715E /9.715E /9.57E /16L|45|16|0|
|3 Build|10.4E /10.5E /10.3E /16L|47.2|16|0|
|4 Recovery|7.8E /8.9E /8.9E /12L|37.6|12|0|
|5 Build|10.4E /11.2E /11.2E /16L|48.8|16|0|
|6 Build|10.4E /12E /12E /16L|50.4|16|0|
|7 Build|11.292E /11.802E /11.806E /18L|52.9|18|0|
|8 Recovery|8.45E /10.2E /10E /13L|41.65|13|0|
|9 Build|11.549E /12.924E /12.927E /18L|55.4|18|0|
|10 Build|11.7E /13.9E /13.9E /18L|57.5|18|0|
|11 Race preparation|11.7E /14.4E /14.4E /18L|58.5|18|0|
|12 Recovery|8.45E /10.4E /10.4E /13L|42.25|13|0|
|13 Race preparation|12.135E /14.932E /14.933E /19L|61|19|0|
|14 Race preparation|14.9E /14.9E /14.9E /15L|59.7|15|0|
|15 Taper|9.6E /11.9E /11.9E /6.4E|39.8|—|0|
|16 Race week|6E /6.4E /3.5E /21.098R|15.9|—|0|

### half-q1

Input 45 km/week; recent long16 km; 4 running days. Capacity band **established**. Policy long ceiling 19 km /135 min; calculated target19 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|10.4E /7.5Q /11.1E /16L|45|16|7 × 2 min tempo|
|2 Maintenance|10.4E /7.6Q /11E /16L|45|16|9 × 90 sec tempo|
|3 Build|10.4E /7.5Q /11.942E /16L|45.842|16|7 × 2 min tempo|
|4 Recovery|7.15E /8.8E /8.6E /11L|35.55|11|0|
|5 Build|10.044E /7.6Q /12.356E /16L|46|16|9 × 90 sec tempo|
|6 Build|10.4E /6.8Q /12.8E /16L|46|16|4 × 3 min half-marathon effort|
|7 Build|10.319E /7.5Q /12.681E /18L|48.5|18|5 × 3 min tempo|
|8 Recovery|7.8E /9.6E /9.2E /12L|38.6|12|0|
|9 Build|11.521E /7.3Q /14.179E /18L|51|18|Half-marathon effort pyramid|
|10 Build|11.7E /8Q /14.4E /18L|52.1|18|8 × 2 min tempo|
|11 Race preparation|11.7E /8.2Q /14.4E /18L|52.3|18|Half-marathon effort pyramid|
|12 Recovery|8.45E /10.4E /10.4E /13L|42.25|13|0|
|13 Race preparation|12.194E /8.6Q /15.006E /19L|54.8|19|5 × 4 min tempo|
|14 Race preparation|14.53E /7.7Q /14.964E /15L|52.194|15|4 × 4 min half-marathon effort|
|15 Taper|9.75E /5.9Q /12E /6.475E|34.125|—|2 × 4 min half-marathon effort|
|16 Race week|6E /3.927Q /3.597E /21.098R|13.524|—|3 min half-marathon effort|

### half-q2

Input 65 km/week; recent long18 km; 6 running days. Capacity band **advanced**. Policy long ceiling 23 km /150 min; calculated target21.583 km before whole-km floor. Regeneration exactly matches the saved example.

|Week /phase|Runs in calendar order|Total|Long|Weekday workouts|
|---|---|---:|---:|---|
|1 Foundation|10.247E /8.7Q /11.7E /8.2Q /8.153E /18L|65|18|8 × 2 min tempo; 5 × 3 min half-marathon effort|
|2 Maintenance|10.519E /8.7Q /11.7E /8Q /8.081E /18L|65|18|10 × 90 sec tempo; Half-marathon effort pyramid|
|3 Build|10.318E /8.7Q /11.7E /8.2Q /8.082E /18L|65|18|8 × 2 min tempo; 5 × 3 min half-marathon effort|
|4 Recovery|8.45E /8.45E /6.3E /8.45E /6.3E /13L|50.95|13|0|
|5 Build|11.214E /8.7Q /11.7E /8Q /8.201E /18L|65.815|18|10 × 90 sec tempo; Half-marathon effort pyramid|
|6 Build|11.308E /8.9Q /11.7E /9Q /8.777E /18L|67.685|18|6 × 3 min tempo; Half-marathon effort pyramid|
|7 Build|11.323E /8.7Q /12.488E /9.3Q /8.581E /20L|70.392|20|8 × 2 min tempo; 5 × 4 min half-marathon effort|
|8 Recovery|9.1E /9.1E /7E /9.1E /7E /14L|55.3|14|0|
|9 Build|12.151E /9.3Q /12.465E /9.9Q /9.391E /20L|73.207|20|5 × 4 min tempo; 4 × 6 min half-marathon effort|
|10 Build|13E /9.8Q /13E /9.6Q /10.216E /20L|75.616|20|7 × 600 m tempo; 5 × 800 m half-marathon effort|
|11 Race preparation|12.362E /10.4Q /13E /9.9Q /10.072E /20L|75.734|20|5 × 5 min tempo; 3 × 8 min half-marathon effort|
|12 Recovery|9.75E /9.75E /7.6E /9.75E /7.6E /15L|59.45|15|0|
|13 Race preparation|11.481E /10.4Q /13.65E /10.6Q /9.209E /21L|76.34|21|6 × 800 m tempo; 5 × 1 km half-marathon effort|
|14 Race preparation|12.434E /10Q /9.928E /10.3Q /9.928E /16L|68.59|16|4 × 6 min tempo; Half-marathon effort pyramid|
|15 Taper|9E /8.048Q /8.201E /6.9Q /7.3E /6.475E|45.924|—|5 × 3 min half-marathon effort; 3 × 3 min half-marathon effort|
|16 Race week|5.6E /4.863Q /4.317E /3.597E /2.878E /21.098R|21.255|—|3 min half-marathon effort|

## What passing the prior tests establishes

The tests check constraints that we authored. For example, tests/distinct-long-run-balance.test.mjs:25 explicitly asserts the generated26 kmopening and the5.2/6.4/6.4/8 distribution; :78 checks the authored1.5 km/6%growth ceiling. Those are valuable regression tests once a policy is accepted, but they cannot prove the chosen policy is appropriate. tests/plan-quality-review.test.mjs:11 invokes a separate accounting/role/variety oracle; that improves independence from implementation but still does not compare any of these schedules day-by-day to an external coaching plan.

There is no demonstrated external rationale for exact65/80%role caps, growth multipliers, quality seeding fractions, all-future-week opening clipping, minute-to-whole-km quantisation, or exposure resets. Consistent serialization, correct workout counts and a successful build do not answer those questions. The current acceptance criteria permit the large compounded recovery cuts, the repeated q0 plateaus, and the mixed-taper easy≈long example.

## Conclusion

The explanatory gap is real. Some repetition and long-run holds can be intentional training, but this implementation frequently obtains them as side effects of independent caps and later corrections. The concrete quantisation and progression-reset cases need engineering attention; the remaining authored coaching choices need a selected, independently reviewed source specification before more formula tuning. This audit does not alter them or claim an external schedule has been implemented.
