# Foundation and first-race pace stress

{
  "generatedAt": "2026-09-25T08:53:26.642Z",
  "libSha256": "494ba12b882b96c491b4a46e4fa170cd937f078b1e5a97f048b8c9b99886f8dd",
  "cases": 13928,
  "accepted": 13542,
  "correctRejections": 186,
  "failures": 200,
  "totalWeeks": 268924,
  "totalWorkouts": 844610
}

Synthetic software verification, not evidence of an individual's race readiness. Admission expectations are declared before generation; an arbitrary PlanError never counts as success. Covers every start/event weekday, leap-year/DST dates, pace3–15min/km, two baseline-mileage levels, time/distance formats, all127 weekly availability masks, exact cap/midnight boundaries and explicit unsupported requests. The forecast screens are independent recorded Stride policy values, not universal physiological thresholds.

Reproduce: `node --experimental-strip-types scripts/verify-foundation-pace-stress.mjs NEW_RUN_LABEL`. Historical evidence is retained.
