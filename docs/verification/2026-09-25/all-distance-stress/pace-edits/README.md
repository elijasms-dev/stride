# Pace and edit sequence stress audit

```json
{
  "attempted": 200,
  "passed": 174,
  "failed": 0,
  "generationRejected": 26,
  "provedBaselineCapacity": 8,
  "boundedQualityCapacityProbes": 18,
  "capacityRefusals": 52,
  "operations": 1862,
  "prescriptions": 170664,
  "numericPrescriptions": 135312,
  "fitExports": 1862,
  "intervalsExports": 1768,
  "intervalsHrRefusals": 94,
  "completedSnapshots": 19922
}
```

Source: `85aec7eeb474c32a17ccec1a2f99eccac1ba2a6ea5da7f9a05b961b262617e89`.

Reproduce with `node --experimental-strip-types scripts/verify-pace-edit-stress.mjs`; isolate with `--case ID --out /tmp/stride-pace-case`.

- Synthetic engine/serialization/export tests, not live integrations or coaching certification.
- Generation rejections and capacity refusals are reported separately; they are not proofs of viable training.
- Capacity probes accept only named fixtures and reviewed constraint messages; every unlisted generation rejection is a failure. Capacity-compatible slow-benchmark counterparts must complete all edit sequences; the 50K companion uses a 35-minute benchmark because 28 km at the 40-minute benchmark pace cannot fit the supported 300-minute ceiling.
- FIT and Intervals are sampled once per accepted operation, not every session.

- **5k-q1-distance-5k40**: bounded-quality-capacity-probe, generate: Week 9 cannot maintain 50 km within the selected running days, session limits and weekly time ceiling. Review these limits together.
- **5k-q1-time-5k40**: bounded-quality-capacity-probe, generate: Week 9 cannot maintain 50 km within the selected running days, session limits and weekly time ceiling. Review these limits together.
- **5k-q2-distance-5k30**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **5k-q2-distance-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **5k-q2-time-5k30**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **5k-q2-time-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **10k-q2-distance-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **10k-q2-time-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **half-q1-distance-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **half-q1-time-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **half-q2-distance-5k30**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **half-q2-distance-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **half-q2-time-5k30**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **half-q2-time-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together. Easy runs cannot exceed the long run, and quality sessions need bounded warm-up and cooldown time. Review the weekly and longest-run inputs, choose more running days if familiar, or fewer workouts.
- **marathon-q0-distance-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **marathon-q0-time-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **marathon-q1-distance-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **marathon-q1-time-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **marathon-q2-distance-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **marathon-q2-time-5k40**: bounded-quality-capacity-probe, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **ultra-50k-q0-distance-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **ultra-50k-q0-time-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **ultra-50k-q1-distance-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **ultra-50k-q1-time-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **ultra-50k-q2-distance-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
- **ultra-50k-q2-time-5k40**: proved-baseline-capacity, generate: Your starting weekly distance and long-run baseline cannot fit the selected running days, session limits and weekly time ceiling. Review these inputs together.
