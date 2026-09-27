# Training Reference — ground truth for plan-generation logic

This file exists because `TRAINING_POLICY` in `lib/engine.ts` shipped 30
revisions (`provisional-2026-09-11-v30`) with `reviewStatus: 'Awaiting
independent coaching review'` — meaning every prior fix was a reaction to a
reported symptom, never checked against an actual published training plan.

**Rule: when `makePlan()`'s output disagrees with this file, the code is
wrong, not this file.** Don't substitute generic training folklore ("10%
rule", "deload every 4 weeks", "3-week taper") for what the specific table
below shows for that specific distance — check the table first.

Sources are named per section. Where sources disagree, that's stated
explicitly — treat it as genuine variance in real coaching practice, not
something to force into a single number.

---

## 5K

**Source: Hal Higdon Intermediate 5K, 8 weeks** (halhigdon.com — one of the
most widely used published plans, millions of users)

```
Wk1: 3mi easy | 5x400        | 3mi easy | rest | 3mi easy | 5mi long
Wk2: 3mi easy | 30min tempo  | 3mi easy | rest | 3mi fast | 5mi long
Wk3: 3mi easy | 6x400        | 3mi easy | rest | 4mi easy | 6mi long
Wk4: 3mi easy | 35min tempo  | 3mi easy | rest | rest     | 5K TIME TRIAL (replaces long run)
Wk5: 3mi easy | 7x400        | 3mi easy | rest | 4mi fast | 6mi long
Wk6: 3mi easy | 40min tempo  | 3mi easy | rest | 5mi easy | 7mi long
Wk7: 3mi easy | 8x400        | 3mi easy | rest | 5mi fast | 7mi long
Wk8: 3mi easy | 30min tempo  | 2mi easy | rest | rest     | RACE
```

**Corroborating sources (no contradictions found):** McMillan Running's 5K
tiers, Nike/Coach Bennett 10K-adjacent structure, ACTIVE.com short-race
plans.

**Properties to match:**
- A quality session (interval or tempo) appears in **every week including
  race week**. No week is easy-runs-plus-long-run only.
- **No full deload/recovery week anywhere in the 8-week block.** The only
  mid-block volume modulation is swapping the long run for a shorter
  time-trial race (week 4) — the Wednesday quality session is untouched.
- Taper is **~1 week**: week 8 drops the long run and shortens one easy
  run, but keeps the Wednesday tempo.
- Long run stays moderate relative to weekly volume — peaks at 7mi against
  a ~18mi week (≈38%), not 70–90%.
- Taper-length consensus across general sources (Mayo Clinic, COROS,
  RunStreet, gneta): 5K taper is **7–10 days**. Unanimous across every
  source checked — no contradictions.

---

## 10K

**Source: Hal Higdon Intermediate 10K, 8 weeks** — same shape as the 5K
table above: quality session every week including race week, no full
deload week.

**Corroborating sources:**
- **McMillan Running** (5 tiers: Novice through Competitive, 8/12/20-week
  variants) — plan description states *"Key/Hard Workouts/Week: 1-2"* as a
  **standing weekly feature**, not a periodic thing.
- **ACTIVE.com, 8-week "Expert 10K" plan** — explicitly uses *"a structured
  two-week taper."* This means, unlike 5K, a **2-week taper is correct for
  10K.**
- **Luke Humphrey Running (Final Surge)** — 8-week 10K plan *"alternates
  between 3 harder workouts one week and two the next to allow for
  recovery from the intensity."* This is the real-world mechanism for
  backing off mid-block: **reduce the number of hard sessions (3→2),
  never drop to zero.**

**Properties to match:**
- Quality session every week, including race week.
- No full deload week.
- Taper: **2 weeks** (differs from 5K — don't collapse the two into one
  constant).
- When volume needs to come down mid-block, reduce quality-session count,
  don't eliminate quality entirely.

---

## Half Marathon

**Source: Hal Higdon Half Marathon Intermediate 1, 12 weeks**
(halhigdon.com)

- Long run grows from 4mi (week 1) to 12mi (week 11).
- Taper: **10–11 days** per Higdon specifically.
- 5 running days/week, taper day count same as training days (frequency
  maintained, volume reduced).

**Corroborating / contrasting sources:**
- Healthline, quoting a coach: *"runners should stick with four-week
  training blocks, upping the mileage each week for three weeks, followed
  by a lower mileage recovery week."*
- Runner's World forum, coaching consensus reply: *"every fourth week, you
  cut back on mileage and intensity."*
- Multiple TrainingPeaks half-marathon plans (Sara Winter et al.), verbatim
  in their own descriptions: *"contains build weeks and cutback or recovery
  weeks."*
- A 16-week half plan source describes a longer taper: weeks 13–14 reduce
  volume 20–30%, week 15 further tapers, week 16 is race week — closer to
  a 2–3 week gradual taper than Higdon's 10–11 days.

**Properties to match:**
- **Periodic cutback/recovery weeks every ~4 weeks ARE standard and
  confirmed practice for this distance** — unlike 5K/10K. This is
  multi-source-confirmed with no contradicting source. **Do not remove or
  gate off recovery weeks for the `half` family.**
- Taper length has genuine variance across coaches: 10–11 days (Higdon) up
  to 2–3 weeks (other published plans). Treat 2–3 weeks as *defensible*,
  not definitively wrong — this is the one distance where source
  disagreement is real, not a sign the code is broken.

---

## Marathon

**Source: Pete Pfitzinger methodology** (Pfitzinger & Douglas, *Advanced
Marathoning* — summarized across multiple secondary sources, consistent
across all of them)

- Typical block length: **12–18 weeks.**
- Weekly mileage progression: **no more than 10% increase per week.**
- Long runs **peak at 20–22 miles (≈32–35km), 2–3 weeks before race day.**
- Total weekly mileage: 40–70+ miles depending on experience level.
- Quality workouts (tempo, threshold, marathon-pace segments in long runs):
  **~2×/week** throughout the build.
- **Recovery weeks are explicitly built in** to prevent burnout — this is
  a named, standard feature of the methodology, not an afterthought.
- Taper: **2–3 weeks.**

**Verdict: the current code already matches this closely** —
`PEAK_LONG_RUN_KM.marathon = {32, 35}` lines up almost exactly with
Pfitzinger's 20–22mi peak, and the existing `recoveryEveryWeeks`/taper
logic for this family is consistent with the reference. **Don't change
marathon-specific logic** unless a change elsewhere breaks it — verify
with a before/after regression check, not by re-deriving marathon logic
from scratch.

---

## Ultra (50K / 50mi / 100K)

**Sources: Marathon Handbook ultra plans, Relentless Forward Commotion
(Hart Strength & Endurance Coaching), Sunrise Run Co 50K/50mi plans**

- Block length: **16–24 weeks.**
- Peak weekly volume: 45–80+ miles depending on target distance.
- Peak long run: **40–45km**, often via back-to-back long-run weekends
  during peak phase.
- **Cutback weeks every 3–4 weeks, reducing volume ~30%** — explicitly
  named and consistent across every ultra source checked.
- Taper: **2–3 weeks**, often staged (e.g. 40% / 60% / 80% volume
  reduction across the final three weeks).

**Verdict: the current code already matches this closely.** Don't change
ultra-specific logic unless a change elsewhere breaks it — verify with a
before/after regression check.

---

## Summary table

| Distance | Real block length | Real taper | Periodic full deload week? | Quality-session gap when backing off |
|---|---|---|---|---|
| 5K | 8 wks | ~1 wk (7–10 days) | **No** | Swap long run for test race; keep quality every week |
| 10K | 8 wks | 2 wks | **No** | Reduce hard-session count (3→2); keep at least 1 |
| Half | 12 wks | 10–11 days *to* 2–3 wks (varies) | **Yes**, ~every 4 wks | Standard cutback week (volume down, structure intact) |
| Marathon | 12–18 wks | 2–3 wks | **Yes**, built in | Standard recovery week |
| Ultra | 16–24 wks | 2–3 wks, staged | **Yes**, every 3–4 wks | Standard cutback (~30% volume reduction) |

The load-bearing conclusion from this table: **5K and 10K are the outliers.**
Every other distance legitimately uses a periodic full recovery/cutback
week; 5K and 10K never do, across five independent sources (Higdon,
McMillan, Nike/Bennett, ACTIVE.com, Luke Humphrey Running) with zero
exceptions found. Any code path that applies the same `recoveryEveryWeeks`
mechanism to all five families is applying a marathon/ultra/half-specific
pattern somewhere it doesn't belong.

---

## Known bugs in the current code, as of this file's writing

See the Codex task brief for full detail and exact line numbers. Summary:

1. `lib/engine.ts` (~line 1485): `recovery` flag fires identically for all
   families. Should be gated off for `5k`/`10k`.
2. `lib/progression-engine.ts`, `mandatoryTaperWeeks` (~line 51): the
   `return 2` fallback covers both `5k` and `10k`. Per the table above,
   10K's 2 weeks is correct; 5K should be 1 week.

## How to keep this file honest

If you change plan-generation logic for any distance, re-check this file
first. If you find real evidence a number here is wrong (a newer edition
of a cited plan, a different well-established coach's published numbers),
update this file *and* cite the new source — don't just change the code
to match a new assumption. This file is only useful as long as every claim
in it traces back to an actual published plan, not to "what sounds right."
