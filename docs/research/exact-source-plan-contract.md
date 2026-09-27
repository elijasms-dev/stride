# Exact external schedules

User instruction, 25 September 2026: follow external plans exactly; do not invent prescriptions.

Status: source selection and complete source documents are pending. This is an implementation contract, not a completed migration. The existing adaptive generator still runs. No external programme has been newly copied into the application for this request.

## Required behaviour

- Select one identified published programme and edition for each enrolled plan. Record the author, title, level, source URL/document, retrieval date, version and source-content fingerprint.
- Preserve every source day, including rest, walking, cross-training, optional choices, tune-up races and the goal event. Preserve source durations, distances, units, ranges, repeats, recoveries and effort instructions.
- Preserve the source's total length and weekly sequence. Date assignment must preserve its day pattern. An incompatible race date, availability, starting mileage or requested workout count is a compatibility issue to explain, not permission to shorten, stretch or rewrite the schedule.
- Keep native source quantities authoritative. A miles-to-kilometres display conversion must not round the prescription to a new whole-kilometre target. Display source ranges as ranges; do not quietly choose their midpoint. Missing duration or pace remains unspecified.
- Disable custom volume funding, easy/long percentage caps, added recovery weeks, workout rotation and automatic taper changes for exact-source plans. Published repetitions and equal-distance days remain intact.
- Apply numerical paces only when the selected source supplies a method or explicitly prescribes a corresponding runner-specific pace. Do not turn an effort instruction into a claimed source-prescribed number using Stride's own model.
- Store completion and actual performance separately from the source prescription. Skipping, partial completion and annotations do not rewrite the original plan. A requested prescription change cannot retain an exact-source claim.
- Compare every generated day against an independently reviewed source transcription. Tests must catch omitted days, changed ranges, recovery alterations and modifications during saves, restoration, preference review, measurement changes and exports.

## Current integration boundary

`lib/plan/generate.ts:makePlan` currently calls `validateProfile` before selecting a generator. The existing profile normalizer and standard generation pipeline encode adaptive assumptions. Exact-source enrollment needs its own validation and selection boundary before that normalization.

`lib/plan/types.ts` currently requires numeric duration fields for steps and workouts. An exact source may prescribe distance alone, a range, an optional activity or rest. A lossless source-prescription model must represent those values directly; populating required fields with guessed pace, zero placeholders or fabricated duration would violate this request.

`lib/plan/validate.ts`, `lib/recovery.ts`, `lib/plan/revise.ts`, `lib/plan/variety.ts`, `lib/run-distance.ts` and `lib/workout-targets.ts` need explicit source-plan handling. Source fidelity must also reach rendering, total summaries and export eligibility; an export format limitation must not change the saved original prescription.

## Source availability

The reference list from the previous research is not itself a selected catalogue of exact schedules. The author, level and edition still need to be fixed before transcription and day-by-day verification.

- [NHS website terms](https://www.nhs.uk/our-policies/terms-and-conditions/) describe reuse under the Open Government Licence, subject to stated exceptions and attribution requirements. The existing NHS-style beginner branch contains additional Stride scheduling/progression rules, so it cannot currently be labelled an exact calendar reproduction merely because its lesson recipes match.
- [B.A.A. Half Marathon Level Two](https://www.baa.org/wp-content/uploads/docs/2018-07/2018_BAA_HalfMarathon_Training_Level2.pdf) expressly requires permission for reproduction. Its availability as a research reference does not supply permission to bundle its full schedule.
- Whole schedules to be embedded should come from user-provided source documents, an applicable reuse licence or documented permission. No such complete catalogue has yet been supplied for this migration.

This new requirement supersedes earlier requests to force arbitrary starting mileage, 0/1/2 quality sessions, whole-kilometre long-run steps or increased novelty whenever those changes would contradict the selected external schedule.
