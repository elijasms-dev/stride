# Pace and edit sequence stress audit

```json
{
  "attempted": 200,
  "passed": 176,
  "failed": 0,
  "generationRejected": 24,
  "provedBaselineCapacity": 8,
  "boundedQualityCapacityProbes": 16,
  "capacityRefusals": 43,
  "operations": 1893,
  "prescriptions": 172800,
  "numericPrescriptions": 136546,
  "fitExports": 1893,
  "intervalsExports": 1797,
  "intervalsHrRefusals": 96,
  "completedSnapshots": 20254
}
```

Source: `85f47b3d2ab29f25ec1a23b13e20181c5350bac9c166d950b91367601058eed9`.

Reproduce with `node --experimental-strip-types scripts/verify-pace-edit-stress.mjs`; isolate with `--case ID --out /tmp/stride-pace-case`.

- Synthetic engine/serialization/export tests, not live integrations or coaching certification.
- Generation rejections and capacity refusals are reported separately; they are not proofs of viable training.
- Capacity probes accept only named fixtures and reviewed constraint messages; every unlisted generation rejection is a failure. Capacity-compatible slow-benchmark counterparts must complete all edit sequences; the 50K companion uses a 35-minute benchmark because 28 km at the 40-minute benchmark pace cannot fit the supported 300-minute ceiling.
- FIT and Intervals are sampled once per accepted operation, not every session.

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
